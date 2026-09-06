package api

import (
	"log/slog"
	"net/http"
	"runtime/debug"
	"strings"
	"time"
)

// allowedMethodsHeader lists the methods advertised during a CORS preflight.
const allowedMethodsHeader = "GET, POST, OPTIONS"

// preflightMaxAgeSeconds tells the browser how long it may cache the result of
// a preflight, which keeps the OPTIONS traffic of a chatty UI down.
const preflightMaxAgeSeconds = "600"

// withCORS answers cross-origin requests from the configured origins, which is
// what lets the development frontend on http://localhost:5173 talk to the API
// on http://localhost:8080.
//
// A single "*" entry allows every origin. Any other list is matched exactly and
// the matching origin is echoed back, together with a Vary header so that
// caches do not serve one origin's response to another. Credentials are never
// allowed, because the API has no notion of a session.
func withCORS(allowedOrigins []string, next http.Handler) http.Handler {
	allowAll := false
	allowed := make(map[string]struct{}, len(allowedOrigins))

	for _, origin := range allowedOrigins {
		origin = strings.TrimSpace(origin)
		switch {
		case origin == "":
			continue
		case origin == "*":
			allowAll = true
		default:
			allowed[strings.ToLower(origin)] = struct{}{}
		}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin != "" {
			_, isAllowed := allowed[strings.ToLower(origin)]
			switch {
			case allowAll:
				w.Header().Set("Access-Control-Allow-Origin", "*")
			case isAllowed:
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}
			w.Header().Add("Vary", "Origin")
		}

		// A preflight is an OPTIONS request carrying Access-Control-Request-
		// Method. It is answered here and never reaches the router.
		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			w.Header().Set("Access-Control-Allow-Methods", allowedMethodsHeader)
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Max-Age", preflightMaxAgeSeconds)
			w.Header().Add("Vary", "Access-Control-Request-Method")
			w.Header().Add("Vary", "Access-Control-Request-Headers")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// logRequests emits one structured line per request with its outcome.
func logRequests(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}

		next.ServeHTTP(recorder, r)

		logger.Info("request handled",
			"method", r.Method,
			"path", r.URL.Path,
			"status", recorder.status,
			"duration_ms", time.Since(start).Milliseconds(),
		)
	})
}

// recoverPanics converts a panic in any downstream handler into a 500 with the
// standard JSON error envelope, so that a bug never takes the process down or
// leaves a client hanging on a closed connection.
func recoverPanics(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			recovered := recover()
			if recovered == nil {
				return
			}
			// net/http uses this sentinel to abort a response on purpose; it
			// must keep propagating to the server.
			if recovered == http.ErrAbortHandler {
				panic(recovered)
			}

			logger.Error("recovered from a panic while handling a request",
				"method", r.Method,
				"path", r.URL.Path,
				"panic", recovered,
				"stack", string(debug.Stack()),
			)
			writeError(w, http.StatusInternalServerError, CodeInternal,
				"an unexpected error occurred", "")
		}()

		next.ServeHTTP(w, r)
	})
}

// statusRecorder remembers the status code written to a response so that the
// logging middleware can report it.
type statusRecorder struct {
	http.ResponseWriter
	status  int
	written bool
}

func (r *statusRecorder) WriteHeader(status int) {
	if !r.written {
		r.status = status
		r.written = true
	}
	r.ResponseWriter.WriteHeader(status)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	// A handler that writes a body without calling WriteHeader implies 200.
	if !r.written {
		r.status = http.StatusOK
		r.written = true
	}
	return r.ResponseWriter.Write(b)
}
