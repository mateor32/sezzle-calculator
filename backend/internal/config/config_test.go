package config_test

import (
	"os"
	"testing"

	"calculator-api/internal/config"
)

func TestLoadDefaults(t *testing.T) {
	// t.Setenv cannot be combined with t.Parallel, so these tests run serially.
	// Calling it before os.Unsetenv registers the cleanup that restores the
	// original value once the test is over.
	for _, key := range []string{"HOST", "PORT", "CORS_ALLOWED_ORIGINS"} {
		t.Setenv(key, "")
		if err := os.Unsetenv(key); err != nil {
			t.Fatalf("could not unset %s: %v", key, err)
		}
	}

	cfg := config.Load()

	if cfg.Addr != ":8080" {
		t.Errorf("Addr = %q, want %q", cfg.Addr, ":8080")
	}
	if len(cfg.AllowedOrigins) != 1 || cfg.AllowedOrigins[0] != "*" {
		t.Errorf("AllowedOrigins = %v, want [*]", cfg.AllowedOrigins)
	}
	if cfg.ReadTimeout <= 0 || cfg.WriteTimeout <= 0 || cfg.IdleTimeout <= 0 || cfg.ShutdownTimeout <= 0 {
		t.Errorf("every timeout must be positive, got %+v", cfg)
	}
}

func TestLoadReadsHostAndPort(t *testing.T) {
	t.Setenv("HOST", "127.0.0.1")
	t.Setenv("PORT", "9000")

	if got := config.Load().Addr; got != "127.0.0.1:9000" {
		t.Errorf("Addr = %q, want %q", got, "127.0.0.1:9000")
	}
}

func TestLoadParsesAllowedOrigins(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want []string
	}{
		{"single origin", "http://localhost:5173", []string{"http://localhost:5173"}},
		{
			"several origins",
			"http://localhost:5173,http://localhost:3000",
			[]string{"http://localhost:5173", "http://localhost:3000"},
		},
		{
			"surrounding whitespace is trimmed",
			" http://localhost:5173 , http://localhost:3000 ",
			[]string{"http://localhost:5173", "http://localhost:3000"},
		},
		{"blank entries are dropped", "http://localhost:5173,,", []string{"http://localhost:5173"}},
		{"wildcard", "*", []string{"*"}},
		{"an empty value disables CORS", "", nil},
		{"a value of only separators disables CORS", " , ", nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("CORS_ALLOWED_ORIGINS", tt.raw)

			got := config.Load().AllowedOrigins
			if len(got) != len(tt.want) {
				t.Fatalf("AllowedOrigins = %v, want %v", got, tt.want)
			}
			for i := range tt.want {
				if got[i] != tt.want[i] {
					t.Fatalf("AllowedOrigins = %v, want %v", got, tt.want)
				}
			}
		})
	}
}
