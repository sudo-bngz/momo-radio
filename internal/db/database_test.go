package database

import (
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"

	"momo-radio/internal/config"
	"momo-radio/internal/logger"
	"momo-radio/internal/testutils"
)

func TestDatabaseMigration(t *testing.T) {
	logger.Log = zap.NewNop()

	// 2. Spin up the isolated Postgres container
	connStr := testutils.SetupPostgres(t)

	// 3. Parse the returned URL string
	u, err := url.Parse(connStr)
	assert.NoError(t, err, "failed to parse testcontainers URL")
	password, _ := u.User.Password()

	// 4. Map the dynamic container credentials to your Config struct
	cfg := &config.Config{}
	cfg.Database.Host = u.Hostname()
	cfg.Database.Port = u.Port()
	cfg.Database.User = u.User.Username()
	cfg.Database.Password = password
	cfg.Database.Name = strings.TrimPrefix(u.Path, "/")

	// 5. Initialize your DB client
	client := New(cfg)
	assert.NotNil(t, client)
	assert.NotNil(t, client.DB)

	// 6. Run the migration
	client.AutoMigrate()

	// 7. Verify that GORM actually created the tables
	assert.True(t, client.DB.Migrator().HasTable("tracks"), "tracks table should exist")
	assert.True(t, client.DB.Migrator().HasTable("users"), "users table should exist")
}
