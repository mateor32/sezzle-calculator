# Calculator

A small calculator application built as a technical assessment: a Go REST API
that performs every calculation, and a React + TypeScript interface that
collects and validates the input.

The two halves are independent. The backend has no knowledge of the UI, the
frontend has no arithmetic of its own, and they meet at a single JSON endpoint.

- **Backend** — Go with the standard `net/http` library, no third-party
  dependencies at all.
- **Frontend** — React 18 with TypeScript, styled with Tailwind CSS v4, built by
  Vite, tested with Jest and React Testing Library.

The interface is a keypad calculator with three palettes and full keyboard
support. Its visual design follows the [Frontend Mentor calculator app
challenge](https://www.frontendmentor.io/challenges/calculator-app-9lteq5N29);
the implementation, the state model and the API behind it are original.

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
- [Deployment](#deployment)
- [Design decisions and assumptions](#design-decisions-and-assumptions)
- [Configuration reference](#configuration-reference)

The prompts used to build this project with AI assistance are recorded in
[PROMPTS.md](PROMPTS.md).

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
│   │   │   ├── Calculator.tsx            Orchestration: key presses to requests
│   │   │   ├── Calculator.test.tsx
│   │   │   ├── Display.tsx               The screen: expression, value, errors
│   │   │   ├── Keypad.tsx                The button grid
│   │   │   └── ThemeSwitcher.tsx         The three-position palette switch
│   │   ├── domain/
│   │   │   ├── keypad.ts                 Key layout, variants, keyboard shortcuts
│   │   │   ├── operations.ts             Operation catalogue: symbols, arity
│   │   │   └── operations.test.ts
│   │   ├── hooks/
│   │   │   └── useTheme.ts               Palette selection, persisted locally
│   │   ├── lib/
│   │   │   ├── formatNumber.ts           Result formatting and digit grouping
│   │   │   ├── formatNumber.test.ts
│   │   │   ├── keypadState.ts            Pure typing rules for the keypad
│   │   │   ├── keypadState.test.ts
│   │   │   ├── validation.ts             Client-side validation rules
│   │   │   └── validation.test.ts
│   │   ├── types/
│   │   │   └── calculator.ts             The API contract, in TypeScript
│   │   ├── App.tsx                       Page shell and palette switch
│   │   ├── App.test.tsx
│   │   ├── config.ts                     API base URL and request timeout
│   │   ├── index.css                     Tailwind entry and the three palettes
│   │   ├── main.tsx                      Mounts the app
│   │   └── setupTests.ts                 Jest setup: matchers and the fetch stub
│   ├── Dockerfile                        Builds the bundle, serves it with nginx
│   ├── nginx.conf                        SPA fallback, caching, gzip
│   ├── babel.config.cjs                  Used by Jest only
│   ├── jest.config.cjs
│   ├── tsconfig.json
│   └── vite.config.ts                    React, Tailwind and the injected API URL
│
├── docker-compose.yml               Runs both services together
├── PROMPTS.md                       The AI prompts used to build this
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

The frontend suite covers the keypad typing rules, the validation rules, the
display formatter and digit grouping, the operation catalogue, the API client
(request shape, error mapping, network failures, timeouts, cancellation), the
palette switch and its persistence, and the calculator itself: entering numbers,
every operation, chained operations, client-side validation, each error path,
the pending state and the keyboard shortcuts.

---

## Deployment

The API is deployed to [Render](https://render.com) as a Docker service and the
interface to [Vercel](https://vercel.com) as a static build. Both read from the
same Git repository, so the repository has to be pushed to GitHub (or GitLab or
Bitbucket) before either platform can build it.

Two files describe the setup, so neither service is clicked together by hand:

| File | Describes |
| --- | --- |
| [`render.yaml`](render.yaml) | The API service: Docker build, health check path, build filter |
| [`frontend/vercel.json`](frontend/vercel.json) | The interface: build commands, SPA fallback, cache and security headers |

### 1. Push the repository

```bash
git remote add origin https://github.com/<user>/<repository>.git
git push -u origin main
```

### 2. Deploy the API to Render

1. **New > Blueprint**, select the repository. Render reads `render.yaml` and
   proposes the `calculator-api` service.
2. Leave `CORS_ALLOWED_ORIGINS` empty for the first deploy; the Vercel URL does
   not exist yet.
3. Apply. The build runs `go vet` and the whole test suite before producing an
   image, so a broken commit never reaches a running container.
4. Note the service URL, for example `https://calculator-api.onrender.com`.

Check it:

```bash
curl https://calculator-api.onrender.com/api/health
# {"status":"ok"}
```

### 3. Deploy the interface to Vercel

1. **Add New > Project**, select the same repository.
2. Set **Root Directory** to `frontend`. This is the one setting that cannot
   live in `vercel.json`; everything else is read from that file.
3. Add two environment variables:

   | Name | Value |
   | --- | --- |
   | `VITE_API_BASE_URL` | `https://calculator-api.onrender.com/api` |
   | `VITE_REQUEST_TIMEOUT_MS` | `60000` |

4. Deploy, and note the URL, for example `https://calculator.vercel.app`.

Both values are compile-time constants. Changing either one needs a redeploy,
not just a restart.

### 4. Close the CORS loop

The browser calls the API from the Vercel origin, so the API has to allow it.
In the Render dashboard set:

```
CORS_ALLOWED_ORIGINS = https://calculator.vercel.app
```

Render restarts the service automatically. Until this is set the calculator
loads but every calculation fails, because the browser refuses to hand the
response to a page from a different origin.

To allow Vercel preview deployments as well, give a comma separated list. There
is no wildcard matching: each origin is compared exactly.

### Free tier cold starts

A free Render service is stopped after about fifteen minutes without traffic,
and the request that wakes it can take close to a minute. That is why
`VITE_REQUEST_TIMEOUT_MS` is raised to `60000` above; at the default of eight
seconds the first calculation after an idle period would report a timeout that
is not really a failure.

If the first calculation still times out, load
`https://<api-host>/api/health` once to wake the service, then retry. A paid
instance, or any host that does not idle containers, removes the problem
entirely.

### Deploying somewhere else

Nothing here is specific to these two platforms. The API is a single static
binary in a container that reads `PORT` and `CORS_ALLOWED_ORIGINS` from the
environment, and the interface is a directory of static files. Any container
host and any static host will do; only the two environment variables and the
CORS origin have to match up.

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

**A keypad, not a form.** Digits accumulate into an operand, an operator key
commits it, and `=` sends the pair. That maps one to one onto the API's
`{operation, a, b}` body while giving the interaction people expect from
something called a calculator. The square root key is the exception: being
unary, it applies immediately to whatever is on screen, exactly as it does on a
physical calculator.

**The typing rules are pure functions.** `lib/keypadState.ts` owns how digits
accumulate, how the leading zero is replaced, how a second decimal point is
refused and what the display should read. It has no React and no network in it,
so the fiddliest logic in the app is tested directly rather than through the
DOM. What is left in the component is the decision of *when* a key press means a
calculation.

**Chained operations settle as they go.** Pressing a second operator while one
is pending evaluates the first, so `2 + 3 × 4` accumulates the way a user
expects instead of silently dropping a step.

**Client-side validation duplicates exactly two domain rules.** Division by zero
and the square root of a negative number are caught before a request is made,
because those are the mistakes a user actually makes and a round trip to be told
so is wasteful. Everything else is left to the server, so the two
implementations cannot drift far apart. The server validates every request again
regardless: the client is a convenience, never the authority.

**Results are formatted for reading.** The API returns the full `float64`, which
is correct, but showing `0.30000000000000004` for `0.1 + 0.2` is noise. The UI
rounds to twelve significant digits, falls back to exponential notation outside
a sensible magnitude range, and groups thousands. Grouping runs on the raw entry
string rather than on a number so that a half-typed `1234.` keeps the decimal
point the user just pressed.

**Requests are cancellable and cannot land out of order.** Each calculation
carries a request id and an `AbortController`; a superseded response is
discarded and an in-flight request is aborted when the component unmounts. The
keypad deliberately stays enabled while a request is in flight — locking it for
the length of a network timeout would strand the user with no way to press
RESET.

**Three palettes, one attribute.** Every colour is a CSS custom property
redefined under a `[data-theme]` selector on `<html>`, and Tailwind's
`@theme inline` maps those onto utilities such as `bg-keypad` and `text-ink`.
Because the utilities compile to `var(--keypad)` rather than to a literal
colour, switching palettes reskins the app with no re-render and no duplicated
class names. The choice is stored in `localStorage` and applied by a tiny inline
script in `index.html` before first paint, so a stored palette never flashes the
default one.

**The keyboard drives the whole calculator.** Digits, `+ - * / ^ %`, `r` for the
square root, `Enter`, `Backspace` and `Escape` all work. The shortcuts live
beside each key definition in `domain/keypad.ts` so the two cannot drift, and
`Enter` and `Space` are left alone while a button has focus, because the browser
already activates it and handling the event twice would run the action twice.

**Accessibility is not left to the visuals.** The palette switch is a real radio
group rather than a styled slider, errors carry `role="alert"` so they are
announced immediately, the result sits in a polite live region, and symbol-only
keys carry spelled-out accessible names ("Square root", not "√").

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

Server-side persistence, authentication, rate limiting, a calculation history
and internationalisation are all absent. None is needed to evaluate the brief,
and each would add surface area to review. The brief asked for correctness,
clarity and maintainability ahead of extra features.

The only thing kept in the browser is the chosen palette, in `localStorage`.
Nothing is sent anywhere but the calculation itself.

### Third-party assets

The typeface is [League Spartan](https://fonts.google.com/specimen/League+Spartan)
from Google Fonts, requested in `index.html`. If it cannot be reached the stack
in `index.css` falls back to the system sans-serif and the layout is unaffected.
The visual design follows the Frontend Mentor calculator app challenge, credited
at the top of this file.

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
