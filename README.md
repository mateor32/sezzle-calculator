# Calculator

A small calculator application built as a technical assessment: a Go REST API
that performs every calculation, and a React + TypeScript interface that
collects and validates the input.

The two halves are independent. The backend has no knowledge of the UI, the
frontend has no arithmetic of its own, and they meet at a single JSON endpoint.

- **Backend** — Go with the standard `net/http` library, no third-party
  dependencies at all.
- **Frontend** — React 18 with TypeScript, built by Vite, tested with Jest and
  React Testing Library.

---

## Table of contents

- [Project structure](#project-structure)
- [Requirements](#requirements)
- [Quick start with Docker](#quick-start-with-docker)
- [Running the backend](#running-the-backend)
- [Running the frontend](#running-the-frontend)
- [API reference](#api-reference)
- [API examples](#api-examples)
- [Running the tests](#running-the-tests)
- [Design decisions and assumptions](#design-decisions-and-assumptions)
- [Configuration reference](#configuration-reference)

---

## Project structure

```
.
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go              Entry point: configuration, logger, server lifecycle
│   ├── internal/
│   │   ├── api/
│   │   │   ├── dto.go               Request and response payloads
│   │   │   ├── errors.go            Error codes, the JSON error envelope, response writers
│   │   │   ├── handlers.go          Request decoding, validation, error mapping
│   │   │   ├── handlers_test.go     Handler tests: success, validation, edge cases, routing
│   │   │   ├── middleware.go        CORS, request logging, panic recovery
│   │   │   ├── middleware_test.go   CORS tests, including preflight
│   │   │   └── router.go            Route table and middleware chain
│   │   ├── calculator/
│   │   │   ├── calculator.go        The arithmetic engine (no HTTP knowledge)
│   │   │   ├── calculator_test.go   Operation tests and every mathematical edge case
│   │   │   └── errors.go            Sentinel errors the transport layer maps to statuses
│   │   └── config/
│   │       ├── config.go            Environment configuration with defaults
│   │       └── config_test.go
│   ├── Dockerfile                   Multi-stage build; tests run inside it
│   └── go.mod
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── calculatorClient.ts       The only module that calls fetch
│   │   │   └── calculatorClient.test.ts
│   │   ├── components/
│   │   │   ├── Calculator.tsx            The form; the only stateful component
│   │   │   ├── Calculator.test.tsx
│   │   │   ├── OperandField.tsx          One labelled numeric input
│   │   │   ├── OperationSelector.tsx     The operation dropdown
│   │   │   └── ResultPanel.tsx           Result, error or idle hint
│   │   ├── domain/
│   │   │   └── operations.ts             Operation catalogue: labels, arity, expressions
│   │   ├── lib/
│   │   │   ├── formatNumber.ts           Display formatting for results
│   │   │   ├── formatNumber.test.ts
│   │   │   ├── validation.ts             Client-side validation rules
│   │   │   └── validation.test.ts
│   │   ├── types/
│   │   │   └── calculator.ts             The API contract, in TypeScript
│   │   ├── App.tsx                       Page shell
│   │   ├── config.ts                     API base URL and request timeout
│   │   ├── index.css                     The single stylesheet
│   │   ├── main.tsx                      Mounts the app
│   │   └── setupTests.ts                 Jest setup: matchers and the fetch stub
│   ├── Dockerfile                        Builds the bundle, serves it with nginx
│   ├── nginx.conf                        SPA fallback, caching, gzip
│   ├── babel.config.cjs                  Used by Jest only
│   ├── jest.config.cjs
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── docker-compose.yml               Runs both services together
└── README.md
```

---

## Requirements

Choose one of the two:

| Path | Needs |
| --- | --- |
| Run with Docker | Docker 24+ with the Compose plugin |
| Run locally | Go 1.22+ and Node.js 18+ (Node 20 or 22 recommended) |

---

## Quick start with Docker

From the repository root:

```bash
docker compose up --build
```

- UI: <http://localhost:3000>
- API: <http://localhost:8080/api/calculate>

The frontend waits for the backend's health check to pass before starting. Both
image builds run their test suites, so a broken build never produces a running
container.

To stop and remove everything:

```bash
docker compose down
```

---

## Running the backend

```bash
cd backend
go run ./cmd/server
```

The API listens on <http://localhost:8080> and logs one structured JSON line per
request. Nothing needs to be installed first: the module has no dependencies.

To build a binary instead:

```bash
cd backend
go build -o bin/server ./cmd/server
./bin/server
```

Check that it is up:

```bash
curl http://localhost:8080/api/health
# {"status":"ok"}
```

---

## Running the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The dev server starts on <http://localhost:5173> and calls the API at
`http://localhost:8080/api` by default, which is why the backend enables CORS.

To point the UI somewhere else, copy `.env.example` to `.env` and set
`VITE_API_BASE_URL`. Vite inlines the value at build time, so restart the dev
server after changing it.

Production build and local preview:

```bash
npm run build     # type checks, then bundles into dist/
npm run preview   # serves dist/ on http://localhost:4173
```

---

## API reference

Base URL: `http://localhost:8080/api`

### `POST /api/calculate`

Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `operation` | string | yes | One of the operations below. Case-insensitive, surrounding whitespace is ignored. |
| `a` | number | yes | The first operand. |
| `b` | number | for binary operations | The second operand. Ignored by `sqrt`. |

Supported operations:

| `operation` | Operands | Computes | Example |
| --- | --- | --- | --- |
| `add` | 2 | `a + b` | `2 + 3 = 5` |
| `subtract` | 2 | `a - b` | `10 - 4 = 6` |
| `multiply` | 2 | `a × b` | `7 × 6 = 42` |
| `divide` | 2 | `a ÷ b` | `10 ÷ 4 = 2.5` |
| `power` | 2 | `a` raised to `b` | `2 ^ 10 = 1024` |
| `sqrt` | 1 | the square root of `a` | `√9 = 3` |
| `percentage` | 2 | `b` percent of `a` | `10% of 200 = 20` |

Success response (`200 OK`) — `b` is omitted for `sqrt`:

```json
{ "operation": "divide", "a": 10, "b": 4, "result": 2.5 }
```

Error response (any non-2xx status):

```json
{
  "error": {
    "code": "DIVISION_BY_ZERO",
    "message": "division by zero is undefined",
    "field": "b"
  }
}
```

`field` is present only when the failure can be attributed to one request field,
which lets the UI highlight the offending input.

### `GET /api/health`

Returns `200` with `{"status":"ok"}`. Used by the container health check.

### Status codes

| Status | When |
| --- | --- |
| `200 OK` | The calculation succeeded. |
| `400 Bad Request` | The body is malformed, a field is missing, has the wrong type, or the operation is unknown. |
| `404 Not Found` | No endpoint matches the path. |
| `405 Method Not Allowed` | The path exists but not for that method. The `Allow` header lists what it accepts. |
| `413 Payload Too Large` | The body exceeds 4 KiB. |
| `415 Unsupported Media Type` | A `Content-Type` other than `application/json` was declared. |
| `422 Unprocessable Entity` | The request was understood but has no representable answer: division by zero, the square root of a negative number, or an overflow. |
| `500 Internal Server Error` | An unexpected failure. The response never includes internal details. |

### Error codes

| Code | Status | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | A field is missing, has the wrong type, or is not recognised. |
| `INVALID_JSON` | 400 | The body could not be parsed. |
| `UNKNOWN_OPERATION` | 400 | The operation is not supported. |
| `DIVISION_BY_ZERO` | 422 | The divisor is zero. |
| `NEGATIVE_SQUARE_ROOT` | 422 | The square root of a negative number is not a real number. |
| `OVERFLOW` | 422 | The result exceeds the range of a 64-bit float. |
| `UNDEFINED_RESULT` | 422 | The result is not a real number, for example `(-8) ^ 0.5`. |
| `NOT_FOUND` | 404 | No such endpoint. |
| `METHOD_NOT_ALLOWED` | 405 | Wrong method for the path. |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | The declared content type is not JSON. |
| `PAYLOAD_TOO_LARGE` | 413 | The body is too large. |
| `INTERNAL_ERROR` | 500 | An unexpected server failure. |

---

## API examples

Every example below assumes the backend is running on `localhost:8080`.

### Addition

```bash
curl -i -X POST http://localhost:8080/api/calculate \
  -H "Content-Type: application/json" \
  -d '{"operation":"add","a":2,"b":3}'
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"operation":"add","a":2,"b":3,"result":5}
```

### Division producing a decimal

```bash
curl -X POST http://localhost:8080/api/calculate \
  -H "Content-Type: application/json" \
  -d '{"operation":"divide","a":10,"b":4}'
```

```json
{"operation":"divide","a":10,"b":4,"result":2.5}
```

### Square root — a unary operation, so `b` is omitted from the response

```bash
curl -X POST http://localhost:8080/api/calculate \
  -H "Content-Type: application/json" \
  -d '{"operation":"sqrt","a":9}'
```

```json
{"operation":"sqrt","a":9,"result":3}
```

### Percentage — "b percent of a"

```bash
curl -X POST http://localhost:8080/api/calculate \
  -H "Content-Type: application/json" \
  -d '{"operation":"percentage","a":200,"b":10}'
```

```json
{"operation":"percentage","a":200,"b":10,"result":20}
```

### Division by zero — `422`

```bash
curl -i -X POST http://localhost:8080/api/calculate \
  -H "Content-Type: application/json" \
  -d '{"operation":"divide","a":10,"b":0}'
```

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json; charset=utf-8

{"error":{"code":"DIVISION_BY_ZERO","message":"division by zero is undefined","field":"b"}}
```

### Square root of a negative number — `422`

```bash
curl -X POST http://localhost:8080/api/calculate \
  -H "Content-Type: application/json" \
  -d '{"operation":"sqrt","a":-9}'
```

```json
{"error":{"code":"NEGATIVE_SQUARE_ROOT","message":"the square root of a negative number is not a real number","field":"a"}}
```

### Overflow — `422`

```bash
curl -X POST http://localhost:8080/api/calculate \
  -H "Content-Type: application/json" \
  -d '{"operation":"power","a":10,"b":400}'
```

```json
{"error":{"code":"OVERFLOW","message":"the result is too large to be represented as a 64-bit floating point number"}}
```

### Missing operand — `400`

```bash
curl -X POST http://localhost:8080/api/calculate \
  -H "Content-Type: application/json" \
  -d '{"operation":"add","a":2}'
```

```json
{"error":{"code":"VALIDATION_ERROR","message":"field \"b\" is required for the \"add\" operation","field":"b"}}
```

### Wrong type — `400`

```bash
curl -X POST http://localhost:8080/api/calculate \
  -H "Content-Type: application/json" \
  -d '{"operation":"add","a":"two","b":3}'
```

```json
{"error":{"code":"VALIDATION_ERROR","message":"field \"a\" must be a JSON number","field":"a"}}
```

### Unknown operation — `400`

```bash
curl -X POST http://localhost:8080/api/calculate \
  -H "Content-Type: application/json" \
  -d '{"operation":"modulo","a":10,"b":3}'
```

```json
{"error":{"code":"UNKNOWN_OPERATION","message":"unsupported operation \"modulo\", the supported operations are: add, divide, multiply, percentage, power, sqrt, subtract","field":"operation"}}
```

### Malformed JSON — `400`

```bash
curl -X POST http://localhost:8080/api/calculate \
  -H "Content-Type: application/json" \
  -d '{"operation":"add",'
```

```json
{"error":{"code":"INVALID_JSON","message":"the request body contains incomplete JSON"}}
```

### Wrong method — `405`

```bash
curl -i http://localhost:8080/api/calculate
```

```http
HTTP/1.1 405 Method Not Allowed
Allow: POST, OPTIONS

{"error":{"code":"METHOD_NOT_ALLOWED","message":"GET is not allowed on this endpoint, use POST"}}
```

### The same call with `fetch`

```js
const response = await fetch('http://localhost:8080/api/calculate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ operation: 'multiply', a: 7, b: 6 }),
});

const payload = await response.json();

if (!response.ok) {
  // { error: { code: 'VALIDATION_ERROR', message: '…', field: 'b' } }
  throw new Error(payload.error.message);
}

console.log(payload.result); // 42
```

---

## Running the tests

### Backend

```bash
cd backend
go test ./...            # the whole suite
go test -v ./...         # with the name of every case
go vet ./...             # static analysis
```

Coverage:

```bash
cd backend
go test -cover ./...                       # a percentage per package
go test -coverprofile=coverage.out ./...   # write a profile
go tool cover -func=coverage.out           # per-function summary in the terminal
go tool cover -html=coverage.out           # open an annotated report in a browser
```

> **Windows PowerShell users:** Windows PowerShell 5.1 splits an argument on its
> `=` sign, so the flags above have to be quoted or Go receives a broken package
> path. PowerShell 7 (`pwsh`), Git Bash and `cmd` are unaffected.
>
> ```powershell
> go test "-coverprofile=coverage.out" ./...
> go tool cover "-func=coverage.out"
> go tool cover "-html=coverage.out" -o coverage.html
> ```

The backend suite covers the arithmetic of every operation, each mathematical
edge case (division by zero, negative square roots, overflow, results that are
not real numbers), request validation, malformed bodies, routing, and the CORS
middleware including preflight.

### Frontend

```bash
cd frontend
npm test                 # the whole suite
npm run test:watch       # re-run on change
npm run typecheck        # tsc --noEmit
```

Coverage:

```bash
cd frontend
npm run test:coverage
```

A summary is printed in the terminal and a browsable report is written to
`coverage/lcov-report/index.html`.

The frontend suite covers the validation rules, the display formatter, the API
client (request shape, error mapping, network failures, timeouts, cancellation)
and the calculator component (rendering, client-side validation, successful
calculations, every error path and the pending state).

---

## Design decisions and assumptions

### Architecture

**The arithmetic knows nothing about HTTP.** `internal/calculator` exposes pure
functions that return either a finite `float64` or one of a handful of sentinel
errors. `internal/api` is the only package that imports `net/http`, and it owns
the decision of which status code each sentinel error deserves. Testing the
mathematics needs no HTTP server, and adding a second transport later would not
touch the rules.

**Operations live in a registry, not a switch.** Each operation is one entry
holding its arity, its optional precondition and its implementation. Arity is
data rather than a hard-coded branch, which is what lets the handler produce
"field `b` is required for the `add` operation" without knowing anything about
addition. A test walks the registry and executes every entry, so an operation
added without being wired up correctly fails the suite.

**The frontend never calls `fetch` from a component.** `api/calculatorClient.ts`
is the only module that knows about the network. Components deal in two error
types (`ApiError` and `NetworkError`) and the whole surface can be tested by
mocking one function.

### API design

**`a` and `b` are decoded into pointers.** It is the only way to distinguish an
omitted field from one explicitly sent as `0`. Without it,
`{"operation":"divide","a":10}` would be treated as a division by zero rather
than reported as a missing operand.

**400 for malformed input, 422 for impossible mathematics.** A missing field or
a string where a number belongs is a badly formed request: `400`. Division by
zero is a perfectly well formed request whose answer does not exist: `422`
Unprocessable Entity says exactly that. Both are rendered identically by the UI,
so the distinction costs nothing on the client and makes server logs easier to
read.

**Errors carry a machine-readable `code` and an optional `field`.** Clients
branch on the code and never on the wording, and `field` is what lets the UI
highlight the input at fault instead of only printing a sentence.

**Unknown fields are rejected.** A typo such as `"opration"` is reported as an
unknown field rather than silently ignored and surfacing later as a confusing
"operation is required".

**Assumption — `percentage(a, b)` means "b percent of a".** The word
"percentage" is ambiguous, so the API fixes one meaning: `percentage` with
`a = 200, b = 10` returns `20`. The UI spells it out in the operation label
(`Percentage (b% of a)`) and in the operand labels so the order is never a
guess.

**Assumption — a stale `b` sent to a unary operation is ignored.** Rejecting it
would force clients to clear a field they are about to hide, and no information
is lost by ignoring it.

**Overflow is detected on the result, not predicted from the operands.** Every
operation is computed and the result is then checked for `±Inf` (reported as
`OVERFLOW`) and `NaN` (reported as `UNDEFINED_RESULT`, which is what
`(-8) ^ 0.5` produces). One check at the end covers every operation, including
any added later.

**Negative zero is normalised to zero.** `-5 × 0` is `-0` in IEEE 754 and would
otherwise be serialised as `-0` and displayed as such.

### Frontend

**Operands are text inputs with `inputMode="decimal"`, not `type="number"`.** A
number input discards characters the browser considers invalid before the change
event fires, which makes it impossible to explain *why* an entry was rejected,
and it changes its value when the mouse wheel moves over it. Keeping the raw
string means validation owns every decision, while mobile keyboards still open
on the numeric layout.

**Client-side validation duplicates exactly two domain rules.** Empty and
non-numeric input, division by zero and the square root of a negative number are
caught before a request is made, because those are the mistakes a user actually
makes and a round trip to be told so is wasteful. Everything else is left to the
server, so the two implementations cannot drift far apart. The server validates
every request again regardless: the client is a convenience, never the
authority.

**Results are formatted for reading.** The API returns the full `float64`, which
is correct, but showing `0.30000000000000004` for `0.1 + 0.2` is noise. The UI
rounds to twelve significant digits and falls back to exponential notation
outside a sensible magnitude range.

**Requests are cancellable and cannot land out of order.** Each submission
carries a request id and an `AbortController`; a superseded response is
discarded and an in-flight request is aborted when the component unmounts.

**No UI framework and no CSS library.** One stylesheet with custom properties
covers the theme, the dark mode and the responsive layout. For a form this size
a dependency would add more to review than it removes.

### CORS

The middleware defaults to `*` so the app runs with no configuration in
development. Setting `CORS_ALLOWED_ORIGINS` switches it to an exact-match
allowlist that echoes the requesting origin and adds `Vary: Origin` so caches
cannot serve one origin's response to another — which is what
`docker-compose.yml` does. Credentials are never allowed, because the API has no
notion of a session. CORS headers are also written on error responses;
without them a browser hides the error body and the UI can only report a generic
network failure.

### Operational details

- **Graceful shutdown.** `SIGINT` and `SIGTERM` stop the listener and drain
  in-flight requests before exiting.
- **Timeouts on the server, a timeout on the client.** Read, write and idle
  timeouts are set on `http.Server`; the client gives up after 8 seconds and
  says so in plain language.
- **The body is capped at 4 KiB.** A calculation request is a few dozen bytes.
- **Panics become 500s.** Recovery middleware logs the stack and returns the
  standard error envelope rather than dropping the connection.
- **Structured logging.** One `log/slog` JSON line per request with method,
  path, status and duration.
- **Containers run as an unprivileged user** and both image builds run their
  test suites before producing an artefact.

### Deliberate omissions

Persistence, authentication, rate limiting, a calculation history and
internationalisation are all absent. None is needed to evaluate the brief, and
each would add surface area to review. The brief asked for correctness, clarity
and maintainability ahead of extra features.

---

## Configuration reference

### Backend

| Variable | Default | Description |
| --- | --- | --- |
| `HOST` | *(all interfaces)* | Interface to bind to. |
| `PORT` | `8080` | Port to listen on. |
| `CORS_ALLOWED_ORIGINS` | `*` | Comma-separated allowlist. `*` allows every origin; an empty value disables CORS. |

### Frontend

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8080/api` | Base URL of the API, without a trailing slash. Inlined at build time. |

---

## Note on the Go module path

The backend module is named `calculator-api`, which keeps it buildable offline
and independent of where the repository is hosted. When publishing this under a
real remote, change the `module` line in `backend/go.mod` and the import paths
in the Go files to match it.
