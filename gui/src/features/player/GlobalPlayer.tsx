import { useEffect, useState } from 'react';
import { Box, Flex, HStack, Text, Badge } from '@chakra-ui/react';
import { usePlayer } from '../../context/PlayerContext';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../services/api';

import { TrackInfo } from './components/TrackInfo';
import { PlaybackControls } from './components/PlaybackControls';
import { VolumeControl } from './components/VolumeControl';
import { WaveSurferPlayer } from './WaveSurferPlayer';

interface NowPlayingMetadata {
  artist: string;
  title: string;
  playlist_name?: string;
  starts_at?: string;
  ends_at?: string;
}

export const GlobalPlayer = () => {
  const { 
    currentTrack, isPlaying, isPlayerVisible, setPlayerVisible, audioRef 
  } = usePlayer();

  const activeOrgId = useAuthStore((state) => state.activeOrganizationId);

  // Live metadata state
  const [nowPlaying, setNowPlaying] = useState<NowPlayingMetadata | null>(null);
  const [liveProgress, setLiveProgress] = useState(0);
  const [liveCurrentTime, setLiveCurrentTime] = useState("0:00");
  const [liveDuration, setLiveDuration] = useState("0:00");

  const isLiveStream = String(currentTrack?.id).startsWith('live-');

  useEffect(() => { 
    if (isPlaying) setPlayerVisible(true); 
  }, [isPlaying, setPlayerVisible]);

  // 1. POLL STATS WHEN STREAMING LIVE
  useEffect(() => {
    if (!isLiveStream || !isPlaying) {
      setNowPlaying(null);
      return;
    }

    const fetchStats = async () => {
      try {
        const stats = await api.getDashboardStats();
        if (stats?.now_playing) {
          setNowPlaying(stats.now_playing);
        }
      } catch (err) {
        console.warn("Failed to fetch live broadcast stats:", err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Poll every 5s

    return () => clearInterval(interval);
  }, [isLiveStream, isPlaying, activeOrgId]);

  // 2. COMPUTE LIVE TRACK TIMING (starts_at -> ends_at)
  useEffect(() => {
    if (!isLiveStream || !nowPlaying?.starts_at || !nowPlaying?.ends_at) return;

    const start = new Date(nowPlaying.starts_at).getTime();
    const end = new Date(nowPlaying.ends_at).getTime();
    const totalDurationSec = Math.max(0, (end - start) / 1000);

    const updateTimer = () => {
      const now = Date.now();
      const elapsedSec = Math.max(0, (now - start) / 1000);
      const pct = Math.min(100, Math.max(0, (elapsedSec / totalDurationSec) * 100));

      setLiveProgress(pct);
      setLiveCurrentTime(formatTime(elapsedSec));
      setLiveDuration(formatTime(totalDurationSec));
    };

    updateTimer();
    const ticker = setInterval(updateTimer, 1000);

    return () => clearInterval(ticker);
  }, [isLiveStream, nowPlaying]);

  const isOffScreen = !isPlayerVisible || !currentTrack;
  const currentTime = audioRef.current?.currentTime || 0;
  const duration = audioRef.current?.duration || 0;

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <style>
        {`
          @keyframes pulseRed {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.85); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}
      </style>

      {/* 1. THE VISUAL PLAYER */}
      <Box 
        position="fixed" bottom={0} left={0} right={0} h="76px" 
        bg="gray.50" borderTop="1px solid" borderColor="gray.200"
        zIndex={9999} px={6}
        transform={isOffScreen ? "translateY(100%)" : "translateY(0)"}
        transition="transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
      >
        <Flex h="full" align="center" gap={6}>
          {/* Left: Track Info (With Live Override) */}
          <Box minW="220px" maxW="300px">
            {isLiveStream && nowPlaying ? (
              <HStack gap={3}>
                <Box>
                  <HStack gap={2} mb={0.5}>
                    <Badge color="red.600" bg="red.50" fontSize="10px" px={1.5} borderRadius="sm">
                      LIVE
                    </Badge>
                    <Text fontSize="xs" fontWeight="bold" color="gray.800" lineClamp={1}>
                      {nowPlaying.title}
                    </Text>
                  </HStack>
                  <Text fontSize="xs" color="gray.500" lineClamp={1}>
                    {nowPlaying.artist} {nowPlaying.playlist_name ? `• ${nowPlaying.playlist_name}` : ''}
                  </Text>
                </Box>
              </HStack>
            ) : (
              <TrackInfo />
            )}
          </Box>

          {/* Controls */}
          <HStack gap={3} flexShrink={0}>
            <PlaybackControls />
          </HStack>

          {/* Center: Waveform (Library) OR Live Progress Bar */}
          <HStack flex="1" gap={4} ml={4} minW="0">
            <Text fontSize="xs" color="gray.500" fontVariantNumeric="tabular-nums" w="35px" textAlign="right">
              {isLiveStream ? liveCurrentTime : formatTime(currentTime)}
            </Text>
            
            <Box flex="1" h="40px" display="flex" alignItems="center">
              {isLiveStream ? (
                // Live Stream Track Progress Bar
                <Box w="100%" h="6px" bg="gray.200" borderRadius="full" overflow="hidden" position="relative">
                  <Box 
                    h="100%" 
                    bg="red.500" 
                    w={`${liveProgress}%`} 
                    transition="width 1s linear" 
                    borderRadius="full"
                  />
                </Box>
              ) : (
                // Static Waveform for Library Tracks
                currentTrack && audioRef.current && (
                  <WaveSurferPlayer 
                    key={currentTrack.id}
                    audioRef={audioRef}
                    trackId={currentTrack.id}
                    isPlaying={isPlaying}
                    waveformKey={currentTrack.waveform_key} 
                    orgId={currentTrack.organization_id} 
                  />
                )
              )}
            </Box>
            
            <Text fontSize="xs" color="gray.500" fontVariantNumeric="tabular-nums" w="35px">
              {isLiveStream ? liveDuration : formatTime(duration)}
            </Text>
          </HStack>

          {/* Right: Volume */}
          <Box flexShrink={0}>
            <VolumeControl />
          </Box>
        </Flex>
      </Box>

      {/* 2. THE INVISIBLE SPACER */}
      <Box 
        w="100%" 
        h={!isOffScreen ? "76px" : "0px"} 
        transition="height 0.4s cubic-bezier(0.4, 0, 0.2, 1)" 
        flexShrink={0}
      />
    </>
  );
};