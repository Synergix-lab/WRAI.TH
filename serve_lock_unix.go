//go:build !windows

package main

import (
	"os"
	"syscall"
)

// acquireServeLock takes an exclusive, non-blocking advisory lock on a lockfile
// next to the DB so two relay processes can NEVER serve the same database at
// once — the failure that wiped agents+teams when a second (launchd) relay came
// up on the same SQLite file. Returns a release func, or an error if another
// live relay already holds it (caller should refuse to start). The lock is held
// for the process lifetime and released by the OS if the process dies.
func acquireServeLock(path string) (func(), error) {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0o644)
	if err != nil {
		return nil, err
	}
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		_ = f.Close()
		return nil, err // EWOULDBLOCK → another relay holds it
	}
	return func() {
		_ = syscall.Flock(int(f.Fd()), syscall.LOCK_UN)
		_ = f.Close()
	}, nil
}
