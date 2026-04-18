import { Box, Flex, VStack, HStack, Text, Icon } from '@chakra-ui/react'; // ⚡️ Added HStack
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
        borderRadius="md" 
        overflow="hidden" 
        border="1px solid" 
        borderColor="gray.200"
        flexShrink={0}
      >
        {coverURL ? (
          <img 
            src={coverURL} 
            alt={currentTrack.title} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        ) : (
          <Icon as={Music} boxSize={5} color="gray.400" />
        )}
      </Flex>

      <VStack align="start" gap={0} minW="0">
        <Text fontSize="sm" fontWeight="600" color="gray.900" lineClamp={1}>
          {currentTrack.title}
        </Text>
        <Text fontSize="xs" color="gray.500" lineClamp={1}>
          {currentTrack.artist}
        </Text>
      </VStack>
    </HStack>
  );
};