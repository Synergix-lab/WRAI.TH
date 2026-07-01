package relay

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"agent-relay/internal/config"

	"github.com/mark3labs/mcp-go/mcp"
)

// Federation forwards direct messages between two independent relay instances.
//
// Model (mirrors the same-instance sendCrossProject pattern, extended across the
// network): each relay holds a static registry of trusted peers. A local agent
// addresses a remote recipient as "name@peerlabel"; this relay POSTs the message
// to that peer's /api/federation/inbound, presenting the peer's shared Token. On
// the receiving side the token identifies the origin peer (constant-time match),
// the message is inserted into the local DB via the normal durable path, and the
// recipient picks it up through its unchanged deliveries-based inbox. The sender
// is stamped as "origagent@<receiver's label for us>" so replies route back
// symmetrically. Delivery is pull-based, so no cross-relay push is required.
//
// Federation is off unless at least one valid peer is configured; when off the
// send path and inbound route behave as if the feature did not exist.
type Federation struct {
	peersByLabel map[string]config.FederationPeer
	peers        []config.FederationPeer // preserves order for token matching
	client       *http.Client
}

// fedMessage is the wire payload for a forwarded direct message. SourceRelay is
// intentionally NOT carried here — the receiver derives the origin from the
// presented token, so a peer cannot spoof its identity in the body.
type fedMessage struct {
	From     string `json:"from"`     // origin agent name on the sending relay
	To       string `json:"to"`       // recipient agent name on the receiving relay
	Project  string `json:"project"`  // target project namespace on the receiver
	Type     string `json:"type"`     // message type (default "notification")
	Subject  string `json:"subject"`  // message subject
	Content  string `json:"content"`  // message body (required)
	Priority string `json:"priority"` // P0..P3 (default P2)
	TTL      int    `json:"ttl_seconds"`
	ReplyTo  string `json:"reply_to,omitempty"`
}

// NewFederation builds the peer registry from config. Entries are pre-validated
// by config.Load (label/url/token non-empty); this just indexes them. A nil or
// empty peer list yields a disabled Federation (Enabled() == false).
func NewFederation(peers []config.FederationPeer) *Federation {
	f := &Federation{
		peersByLabel: make(map[string]config.FederationPeer, len(peers)),
		client:       &http.Client{Timeout: 5 * time.Second},
	}
	for _, p := range peers {
		label := strings.ToLower(strings.TrimSpace(p.Label))
		if label == "" || p.URL == "" || p.Token == "" {
			continue
		}
		if _, dup := f.peersByLabel[label]; dup {
			continue // first definition wins; ignore duplicate labels
		}
		f.peersByLabel[label] = p
		f.peers = append(f.peers, p)
	}
	return f
}

// Enabled reports whether any peer is configured.
func (f *Federation) Enabled() bool {
	return f != nil && len(f.peersByLabel) > 0
}

// PeerByLabel resolves an outbound peer by its local alias.
func (f *Federation) PeerByLabel(label string) (config.FederationPeer, bool) {
	if f == nil {
		return config.FederationPeer{}, false
	}
	p, ok := f.peersByLabel[strings.ToLower(strings.TrimSpace(label))]
	return p, ok
}

// PeerByToken resolves the origin peer for an inbound request from its presented
// token, using a constant-time compare against every configured token so the
// match cost does not leak which peer (if any) a token belongs to.
func (f *Federation) PeerByToken(token string) (config.FederationPeer, bool) {
	if f == nil || token == "" {
		return config.FederationPeer{}, false
	}
	tok := []byte(token)
	var match config.FederationPeer
	found := false
	for _, p := range f.peers {
		if subtle.ConstantTimeCompare([]byte(p.Token), tok) == 1 {
			match = p
			found = true
			// no early break: keep the loop's timing independent of position
		}
	}
	return match, found
}

// Forward POSTs a message to a peer relay's inbound route. Best-effort with a
// short timeout; a non-2xx or transport error is returned to the caller so the
// send tool can report the failure rather than silently drop.
func (f *Federation) Forward(ctx context.Context, peer config.FederationPeer, msg fedMessage) error {
	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	url := strings.TrimRight(peer.URL, "/") + "/api/federation/inbound"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Relay-Federation-Token", peer.Token)
	resp, err := f.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("peer %q returned %d", peer.Label, resp.StatusCode)
	}
	return nil
}

// splitPeerAddr splits "name@peerlabel" into (name, label, true). It returns
// false for any address without a single valid "@peer" suffix — broadcast ("*"),
// "team:"/"conversation:" prefixes, or a bare name — so those keep their local
// meaning. An empty name or label is treated as not-a-peer-address.
func splitPeerAddr(to string) (name, label string, ok bool) {
	at := strings.LastIndex(to, "@")
	if at <= 0 || at == len(to)-1 {
		return "", "", false
	}
	if strings.HasPrefix(to, "team:") || strings.HasPrefix(to, "conversation:") {
		return "", "", false
	}
	return to[:at], to[at+1:], true
}

// sendFederated forwards a direct message to an agent on a peer relay. The reply
// path is preserved by the receiver, which stamps the sender as
// "<from>@<its own label for this relay>".
func (h *Handlers) sendFederated(ctx context.Context, project, from, peerLabel, toName, msgType, subject, content, priority string, ttlSeconds int, replyTo *string) (*mcp.CallToolResult, error) {
	peer, ok := h.federation.PeerByLabel(peerLabel)
	if !ok {
		return mcp.NewToolResultError(fmt.Sprintf("unknown peer relay %q — configure it in RELAY_FEDERATION_PEERS", peerLabel)), nil
	}
	targetProject := peer.Project
	if targetProject == "" {
		targetProject = "default"
	}
	fm := fedMessage{
		From:     from,
		To:       strings.ToLower(strings.TrimSpace(toName)),
		Project:  targetProject,
		Type:     msgType,
		Subject:  subject,
		Content:  content,
		Priority: priority,
		TTL:      ttlSeconds,
	}
	if replyTo != nil {
		fm.ReplyTo = *replyTo
	}
	if err := h.federation.Forward(ctx, peer, fm); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("federated send to %q failed: %v", peerLabel, err)), nil
	}
	h.events.Emit(MCPEvent{Type: "message", Action: "federated", Agent: from, Project: project, Target: fmt.Sprintf("%s@%s", fm.To, peerLabel), Label: subject})
	return h.resultJSONTracked(project, from, "send_message", map[string]any{
		"sent": "federated",
		"to":   fmt.Sprintf("%s@%s", fm.To, peerLabel),
		"peer": peerLabel,
	})
}

// apiFederationInbound accepts a forwarded message from a trusted peer relay.
// Auth is the peer's own token (X-Relay-Federation-Token), matched constant-time
// — this route is exempt from the global RELAY_API_KEY check so peers never hold
// the admin key. The message is inserted into the local project via the same
// durable path as every other message and surfaces in the recipient's inbox.
func (r *Relay) apiFederationInbound(w http.ResponseWriter, req *http.Request) {
	if !r.Federation.Enabled() {
		http.Error(w, `{"error":"federation not enabled"}`, http.StatusNotFound)
		return
	}
	peer, ok := r.Federation.PeerByToken(req.Header.Get("X-Relay-Federation-Token"))
	if !ok {
		http.Error(w, `{"error":"unauthorized peer"}`, http.StatusUnauthorized)
		return
	}

	var fm fedMessage
	if err := json.NewDecoder(req.Body).Decode(&fm); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}
	to := strings.ToLower(strings.TrimSpace(fm.To))
	if to == "" || strings.TrimSpace(fm.Content) == "" {
		http.Error(w, `{"error":"'to' and 'content' are required"}`, http.StatusBadRequest)
		return
	}
	project := strings.TrimSpace(fm.Project)
	if project == "" {
		project = "default"
	}

	// The recipient must already exist locally: federation delivers to known
	// agents only, so a compromised/misconfigured peer cannot spray messages to
	// arbitrary phantom names (and auto-create projects) on this relay.
	if agent, _ := r.DB.GetAgent(project, to); agent == nil {
		http.Error(w, `{"error":"recipient not found on this relay"}`, http.StatusNotFound)
		return
	}

	msgType := strings.TrimSpace(fm.Type)
	if msgType == "" {
		msgType = "notification"
	}
	priority := mapPriority(fm.Priority)
	ttl := fm.TTL
	if ttl <= 0 {
		ttl = 14400
	}
	// Sender is qualified with the origin's local label so the recipient can
	// reply straight back with `to: "<from>@<peer.Label>"`.
	fromLabel := fmt.Sprintf("%s@%s", strings.ToLower(strings.TrimSpace(fm.From)), peer.Label)

	meta := map[string]any{
		"source_relay": peer.Label,
		"source_agent": fm.From,
		"federated":    true,
	}
	metaBytes, _ := json.Marshal(meta)

	var replyTo *string
	if s := strings.TrimSpace(fm.ReplyTo); s != "" {
		replyTo = &s
	}

	msg, err := r.DB.InsertMessageWithDeliveries(project, fromLabel, to, msgType, subject(fm.Subject), fm.Content, string(metaBytes), priority, ttl, replyTo, nil, []string{to})
	if err != nil {
		apiError(w, http.StatusInternalServerError, "failed to deliver federated message", err)
		return
	}

	// Best-effort wake-up; the message is already durable if this no-ops.
	r.Registry.Notify(project, to, fromLabel, fm.Subject, msg.ID)
	r.Events.Emit(MCPEvent{Type: "message", Action: "federated_in", Agent: fromLabel, Project: project, Target: to, Label: fm.Subject})

	writeJSON(w, map[string]any{"delivered": true, "message_id": msg.ID})
}

// subject trims a federated subject; kept trivial but centralizes the choice to
// pass it through verbatim (no default) so an empty subject stays empty.
func subject(s string) string { return strings.TrimSpace(s) }
