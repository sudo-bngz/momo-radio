import { Flex, HStack, IconButton, Icon } from '@chakra-ui/react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { usePlayer } from '../../../context/PlayerContext';

export const PlaybackControls = () => {
  const { isPlaying, togglePlayPause, playNext, playPrevious } = usePlayer();

  return (
    <HStack gap={1} ml={{ base: 0, md: 6 }}>
      
      <IconButton
        aria-label="Previous"
        variant="ghost"
        color="fg.muted"
        onClick={playPrevious}
        bg="transparent" 
        _hover={{ bg: "gray.50", color: "fg", _dark: { bg: "whiteAlpha.100", color: "fg" } }}
        size="md"
        display={{ base: "none", md: "inline-flex" }}
      >
        <Icon as={SkipBack} boxSize={4} fill="currentColor" />
      </IconButton>
      
      <Flex 
        as="button" 
        onClick={togglePlayPause} 
        align="center" justify="center" 
        w={{ base: "38px", md: "42px" }} 
        h={{ base: "38px", md: "42px" }}
        bg="bg" 
        color="fg"
        _dark={{ bg: "whiteAlpha.200" }}
        borderRadius="full" 
        boxShadow="0 2px 8px rgba(0,0,0,0.06)"
        border="1px solid" borderColor="border"
        _hover={{ transform: "scale(1.05)", bg: "gray.50", _dark: { bg: "whiteAlpha.300" } }} 
        _active={{ transform: "scale(0.95)" }}
        transition="all 0.2s"
        flexShrink={0}
      >
        {isPlaying ? (
          <Icon as={Pause} boxSize={{ base: 4, md: 5 }} fill="currentColor" />
        ) : (
          <Icon as={Play} boxSize={{ base: 4, md: 5 }} fill="currentColor" ml="2px" />
        )}
      </Flex>

      <IconButton
        aria-label="Next"
        variant="ghost"
        color="fg.muted"
        onClick={playNext}
        _hover={{ bg: "gray.50", color: "fg", _dark: { bg: "whiteAlpha.100", color: "fg" } }}
        size="md"
        bg="transparent" 
        display="inline-flex"
      >
        <Icon as={SkipForward} boxSize={4} fill="currentColor" />
      </IconButton>
      
    </HStack>
  );
};