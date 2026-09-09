package radio

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"

	"momo-radio/internal/logger"
)

func (e *Engine) startRedirectServer() {
	port := ":8080"

	http.HandleFunc("/listen", func(w http.ResponseWriter, r *http.Request) {
		orgID := r.URL.Query().Get("org_id")
		mount := r.URL.Query().Get("mount")

		if orgID == "" {
			http.Error(w, "Missing org_id parameter", http.StatusBadRequest)
			return
		}
		if mount == "" {
			mount = "radio"
		}

		var baseURL string
		if e.cfg.CDN.Enabled && e.cfg.CDN.Assets != "" {
			baseURL = strings.TrimRight(e.cfg.CDN.Assets, "/")
		} else if e.cfg.MediaMTX.HLSURL != "" {
			baseURL = strings.TrimRight(e.cfg.MediaMTX.HLSURL, "/")
		} else {
			baseURL = "http://localhost:8888"
		}

		publicURL := fmt.Sprintf("%s/%s/%s/index.m3u8", baseURL, orgID, mount)
		http.Redirect(w, r, publicURL, http.StatusFound)
	})

	http.Handle("/_metrics", promhttp.Handler())

	logger.Log.Info("Helper Server listening", zap.String("port", port))
	_ = http.ListenAndServe(port, nil)
}
