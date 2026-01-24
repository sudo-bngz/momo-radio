package metadata

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"os/exec"
	"strings"

	"github.com/bogem/id3v2"
	"github.com/go-flac/go-flac"
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

func StampMP3(path string, tags map[string]string) error {
	tag, err := id3v2.Open(path, id3v2.Options{Parse: true})
	if err != nil {
		return err
	}
	defer tag.Close()

	tag.SetTitle(tags["TITLE"])
	tag.SetArtist(tags["ARTIST"])
	tag.SetAlbum(tags["ALBUM"])
	tag.SetGenre(tags["GENRE"])
	tag.SetYear(tags["DATE"])

	if v := tags["BPM"]; v != "" {
		tag.AddTextFrame("TBPM", tag.DefaultEncoding(), v)
	}
	if v := tags["KEY"]; v != "" {
		tag.AddTextFrame("TKEY", tag.DefaultEncoding(), v)
	}

	return tag.Save()
}

// stampFLAC manually constructs a Vorbis Comment block since go-flac is low-level.
func StampFLAC(path string, tags map[string]string) error {
	f, err := flac.ParseFile(path) //
	if err != nil {
		return err
	}

	// 1. Filter out existing VorbisComment blocks to avoid duplicates
	var newMeta []*flac.MetaDataBlock
	for _, m := range f.Meta {
		if m.Type != flac.VorbisComment {
			newMeta = append(newMeta, m)
		}
	}

	// 2. Create the new Vorbis Comment Block Data
	// Format: [Vendor Len][Vendor String][Comment List Len][Comment 0 Len][Comment 0 String]...
	vendor := "MomoRadioIngester"

	var buf bytes.Buffer

	// Write Vendor Length (Little Endian uint32)
	binary.Write(&buf, binary.LittleEndian, uint32(len(vendor)))
	// Write Vendor String
	buf.WriteString(vendor)

	// Count valid tags
	validTags := 0
	for _, v := range tags {
		if v != "" {
			validTags++
		}
	}

	// Write User Comment List Length
	binary.Write(&buf, binary.LittleEndian, uint32(validTags))

	// Write Each Comment
	for k, v := range tags {
		if v == "" {
			continue
		}
		// Format "KEY=VALUE"
		commentStr := k + "=" + v

		// Write Comment Length
		binary.Write(&buf, binary.LittleEndian, uint32(len(commentStr)))
		// Write Comment String
		buf.WriteString(commentStr)
	}

	// 3. Construct the Block
	cmdb := &flac.MetaDataBlock{
		Type: flac.VorbisComment, //
		Data: buf.Bytes(),        //
	}

	// 4. Append to Meta (Must be after StreamInfo)
	// Usually StreamInfo is at index 0, so we append our new block after existing blocks
	newMeta = append(newMeta, cmdb)
	f.Meta = newMeta

	return f.Save(path) //
}
