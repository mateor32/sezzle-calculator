package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// Machine readable error codes. Clients are expected to branch on these rather
// than on the human readable message, which may be reworded at any time.
const (
	CodeValidation         = "VALIDATION_ERROR"
	CodeInvalidJSON        = "INVALID_JSON"
	CodeUnknownOperation   = "UNKNOWN_OPERATION"
	CodeDivisionByZero     = "DIVISION_BY_ZERO"
	CodeNegativeSquareRoot = "NEGATIVE_SQUARE_ROOT"
	CodeOverflow           = "OVERFLOW"
	CodeUndefinedResult    = "UNDEFINED_RESULT"
	CodeNotFound           = "NOT_FOUND"
	CodeMethodNotAllowed   = "METHOD_NOT_ALLOWED"
	CodeUnsupportedMedia   = "UNSUPPORTED_MEDIA_TYPE"
	CodePayloadTooLarge    = "PAYLOAD_TOO_LARGE"
	CodeInternal           = "INTERNAL_ERROR"
)

// ErrorDetail describes a single failure.
type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	// Field names the offending request field when the failure can be
	// attributed to one, so a UI can highlight the right input.
	Field string `json:"field,omitempty"`
}

// ErrorResponse is the envelope of every non-2xx response. Wrapping the detail
// in an "error" key means a client can tell a failure from a success by the
// shape of the body alone, without inspecting the status code.
type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

// writeJSON serialises payload as the body of an HTTP response. A nil payload
// writes headers and status only.
func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)

	if payload == nil {
		return
	}

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		// The status line is already on the wire at this point, so the only
		// thing left to do is record the failure.
		slog.Default().Error("failed to encode response body", "error", err)
	}
}

// writeError sends an ErrorResponse. Pass an empty field when the failure
// cannot be attributed to a specific request field.
func writeError(w http.ResponseWriter, status int, code, message, field string) {
	writeJSON(w, status, ErrorResponse{
		Error: ErrorDetail{Code: code, Message: message, Field: field},
	})
}
