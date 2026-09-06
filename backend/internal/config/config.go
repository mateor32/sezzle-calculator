// Package config reads the runtime configuration of the service from the
// environment. Every setting has a usable default so that the server starts
// with no configuration at all during development.
package config

import (
	"net"
	"os"
	"strings"
	"time"
)

// Defaults applied when the corresponding environment variable is not set.
const (
	defaultHost           = ""
	defaultPort           = "8080"
	defaultAllowedOrigins = "*"

	defaultReadTimeout     = 5 * time.Second
	defaultWriteTimeout    = 10 * time.Second
	defaultIdleTimeout     = 60 * time.Second
	defaultShutdownTimeout = 10 * time.Second
)

// Config is the resolved configuration of the service.
type Config struct {
	// Addr is the host:port the HTTP server listens on.
	Addr string
	// AllowedOrigins is the CORS allowlist. A single "*" entry allows every
	// origin; an empty slice disables CORS entirely.
	AllowedOrigins []string

	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	IdleTimeout     time.Duration
	ShutdownTimeout time.Duration
}

// Load builds a Config from the environment.
//
// Recognised variables:
//
//	HOST                  interface to bind to        (default: all interfaces)
//	PORT                  port to listen on           (default: 8080)
//	CORS_ALLOWED_ORIGINS  comma separated allowlist    (default: *)
//
// Setting CORS_ALLOWED_ORIGINS to an empty string is meaningful: it turns CORS
// off, which is the right setting when the API is served behind a reverse
// proxy on the same origin as the UI.
func Load() Config {
	return Config{
		Addr:            net.JoinHostPort(lookup("HOST", defaultHost), lookup("PORT", defaultPort)),
		AllowedOrigins:  parseOrigins(lookup("CORS_ALLOWED_ORIGINS", defaultAllowedOrigins)),
		ReadTimeout:     defaultReadTimeout,
		WriteTimeout:    defaultWriteTimeout,
		IdleTimeout:     defaultIdleTimeout,
		ShutdownTimeout: defaultShutdownTimeout,
	}
}

// lookup returns the value of an environment variable, falling back to
// fallback only when the variable is unset. A variable that is set to an empty
// string is honoured as an empty value.
func lookup(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// parseOrigins splits a comma separated allowlist, dropping blank entries.
func parseOrigins(raw string) []string {
	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))

	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	return origins
}
