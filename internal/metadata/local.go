package metadata

import (
	"encoding/json"
	"os/exec"
	"strings"
)

// GetLocal reads tags from a file using ffprobe.
func GetLocal(path string) (Track, error) {
	cmd := exec.Command("ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", path)
	out, err := cmd.Output()
	if err != nil {
		return Track{}, err
	}

	var data struct {
		Format struct {
			Tags map[string]string `json:"tags"`
		} `json:"format"`
	}
	if err := json.Unmarshal(out, &data); err != nil {
		return Track{}, err
	}

	tags := data.Format.Tags
	getTag := func(keys ...string) string {
		for _, k := range keys {
			// Check standard, uppercase, and lowercase (ID3 vs Vorbis)
			for _, variant := range []string{k, strings.ToUpper(k), strings.ToLower(k)} {
				if val := tags[variant]; val != "" {
					return strings.TrimSpace(val)
				}
			}
		}
		return ""
	}

	return Track{
		Artist:    getTag("artist", "albumartist", "TPE1", "TPE2"),
		Title:     getTag("title", "TIT2"),
		Album:     getTag("album", "TALB"),
		Genre:     getTag("genre", "TCON"),
		Year:      getTag("date", "year", "TYER", "TDRC", "creation_time"),
		Publisher: getTag("publisher", "label", "organization", "TPUB"),
	}, nil
}
