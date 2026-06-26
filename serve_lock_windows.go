//go:build windows

package main

// acquireServeLock is a no-op on Windows (flock is unix-only). Windows isn't a
// relay host in this deployment; revisit with LockFileEx if that changes.
func acquireServeLock(_ string) (func(), error) {
	return func() {}, nil
}
