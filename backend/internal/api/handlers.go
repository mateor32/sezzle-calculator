package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"reflect"
	"strings"

	"calculator-api/internal/calculator"
)

// maxRequestBodyBytes caps the request body. A calculation request is a handful
// of bytes, so a small ceiling costs nothing and removes a trivial way to make
// the process allocate.
const maxRequestBodyBytes = 4 << 10 // 4 KiB

// handleCalculate serves POST /api/calculate.
func (s *server) handleCalculate(w http.ResponseWriter, r *http.Request) {
	if err := requireJSONContentType(r); err != nil {
		writeError(w, http.StatusUnsupportedMediaType, CodeUnsupportedMedia, err.Error(), "")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)

	decoder := json.NewDecoder(r.Body)
	// Reject unknown fields so that a typo such as "opration" is reported
	// instead of being silently ignored and surfacing as a missing operation.
	decoder.DisallowUnknownFields()

	var req CalculateRequest
	if err := decoder.Decode(&req); err != nil {
		writeDecodeError(w, err)
		return
	}
	if decoder.More() {
		writeError(w, http.StatusBadRequest, CodeInvalidJSON,
			"the request body must contain exactly one JSON object", "")
		return
	}

	def, detail, ok := validateRequest(req)
	if !ok {
		writeError(w, http.StatusBadRequest, detail.Code, detail.Message, detail.Field)
		return
	}

	// validateRequest has already guaranteed that the operands required by the
	// operation's arity are present.
	operands := []float64{*req.A}
	if def.Arity == 2 {
		operands = append(operands, *req.B)
	}

	result, err := calculator.Calculate(def.Operation, operands)
	if err != nil {
		status, detail := mapCalculationError(err)
		if status == http.StatusInternalServerError {
			s.logger.Error("calculation failed unexpectedly",
				"operation", def.Operation, "operands", operands, "error", err)
		}
		writeError(w, status, detail.Code, detail.Message, detail.Field)
		return
	}

	response := CalculateResponse{
		Operation: string(def.Operation),
		A:         operands[0],
		Result:    result,
	}
	if def.Arity == 2 {
		response.B = &operands[1]
	}

	writeJSON(w, http.StatusOK, response)
}

// handleHealth serves GET /api/health. It is used by the Docker Compose health
// check and by anything else that needs a cheap liveness probe.
func (s *server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, HealthResponse{Status: "ok"})
}

// handleNotFound answers every unrouted path with the same JSON error envelope
// used everywhere else, instead of the plain text default of net/http.
func (s *server) handleNotFound(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotFound, CodeNotFound,
		fmt.Sprintf("no endpoint matches %s %s", r.Method, r.URL.Path), "")
}

// allowMethod rejects any method other than the one a route accepts. The check
// is explicit rather than delegated to the method patterns of ServeMux so that
// the rejection carries the same JSON envelope as every other error.
//
// A GET route also answers HEAD, because HTTP defines HEAD as identical to GET
// without a response body and net/http discards the body for us. Monitoring
// tools rely on this: a container health check running `wget --spider`, for
// instance, sends HEAD and would otherwise be told 405 by a perfectly healthy
// service.
func allowMethod(method string, next http.HandlerFunc) http.HandlerFunc {
	allowsHead := method == http.MethodGet

	allow := method + ", OPTIONS"
	if allowsHead {
		allow = method + ", HEAD, OPTIONS"
	}

	return func(w http.ResponseWriter, r *http.Request) {
		permitted := r.Method == method || (allowsHead && r.Method == http.MethodHead)
		if !permitted {
			w.Header().Set("Allow", allow)
			writeError(w, http.StatusMethodNotAllowed, CodeMethodNotAllowed,
				fmt.Sprintf("%s is not allowed on this endpoint, use %s", r.Method, method), "")
			return
		}
		next(w, r)
	}
}

// requireJSONContentType rejects bodies that are declared as something other
// than JSON. A missing header is accepted so that quick manual calls with curl
// keep working; a present but wrong header is a genuine client mistake.
func requireJSONContentType(r *http.Request) error {
	raw := r.Header.Get("Content-Type")
	if raw == "" {
		return nil
	}

	mediaType, _, err := mime.ParseMediaType(raw)
	if err != nil || mediaType != "application/json" {
		return fmt.Errorf("expected Content-Type application/json, got %q", raw)
	}
	return nil
}

// writeDecodeError turns the errors of encoding/json into precise, actionable
// client messages. The default library errors leak Go type names, which are
// meaningless to a consumer of the API.
func writeDecodeError(w http.ResponseWriter, err error) {
	var (
		maxBytesErr *http.MaxBytesError
		syntaxErr   *json.SyntaxError
		typeErr     *json.UnmarshalTypeError
	)

	switch {
	case errors.As(err, &maxBytesErr):
		writeError(w, http.StatusRequestEntityTooLarge, CodePayloadTooLarge,
			fmt.Sprintf("the request body must not exceed %d bytes", maxBytesErr.Limit), "")

	case errors.Is(err, io.EOF):
		writeError(w, http.StatusBadRequest, CodeInvalidJSON,
			"the request body must not be empty", "")

	case errors.As(err, &syntaxErr):
		writeError(w, http.StatusBadRequest, CodeInvalidJSON,
			fmt.Sprintf("the request body contains malformed JSON at position %d", syntaxErr.Offset), "")

	case errors.Is(err, io.ErrUnexpectedEOF):
		writeError(w, http.StatusBadRequest, CodeInvalidJSON,
			"the request body contains incomplete JSON", "")

	case errors.As(err, &typeErr):
		if typeErr.Field == "" {
			writeError(w, http.StatusBadRequest, CodeInvalidJSON,
				"the request body must be a JSON object", "")
			return
		}
		writeError(w, http.StatusBadRequest, CodeValidation,
			fmt.Sprintf("field %q must be %s", typeErr.Field, expectedJSONType(typeErr.Type)), typeErr.Field)

	case strings.HasPrefix(err.Error(), unknownFieldPrefix):
		field := strings.Trim(strings.TrimPrefix(err.Error(), unknownFieldPrefix), `"`)
		writeError(w, http.StatusBadRequest, CodeValidation,
			fmt.Sprintf("unknown field %q, the accepted fields are \"operation\", \"a\" and \"b\"", field), field)

	default:
		writeError(w, http.StatusBadRequest, CodeInvalidJSON,
			"the request body could not be parsed as JSON", "")
	}
}

// unknownFieldPrefix is the prefix of the error that encoding/json produces for
// an unknown field. The standard library does not expose a typed error for it,
// so the string has to be matched.
const unknownFieldPrefix = "json: unknown field "

// expectedJSONType describes a Go target type in terms a JSON client
// understands.
func expectedJSONType(t reflect.Type) string {
	for t != nil && t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	if t == nil {
		return "a valid JSON value"
	}

	switch t.Kind() {
	case reflect.String:
		return "a JSON string"
	case reflect.Float32, reflect.Float64,
		reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return "a JSON number"
	case reflect.Bool:
		return "a JSON boolean"
	default:
		return "a valid JSON value"
	}
}

// validateRequest checks the decoded body against the rules of the requested
// operation and resolves it to its definition.
func validateRequest(req CalculateRequest) (calculator.Definition, ErrorDetail, bool) {
	name := strings.TrimSpace(req.Operation)
	if name == "" {
		return calculator.Definition{}, ErrorDetail{
			Code:    CodeValidation,
			Message: `field "operation" is required`,
			Field:   "operation",
		}, false
	}

	def, found := calculator.Lookup(name)
	if !found {
		return calculator.Definition{}, ErrorDetail{
			Code: CodeUnknownOperation,
			Message: fmt.Sprintf("unsupported operation %q, the supported operations are: %s",
				name, strings.Join(calculator.SupportedOperations(), ", ")),
			Field: "operation",
		}, false
	}

	if req.A == nil {
		return def, ErrorDetail{
			Code:    CodeValidation,
			Message: `field "a" is required and must be a number`,
			Field:   "a",
		}, false
	}

	if def.Arity == 2 && req.B == nil {
		return def, ErrorDetail{
			Code:    CodeValidation,
			Message: fmt.Sprintf(`field "b" is required for the %q operation`, def.Operation),
			Field:   "b",
		}, false
	}

	// A "b" sent to a unary operation is deliberately ignored rather than
	// rejected: it costs a client nothing to leave a stale field in the body.
	return def, ErrorDetail{}, true
}

// mapCalculationError translates a calculator sentinel error into the status
// code and payload a client should see.
//
// Malformed input is a 400. Input that is well formed but has no representable
// answer is a 422: the request was understood, the mathematics simply does not
// work out.
func mapCalculationError(err error) (int, ErrorDetail) {
	switch {
	case errors.Is(err, calculator.ErrDivisionByZero):
		return http.StatusUnprocessableEntity, ErrorDetail{
			Code: CodeDivisionByZero, Message: err.Error(), Field: "b",
		}

	case errors.Is(err, calculator.ErrNegativeSquareRoot):
		return http.StatusUnprocessableEntity, ErrorDetail{
			Code: CodeNegativeSquareRoot, Message: err.Error(), Field: "a",
		}

	case errors.Is(err, calculator.ErrOverflow):
		return http.StatusUnprocessableEntity, ErrorDetail{
			Code: CodeOverflow, Message: err.Error(),
		}

	case errors.Is(err, calculator.ErrUndefinedResult):
		return http.StatusUnprocessableEntity, ErrorDetail{
			Code: CodeUndefinedResult, Message: err.Error(),
		}

	case errors.Is(err, calculator.ErrUnknownOperation):
		return http.StatusBadRequest, ErrorDetail{
			Code: CodeUnknownOperation, Message: err.Error(), Field: "operation",
		}

	case errors.Is(err, calculator.ErrInvalidOperandCount),
		errors.Is(err, calculator.ErrNonFiniteOperand):
		return http.StatusBadRequest, ErrorDetail{
			Code: CodeValidation, Message: err.Error(),
		}

	default:
		// Unreachable unless a new sentinel error is added without being
		// mapped here. The caller logs this case before responding.
		return http.StatusInternalServerError, ErrorDetail{
			Code: CodeInternal, Message: "the request could not be processed",
		}
	}
}
