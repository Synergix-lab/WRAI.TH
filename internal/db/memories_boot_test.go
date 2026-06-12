package db

import "testing"

// ListBootMemories must surface global + project-scope memories written by
// OTHER agents (the buildSessionContext regression: ListMemories with
// agentName filtered agent_name on all scopes, hiding shared knowledge).
func TestListBootMemories_CrossScope(t *testing.T) {
	d := testDB(t)

	mustSet := func(agent, key, scope, layer string) {
		t.Helper()
		if _, err := d.SetMemory("proj", agent, key, "v-"+key, "", scope, "", layer); err != nil {
			t.Fatalf("SetMemory(%s): %v", key, err)
		}
	}

	mustSet("cto", "shared-rule", "project", "constraints") // other agent, project scope
	mustSet("cto", "global-fact", "global", "behavior")     // other agent, global scope
	mustSet("fe-2", "my-note", "agent", "context")          // own agent scope
	mustSet("fe-3", "private-note", "agent", "context")     // other agent's private scope

	mems, err := d.ListBootMemories("proj", "fe-2", 50)
	if err != nil {
		t.Fatalf("ListBootMemories: %v", err)
	}

	got := map[string]bool{}
	for _, m := range mems {
		got[m.Key] = true
	}
	for _, want := range []string{"shared-rule", "global-fact", "my-note"} {
		if !got[want] {
			t.Fatalf("boot view missing %q (got %v)", want, got)
		}
	}
	if got["private-note"] {
		t.Fatal("boot view must not include another agent's agent-scope memory")
	}

	// Constraints sort first so budget projection keeps them.
	if len(mems) == 0 || mems[0].Key != "shared-rule" {
		t.Fatalf("constraints memory must sort first, got %q", mems[0].Key)
	}
}
