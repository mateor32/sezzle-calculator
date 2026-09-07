# ---- Build stage -------------------------------------------------------------
# The build is pinned to a specific Go minor version so that images are
# reproducible across machines and CI.
FROM golang:1.23-alpine AS build

WORKDIR /src

# The dependency files are copied on their own so that the module download layer
# is cached and only invalidated when the dependencies actually change. This
# project has no third-party dependencies, but the layout keeps that true if it
# ever grows one.
COPY go.mod ./
RUN go mod download

COPY . .

# Run the test suite as part of the image build: a broken build can never
# produce a runnable image.
RUN go vet ./... && go test ./...

# CGO is disabled to produce a statically linked binary that runs on a minimal
# base image. -trimpath keeps local build paths out of the binary and the
# linker flags drop the symbol table and DWARF data to reduce its size.
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w" \
    -o /out/server ./cmd/server

# ---- Runtime stage -----------------------------------------------------------
FROM alpine:3.20 AS runtime

# wget is used by the container health check; ca-certificates is there for any
# future outbound HTTPS call.
RUN apk add --no-cache ca-certificates wget

# Run as an unprivileged user rather than root.
RUN adduser -D -H -u 10001 calculator

COPY --from=build /out/server /usr/local/bin/server

USER calculator

ENV PORT=8080
EXPOSE 8080

# The probe reads $PORT rather than hard-coding 8080, because a platform-as-a-
# service injects its own port at runtime. Written in shell form so the variable
# is expanded; the exec form would pass it through literally.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["/usr/local/bin/server"]
