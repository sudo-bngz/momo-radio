package rekordbox

import (
	"encoding/xml"
	"fmt"
	"momo-radio/internal/models"
	"net/url"
	"path/filepath"
)

// The Root Element
type DJPlaylists struct {
	XMLName    xml.Name   `xml:"DJ_PLAYLISTS"`
	Version    string     `xml:"Version,attr"`
	Product    Product    `xml:"PRODUCT"`
	Collection Collection `xml:"COLLECTION"`
	Playlists  Playlists  `xml:"PLAYLISTS"`
}

type Product struct {
	Name    string `xml:"Name,attr"`
	Version string `xml:"Version,attr"`
	Company string `xml:"Company,attr"`
}

type Collection struct {
	Entries int     `xml:"Entries,attr"`
	Tracks  []Track `xml:"TRACK"`
}

type Track struct {
	TrackID    int    `xml:"TrackID,attr"`
	Name       string `xml:"Name,attr"`
	Artist     string `xml:"Artist,attr"`
	Album      string `xml:"Album,attr"`
	Genre      string `xml:"Genre,attr"`
	Kind       string `xml:"Kind,attr"` // e.g., "MP3 File"
	Size       int    `xml:"Size,attr"`
	TotalTime  int    `xml:"TotalTime,attr"`
	Year       string `xml:"Year,attr"`
	AverageBpm string `xml:"AverageBpm,attr"`
	DateAdded  string `xml:"DateAdded,attr"`
	BitRate    int    `xml:"BitRate,attr"`
	SampleRate int    `xml:"SampleRate,attr"`
	PlayCount  int    `xml:"PlayCount,attr"`
	Location   string `xml:"Location,attr"`
	Tonality   string `xml:"Tonality,attr"`
	Label      string `xml:"Label,attr"`
}

// Playlist Hierarchy
type Playlists struct {
	RootNode Node `xml:"NODE"`
}

type Node struct {
	Type    int      `xml:"Type,attr"` // 0 = Folder, 1 = Playlist
	Name    string   `xml:"Name,attr"`
	Count   int      `xml:"Count,attr"`   // For Folders
	Entries int      `xml:"Entries,attr"` // For Playlists
	KeyType int      `xml:"KeyType,attr"` // 0 = TrackID
	Nodes   []Node   `xml:"NODE,omitempty"`
	Tracks  []PTrack `xml:"TRACK,omitempty"`
}

type PTrack struct {
	Key int `xml:"Key,attr"` // Maps to Track.TrackID
}

func GenerateXML(playlistName string, tracks []models.Track) ([]byte, error) {
	rbx := DJPlaylists{
		Version: "1.0.0",
		Product: Product{
			Name:    "Momo Radio",
			Version: "1.0",
			Company: "Momo Corp",
		},
	}

	// 1. Build the COLLECTION (The master database of files)
	collection := Collection{
		Entries: len(tracks),
		Tracks:  make([]Track, 0),
	}

	// 2. Build the PLAYLIST entries (Just pointers to the TrackIDs)
	pNode := Node{
		Type:    1, // 1 = Playlist
		Name:    playlistName,
		Entries: len(tracks),
		KeyType: 0, // 0 = Match by TrackID
		Tracks:  make([]PTrack, 0),
	}

	for _, t := range tracks {
		// ⚡️ CRITICAL: Rekordbox expects URI encoded file paths!
		// We assume the audio files will be sitting right next to the XML in the unzipped folder
		safeFilename := url.PathEscape(filepath.Base(t.Key))
		location := fmt.Sprintf("file://localhost/%s", safeFilename)

		xmlTrack := Track{
			TrackID:    int(t.ID),
			Name:       t.Title,
			Artist:     t.Artist.Name,
			Album:      t.Album.Title,
			Genre:      t.Genre,
			Kind:       "MP3 File", // Assuming mp3 from worker
			Size:       t.FileSize,
			TotalTime:  int(t.Duration),
			AverageBpm: fmt.Sprintf("%.2f", t.BPM),
			BitRate:    t.Bitrate / 1000, // Convert bps to kbps
			SampleRate: 44100,            // Standard assumption, or save this in DB during ingest!
			Location:   location,
			Tonality:   t.MusicalKey,
			Label:      t.Album.Publisher,
		}

		collection.Tracks = append(collection.Tracks, xmlTrack)
		pNode.Tracks = append(pNode.Tracks, PTrack{Key: int(t.ID)})
	}

	rbx.Collection = collection

	// Build the Root folder structure required by Rekordbox
	rbx.Playlists.RootNode = Node{
		Type:  0, // Folder
		Name:  "ROOT",
		Count: 1,
		Nodes: []Node{pNode},
	}

	// Generate the XML bytes with proper indentation
	output, err := xml.MarshalIndent(rbx, "", "  ")
	if err != nil {
		return nil, err
	}

	// Rekordbox requires the XML header
	finalXML := []byte(xml.Header + string(output))
	return finalXML, nil
}
