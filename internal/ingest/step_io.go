package ingest

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

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
		return err
	}
	ctx.Track = &track
	ctx.OrgID = track.OrganizationID.String()

	baseName := filepath.Base(ctx.Payload.FileKey)
	ext := filepath.Ext(baseName)
	nameWithoutExt := strings.TrimSuffix(baseName, ext)

	ctx.RawPath = filepath.Join(ctx.Worker.cfg.Server.TempDir, "raw_"+baseName)
	ctx.CleanPath = filepath.Join(ctx.Worker.cfg.Server.TempDir, "clean_"+nameWithoutExt+".mp3")
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
		obj, err = ctx.Worker.storage.DownloadMasterFile(ctx.Track.MasterKey)
		if err != nil {
			obj, err = ctx.Worker.storage.DownloadFile(ctx.Track.Key)
		}
	} else {
		obj, err = ctx.Worker.storage.DownloadIngestFile(ctx.Payload.FileKey)
	}

	if err != nil {
		return err
	}
	defer obj.Body.Close()

	fRaw, err := os.Create(ctx.RawPath)
	if err != nil {
		return err
	}
	defer fRaw.Close()

	_, err = io.Copy(fRaw, obj.Body)
	return err
}

// -----------------------------------------------------------------------------
// VAULT STEP (Master File Archive)
// -----------------------------------------------------------------------------
type VaultStep struct{}

func (s *VaultStep) Name() string { return "archiving master" }

func (s *VaultStep) Execute(ctx *ProcessingContext) error {
	if ctx.Payload.IsRetry {
		return nil // Skip on retries
	}

	fMaster, err := os.Open(ctx.RawPath)
	if err != nil {
		return nil // Non-fatal, just a warning in logs
	}
	defer fMaster.Close()

	safeFilename := strings.ReplaceAll(filepath.Base(ctx.Payload.FileKey), " ", "_")
	masterKey := fmt.Sprintf("vault/%s/%d_%s", ctx.OrgID, ctx.Payload.TrackID, safeFilename)

	if err := ctx.Worker.storage.UploadMasterFile(masterKey, fMaster, "audio/mpeg"); err == nil {
		ctx.Worker.db.DB.Model(ctx.Track).Update("MasterKey", masterKey)
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

	fClean, err := os.Open(ctx.CleanPath)
	if err != nil {
		return err
	}
	defer fClean.Close()

	return ctx.Worker.storage.UploadAssetFile(ctx.DestKey, fClean, "audio/mpeg", "public, max-age=31536000")
}
