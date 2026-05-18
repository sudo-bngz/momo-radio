package ingest

import (
	"bytes"
	"fmt"
	"log"
	"os"
	"os/exec"

	"momo-radio/internal/models"
)

// -----------------------------------------------------------------------------
// WAVEFORM GENERATION STEP
// -----------------------------------------------------------------------------
type WaveformStep struct{}

func (s *WaveformStep) Name() string { return "generating_waveform" }

func (s *WaveformStep) Execute(ctx *ProcessingContext) error {
	// ⚡️ Use RawPath, which is guaranteed to exist throughout the pipeline
	jsonOutputPath := ctx.RawPath + ".json"

	// Run the BBC audiowaveform CLI tool
	cmd := exec.CommandContext(ctx.Ctx, "audiowaveform",
		"-i", ctx.RawPath,
		"-o", jsonOutputPath,
		"-z", "64",
		"-b", "8",
	)

	// Capture stderr for better debugging if a corrupted file slips through
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("audiowaveform failed: %w | stderr: %s", err, stderr.String())
	}

	// Ensure the temp JSON file is cleaned up when this step finishes
	defer os.Remove(jsonOutputPath)

	// Read the generated JSON file
	waveformJSON, err := os.ReadFile(jsonOutputPath)
	if err != nil {
		return fmt.Errorf("failed to read waveform json: %w", err)
	}

	// 4. Upload to Storage Bucket
	waveformKey := fmt.Sprintf("organizations/%s/waveforms/%s.json", ctx.OrgID, ctx.Payload.TrackIDStr())

	err = ctx.Worker.storage.UploadAssetFile(waveformKey, bytes.NewReader(waveformJSON), "application/json", "max-age=31536000")
	if err != nil {
		return fmt.Errorf("failed to upload waveform to storage: %w", err)
	}

	// 5. Update the Database Directly
	err = ctx.Worker.db.DB.Model(&models.Track{}).Where("id = ?", ctx.Payload.TrackID).Update("waveform_key", waveformKey).Error
	if err != nil {
		log.Printf("Warning: failed to update DB with waveform key for track %d: %v", ctx.Payload.TrackID, err)
	}

	// Update the context model if it's already instantiated
	if ctx.Track != nil {
		ctx.Track.WaveformKey = waveformKey
	}

	log.Printf("Successfully generated and uploaded waveform for track %d", ctx.Payload.TrackID)
	return nil
}
