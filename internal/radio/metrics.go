package radio

import "github.com/prometheus/client_golang/prometheus"

var (
	tracksPlayed = prometheus.NewCounterVec(
		prometheus.CounterOpts{Name: "radio_playout_tracks_total", Help: "Tracks played per tenant"},
		[]string{"organization_id"},
	)
	streamRestarts = prometheus.NewCounterVec(
		prometheus.CounterOpts{Name: "radio_stream_restarts_total", Help: "RTMP stream restarts per tenant"},
		[]string{"organization_id"},
	)
	streamErrors = prometheus.NewCounterVec(
		prometheus.CounterOpts{Name: "radio_stream_errors_total", Help: "RTMP stream errors per tenant"},
		[]string{"organization_id"},
	)
)

func RegisterMetrics() {
	prometheus.MustRegister(tracksPlayed, streamRestarts, streamErrors)
}
