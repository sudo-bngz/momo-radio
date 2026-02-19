import React, { useEffect } from 'react';
import { Box, Flex, HStack, VStack, Text, Slider } from '@chakra-ui/react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext'; // Ensure this path is correct

export const GlobalPlayer = () => {
  // Pull global visibility state from context
  const { 
    currentTrack, 
    isPlaying, 
    togglePlayPause, 
    progress, 
    isPlayerVisible, 
    setPlayerVisible 
  } = usePlayer();

  // 1. Slide up automatically whenever a track starts playing
  useEffect(() => {
    if (isPlaying) {
      setPlayerVisible(true);
    }
  }, [isPlaying, setPlayerVisible]);

  // 2. Auto-hide logic: Slides down after 30s of being paused
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    if (!isPlaying && currentTrack && isPlayerVisible) {
      timeout = setTimeout(() => {
        setPlayerVisible(false); // Hide globally so layout padding reacts
      }, 30000); 
    }
    return () => clearTimeout(timeout);
  }, [isPlaying, currentTrack, isPlayerVisible, setPlayerVisible]);

  // The bar is off-screen if manually dismissed OR if there's no track loaded
  const isOffScreen = !isPlayerVisible || !currentTrack;

  return (
    <Box 
      position="fixed" 
      bottom={0} 
      left={0} 
      right={0} 
      h="72px" 
      bg="white/95" 
      backdropFilter="blur(16px)" 
      // Soft shadow instead of border for that floating premium look
      shadow="0 -2px 10px rgba(0,0,0,0.06)" 
      zIndex={9999} 
      px={8}
      // Reactive transform based on global state
      transform={isOffScreen ? "translateY(100%)" : "translateY(0)"}
      transition="transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
    >
      {/* Progress Bar - Sleek gray.900 (No blue border) */}
      <Box position="absolute" top="-1px" left={0} right={0} h="2px" bg="transparent">
        <Box h="full" bg="gray.900" w={`${progress}%`} transition="width 0.1s linear" />
      </Box>

      <Flex h="full" align="center" justify="space-between">
        
        {/* Left: Track Info */}
        <HStack gap={4} w="30%">
          <Flex align="center" justify="center" w={10} h={10} bg="gray.100" borderRadius="xl" color="gray.500" flexShrink={0}>
            <Music size={18} />
          </Flex>
          <VStack align="start" gap={0} overflow="hidden" flex="1">
            <Text fontWeight="bold" fontSize="sm" color="gray.900" truncate w="full">
              {currentTrack?.title || "Select a track"}
            </Text>
            <Text fontSize="xs" color="gray.500" truncate w="full">
              {currentTrack?.artist || "Library"}
            </Text>
          </VStack>
        </HStack>

        {/* Center: Playback Controls */}
        <HStack gap={8} justify="center" flex="1">
          <Box 
            as="button" bg="transparent" border="none" cursor="pointer"
            color="gray.400" _hover={{ color: "gray.900" }} transition="color 0.2s"
            _focus={{ outline: "none" }}
          >
            <SkipBack size={22} />
          </Box>
          
          <Flex 
            as="button" 
            onClick={togglePlayPause}
            align="center" justify="center" 
            w={12} h={12} 
            bg="gray.900" color="white" border="none" cursor="pointer"
            borderRadius="full" 
            _hover={{ bg: "black", transform: "scale(1.05)" }}
            transition="all 0.2s"
            boxShadow="0 4px 12px rgba(0,0,0,0.1)"
            _focus={{ outline: "none" }}
            opacity={currentTrack ? 1 : 0.3}
            pointerEvents={currentTrack ? "auto" : "none"}
          >
            {isPlaying ? (
              <Pause size={20} color="white" fill="white" />
            ) : (
              <Play size={20} color="white" fill="white" style={{ marginLeft: '4px' }} />
            )}
          </Flex>
          
          <Box 
            as="button" bg="transparent" border="none" cursor="pointer"
            color="gray.400" _hover={{ color: "gray.900" }} transition="color 0.2s"
            _focus={{ outline: "none" }}
          >
            <SkipForward size={22} />
          </Box>
        </HStack>

        {/* Right: Volume & Dismiss Button */}
        <HStack gap={4} w="30%" justify="flex-end">
          <Volume2 size={18} color="var(--chakra-colors-gray-500)" />
          <Box w="100px">
            <Slider.Root defaultValue={[70]} max={100} size="sm" colorPalette="gray">
              <Slider.Track bg="gray.200">
                <Slider.Range bg="gray.500" />
              </Slider.Track>
              <Slider.Thumb index={0} _focus={{ outline: "none", boxShadow: "none" }} />
            </Slider.Root>
          </Box>
          
          <Box w="1px" h="24px" bg="gray.200" mx={2} />
          
          {/* Manual Dismiss Button - Trigger global layout shift */}
          <Box 
            as="button" bg="transparent" border="none" cursor="pointer"
            color="gray.400" _hover={{ color: "gray.900" }} transition="color 0.2s"
            onClick={() => setPlayerVisible(false)}
            _focus={{ outline: "none" }}
            title="Hide Player"
          >
            <X size={18} />
          </Box>
        </HStack>

      </Flex>
    </Box>
  );
};