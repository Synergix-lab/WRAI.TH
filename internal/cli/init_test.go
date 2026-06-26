package cli

import "testing"

func TestEnsureToolsFull(t *testing.T) {
	cases := []struct {
		in      string
		want    string
		changed bool
	}{
		{"http://localhost:8090/mcp", "http://localhost:8090/mcp?tools=full", true},
		{"http://localhost:8090/mcp?project=demo", "http://localhost:8090/mcp?project=demo&tools=full", true},
		{"http://localhost:8090/mcp?tools=full", "http://localhost:8090/mcp?tools=full", false},
		{"http://localhost:8090/mcp?tools=discovery", "http://localhost:8090/mcp?tools=discovery", false},
	}
	for _, c := range cases {
		got, changed := ensureToolsFull(c.in)
		if got != c.want || changed != c.changed {
			t.Fatalf("ensureToolsFull(%q) = (%q, %v), want (%q, %v)", c.in, got, changed, c.want, c.changed)
		}
	}
}
