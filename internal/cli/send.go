package cli

import (
	"fmt"
	"os"
	"strings"

	"agent-relay/internal/db"
)

func runSend(args []string) {
	project, rest := parseProject(args)

	if len(rest) < 3 {
		fmt.Fprintln(os.Stderr, "usage: agent-relay send [-p project] <from> <to> <message>")
		os.Exit(1)
	}

	from := rest[0]
	to := rest[1]
	content := strings.Join(rest[2:], " ")

	// Derive subject from first few words.
	subject := deriveSubject(content)

	// Detect type: question if ends with "?"
	msgType := "notification"
	if strings.HasSuffix(strings.TrimSpace(content), "?") {
		msgType = "question"
	}

	// Write directly to DB (WAL supports concurrent readers + single writer).
	d := openDBReadWrite()
	defer func() { _ = d.Close() }()

	if from == "" {
		fmt.Fprintln(os.Stderr, "error: 'from' cannot be empty")
		os.Exit(1)
	}
	if from == to {
		fmt.Fprintln(os.Stderr, "error: cannot send message to self")
		os.Exit(1)
	}

	msg, err := d.InsertMessage(project, from, to, msgType, subject, content, "{}", "P2", 3600, nil, nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	// Fan-out to recipients so the message appears in inboxes.
	// Matches the MCP/HTTP API path (see internal/relay/handlers.go HandleSendMessage).
	recipients := resolveRecipients(d, project, from, to)
	if len(recipients) > 0 {
		if err := d.CreateDeliveries(msg.ID, project, recipients); err != nil {
			fmt.Fprintf(os.Stderr, "warning: message stored but delivery failed: %v\n", err)
		}
	}

	fmt.Printf("ok → %s (id:%s)\n", to, msg.ID[:8])
}

// resolveRecipients returns the agents that should receive a delivery.
// Mirrors the fan-out logic in the MCP/HTTP handlers.
func resolveRecipients(d *db.DB, project, from, to string) []string {
	if to == "*" {
		agents, err := d.ListAgents(project)
		if err != nil {
			return nil
		}
		out := make([]string, 0, len(agents))
		for _, a := range agents {
			if a.Name != from && a.Status != "inactive" {
				out = append(out, a.Name)
			}
		}
		return out
	}
	if strings.HasPrefix(to, "team:") {
		// CLI doesn't wire the team roster — leave empty (delivery only for direct sends).
		return nil
	}
	return []string{to}
}

// deriveSubject takes the first ~5 words of a message as a subject line.
func deriveSubject(content string) string {
	words := strings.Fields(content)
	if len(words) <= 5 {
		return content
	}
	return strings.Join(words[:5], " ") + "..."
}
