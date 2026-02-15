import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import type { DashboardData, NowPlayingInfo } from '../../../types';

export const useDashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchDashboardData = async () => {
    try {
      const result = await api.getDashboardStats();
      setData(result);
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Refresh every 30 seconds to keep the "Now Playing" and Stats fresh
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Helper to format bytes from the DB into human-readable GB
   */
  const formatStorage = (bytes: number): string => {
    if (!bytes || bytes === 0) return "0 GB";
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  /**
   * Helper to calculate time remaining for the current track
   */
  const getTimeRemaining = (nowPlaying: NowPlayingInfo | null): string => {
    if (!nowPlaying) return "--:--";
    
    const end = new Date(nowPlaying.ends_at).getTime();
    const now = new Date().getTime();
    const diffMs = end - now;

    if (diffMs <= 0) return "0:00";

    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    isLoading,
    stats: {
      totalTracks: data?.stats.total_tracks ?? 0,
      totalPlaylists: data?.stats.total_playlists ?? 0,
      uptime: data?.stats.uptime ?? "100%",
      storageUsed: formatStorage(data?.stats.storage_used_bytes ?? 0)
    },
    recentTracks: data?.recent_tracks ?? [],
    nowPlaying: data?.now_playing ? {
      ...data.now_playing,
      timeRemaining: getTimeRemaining(data.now_playing)
    } : {
      title: "Silence",
      artist: "Station Offline",
      playlist_name: "No Schedule",
      timeRemaining: "--:--"
    }
  };
};