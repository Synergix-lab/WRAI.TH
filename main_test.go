package main

import "testing"

func TestIsLoopbackHost(t *testing.T) {
	cases := map[string]bool{
		"127.0.0.1":    true,
		"localhost":    true,
		"::1":          true,
		"[::1]":        true,
		"127.0.0.5":    true, // whole 127/8 is loopback
		"0.0.0.0":      false,
		"192.168.1.10": false,
		"10.0.0.1":     false,
		"example.com":  false,
	}
	for host, want := range cases {
		if got := isLoopbackHost(host); got != want {
			t.Errorf("isLoopbackHost(%q) = %v, want %v", host, got, want)
		}
	}
}
