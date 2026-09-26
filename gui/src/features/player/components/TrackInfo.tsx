import { Box, Flex, VStack, HStack, Text, Icon } from '@chakra-ui/react';
import { Music } from 'lucide-react';
import { usePlayer } from '../../../context/PlayerContext';

export const TrackInfo = () => {
  const { currentTrack } = usePlayer();

  if (!currentTrack) return <Box w="280px" />;

  const albumCover = typeof currentTrack.album === 'object' && currentTrack.album !== null
    ? (currentTrack.album as any).cover_url 
    : '';

  const coverURL = currentTrack.cover_url || albumCover;

  return (
    <HStack gap={4} w="280px" minW="0">
      <Flex 
        align="center" 
        justify="center" 
        w="48px" 
        h="48px" 
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
          <Icon as={Music} boxSize={5} color="fg.muted" />
        )}
      </Flex>

      <VStack align="start" gap={0} minW="0">
        <Text fontSize="sm" fontWeight="600" color="fg" lineClamp={1}>
          {currentTrack.title}
        </Text>
        <Text fontSize="xs" color="fg.muted" lineClamp={1}>
          {currentTrack.artist}
        </Text>
      </VStack>
    </HStack>
  );
};