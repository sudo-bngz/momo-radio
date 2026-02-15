import React from 'react';
import { Heading, Icon, Box } from '@chakra-ui/react'; // Removed Container
import { Music } from 'lucide-react';
import { IngestView } from './components/IngesterView';

export const IngestFeature: React.FC = () => {
  return (
    // FIX: Swapped <Container> for <Box w="full"> to allow fluid expansion
    <Box w="full" h="100%" data-theme="light">
      <Heading size="lg" mb={6} display="flex" alignItems="center" gap={2} color="gray.800">
        <Icon as={Music} color="blue.500" />
        Upload Track
      </Heading>
      
      <Box h="calc(100% - 80px)" w="full">
        <IngestView />
      </Box>
    </Box>
  );
};