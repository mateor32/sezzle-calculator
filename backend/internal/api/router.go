// Package api exposes the calculator over HTTP: routing, request decoding,
// validation, error mapping and the middleware chain. It is the only package
// that knows about net/http, which keeps the arithmetic in the calculator
// package independent of any transport.
package api

import (
	"log/slog"
	"net/http"
)

// Options configures the router.
type Options struct {
	// AllowedOrigins lists the origins accepted by the CORS middleware. A
	// single "*" entry allows every origin; an empty slice disables CORS.
	AllowedOrigins []string
	// Logger receives request and error logs. Defaults to slog.Default().
	Logger *slog.Logger
}

// server holds the dependencies shared by the handlers.
type server struct {
	logger *slog.Logger
}

// NewRouter builds the fully wired HTTP handler for the service.
//
// The middleware chain is ordered outermost first: panic recovery wraps
// everything so that no failure escapes, request logging records the final
// status of every response including the ones produced by CORS, and the CORS
// middleware sits closest to the router so that its headers are present on
// success and error responses alike.
func NewRouter(opts Options) http.Handler {
	logger := opts.Logger
	if logger == nil {
		logger = slog.Default()
	}

	s := &server{logger: logger}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/calculate", allowMethod(http.MethodPost, s.handleCalculate))
	mux.HandleFunc("/api/health", allowMethod(http.MethodGet, s.handleHealth))
	mux.HandleFunc("/", s.handleNotFound)

	return recoverPanics(logger, logRequests(logger, withCORS(opts.AllowedOrigins, mux)))
}
