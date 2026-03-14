package workflow

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"text/template"
	"time"

	"agent-relay/internal/db"
	"agent-relay/internal/spawn"
)

// Node represents a single node in the workflow DAG.
type Node struct {
	ID     string         `json:"id"`
	Type   string         `json:"type"` // e.g. "trigger:event", "condition:match", "action:spawn"
	Label  string         `json:"label"`
	Config map[string]any `json:"config"` // type-specific configuration
	X      float64        `json:"x"`      // visual position
	Y      float64        `json:"y"`      // visual position
}

// Edge represents a connection between two nodes.
type Edge struct {
	Source     string `json:"source"`
	Target     string `json:"target"`
	SourcePort string `json:"sourcePort,omitempty"`
	TargetPort string `json:"targetPort,omitempty"`
}

// Engine executes workflow DAGs.
type Engine struct {
	db       *db.DB
	spawnMgr *spawn.Manager
	msgFunc  func(project, from, to, msgType, subject, content string) error // for action:message
	taskFunc func(project, profile, title, desc string) (string, error)      // for action:task
	logger   *log.Logger
}

// NewEngine creates a workflow engine.
func NewEngine(database *db.DB, spawnMgr *spawn.Manager) *Engine {
	return &Engine{
		db:       database,
		spawnMgr: spawnMgr,
		logger:   log.Default(),
	}
}

// SetMessageFunc sets the function used by action:message nodes.
func (e *Engine) SetMessageFunc(fn func(project, from, to, msgType, subject, content string) error) {
	e.msgFunc = fn
}

// SetTaskFunc sets the function used by action:task nodes.
func (e *Engine) SetTaskFunc(fn func(project, profile, title, desc string) (string, error)) {
	e.taskFunc = fn
}

// Execute runs a workflow with the given trigger metadata.
func (e *Engine) Execute(ctx context.Context, wf *db.Workflow, triggerEvent string, triggerMeta map[string]string) (*db.WorkflowRun, error) {
	// Parse nodes and edges from workflow JSON
	var nodes []Node
	var edges []Edge
	if err := json.Unmarshal([]byte(wf.Nodes), &nodes); err != nil {
		return nil, fmt.Errorf("parse nodes: %w", err)
	}
	if err := json.Unmarshal([]byte(wf.Edges), &edges); err != nil {
		return nil, fmt.Errorf("parse edges: %w", err)
	}

	// Create workflow run
	metaJSON, _ := json.Marshal(triggerMeta)
	run, err := e.db.CreateWorkflowRun(wf.ID, wf.Project, triggerEvent, string(metaJSON))
	if err != nil {
		return nil, fmt.Errorf("create run: %w", err)
	}

	// Build adjacency list and node map
	nodeMap := make(map[string]*Node, len(nodes))
	children := make(map[string][]string) // nodeID -> downstream nodeIDs
	parents := make(map[string][]string)  // nodeID -> upstream nodeIDs
	for i := range nodes {
		nodeMap[nodes[i].ID] = &nodes[i]
	}
	for _, edge := range edges {
		children[edge.Source] = append(children[edge.Source], edge.Target)
		parents[edge.Target] = append(parents[edge.Target], edge.Source)
	}

	// Find trigger node (entry point)
	var triggerNode *Node
	for _, n := range nodes {
		if strings.HasPrefix(n.Type, "trigger:") {
			triggerNode = nodeMap[n.ID]
			break
		}
	}
	if triggerNode == nil {
		e.db.FinishWorkflowRun(run.ID, "failed", "no trigger node found")
		return run, fmt.Errorf("no trigger node found")
	}

	// Execution context: stores node outputs for template resolution
	execData := &execContext{
		Event:       triggerEvent,
		Meta:        triggerMeta,
		NodeOutputs: make(map[string]map[string]any),
		mu:          sync.RWMutex{},
	}

	// BFS execution from trigger node
	err = e.executeBFS(ctx, run, triggerNode.ID, nodeMap, children, parents, wf.Project, execData)

	if err != nil {
		e.db.FinishWorkflowRun(run.ID, "failed", err.Error())
	} else {
		e.db.FinishWorkflowRun(run.ID, "completed", "")
	}

	return run, err
}

type execContext struct {
	Event       string
	Meta        map[string]string
	NodeOutputs map[string]map[string]any
	mu          sync.RWMutex
}

// executeBFS runs nodes in topological order (BFS from startID).
func (e *Engine) executeBFS(ctx context.Context, run *db.WorkflowRun, startID string, nodeMap map[string]*Node, children, parents map[string][]string, project string, execData *execContext) error {
	// Track completed nodes
	completed := make(map[string]bool)
	failed := make(map[string]bool)

	// Queue starts with trigger node
	queue := []string{startID}
	completed[startID] = true // trigger node is auto-completed

	// Create and complete trigger node run
	triggerNR, _ := e.db.CreateNodeRun(run.ID, startID, nodeMap[startID].Type)
	if triggerNR != nil {
		metaJSON, _ := json.Marshal(execData.Meta)
		e.db.UpdateNodeRun(triggerNR.ID, "completed", string(metaJSON), "")
		execData.mu.Lock()
		execData.NodeOutputs[startID] = map[string]any{"event": execData.Event, "meta": execData.Meta}
		execData.mu.Unlock()
	}

	// Process downstream nodes
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		downstream := children[current]
		if len(downstream) == 0 {
			continue
		}

		// Fan-out: execute downstream nodes that have all parents completed
		var wg sync.WaitGroup
		var mu sync.Mutex
		var firstErr error

		for _, nextID := range downstream {
			// Check all parents are completed
			allDone := true
			for _, pid := range parents[nextID] {
				if !completed[pid] {
					allDone = false
					break
				}
			}
			if !allDone {
				continue
			}

			node := nodeMap[nextID]
			if node == nil {
				continue
			}

			wg.Add(1)
			go func(nid string, n *Node) {
				defer wg.Done()

				// Create node run
				nr, err := e.db.CreateNodeRun(run.ID, nid, n.Type)
				if err != nil {
					mu.Lock()
					if firstErr == nil {
						firstErr = err
					}
					failed[nid] = true
					mu.Unlock()
					return
				}

				// Execute the node
				e.db.UpdateNodeRun(nr.ID, "running", "", "")
				output, err := e.executeNode(ctx, project, n, execData)

				if err != nil {
					e.db.UpdateNodeRun(nr.ID, "failed", "{}", err.Error())
					mu.Lock()
					if firstErr == nil {
						firstErr = err
					}
					failed[nid] = true
					mu.Unlock()
					return
				}

				// Store output
				outputJSON, _ := json.Marshal(output)
				e.db.UpdateNodeRun(nr.ID, "completed", string(outputJSON), "")

				execData.mu.Lock()
				execData.NodeOutputs[nid] = output
				execData.mu.Unlock()

				mu.Lock()
				completed[nid] = true
				queue = append(queue, nid)
				mu.Unlock()
			}(nextID, node)
		}
		wg.Wait()

		if firstErr != nil {
			return firstErr
		}
	}
	return nil
}

// executeNode dispatches to the appropriate handler based on node type.
func (e *Engine) executeNode(ctx context.Context, project string, node *Node, execData *execContext) (map[string]any, error) {
	switch {
	case strings.HasPrefix(node.Type, "condition:"):
		return e.evalCondition(node, execData)
	case strings.HasPrefix(node.Type, "action:"):
		return e.execAction(ctx, project, node, execData)
	default:
		return nil, fmt.Errorf("unknown node type: %s", node.Type)
	}
}

// resolveTemplate resolves {{.meta.KEY}} and {{.node.NODEID.output.KEY}} placeholders.
func (e *Engine) resolveTemplate(tmplStr string, execData *execContext) string {
	if !strings.Contains(tmplStr, "{{") {
		return tmplStr
	}

	// Build template data
	data := map[string]any{
		"event": execData.Event,
		"meta":  execData.Meta,
		"node":  execData.NodeOutputs,
	}

	t, err := template.New("").Parse(tmplStr)
	if err != nil {
		return tmplStr
	}

	var buf strings.Builder
	if err := t.Execute(&buf, data); err != nil {
		return tmplStr
	}
	return buf.String()
}

// configStr gets a string config value, resolving templates.
func (e *Engine) configStr(node *Node, key string, execData *execContext) string {
	v, ok := node.Config[key]
	if !ok {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return fmt.Sprintf("%v", v)
	}
	return e.resolveTemplate(s, execData)
}

// FireWorkflows checks all enabled workflows in a project for matching trigger:event nodes.
func (e *Engine) FireWorkflows(project, event string, meta map[string]string) {
	workflows, err := e.db.ListWorkflows(project)
	if err != nil || len(workflows) == 0 {
		return
	}

	for _, wf := range workflows {
		if !wf.Enabled {
			continue
		}

		var nodes []Node
		if err := json.Unmarshal([]byte(wf.Nodes), &nodes); err != nil {
			continue
		}

		// Check if workflow has a trigger:event node matching this event
		for _, n := range nodes {
			if n.Type == "trigger:event" {
				cfgEvent, _ := n.Config["event"].(string)
				if cfgEvent == event || cfgEvent == "*" {
					// Check match_rules if present
					if rules, ok := n.Config["match_rules"].(string); ok && rules != "" && rules != "{}" {
						rulesMap := make(map[string]string)
						if err := json.Unmarshal([]byte(rules), &rulesMap); err == nil {
							match := true
							for k, v := range rulesMap {
								if meta[k] != v {
									match = false
									break
								}
							}
							if !match {
								continue
							}
						}
					}

					// Execute workflow in background
					go func(w db.Workflow) {
						ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
						defer cancel()
						if _, err := e.Execute(ctx, &w, event, meta); err != nil {
							e.logger.Printf("[workflow] execute %s failed: %v", w.ID, err)
						}
					}(wf)
					break
				}
			}
		}
	}
}
