package relay

import (
	"crypto/subtle"
	"net"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// authMiddleware rejects requests without a valid Bearer token.
// If apiKey is empty, all requests pass through (local-mode).
func authMiddleware(apiKey string, next http.Handler) http.Handler {
	if apiKey == "" {
		return next
	}
	expected := []byte(apiKey)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("Authorization")
		const prefix = "Bearer "
		if len(token) > len(prefix) && token[:len(prefix)] == prefix {
			token = token[len(prefix):]
		} else {
			token = ""
		}
		if subtle.ConstantTimeCompare([]byte(token), expected) != 1 {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// bodySizeLimitMiddleware wraps request bodies with http.MaxBytesReader.
func bodySizeLimitMiddleware(maxBytes int64, next http.Handler) http.Handler {
	if maxBytes <= 0 {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
		next.ServeHTTP(w, r)
	})
}

// rateLimitMiddleware limits requests per IP using a token bucket.
// If reqPerMin is 0, all requests pass through.
func rateLimitMiddleware(reqPerMin int, next http.Handler) http.Handler {
	if reqPerMin <= 0 {
		return next
	}

	type visitor struct {
		limiter  *rate.Limiter
		lastSeen time.Time
	}
	var mu sync.Mutex
	visitors := make(map[string]*visitor)

	// Cleanup stale entries every 10 minutes.
	go func() {
		for {
			time.Sleep(10 * time.Minute)
			mu.Lock()
			for ip, v := range visitors {
				if time.Since(v.lastSeen) > 15*time.Minute {
					delete(visitors, ip)
				}
			}
			mu.Unlock()
		}
	}()

	perSecond := rate.Limit(float64(reqPerMin) / 60.0)
	burst := reqPerMin // allow bursting up to the full per-minute quota

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip, _, _ := net.SplitHostPort(r.RemoteAddr)
		if ip == "" {
			ip = r.RemoteAddr
		}

		mu.Lock()
		v, ok := visitors[ip]
		if !ok {
			v = &visitor{limiter: rate.NewLimiter(perSecond, burst)}
			visitors[ip] = v
		}
		v.lastSeen = time.Now()
		mu.Unlock()

		if !v.limiter.Allow() {
			w.Header().Set("Retry-After", "60")
			http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// corsMiddleware sets CORS headers for the configured origins.
// If origins is empty, no CORS headers are added (same-origin by default).
func corsMiddleware(origins []string, next http.Handler) http.Handler {
	if len(origins) == 0 {
		return next
	}
	allowAll := len(origins) == 1 && origins[0] == "*"

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}

		allowed := allowAll
		if !allowed {
			for _, o := range origins {
				if o == origin {
					allowed = true
					break
				}
			}
		}
		if !allowed {
			next.ServeHTTP(w, r)
			return
		}

		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
