import { Flex, VStack, Text, HStack, Icon } from '@chakra-ui/react';
import { Music } from 'lucide-react';
import { usePlayer } from '../../../context/PlayerContext';

export const TrackInfo = () => {
  const { currentTrack } = usePlayer();

  return (
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
  );
};