import React from 'react';
import { Box, VStack, HStack, Text, Badge, Icon, Progress, Flex } from '@chakra-ui/react';
import { Music, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export interface QueueItem {
  id: string | number;
  title: string;
  status: 'queued' | 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  step?: string;
}

interface ProcessingQueueProps {
  items: QueueItem[];
}

export const ProcessingQueue: React.FC<ProcessingQueueProps> = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <Box w="100%" mt={8} animation="fade-in 0.4s ease-out">
      <Text fontSize="sm" fontWeight="bold" color="gray.500" mb={4} textTransform="uppercase" letterSpacing="wider">
        Processing Queue ({items.length})
      </Text>
      
      <VStack align="stretch" gap={3}>
        {items.map((item) => (
          <HStack 
            key={item.id} 
            bg="white" 
            p={4} 
            borderRadius="xl" 
            border="1px solid" 
            borderColor="gray.100" 
            boxShadow="sm"
            gap={4}
          >
            {/* Status Icon */}
            <Flex align="center" justify="center" w="40px" h="40px" bg="gray.50" borderRadius="md" flexShrink={0}>
              {item.status === 'success' && <Icon as={CheckCircle} color="green.500" />}
              {item.status === 'error' && <Icon as={XCircle} color="red.500" />}
              {(item.status === 'processing' || item.status === 'uploading') && (
                <Icon as={Loader2} color="blue.500" className="spin-animation" />
              )}
              {item.status === 'queued' && <Icon as={Music} color="gray.400" />}
            </Flex>

            {/* Track Info & Progress */}
            <VStack align="start" gap={1} flex="1" minW="0">
              <HStack justify="space-between" w="100%">
                <Text fontSize="sm" fontWeight="600" color="gray.900" truncate>
                  {item.title || 'Unknown Track'}
                </Text>
                <Badge 
                  size="sm" 
                  colorPalette={
                    item.status === 'success' ? 'green' : 
                    item.status === 'error' ? 'red' : 
                    item.status === 'processing' ? 'purple' : 'blue'
                  }
                >
                  {item.status}
                </Badge>
              </HStack>

              {/* Progress Bar (Hidden on success/error) */}
              {(item.status === 'uploading' || item.status === 'processing') ? (
                <Box w="100%" mt={1}>
                  <Progress.Root value={item.progress} size="xs" colorPalette="blue">
                    <Progress.Track>
                      <Progress.Range />
                    </Progress.Track>
                  </Progress.Root>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    {item.step || 'Processing...'}
                  </Text>
                </Box>
              ) : (
                <Text fontSize="xs" color="gray.500">
                  {item.status === 'success' ? 'Ready in library' : 'Processing failed'}
                </Text>
              )}
            </VStack>
          </HStack>
        ))}
      </VStack>
      
      <style>{`
        .spin-animation { animation: spin 2s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </Box>
  );
};