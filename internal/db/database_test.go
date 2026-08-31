package database

import (
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"momo-radio/internal/config"
	"momo-radio/internal/testutils"
)

func TestDatabaseMigration(t *testing.T) {
	// 1. Spin up the isolated Postgres container
	connStr := testutils.SetupPostgres(t)

	// 2. Parse the returned URL string
	u, err := url.Parse(connStr)
	assert.NoError(t, err, "failed to parse testcontainers URL")
	password, _ := u.User.Password()

	// 3. Map the dynamic container credentials to your Config struct
	cfg := &config.Config{}
	cfg.Database.Host = u.Hostname()
	cfg.Database.Port = u.Port()
	cfg.Database.User = u.User.Username()
	cfg.Database.Password = password
	cfg.Database.Name = strings.TrimPrefix(u.Path, "/")

	// 4. Initialize your DB client directly (no package prefix needed)
	client := New(cfg)
	assert.NotNil(t, client)
	assert.NotNil(t, client.DB)

	// 5. Run the migration
	client.AutoMigrate()

	// 6. Verify that GORM actually created the tables
	assert.True(t, client.DB.Migrator().HasTable("tracks"), "tracks table should exist")
	assert.True(t, client.DB.Migrator().HasTable("users"), "users table should exist")
}
