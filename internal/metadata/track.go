package metadata

type Track struct {
	Artist        string  `json:"artist"`
	Title         string  `json:"title"`
	Genre         string  `json:"genre"`
	Style         string  `json:"style"`
	Album         string  `json:"album"`
	Year          string  `json:"year"`
	Country       string  `json:"country"`
	Publisher     string  `json:"publisher"`
	BPM           float64 `json:"bpm"`
	Duration      float64 `json:"duration"`
	MusicalKey    string  `json:"musical_key"`
	Scale         string  `json:"scale"`
	Danceability  float64 `json:"danceability"`
	Loudness      float64 `json:"loudness"`
	CatalogNumber string  `json:"catalog_number"`
}
