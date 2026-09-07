# Prompts

This project was built with AI assistance, and the assessment asks for the
prompts to be shared. What follows is the actual record of the session, in
order, reproduced verbatim — including typos, and including the prompts written
in Spanish, each with an English translation.

**Tool:** Claude Code (Claude Opus 5), running in VS Code on Windows 11.

The session was a conversation rather than a single request: an opening
specification, then short follow-ups that ran the tests, installed a missing
toolchain, started the services, and eventually replaced the entire interface.
The later prompts are as much a part of how the project got here as the first
one.

---

## 1. The specification

The opening prompt, which produced the Go API, the React interface, the test
suites, the Docker setup and the README in one pass.

> Act as a senior full-stack software engineer. I need you to build a complete,
> production-ready calculator application, with these specifications:
>
> **CONTEXT**
> This is a technical assessment project. Prioritize correctness, clarity, and
> maintainability over extra features. ALL code, comments, documentation, and
> commit messages must be written in English.
>
> **TECH STACK**
> - Backend: Go (using the standard net/http library, no heavy frameworks)
> - Frontend: React with TypeScript
> - Communication: REST API, JSON
>
> **REQUIRED FUNCTIONALITY**
> Required operations: addition, subtraction, multiplication, division
> Optional operations: exponentiation, square root, percentage
>
> **BACKEND (Go)**
> - A REST endpoint (e.g. POST /api/calculate) that receives an operation and operands
> - Input validation: incorrect data types, missing fields
> - Edge case handling: division by zero, square root of a negative number, overflow
> - JSON responses with appropriate HTTP status codes (200, 400, etc.)
> - Clean project structure (separate handlers, business logic, main.go)
> - Unit tests (using the standard testing package) for the calculation logic
>   and the HTTP handlers, covering normal and edge cases
> - Enable CORS so the frontend can consume the API in development
>
> **FRONTEND (React + TypeScript)**
> - Intuitive calculator UI (number inputs, operation selector, calculate button,
>   result/error display area)
> - Client-side input validation before calling the API
> - Handling of network errors and backend-returned errors, clearly shown to the user
> - Responsive design (works on mobile and desktop)
> - An API service/client separated from the UI components (separation of concerns)
> - Unit tests (using Jest and React Testing Library) for key components and
>   validation logic
>
> **DOCUMENTATION**
> Generate a README.md, written entirely in English, including:
> - Setup and installation instructions
> - How to run the backend and frontend
> - Real API call examples (curl or fetch) with their JSON responses
> - Design decisions and assumptions made, briefly explained
> - How to run tests and view coverage
>
> **EXTRAS (optional but valued)**
> - A Dockerfile for the backend, a Dockerfile for the frontend, and a
>   docker-compose.yml to run everything together with a single command
>
> **DELIVERY**
> Organize the code into two folders: /backend and /frontend, at the root of a
> Git repository, ready to commit and push.
>
> Generate the complete project, file by file, briefly explaining the purpose
> of each one.

**Outcome.** The full project: `backend/` with the calculator engine, the HTTP
layer, configuration and tests; `frontend/` with the API client, validation,
components and tests; Dockerfiles, a Compose file, the README, and an
initialised Git repository with one commit.

---

## 2. Running the tests

> como corro ,los test y genero los reportes?

*(How do I run the tests and generate the reports?)*

**Outcome.** The commands for both halves. This surfaced that the Go toolchain
was not installed on the machine, so the backend suite could not be run locally
at that point.

---

## 3. Installing the toolchain

> instala go

*(Install Go.)*

**Outcome.** Go installed via `winget`. The backend was then verified for the
first time on the user's own machine: `gofmt`, `go build`, `go vet` and the full
suite, plus the coverage profile and HTML report.

This step also exposed a real bug in the README: Windows PowerShell 5.1 splits
an argument on its `=` sign, so the documented
`go test -coverprofile=coverage.out ./...` reached Go as a broken package path
and failed. The README now documents the quoted form alongside the portable one.

---

## 4. Running the application

> corre el front y el back

*(Run the frontend and the backend.)*

**Outcome.** Both services started and verified end to end: the page served, the
React modules compiled, a real cross-origin `POST` answered with a result, the
CORS preflight answered `204`, and an invalid request answered `422` with the
field at fault named.

---

## 5. The redesign

This prompt came with a screenshot of the Frontend Mentor calculator app
challenge attached — a dark violet keypad with neon yellow numerals and a
three-position theme switch.

> que diseño tan horrible haz uno asi: *(screenshot attached)*

*(What a horrible design — make one like this.)*

**Outcome.** The interface was rebuilt. This was not a restyle: the reference is
a **keypad** calculator, where digits accumulate and an operator key commits an
operand, while the original was a two-field form. The keypad model maps one to
one onto the API's `{operation, a, b}` body, so the backend was left untouched.

The three extra operations the API supports and the reference design does not
(`√`, `xʸ`, `%`) were given their own row rather than dropped, so no
functionality was lost to the aesthetic.

---

## 6. The styling choice

Sent while the redesign was already in progress.

> usa tailwind si es posible

*(Use Tailwind if possible.)*

**Outcome.** Tailwind CSS v4 replaced the hand-written stylesheet. The three
palettes are CSS custom properties under a `[data-theme]` attribute, mapped onto
Tailwind utilities with `@theme inline` so that switching a palette reskins the
app without a re-render.

---

## 7. Orientation and reporting

Three short questions once the rebuilt app was running.

> donde esta el back

*(Where is the backend?)*

> donde puedo ver kos reportes detallados de los test

*(Where can I see the detailed test reports?)*

> necesito el reporte de cobertura cual es

*(I need the coverage report — which one is it?)*

**Outcome.** No code changes. The coverage reports were regenerated and opened:
`backend/coverage.html` and `frontend/coverage/lcov-report/index.html`.

---

## 8. This file

> Crea un archivo PROMPTS.md en la raíz del repo con el/los prompt(s) que usaste
> (piden explícitamente compartirlos).

*(Create a PROMPTS.md file at the root of the repo with the prompt(s) you used —
they explicitly ask for them to be shared.)*

---

## 9. Deployment

> ahora despleguemos la app el back y front ambas

*(Now let's deploy the app, both the backend and the frontend.)*

> despleguemos el back en render y front en vercel

*(Let's deploy the backend to Render and the frontend to Vercel.)*

**Outcome.** `render.yaml` and `frontend/vercel.json`, so both services are
described in version control rather than clicked together in a web form, plus a
deployment section in the README.

Preparing for a hosted deployment surfaced two things worth fixing:

- The container health check hard-coded port 8080, but a platform-as-a-service
  injects its own `PORT`. It now reads the variable.
- The client timeout was a fixed eight seconds, which is right for a local API
  but not for a free tier that idles containers to sleep — the request that
  wakes one can take close to a minute. The timeout is now configurable per
  environment through `VITE_REQUEST_TIMEOUT_MS`.

The deployment itself is gated on credentials that only the repository owner
has, so the steps that need a Render or Vercel account are documented in the
README rather than performed here.

---

## How the prompts were used

**The specification was detailed; the implementation decisions were not.** The
opening prompt fixed the stack, the endpoint shape and the deliverables. It did
not decide how to structure the Go packages, what status code a division by zero
deserves, how to tell a missing field from an explicit zero, or how to keep the
arithmetic free of HTTP. Those were worked out during implementation and are
written up in the "Design decisions and assumptions" section of the README,
which is where an evaluator should look to judge the engineering rather than the
prompting.

**The work was verified, not just generated.** Every claim in the README's API
examples was checked against a running server, and the responses in it were
copied from real `curl` output rather than written from memory. The frontend
suite, the type checker and the production build were run after every
significant change.

**Two mistakes were caught and corrected during the session,** both worth
recording because they show where AI-assisted work needs checking:

1. The README documented coverage commands that fail in Windows PowerShell 5.1.
   Found by running them rather than assuming they worked; fixed in commit
   `26b663a`.
2. The first version of the rewritten component tests asserted with
   `findByText('5')`, which matched both the display and the keypad key labelled
   "5". Fourteen tests failed. The bug was in the tests, not the application;
   the assertions now target the display explicitly.

**What was deliberately not built.** Persistence, authentication, rate limiting,
calculation history and internationalisation are all absent. The brief asked for
correctness, clarity and maintainability ahead of extra features, and each of
those would have added surface area to review without demonstrating anything the
brief asked about.

---

## Design attribution

The visual design of the interface follows the [Frontend Mentor calculator app
challenge](https://www.frontendmentor.io/challenges/calculator-app-9lteq5N29),
supplied as a reference image in prompt 5. The implementation, the keypad state
model, the API and everything behind the surface are original. The typeface is
League Spartan, from Google Fonts.
