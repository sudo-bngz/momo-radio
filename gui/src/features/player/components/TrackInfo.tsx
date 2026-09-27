import { Box, Flex, VStack, HStack, Text, Icon } from '@chakra-ui/react';
import { Music } from 'lucide-react';
import { usePlayer } from '../../../context/PlayerContext';

export const TrackInfo = () => {
  const { currentTrack } = usePlayer();

  if (!currentTrack) return <Box w={{ base: "100%", md: "280px" }} minW="0" />;

  const albumCover = typeof currentTrack.album === 'object' && currentTrack.album !== null
    ? (currentTrack.album as any).cover_url 
    : '';

  const coverURL = currentTrack.cover_url || albumCover;

  return (
    // ⚡️ Responsive gap and width
    <HStack gap={{ base: 3, md: 4 }} w="100%" maxW={{ base: "none", md: "280px" }} minW="0">
      <Flex 
        align="center" 
        justify="center" 
        // ⚡️ Slightly smaller artwork on mobile to give text more room
        w={{ base: "40px", md: "48px" }} 
        h={{ base: "40px", md: "48px" }} 
        bg="gray.100" 
        _dark={{ bg: "whiteAlpha.200" }}
        borderRadius="md" 
        overflow="hidden" 
        border="1px solid" 
        borderColor="border"
        flexShrink={0}
      >
        {coverURL ? (
          <img 
            src={coverURL} 
            alt={currentTrack.title} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        ) : (
          <Icon as={Music} boxSize={{ base: 4, md: 5 }} color="fg.muted" />
        )}
      </Flex>

      {/* ⚡️ flex="1" ensures this text block shrinks and truncates instead of pushing controls off-screen */}
      <VStack align="start" gap={0} minW="0" flex="1">
        <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="600" color="fg" lineClamp={1}>
          {currentTrack.title}
        </Text>
        <Text fontSize={{ base: "10px", md: "xs" }} color="fg.muted" lineClamp={1}>
          {currentTrack.artist}
        </Text>
      </VStack>
    </HStack>
  );
};