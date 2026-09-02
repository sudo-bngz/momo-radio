package search

import (
	"log"

	"momo-radio/internal/config"

	"github.com/meilisearch/meilisearch-go"
)

func InitMeilisearch(cfg *config.Config) meilisearch.ServiceManager {
	client := meilisearch.New(cfg.Meilisearch.Host, meilisearch.WithAPIKey(cfg.Meilisearch.MasterKey))

	index := client.Index("tracks")

	// Reverted back to []any to satisfy the compiler
	filterable := []any{
		"organization_id",
		"genre",
		"style",
		"mood",
		"scale",
		"musical_key",
		"bpm",
		"artists_names",
		"album_title",
		"year",
		"publisher",
	}
	if _, err := index.UpdateFilterableAttributes(&filterable); err != nil {
		log.Fatalf("Failed to configure Meilisearch filters: %v", err)
	}

	searchable := []string{
		"title",
		"artists_names",
		"album_title",
		"scale",
		"musical_key",
		"genre",
		"style",
		"mood",
		"ml_characteristics",
	}
	if _, err := index.UpdateSearchableAttributes(&searchable); err != nil {
		log.Fatalf("Failed to configure Meilisearch searchable attributes: %v", err)
	}

	sortable := []string{
		"bpm",
		"duration",
	}
	if _, err := index.UpdateSortableAttributes(&sortable); err != nil {
		log.Fatalf("Failed to configure Meilisearch sortable attributes: %v", err)
	}

	return client
}
