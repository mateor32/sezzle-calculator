package api_test

import (
	"encoding/json"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"calculator-api/internal/api"
)

const tolerance = 1e-9

// newTestServer builds a router with CORS open to every origin, which is the
// default configuration of the service.
func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	return api.NewRouter(api.Options{AllowedOrigins: []string{"*"}})
}

// do sends a request through the router and returns the recorded response.
func do(t *testing.T, handler http.Handler, method, target, body string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()

	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}

	req := httptest.NewRequest(method, target, reader)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	return recorder
}

// decodeSuccess asserts a 200 response and returns the decoded payload.
func decodeSuccess(t *testing.T, recorder *httptest.ResponseRecorder) api.CalculateResponse {
	t.Helper()

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d (body: %s)", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "application/json") {
		t.Errorf("Content-Type = %q, want an application/json value", contentType)
	}

	var payload api.CalculateResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("could not decode the success body %q: %v", recorder.Body.String(), err)
	}
	return payload
}

// decodeError asserts the expected status and returns the decoded error detail.
func decodeError(t *testing.T, recorder *httptest.ResponseRecorder, wantStatus int) api.ErrorDetail {
	t.Helper()

	if recorder.Code != wantStatus {
		t.Fatalf("status = %d, want %d (body: %s)", recorder.Code, wantStatus, recorder.Body.String())
	}

	var payload api.ErrorResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("could not decode the error body %q: %v", recorder.Body.String(), err)
	}
	if payload.Error.Code == "" {
		t.Errorf("error body %q is missing a code", recorder.Body.String())
	}
	if payload.Error.Message == "" {
		t.Errorf("error body %q is missing a message", recorder.Body.String())
	}
	return payload.Error
}

func TestCalculateSuccess(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		body       string
		wantResult float64
		wantB      *float64
	}{
		{"addition", `{"operation":"add","a":2,"b":3}`, 5, ptr(3)},
		{"subtraction", `{"operation":"subtract","a":10,"b":4}`, 6, ptr(4)},
		{"multiplication", `{"operation":"multiply","a":7,"b":6}`, 42, ptr(6)},
		{"division", `{"operation":"divide","a":10,"b":4}`, 2.5, ptr(4)},
		{"exponentiation", `{"operation":"power","a":2,"b":10}`, 1024, ptr(10)},
		{"square root without b", `{"operation":"sqrt","a":9}`, 3, nil},
		{"percentage", `{"operation":"percentage","a":200,"b":10}`, 20, ptr(10)},
		{"negative operands", `{"operation":"add","a":-2.5,"b":-3.5}`, -6, ptr(-3.5)},
		{"operation name is case insensitive", `{"operation":"ADD","a":1,"b":1}`, 2, ptr(1)},
		{"a stale b is ignored by a unary operation", `{"operation":"sqrt","a":16,"b":99}`, 4, nil},
		{"zero operands are honoured", `{"operation":"add","a":0,"b":0}`, 0, ptr(0)},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			payload := decodeSuccess(t, do(t, newTestServer(t), http.MethodPost, "/api/calculate", tt.body, nil))

			if math.Abs(payload.Result-tt.wantResult) > tolerance {
				t.Errorf("result = %v, want %v", payload.Result, tt.wantResult)
			}
			switch {
			case tt.wantB == nil && payload.B != nil:
				t.Errorf("b = %v, want it to be omitted", *payload.B)
			case tt.wantB != nil && payload.B == nil:
				t.Errorf("b was omitted, want %v", *tt.wantB)
			case tt.wantB != nil && math.Abs(*payload.B-*tt.wantB) > tolerance:
				t.Errorf("b = %v, want %v", *payload.B, *tt.wantB)
			}
		})
	}
}

// The response must echo the resolved operation in its canonical lower-case
// form, whatever casing the client used.
func TestCalculateEchoesTheCanonicalOperation(t *testing.T) {
	t.Parallel()

	payload := decodeSuccess(t, do(t, newTestServer(t), http.MethodPost, "/api/calculate",
		`{"operation":"  Divide ","a":9,"b":2}`, nil))

	if payload.Operation != "divide" {
		t.Errorf("operation = %q, want %q", payload.Operation, "divide")
	}
	if payload.A != 9 {
		t.Errorf("a = %v, want 9", payload.A)
	}
	if payload.Result != 4.5 {
		t.Errorf("result = %v, want 4.5", payload.Result)
	}
}

func TestCalculateValidationErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		body      string
		wantCode  string
		wantField string
	}{
		{"missing operation", `{"a":1,"b":2}`, api.CodeValidation, "operation"},
		{"blank operation", `{"operation":"   ","a":1,"b":2}`, api.CodeValidation, "operation"},
		{"unsupported operation", `{"operation":"modulo","a":1,"b":2}`, api.CodeUnknownOperation, "operation"},
		{"missing a", `{"operation":"add","b":2}`, api.CodeValidation, "a"},
		{"missing b", `{"operation":"add","a":2}`, api.CodeValidation, "b"},
		{"missing b for percentage", `{"operation":"percentage","a":200}`, api.CodeValidation, "b"},
		{"missing a for sqrt", `{"operation":"sqrt"}`, api.CodeValidation, "a"},
		{"a is a string", `{"operation":"add","a":"one","b":2}`, api.CodeValidation, "a"},
		{"b is a boolean", `{"operation":"add","a":1,"b":true}`, api.CodeValidation, "b"},
		{"a is null", `{"operation":"add","a":null,"b":2}`, api.CodeValidation, "a"},
		{"operation is a number", `{"operation":5,"a":1,"b":2}`, api.CodeValidation, "operation"},
		{"a is out of the float64 range", `{"operation":"add","a":1e400,"b":2}`, api.CodeValidation, "a"},
		{"unknown field", `{"operation":"add","a":1,"b":2,"c":3}`, api.CodeValidation, "c"},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			detail := decodeError(t, do(t, newTestServer(t), http.MethodPost, "/api/calculate", tt.body, nil), http.StatusBadRequest)

			if detail.Code != tt.wantCode {
				t.Errorf("code = %q, want %q (message: %s)", detail.Code, tt.wantCode, detail.Message)
			}
			if detail.Field != tt.wantField {
				t.Errorf("field = %q, want %q (message: %s)", detail.Field, tt.wantField, detail.Message)
			}
		})
	}
}

func TestCalculateMalformedBodies(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		body     string
		wantCode string
	}{
		{"empty body", ``, api.CodeInvalidJSON},
		{"not JSON at all", `hello`, api.CodeInvalidJSON},
		{"truncated object", `{"operation":"add","a":1`, api.CodeInvalidJSON},
		{"top level array", `[1,2,3]`, api.CodeInvalidJSON},
		{"top level string", `"add"`, api.CodeInvalidJSON},
		{"two JSON objects", `{"operation":"add","a":1,"b":2}{"operation":"add","a":1,"b":2}`, api.CodeInvalidJSON},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			// The empty body case cannot go through the helper's body check,
			// so the request is built with an explicit Content-Type header.
			recorder := do(t, newTestServer(t), http.MethodPost, "/api/calculate", tt.body,
				map[string]string{"Content-Type": "application/json"})

			detail := decodeError(t, recorder, http.StatusBadRequest)
			if detail.Code != tt.wantCode {
				t.Errorf("code = %q, want %q (message: %s)", detail.Code, tt.wantCode, detail.Message)
			}
		})
	}
}

// Requests that are well formed but have no representable answer are reported
// as 422 rather than 400: the server understood the request, the mathematics
// simply does not work out.
func TestCalculateUnprocessableResults(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		body      string
		wantCode  string
		wantField string
	}{
		{"division by zero", `{"operation":"divide","a":10,"b":0}`, api.CodeDivisionByZero, "b"},
		{"zero divided by zero", `{"operation":"divide","a":0,"b":0}`, api.CodeDivisionByZero, "b"},
		{"square root of a negative number", `{"operation":"sqrt","a":-9}`, api.CodeNegativeSquareRoot, "a"},
		{"addition overflow", `{"operation":"add","a":1.7976931348623157e308,"b":1.7976931348623157e308}`, api.CodeOverflow, ""},
		{"power overflow", `{"operation":"power","a":10,"b":400}`, api.CodeOverflow, ""},
		{"undefined power", `{"operation":"power","a":-8,"b":0.5}`, api.CodeUndefinedResult, ""},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			detail := decodeError(t, do(t, newTestServer(t), http.MethodPost, "/api/calculate", tt.body, nil),
				http.StatusUnprocessableEntity)

			if detail.Code != tt.wantCode {
				t.Errorf("code = %q, want %q (message: %s)", detail.Code, tt.wantCode, detail.Message)
			}
			if detail.Field != tt.wantField {
				t.Errorf("field = %q, want %q", detail.Field, tt.wantField)
			}
		})
	}
}

func TestCalculateRejectsANonJSONContentType(t *testing.T) {
	t.Parallel()

	recorder := do(t, newTestServer(t), http.MethodPost, "/api/calculate", `{"operation":"add","a":1,"b":2}`,
		map[string]string{"Content-Type": "text/plain"})

	detail := decodeError(t, recorder, http.StatusUnsupportedMediaType)
	if detail.Code != api.CodeUnsupportedMedia {
		t.Errorf("code = %q, want %q", detail.Code, api.CodeUnsupportedMedia)
	}
}

// A charset parameter is part of a perfectly valid JSON content type.
func TestCalculateAcceptsAContentTypeWithCharset(t *testing.T) {
	t.Parallel()

	recorder := do(t, newTestServer(t), http.MethodPost, "/api/calculate", `{"operation":"add","a":1,"b":2}`,
		map[string]string{"Content-Type": "application/json; charset=utf-8"})

	if payload := decodeSuccess(t, recorder); payload.Result != 3 {
		t.Errorf("result = %v, want 3", payload.Result)
	}
}

func TestCalculateRejectsAnOversizedBody(t *testing.T) {
	t.Parallel()

	// A body well past the 4 KiB ceiling enforced by the handler.
	body := `{"operation":"add","a":1,"b":2,"padding":"` + strings.Repeat("x", 8<<10) + `"}`

	detail := decodeError(t, do(t, newTestServer(t), http.MethodPost, "/api/calculate", body, nil),
		http.StatusRequestEntityTooLarge)

	if detail.Code != api.CodePayloadTooLarge {
		t.Errorf("code = %q, want %q", detail.Code, api.CodePayloadTooLarge)
	}
}

func TestRoutingRejectsTheWrongMethod(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		method    string
		target    string
		wantAllow string
	}{
		{"GET on calculate", http.MethodGet, "/api/calculate", "POST, OPTIONS"},
		{"PUT on calculate", http.MethodPut, "/api/calculate", "POST, OPTIONS"},
		{"DELETE on calculate", http.MethodDelete, "/api/calculate", "POST, OPTIONS"},
		{"HEAD on calculate", http.MethodHead, "/api/calculate", "POST, OPTIONS"},
		{"POST on health", http.MethodPost, "/api/health", "GET, HEAD, OPTIONS"},
		{"DELETE on health", http.MethodDelete, "/api/health", "GET, HEAD, OPTIONS"},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			recorder := do(t, newTestServer(t), tt.method, tt.target, "", nil)

			detail := decodeError(t, recorder, http.StatusMethodNotAllowed)
			if detail.Code != api.CodeMethodNotAllowed {
				t.Errorf("code = %q, want %q", detail.Code, api.CodeMethodNotAllowed)
			}
			if allow := recorder.Header().Get("Allow"); allow != tt.wantAllow {
				t.Errorf("Allow = %q, want %q", allow, tt.wantAllow)
			}
		})
	}
}

func TestRoutingUnknownPath(t *testing.T) {
	t.Parallel()

	for _, target := range []string{"/", "/api", "/api/calculate/extra", "/does-not-exist"} {
		target := target
		t.Run(target, func(t *testing.T) {
			t.Parallel()

			detail := decodeError(t, do(t, newTestServer(t), http.MethodGet, target, "", nil), http.StatusNotFound)
			if detail.Code != api.CodeNotFound {
				t.Errorf("code = %q, want %q", detail.Code, api.CodeNotFound)
			}
		})
	}
}

func TestHealth(t *testing.T) {
	t.Parallel()

	recorder := do(t, newTestServer(t), http.MethodGet, "/api/health", "", nil)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}

	var payload api.HealthResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("could not decode the body %q: %v", recorder.Body.String(), err)
	}
	if payload.Status != "ok" {
		t.Errorf("status = %q, want %q", payload.Status, "ok")
	}
}

// HTTP defines HEAD as identical to GET without a body, and container health
// checks depend on it: `wget --spider` sends HEAD, so a GET-only health
// endpoint reports a perfectly healthy service as down.
func TestHealthAnswersHead(t *testing.T) {
	t.Parallel()

	recorder := do(t, newTestServer(t), http.MethodHead, "/api/health", "", nil)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "application/json") {
		t.Errorf("Content-Type = %q, want an application/json value", contentType)
	}
}

// The preflight must advertise HEAD alongside the methods that carry a body.
func TestPreflightAdvertisesHead(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodOptions, "/api/health", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	req.Header.Set("Access-Control-Request-Method", http.MethodHead)

	recorder := httptest.NewRecorder()
	newTestServer(t).ServeHTTP(recorder, req)

	if got := recorder.Header().Get("Access-Control-Allow-Methods"); !strings.Contains(got, http.MethodHead) {
		t.Errorf("Access-Control-Allow-Methods = %q, want it to include %q", got, http.MethodHead)
	}
}

// Every response, successful or not, must be JSON and must forbid MIME
// sniffing.
func TestResponsesAreAlwaysJSON(t *testing.T) {
	t.Parallel()

	requests := []struct {
		method string
		target string
		body   string
	}{
		{http.MethodPost, "/api/calculate", `{"operation":"add","a":1,"b":2}`},
		{http.MethodPost, "/api/calculate", `{"operation":"divide","a":1,"b":0}`},
		{http.MethodPost, "/api/calculate", `not json`},
		{http.MethodGet, "/api/health", ""},
		{http.MethodGet, "/nowhere", ""},
		{http.MethodGet, "/api/calculate", ""},
	}

	for _, request := range requests {
		request := request
		t.Run(request.method+" "+request.target, func(t *testing.T) {
			t.Parallel()

			recorder := do(t, newTestServer(t), request.method, request.target, request.body,
				map[string]string{"Content-Type": "application/json"})

			if contentType := recorder.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "application/json") {
				t.Errorf("Content-Type = %q, want an application/json value", contentType)
			}
			if sniff := recorder.Header().Get("X-Content-Type-Options"); sniff != "nosniff" {
				t.Errorf("X-Content-Type-Options = %q, want %q", sniff, "nosniff")
			}
			if !json.Valid(recorder.Body.Bytes()) {
				t.Errorf("body %q is not valid JSON", recorder.Body.String())
			}
		})
	}
}

func ptr(value float64) *float64 {
	return &value
}
