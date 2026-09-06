package api_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"calculator-api/internal/api"
)

const devOrigin = "http://localhost:5173"

func TestCORSAllowsEveryOriginWithAWildcard(t *testing.T) {
	t.Parallel()

	handler := api.NewRouter(api.Options{AllowedOrigins: []string{"*"}})

	recorder := do(t, handler, http.MethodPost, "/api/calculate", `{"operation":"add","a":1,"b":2}`,
		map[string]string{"Origin": "https://any-origin.example"})

	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, "*")
	}
	if recorder.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
}

func TestCORSEchoesAnAllowlistedOrigin(t *testing.T) {
	t.Parallel()

	handler := api.NewRouter(api.Options{AllowedOrigins: []string{devOrigin, "http://localhost:3000"}})

	recorder := do(t, handler, http.MethodPost, "/api/calculate", `{"operation":"add","a":1,"b":2}`,
		map[string]string{"Origin": devOrigin})

	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != devOrigin {
		t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, devOrigin)
	}
	// Caches must not serve one origin's response to another.
	if vary := recorder.Header().Values("Vary"); !contains(vary, "Origin") {
		t.Errorf("Vary = %v, want it to include %q", vary, "Origin")
	}
}

// An origin outside the allowlist is served normally but without the header
// that would let the browser hand the response to the page.
func TestCORSOmitsTheHeaderForADisallowedOrigin(t *testing.T) {
	t.Parallel()

	handler := api.NewRouter(api.Options{AllowedOrigins: []string{devOrigin}})

	recorder := do(t, handler, http.MethodPost, "/api/calculate", `{"operation":"add","a":1,"b":2}`,
		map[string]string{"Origin": "https://evil.example"})

	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q, want it to be absent", got)
	}
	if recorder.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
}

func TestCORSPreflight(t *testing.T) {
	t.Parallel()

	handler := api.NewRouter(api.Options{AllowedOrigins: []string{devOrigin}})

	req := httptest.NewRequest(http.MethodOptions, "/api/calculate", nil)
	req.Header.Set("Origin", devOrigin)
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	req.Header.Set("Access-Control-Request-Headers", "content-type")

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusNoContent)
	}
	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != devOrigin {
		t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, devOrigin)
	}
	if got := recorder.Header().Get("Access-Control-Allow-Methods"); !strings.Contains(got, http.MethodPost) {
		t.Errorf("Access-Control-Allow-Methods = %q, want it to include %q", got, http.MethodPost)
	}
	if got := recorder.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(strings.ToLower(got), "content-type") {
		t.Errorf("Access-Control-Allow-Headers = %q, want it to include %q", got, "Content-Type")
	}
	if got := recorder.Header().Get("Access-Control-Max-Age"); got == "" {
		t.Error("Access-Control-Max-Age is absent, want a cache duration")
	}
	if body := recorder.Body.String(); body != "" {
		t.Errorf("body = %q, want a preflight to have no body", body)
	}
}

// The API has no session, so it must never opt into credentialed requests.
func TestCORSNeverAllowsCredentials(t *testing.T) {
	t.Parallel()

	handler := api.NewRouter(api.Options{AllowedOrigins: []string{"*"}})

	recorder := do(t, handler, http.MethodPost, "/api/calculate", `{"operation":"add","a":1,"b":2}`,
		map[string]string{"Origin": devOrigin})

	if got := recorder.Header().Get("Access-Control-Allow-Credentials"); got != "" {
		t.Errorf("Access-Control-Allow-Credentials = %q, want it to be absent", got)
	}
}

// A request without an Origin header is a same-origin or non-browser call and
// must not receive CORS headers at all.
func TestCORSIgnoresRequestsWithoutAnOrigin(t *testing.T) {
	t.Parallel()

	handler := api.NewRouter(api.Options{AllowedOrigins: []string{"*"}})

	recorder := do(t, handler, http.MethodPost, "/api/calculate", `{"operation":"add","a":1,"b":2}`, nil)

	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q, want it to be absent", got)
	}
}

// CORS headers have to be present on failures too, otherwise the browser hides
// the error payload from the frontend and it can only report "network error".
func TestCORSHeadersArePresentOnErrorResponses(t *testing.T) {
	t.Parallel()

	handler := api.NewRouter(api.Options{AllowedOrigins: []string{devOrigin}})

	recorder := do(t, handler, http.MethodPost, "/api/calculate", `{"operation":"divide","a":1,"b":0}`,
		map[string]string{"Origin": devOrigin})

	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusUnprocessableEntity)
	}
	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != devOrigin {
		t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, devOrigin)
	}
}

func TestCORSCanBeDisabledWithAnEmptyAllowlist(t *testing.T) {
	t.Parallel()

	handler := api.NewRouter(api.Options{AllowedOrigins: nil})

	recorder := do(t, handler, http.MethodPost, "/api/calculate", `{"operation":"add","a":1,"b":2}`,
		map[string]string{"Origin": devOrigin})

	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q, want it to be absent", got)
	}
}

func contains(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}
