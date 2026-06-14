package cli

import (
	"archive/tar"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
)

func writeTarGz(t *testing.T, path, entry string, content []byte) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = f.Close() }()
	gz := gzip.NewWriter(f)
	tw := tar.NewWriter(gz)
	_ = tw.WriteHeader(&tar.Header{Name: entry, Mode: 0o755, Size: int64(len(content)), Typeflag: tar.TypeReg})
	_, _ = tw.Write(content)
	_ = tw.Close()
	_ = gz.Close()
}

func TestExtractTarGz(t *testing.T) {
	dir := t.TempDir()
	arc := filepath.Join(dir, "agent-relay-linux-amd64.tar.gz")
	writeTarGz(t, arc, "agent-relay", []byte("#!/bin/true\n"))

	if err := extractArchive(arc, dir); err != nil {
		t.Fatalf("extract: %v", err)
	}
	got, err := os.ReadFile(filepath.Join(dir, "agent-relay"))
	if err != nil {
		t.Fatalf("extracted binary missing: %v", err)
	}
	if string(got) != "#!/bin/true\n" {
		t.Fatalf("bad content: %q", got)
	}
}

func TestVerifyChecksum(t *testing.T) {
	dir := t.TempDir()
	arc := filepath.Join(dir, "agent-relay-linux-amd64.tar.gz")
	if err := os.WriteFile(arc, []byte("payload"), 0o644); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256([]byte("payload"))
	sumsPath := filepath.Join(dir, "SHA256SUMS")
	line := hex.EncodeToString(sum[:]) + "  agent-relay-linux-amd64.tar.gz\n"
	if err := os.WriteFile(sumsPath, []byte("deadbeef  other.tar.gz\n"+line), 0o644); err != nil {
		t.Fatal(err)
	}

	ok, err := verifyChecksum(arc, "agent-relay-linux-amd64.tar.gz", sumsPath)
	if err != nil || !ok {
		t.Fatalf("valid checksum rejected: ok=%v err=%v", ok, err)
	}

	// Tamper the archive → must fail.
	if err := os.WriteFile(arc, []byte("payload-TAMPERED"), 0o644); err != nil {
		t.Fatal(err)
	}
	ok, err = verifyChecksum(arc, "agent-relay-linux-amd64.tar.gz", sumsPath)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if ok {
		t.Fatal("tampered archive passed checksum verification")
	}

	// Missing entry → error.
	if _, err := verifyChecksum(arc, "nonexistent.tar.gz", sumsPath); err == nil {
		t.Fatal("expected error for missing checksum entry")
	}
}
