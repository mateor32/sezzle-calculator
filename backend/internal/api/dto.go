package api

// CalculateRequest is the JSON body accepted by POST /api/calculate.
//
// A and B are pointers on purpose: it is the only way to tell a field that was
// omitted from a field that was explicitly sent as 0. Without that distinction
// {"operation":"divide","a":10} would silently be treated as a division by
// zero instead of reporting the missing operand.
type CalculateRequest struct {
	Operation string   `json:"operation"`
	A         *float64 `json:"a"`
	B         *float64 `json:"b"`
}

// CalculateResponse is the body of a successful calculation. It echoes the
// resolved operation and the operands that were used, which keeps responses
// self-describing and makes debugging a client straightforward.
//
// B is omitted for unary operations such as sqrt.
type CalculateResponse struct {
	Operation string   `json:"operation"`
	A         float64  `json:"a"`
	B         *float64 `json:"b,omitempty"`
	Result    float64  `json:"result"`
}

// HealthResponse is the body of GET /api/health.
type HealthResponse struct {
	Status string `json:"status"`
}
