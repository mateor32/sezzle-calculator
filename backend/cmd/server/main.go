// Command server runs the calculator HTTP API.
//
// It is intentionally thin: it wires the configuration, the logger and the
// router together, then owns the lifecycle of the HTTP server. All behaviour
// lives in the internal packages, which keeps it testable without a process.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"calculator-api/internal/api"
	"calculator-api/internal/config"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	if err := run(logger); err != nil {
		logger.Error("the server stopped with an error", "error", err)
		os.Exit(1)
	}
}

// run starts the server and blocks until it is asked to shut down. Returning an
// error rather than calling os.Exit keeps every deferred cleanup in play.
func run(logger *slog.Logger) error {
	cfg := config.Load()

	server := &http.Server{
		Addr: cfg.Addr,
		Handler: api.NewRouter(api.Options{
			AllowedOrigins: cfg.AllowedOrigins,
			Logger:         logger,
		}),
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		IdleTimeout:  cfg.IdleTimeout,
		// Route the server's own errors through the structured logger instead
		// of the standard library's default output.
		ErrorLog: slog.NewLogLogger(logger.Handler(), slog.LevelError),
	}

	// SIGINT covers Ctrl+C during development, SIGTERM covers `docker stop`
	// and orchestrators.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	listenErr := make(chan error, 1)
	go func() {
		logger.Info("the calculator api is listening",
			"addr", cfg.Addr,
			"allowed_origins", cfg.AllowedOrigins,
		)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			listenErr <- err
		}
		close(listenErr)
	}()

	select {
	case err := <-listenErr:
		if err != nil {
			return err
		}
		return nil
	case <-ctx.Done():
		logger.Info("a shutdown signal was received, draining in-flight requests")
	}

	// Stop listening for signals so that a second Ctrl+C can still kill a
	// server that refuses to drain.
	stop()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		return err
	}

	logger.Info("the server stopped cleanly")
	return nil
}
