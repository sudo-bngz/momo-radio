import { useEffect } from 'react';
import { Box, Flex, HStack, Text, Badge, Image } from '@chakra-ui/react';
import { usePlayer } from '../../context/PlayerContext';
import { useAuthStore } from '../../store/useAuthStore';

import { TrackInfo } from './components/TrackInfo';
import { PlaybackControls } from './components/PlaybackControls';
import { VolumeControl } from './components/VolumeControl';
import { WaveSurferPlayer } from './WaveSurferPlayer';

export const GlobalPlayer = () => {
  const { 
    currentTrack, isPlaying, isPlayerVisible, setPlayerVisible, audioRef, 
    progress, liveMeta, liveElapsed, liveDuration 
  } = usePlayer();

  const activeOrgId = useAuthStore((state) => state.activeOrganizationId);

  const trackId = String(currentTrack?.id || '');
  const trackUrl = String((currentTrack as any)?.url || (currentTrack as any)?.stream_url || '');
  const isLiveStream = trackId.startsWith('live') || trackId === 'radio' || trackUrl.includes('.m3u8');

  useEffect(() => { 
    if (isPlaying) setPlayerVisible(true); 
  }, [isPlaying, setPlayerVisible]);

  const isOffScreen = !isPlayerVisible || !currentTrack;
  
  // Use Context timing for Live, standard audioRef for Library
  const currentTimeDisplay = isLiveStream ? liveElapsed : (audioRef.current?.currentTime || 0);
  const durationDisplay = isLiveStream ? liveDuration : (audioRef.current?.duration || 0);

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
        // ⚡️ Semantic styling for the player bar
        bg="bg.panel" borderTop="1px solid" borderColor="border"
        zIndex={9999} px={6}
        transform={isOffScreen ? "translateY(100%)" : "translateY(0)"}
        transition="transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
      >
        <Flex h="full" align="center" gap={6}>
         {/* Left: Track Info (With Live Override) */}
          <Box minW="220px" maxW="300px">
            {isLiveStream && liveMeta ? (
              <HStack gap={3}>
                
                {liveMeta.cover_url ? (
                  <Image 
                    src={liveMeta.cover_url} 
                    boxSize="48px" 
                    borderRadius="md" 
                    objectFit="cover" 
                    flexShrink={0}
                  />
                ) : (
                  // ⚡️ Fallback square correctly colored for dark mode
                  <Box boxSize="48px" bg="gray.100" _dark={{ bg: "whiteAlpha.200" }} borderRadius="md" flexShrink={0} />
                )}

                <Box>
                  <HStack gap={2} mb={0.5}>
                    {/* ⚡️ Live badge dynamically flips to deep red in dark mode */}
                    <Badge color="red.600" bg="red.50" _dark={{ color: "red.300", bg: "red.900" }} fontSize="10px" px={1.5} borderRadius="sm">
                      LIVE
                    </Badge>
                    <Text fontSize="xs" fontWeight="bold" color="fg" lineClamp={1}>
                      {liveMeta.title}
                    </Text>
                  </HStack>
                  <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                    {liveMeta.artist} {liveMeta.playlist_name ? `• ${liveMeta.playlist_name}` : ''}
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

          {/* Center: Waveform (Library) OR Live Progress */}
          <HStack flex="1" gap={4} ml={4} minW="0">
            <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums" w="35px" textAlign="right">
              {formatTime(currentTimeDisplay)}
            </Text>
            
            <Box flex="1" h="40px" display="flex" alignItems="center">
              {isLiveStream ? (
                liveMeta?.waveform_url ? (
                  <WaveSurferPlayer 
                    key={`live-${liveMeta.track_id}`}
                    audioRef={null} 
                    trackId={liveMeta.track_id}
                    isPlaying={isPlaying}
                    waveformUrl={liveMeta.waveform_url} 
                    orgId={activeOrgId || ''}
                    liveProgress={progress} 
                  />
                ) : (
                  // Fallback solid bar if the track has no waveform
                  <Box w="100%" h="6px" bg="gray.200" _dark={{ bg: "whiteAlpha.200" }} borderRadius="full" overflow="hidden" position="relative">
                    <Box 
                      h="100%" 
                      bg="red.500" 
                      _dark={{ bg: "red.400" }}
                      w={`${progress}%`} 
                      transition={progress === 0 ? "none" : "width 1s linear"} 
                      borderRadius="full" 
                    />
                  </Box>
                )
              ) : (
                currentTrack && audioRef.current && (
                  <WaveSurferPlayer 
                    key={currentTrack.id}
                    audioRef={audioRef}
                    trackId={currentTrack.id}
                    isPlaying={isPlaying}
                    waveformKey={currentTrack.waveform_key} 
                    orgId={currentTrack.organization_id || activeOrgId || ''} 
                  />
                )
              )}
            </Box>
            
            <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums" w="35px">
              {formatTime(durationDisplay)}
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