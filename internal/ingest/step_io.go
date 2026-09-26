package ingest

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/hibiken/asynq"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"momo-radio/internal/logger"
	"momo-radio/internal/models"
	"momo-radio/internal/storage"
)

// -----------------------------------------------------------------------------
// SETUP STEP
// -----------------------------------------------------------------------------
type SetupStep struct{}

func (s *SetupStep) Name() string { return "initializing" }

func (s *SetupStep) Execute(ctx *ProcessingContext) error {
	var track models.Track

	if err := ctx.Worker.db.DB.First(&track, ctx.Payload.TrackID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			logger.Log.Warn("Track not found in DB. It was likely deleted by the user. Aborting task cleanly.",
				zap.Any("track_id", ctx.Payload.TrackID),
			)
			// Returning asynq.SkipRetry tells the queue manager to delete this task immediately without retrying
			return fmt.Errorf("track %d deleted, skipping processing: %w", ctx.Payload.TrackID, asynq.SkipRetry)
		}

		logger.Log.Error("Failed to fetch track during setup",
			zap.Any("track_id", ctx.Payload.TrackID),
			zap.Error(err),
		)
		return err
	}

	ctx.Track = &track
	ctx.OrgID = track.OrganizationID.String()

	baseName := filepath.Base(ctx.Payload.FileKey)
	ext := filepath.Ext(baseName)
	nameWithoutExt := strings.TrimSuffix(baseName, ext)

	ctx.RawPath = filepath.Join(ctx.Worker.cfg.Server.TempDir, "raw_"+baseName)
	ctx.CleanPath = filepath.Join(ctx.Worker.cfg.Server.TempDir, "clean_"+nameWithoutExt+".mp3")

	logger.Log.Debug("Setup step complete",
		zap.Any("track_id", track.ID),
		zap.String("raw_path", ctx.RawPath),
		zap.String("clean_path", ctx.CleanPath),
	)
	return nil
}

// -----------------------------------------------------------------------------
// DOWNLOAD STEP
// -----------------------------------------------------------------------------
type DownloadStep struct{}

func (s *DownloadStep) Name() string { return "downloading" }

func (s *DownloadStep) Execute(ctx *ProcessingContext) error {
	var obj *storage.FileObject
	var err error

	if ctx.Payload.IsRetry {
		logger.Log.Debug("Retry payload detected, attempting to download master file",
			zap.Any("track_id", ctx.Track.ID),
			zap.String("master_key", ctx.Track.MasterKey),
		)
		obj, err = ctx.Worker.storage.DownloadMasterFile(ctx.Track.MasterKey)
		if err != nil {
			logger.Log.Warn("Failed to download master file on retry, falling back to CDN key",
				zap.Any("track_id", ctx.Track.ID),
				zap.Error(err),
			)
			obj, err = ctx.Worker.storage.DownloadFile(ctx.Track.Key)
		}
	} else {
		logger.Log.Debug("Downloading ingest file",
			zap.Any("track_id", ctx.Track.ID),
			zap.String("file_key", ctx.Payload.FileKey),
		)
		obj, err = ctx.Worker.storage.DownloadIngestFile(ctx.Payload.FileKey)
	}

	if err != nil {
		logger.Log.Error("Failed to download file",
			zap.Any("track_id", ctx.Track.ID),
			zap.Error(err),
		)
		return err
	}
	defer obj.Body.Close()

	fRaw, err := os.Create(ctx.RawPath)
	if err != nil {
		logger.Log.Error("Failed to create local raw file",
			zap.Any("track_id", ctx.Track.ID),
			zap.String("raw_path", ctx.RawPath),
			zap.Error(err),
		)
		return err
	}
	defer fRaw.Close()

	_, err = io.Copy(fRaw, obj.Body)
	if err != nil {
		logger.Log.Error("Failed to write downloaded bytes to disk",
			zap.Any("track_id", ctx.Track.ID),
			zap.Error(err),
		)
		return err
	}

	logger.Log.Info("Successfully downloaded file", zap.Any("track_id", ctx.Track.ID))
	return nil
}

// -----------------------------------------------------------------------------
// VAULT STEP (Master File Archive)
// -----------------------------------------------------------------------------
type VaultStep struct{}

func (s *VaultStep) Name() string { return "archiving master" }

func (s *VaultStep) Execute(ctx *ProcessingContext) error {
	if ctx.Payload.IsRetry {
		logger.Log.Debug("Skipping vault step for retry", zap.Any("track_id", ctx.Track.ID))
		return nil // Skip on retries
	}

	fMaster, err := os.Open(ctx.RawPath)
	if err != nil {
		logger.Log.Warn("Failed to open raw file for vaulting (non-fatal)",
			zap.Any("track_id", ctx.Track.ID),
			zap.String("raw_path", ctx.RawPath),
			zap.Error(err),
		)
		return nil // Non-fatal, just a warning in logs
	}
	defer fMaster.Close()

	safeFilename := strings.ReplaceAll(filepath.Base(ctx.Payload.FileKey), " ", "_")
	masterKey := fmt.Sprintf("vault/%s/%d_%s", ctx.OrgID, ctx.Payload.TrackID, safeFilename)

	if err := ctx.Worker.storage.UploadMasterFile(masterKey, fMaster, "audio/mpeg"); err == nil {
		ctx.Worker.db.DB.Model(ctx.Track).Update("MasterKey", masterKey)
		logger.Log.Info("Successfully vaulted master file",
			zap.Any("track_id", ctx.Track.ID),
			zap.String("master_key", masterKey),
		)
	} else {
		logger.Log.Error("Failed to vault master file",
			zap.Any("track_id", ctx.Track.ID),
			zap.String("master_key", masterKey),
			zap.Error(err),
		)
	}
	return nil
}

// -----------------------------------------------------------------------------
// UPLOAD STEP (Final CDN Asset)
// -----------------------------------------------------------------------------
type UploadStep struct{}

func (s *UploadStep) Name() string { return "uploading" }

func (s *UploadStep) Execute(ctx *ProcessingContext) error {
	baseDestinationKey := BuildPath(*ctx.Meta, ctx.Payload.FileKey)
	finalExt := filepath.Ext(baseDestinationKey)
	pathWithoutExt := strings.TrimSuffix(baseDestinationKey, finalExt)

	ctx.DestKey = fmt.Sprintf("library/%s/%s_%d%s", ctx.OrgID, pathWithoutExt, ctx.Payload.TrackID, finalExt)

	logger.Log.Debug("Starting CDN asset upload",
		zap.Any("track_id", ctx.Track.ID),
		zap.String("dest_key", ctx.DestKey),
	)

	fClean, err := os.Open(ctx.CleanPath)
	if err != nil {
		logger.Log.Error("Failed to open clean file for upload",
			zap.Any("track_id", ctx.Track.ID),
			zap.String("clean_path", ctx.CleanPath),
			zap.Error(err),
		)
		return err
	}
	defer fClean.Close()

	err = ctx.Worker.storage.UploadAssetFile(ctx.DestKey, fClean, "audio/mpeg", "public, max-age=31536000")
	if err != nil {
		logger.Log.Error("Failed to upload CDN asset",
			zap.Any("track_id", ctx.Track.ID),
			zap.String("dest_key", ctx.DestKey),
			zap.Error(err),
		)
		return err
	}

	logger.Log.Info("Successfully uploaded CDN asset",
		zap.Any("track_id", ctx.Track.ID),
		zap.String("dest_key", ctx.DestKey),
	)
	return nil
}
