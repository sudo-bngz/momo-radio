package testutils

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/modules/redis"
)

// SetupPostgres spins up an ephemeral Postgres container and returns the connection string.
func SetupPostgres(t *testing.T) string {
	t.Helper()
	ctx := context.Background()

	pgContainer, err := postgres.Run(ctx,
		"postgres:16-alpine",
		postgres.WithDatabase("momo_test"),
		postgres.WithUsername("test_user"),
		postgres.WithPassword("test_pass"),
		postgres.BasicWaitStrategies(),
	)
	assert.NoError(t, err, "failed to start postgres container")

	t.Cleanup(func() {
		// Use a fresh context for cleanup in case the parent test context timed out
		if err := pgContainer.Terminate(context.Background()); err != nil {
			t.Fatalf("failed to terminate pg container: %s", err)
		}
	})

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	assert.NoError(t, err, "failed to get postgres connection string")

	return connStr
}

// SetupRedis spins up an ephemeral Redis container and returns the connection URI.
func SetupRedis(t *testing.T) string {
	t.Helper()
	ctx := context.Background()

	redisContainer, err := redis.Run(ctx, "redis:7-alpine")
	assert.NoError(t, err, "failed to start redis container")

	t.Cleanup(func() {
		if err := redisContainer.Terminate(context.Background()); err != nil {
			t.Fatalf("failed to terminate redis container: %s", err)
		}
	})

	uri, err := redisContainer.ConnectionString(ctx)
	assert.NoError(t, err, "failed to get redis connection string")

	return uri
}
