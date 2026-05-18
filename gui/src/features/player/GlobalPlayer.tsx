import { useEffect } from 'react';
import { Box, Flex, HStack, Text } from '@chakra-ui/react';
import { usePlayer } from '../../context/PlayerContext';

import { TrackInfo } from './components/TrackInfo';
import { PlaybackControls } from './components/PlaybackControls';
import { VolumeControl } from './components/VolumeControl';
import { WaveSurferPlayer } from './WaveSurferPlayer';

export const GlobalPlayer = () => {
  const { 
    currentTrack, isPlaying, isPlayerVisible, setPlayerVisible, audioRef 
  } = usePlayer();

  useEffect(() => { 
    if (isPlaying) setPlayerVisible(true); 
  }, [isPlaying, setPlayerVisible]);

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
      {/* 1. THE VISUAL PLAYER (Fixed Overlay) */}
      <Box 
        position="fixed" bottom={0} left={0} right={0} h="76px" 
        bg="gray.50" borderTop="1px solid" borderColor="gray.200"
        zIndex={9999} px={6}
        transform={isOffScreen ? "translateY(100%)" : "translateY(0)"}
        transition="transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
      >
        <Flex h="full" align="center" gap={6}>
          {/* Left: Track Info */}
          <TrackInfo />

          {/* Controls */}
          <HStack gap={3} flexShrink={0}>
             <PlaybackControls />
          </HStack>

          {/* Waveform */}
          <HStack flex="1" gap={4} ml={4} minW="0">
            <Text fontSize="xs" color="gray.500" fontVariantNumeric="tabular-nums" w="35px">
              {formatTime(currentTime)}
            </Text>
            
            <Box flex="1" h="40px">
              {/* ⚡️ Only render WaveSurfer if we have a track and an audioRef */}
              {currentTrack && audioRef.current && (
                <WaveSurferPlayer 
                  key={currentTrack.id}
                  audioRef={audioRef}
                  trackId={currentTrack.id}
                  isPlaying={isPlaying}
                  waveformKey={currentTrack.waveform_key} 
                  orgId={currentTrack.organization_id} 
                />
              )}
            </Box>
            
            <Text fontSize="xs" color="gray.500" fontVariantNumeric="tabular-nums" w="35px">
               {formatTime(duration)}
            </Text>
          </HStack>

          {/* Right: Volume */}
          <Box flexShrink={0}>
             <VolumeControl />
          </Box>
        </Flex>
      </Box>

      {/* 2. THE INVISIBLE SPACER (Layout Push) */}
      <Box 
        w="100%" 
        h={!isOffScreen ? "76px" : "0px"} 
        transition="height 0.4s cubic-bezier(0.4, 0, 0.2, 1)" 
        flexShrink={0}
      />
    </>
  );
};