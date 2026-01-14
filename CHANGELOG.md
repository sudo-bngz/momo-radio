## [unreleased]

### 🚀 Features

- *(ingest)* Add repair mode to backfill and correct track metadata
- *(metadata)* Prioritize internal tags and implement database-driven repair
- *(ingest)* Integrate Essentia deep acoustic analysis and optimize container
- *(ingest)* Enable multi-arch Docker builds and expand metadata schema
- *(radio)* Implement smart track rotation and play stats persistence
- *(dj)* Implement true random shuffle with repetition protection

### 🐛 Bug Fixes

- *(audio)* Update Essentia JSON mapping for version 2.1-beta6

### 🚜 Refactor

- *(ingest)* Optimize Essentia build for Atom C2750 and implement WAV-bypass
## [0.2.1] - 2026-01-11

### 🚀 Features

- *(streamer)* Implement caching and prefetching
- *(api)* Initial implementation of HTTP API server
- *(dj)* Implement tracks scheduling
- *(ingest)* Implement filename sanitization and intelligent metadata merging
- *(metadata)* Improve Discogs genre/style extraction and release selection

### 🐛 Bug Fixes

- *(stream)* Remove blocking error if corrupted streaming
- *(ingest)* Add file validation and prioritize Discogs metadata

### 📚 Documentation

- *(readme)* Update documenation
- *(readme)* Typo

### ⚙️ Miscellaneous Tasks

- *(ci)* Integrate api server into CI
## [0.2.0] - 2025-12-19

### 🚀 Features

- *(ingester)* Add prometheus metrics, iTunes enrichment, and robust env config
- *(cache)* Setup cache tracks listing
- *(db)* Integrate PostgreSQL for track metadata persistence and selection
- *(metadata)* Integrate Discogs for original label discovery

### 🐛 Bug Fixes

- *(config)* Setup default env values

### 🚜 Refactor

- [**breaking**] Modularize architecture, add metrics and metadata enrichment
## [0.1.0-alpha.1] - 2025-11-25

### 🚀 Features

- *(init)* Setup repository
- *(ci)* Setup Github actions
- *(ui)* Setup webpage

### 📚 Documentation

- *(readme)* Update README.md
- *(readme)* Update README.md for Docker
- *(archi)* Update diagram architecture
