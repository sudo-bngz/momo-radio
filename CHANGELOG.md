## [0.6.0-alpha] - 2026-05-15

### 🚀 Features

- Secure ingestion SSE and handle processing states in LibraryView
- *(ingest)* Secure ingestion SSE and handle processing states in LibraryView
- *(gui)* Implement generative visuals and enhance real-time UI states
- *(playlist)* Modernize playlist UI and fix drag-and-drop track sorting
- *(playlist)* Enhance playlist editor with harmonic metadata and artwork
- *(playlist)* Implement playlist artwork mosaics and deep relational preloading
- *(schedule)* Implement strict curated sequencing and looping for playlists
- *(playlist)* Implement infinite scrolling and server-side search in Playlist Builder
- *(playlist)* Implement toast notifications and stabilized infinite scroll in Playlist Builder
- *(ingester)* Implement master vault archiving and manual analysis retry
- *(ingest)* Implement Master Vault fallback for ingestion retries
- *(library)* Enhance TrackDetailDrawer with technical metadata and navigation
- *(worker)* Unify ingester into multi-domain worker and implement Rekordbox export
- *(auth)* Migrate to Supabase & multi-tenant RBAC
- *(auth)* Implement multi-tenancy storage scoping and async logout flow
- *(auth)* Implement real-time session monitoring and timeout handling
- *(streamer)* Scale engine architecture to support concurrent multi-tenancy

### 🐛 Bug Fixes

- *(scheduler)* Resolve scheduler timezone discrepancies and improve track preloading
- *(ingester)* Append track ID to production asset filenames for uniqueness
## [0.5.0] - 2026-04-19

### 🚀 Features

- *(ingest)* Implement deep cleanup of junk files and empty directories
- *(playlist)* Implement playlist editor and broadcast scheduling system
- *(gui)* Implement broadcast scheduler and improve playlist studio UI
- *(gui)* Implement library view and modularize ingestion workflow
- *(radio)* Implement station dashboard and unified orchestrator architecture
- *(rbac)* Implement JWT authentication, RBAC, and modular API structure
- *(gui)* Implement secure frontend auth flow with JWT and TopNav metadata
- *(rbac)* Implement comprehensive auth migration, RBAC, and client-side routing
- *(gui)* Finalize playlist editor CRUD and standardize API schema
- Implement storage abstraction and global audio preview player
- *(gui)* Implement track streaming API and enhanced waveform player
- *(gui)* Modularize global player into feature components and enhance waveform UI
- *(gui)* Overhaul TopNav UI with track marquee and refine library actions
- *(gui)* Implement dynamic layout push for Global Player and refine spacing
- *(gui)* Implement track detail drawer
- *(gui)* Embed React frontend into Go binary for single-artifact deployment
- *(gui)* Optimize library data fetching and implement detail drawer payload
- *(gui)* Implement track metadata editing and database persistence
- Implement recurring and one-time event logic in scheduling system
- *(gui)* Implement server-side library management and virtualization support
- *(gui)* Implement infinite scrolling for library scrolling
- *(gui)* Implement edit mode and tag management for track drawer
- *(gui)* Implement artist profile view and cross-library navigation
- *(ingester)* Implement relational metadata models and data migration
- *(api)* Implement Artist and Album API handlers and enhance track search
- *(gui)* Integrate relational metadata and implement defensive UI handling
- *(gui)* Modernize library sort UI and clean up table layout
- *(cover)* Implement automated album artwork ingestion and retrieval
- *(gui)* Standardize library layout and add breadcrumb navigation
- *(gui)* Integrate custom branding and apply global typography/theming
- *(gui)* Implement dynamic grayscale heat-map for BPM badges
- *(ingest)* Implement asynchronous ingestion worker and real-time status tracking

### 🐛 Bug Fixes

- *(gui)* Synchronize frontend and backend station stats
- *(model)* Use default date in startime and endtime for schedule
- *(gui)* Configure Vite proxy and use relative API paths
- *(storage)* Add region parameter to public URL generation

### ⚙️ Miscellaneous Tasks

- *(ci)* Upgrade ingest builder Dockerimage to Bookworm
- *(docker)* Switch to single-precision FFTW for Essentia build
- *(ci)* Integrate frontend build and API verification into workflow
- *(migrate)* Add migrate script
- *(gui)* Update site metadata and remove unused Vite SVGs
- *(go)* Upgrade go builder to 1.25
## [0.4.0-alpha] - 2026-01-30

### 🚀 Features

- *(ingest)* Add repair mode to backfill and correct track metadata
- *(metadata)* Prioritize internal tags and implement database-driven repair
- *(ingest)* Integrate Essentia deep acoustic analysis and optimize container
- *(ingest)* Enable multi-arch Docker builds and expand metadata schema
- *(radio)* Implement smart track rotation and play stats persistence
- *(dj)* Implement true random shuffle with repetition protection
- *(dj)* Implement smart shuffle with artist separation and fallback logic
- *(metadata)* Enhance discogs enrichment strategy and fix parsing errors
- *(ingester)* Split repair logic into audio and metadata maintenance modes
- *(streamer)* Implement state persistence for seamless restarts
- *(dj)* Implement starvation algorithm for fair track distribution
- *(ingest)* Enhance artist country resolution using MusicBrainz and GeoAPI
- *(admin)* Setup admin with upload and track  pre-analyze
- *(dj)* Implement harmonic mixing and timetable scheduling
- *(radio)* Implement dynamic DJ providers and DB-backed scheduling
- *(seed)* Implement full 24/7 radio grid with genre-specific scheduling
- *(radio)* Implement harmonic daily provider and refined electronic grid
- *(radio)* Implement CLI simulation mode and provider overrides

### 🐛 Bug Fixes

- *(audio)* Update Essentia JSON mapping for version 2.1-beta6
- *(streamer)* Enforce hls continuity and unique segment naming
- *(streamer)* Resolve uploader race condition
- *(ingest)* Improve metadata enrichment and origin resolution

### 🚜 Refactor

- *(ingest)* Optimize Essentia build for Atom C2750 and implement WAV-bypass
- *(ingest)* Implement multi-provider country repair and metadata refactor
- *(ingest)* Implement GeoAPI fallback in country repair logic
- *(dj)* Decouple radio engine and modularize mixing logic
- Simplify StarvationProvider to pure rotation logic

### ⚙️ Miscellaneous Tasks

- *(doc)* Changelog
- *(release)* Add automated GitHub Release workflow
- *(doc)* Update CHANGELOG
- *(ingester)* Remove country resolution during ingestion
- *(doc)* Update CHANGELOG
- *(doc)* Update CHANGELOG
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
