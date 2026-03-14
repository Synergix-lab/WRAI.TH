package workflow

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// evalCondition evaluates a condition node and returns pass/fail output.
func (e *Engine) evalCondition(node *Node, execData *execContext) (map[string]any, error) {
	switch node.Type {
	case "condition:match":
		return e.evalMatch(node, execData)
	case "condition:switch":
		return e.evalSwitch(node, execData)
	case "condition:cooldown":
		return map[string]any{"passed": true}, nil // TODO: implement cooldown tracking
	case "condition:quota_check":
		return map[string]any{"passed": true}, nil // TODO: implement quota check
	default:
		return nil, fmt.Errorf("unknown condition type: %s", node.Type)
	}
}

// evalMatch checks if a field in trigger meta matches a condition.
func (e *Engine) evalMatch(node *Node, execData *execContext) (map[string]any, error) {
	field := e.configStr(node, "field", execData)
	op, _ := node.Config["op"].(string)
	value := e.configStr(node, "value", execData)

	if field == "" || op == "" {
		return nil, fmt.Errorf("condition:match requires field and op")
	}

	// Get actual value from meta
	actual := execData.Meta[field]

	var passed bool
	switch op {
	case "eq", "==", "equals":
		passed = actual == value
	case "neq", "!=", "not_equals":
		passed = actual != value
	case "contains":
		passed = strings.Contains(actual, value)
	case "gt", ">":
		a, errA := strconv.ParseFloat(actual, 64)
		v, errV := strconv.ParseFloat(value, 64)
		passed = errA == nil && errV == nil && a > v
	case "lt", "<":
		a, errA := strconv.ParseFloat(actual, 64)
		v, errV := strconv.ParseFloat(value, 64)
		passed = errA == nil && errV == nil && a < v
	case "exists":
		_, passed = execData.Meta[field]
	default:
		return nil, fmt.Errorf("unknown op: %s", op)
	}

	return map[string]any{
		"passed": passed,
		"field":  field,
		"actual": actual,
		"op":     op,
		"value":  value,
	}, nil
}

// evalSwitch does multi-branch routing based on field value.
func (e *Engine) evalSwitch(node *Node, execData *execContext) (map[string]any, error) {
	field := e.configStr(node, "field", execData)
	actual := execData.Meta[field]

	casesRaw, ok := node.Config["cases"]
	if !ok {
		return map[string]any{"matched_port": "default", "value": actual}, nil
	}

	// cases should be array of {value, port}
	casesJSON, _ := json.Marshal(casesRaw)
	var cases []struct {
		Value string `json:"value"`
		Port  string `json:"port"`
	}
	if err := json.Unmarshal(casesJSON, &cases); err != nil {
		return map[string]any{"matched_port": "default", "value": actual}, nil
	}

	for _, c := range cases {
		if actual == c.Value {
			return map[string]any{"matched_port": c.Port, "value": actual}, nil
		}
	}

	return map[string]any{"matched_port": "default", "value": actual}, nil
}
