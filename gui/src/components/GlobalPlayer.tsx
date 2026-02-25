import React, { useEffect } from 'react';
import { Box, Flex, HStack, VStack, Text, IconButton, Icon } from '@chakra-ui/react';
import { Slider } from '@chakra-ui/react'; 
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { WaveSurferPlayer } from './WaveSurferPlayer';

export const GlobalPlayer = () => {
  const { 
    currentTrack, isPlaying, togglePlayPause, isPlayerVisible, setPlayerVisible,
    volume, setVolume, audioRef 
  } = usePlayer();

  useEffect(() => { if (isPlaying) setPlayerVisible(true); }, [isPlaying, setPlayerVisible]);

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isOffScreen = !isPlayerVisible || !currentTrack;
  const currentTime = audioRef.current?.currentTime || 0;
  const duration = audioRef.current?.duration || 0;

  return (
    <Box 
      position="fixed" bottom={0} left={0} right={0} 
      h="72px" // Reduced height for a more compact feel
      bg="white" 
      borderTop="1px solid" borderColor="gray.100"
      zIndex={9999} px={6}
      transform={isOffScreen ? "translateY(100%)" : "translateY(0)"}
      transition="transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
      boxShadow="0 -4px 20px rgba(0,0,0,0.03)"
    >
      <Flex h="full" align="center">
        
        {/* 1. TRACK INFO (Far Left - More Compact) */}
        <HStack gap={3} minW="200px">
          <Flex 
            align="center" justify="center" 
            w="40px" h="40px" // Scaled down from 52px
            bg="gray.50" borderRadius="md" 
            border="1px solid" borderColor="gray.100"
            color="gray.400"
          >
            <Icon as={Music} boxSize={4} />
          </Flex>
          <VStack align="start" gap={0} overflow="hidden">
            <Text fontWeight="600" fontSize="xs" color="gray.900" truncate w="100%">
              {currentTrack?.title || "refleurir"}
            </Text>
            <Text fontSize="10px" color="gray.500" truncate w="100%">
              {currentTrack?.artist || "Ian Hawgood"}
            </Text>
          </VStack>
        </HStack>

        {/* 2. PLAYBACK CONTROLS (Grouped Left-Center) */}
        <HStack gap={0} ml={6}>
          <IconButton
            aria-label="Previous"
            variant="ghost"
            color="gray.700"
            bg="transparent" 
            _hover={{ bg: "gray.50" }}
            size="md"
          >
            <Icon as={SkipBack} boxSize={4} fill="currentColor" />
          </IconButton>
          
          <Flex 
            as="button" 
            onClick={togglePlayPause} 
            align="center" justify="center" 
            w="42px" h="42px" // Scaled down from 54px
            bg="white" 
            color="gray.900"
            borderRadius="full" 
            boxShadow="0 2px 8px rgba(0,0,0,0.06)"
            border="1px solid" borderColor="gray.100"
            _hover={{ transform: "scale(1.05)" }} 
            _active={{ transform: "scale(0.95)" }}
            transition="all 0.2s"
          >
            {isPlaying ? (
              <Icon as={Pause} boxSize={5} fill="currentColor" />
            ) : (
              <Icon as={Play} boxSize={5} fill="currentColor" ml="2px" />
            )}
          </Flex>

          <IconButton
            aria-label="Next"
            variant="ghost"
            color="gray.700"
            _hover={{ bg: "gray.50" }}
            size="md"
            bg="transparent" 
          >
            <Icon as={SkipForward} boxSize={4} fill="currentColor" />
          </IconButton>
        </HStack>

        {/* 3. WAVEFORM (Stretching Center) */}
        <HStack flex="1" gap={4} px={4} minW={0} align="center" h="100%">
          <Text fontSize="10px" color="gray.400" fontVariantNumeric="tabular-nums" pt="1px">
            {formatTime(currentTime)}
          </Text>
          
          {/* Added display="flex" and alignItems="center" to force WaveSurfer vertical centering */}
          <Box flex="1" h="100%" display="flex" alignItems="center"> 
            <Box w="100%" h="46px"> {/* Explicit height for the waveform rendering area */}
              {currentTrack && audioRef.current && (
                <WaveSurferPlayer 
                  key={currentTrack.id}
                  audioRef={audioRef}
                  trackId={currentTrack.id}
                  isPlaying={isPlaying}
                  color="#EDF2F7"
                  progressColor="#3182CE"
                />
              )}
            </Box>
          </Box>
          
          <Text fontSize="10px" color="gray.400" fontVariantNumeric="tabular-nums" pt="1px">
            {formatTime(duration)}
          </Text>
        </HStack>

        {/* 4. UTILITIES (Far Right) */}
        <HStack gap={4} justify="flex-end">
          <IconButton
             aria-label="Volume"
             variant="ghost"
             size="sm"
             color="gray.400"
            bg="transparent" 
          >
            <Icon as={Volume2} boxSize={4} />
          </IconButton>
          
          <Box w="1px" h="16px" bg="gray.200" />

          <IconButton
            aria-label="Close"
            variant="ghost"
            color="gray.400"
            bg="transparent" 
            _hover={{ color: "gray.900", bg: "gray.50" }}
            onClick={() => setPlayerVisible(false)}
            size="sm"
          >
            <Icon as={X} boxSize={4} />
          </IconButton>
        </HStack>

      </Flex>
    </Box>
  );
};