import { useEffect } from 'react';
import { Box, Flex, HStack, Text } from '@chakra-ui/react';
import { usePlayer } from '../../context/PlayerContext';

import { TrackInfo } from './components/TrackInfo';
import { PlaybackControls } from './components/PlaybackControls';
import { VolumeControl } from './components/VolumeControl';
import { WaveSurferPlayer } from './WaveSurferPlayer'; // Keep this here or move to features/ too

export const GlobalPlayer = () => {
  const { 
    currentTrack, isPlaying, isPlayerVisible, setPlayerVisible, audioRef 
  } = usePlayer();

  useEffect(() => { if (isPlaying) setPlayerVisible(true); }, [isPlaying, setPlayerVisible]);

  const isOffScreen = !isPlayerVisible || !currentTrack;
  const currentTime = audioRef.current?.currentTime || 0;
  const duration = audioRef.current?.duration || 0;

  // Simple time formatter
  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Box 
      position="fixed" bottom={0} left={0} right={0} h="75px" 
      bg="gray.50" borderTop="1px solid" borderColor="gray.200"
      zIndex={9999} px={6}
      transform={isOffScreen ? "translateY(100%)" : "translateY(0)"}
      transition="transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
    >
      <Flex h="full" align="center" gap={6}>
        
        {/* 1. Left Section */}
        <TrackInfo />

        {/* 2. Middle Section: Controls + Waveform */}
        <HStack gap={3}>
           <PlaybackControls />
        </HStack>

        <HStack flex="1" gap={4} ml={4}>
          <Text fontSize="xs" color="gray.500" fontVariantNumeric="tabular-nums" w="35px">
            {formatTime(currentTime)}
          </Text>
          
          <Box flex="1" h="40px">
            {currentTrack && audioRef.current && (
              <WaveSurferPlayer 
                key={currentTrack.id}
                audioRef={audioRef}
                trackId={currentTrack.id}
                isPlaying={isPlaying}
              />
            )}
          </Box>
          
          <Text fontSize="xs" color="gray.500" fontVariantNumeric="tabular-nums" w="35px">
             {formatTime(duration)}
          </Text>
        </HStack>

        {/* 3. Right Section */}
        <Box flexShrink={0}>
           <VolumeControl />
        </Box>
      </Flex>
    </Box>
  );
};