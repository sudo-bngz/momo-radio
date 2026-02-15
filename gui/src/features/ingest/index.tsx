// src/features/ingest/index.tsx
import React from 'react';
import { Heading, Icon, Container, Box } from '@chakra-ui/react';
import { Music } from 'lucide-react';
import { IngestView } from './components/IngesterView';

export const IngestFeature: React.FC = () => {
  return (
    <Container maxW="container.lg" h="100%" data-theme="light">
      <Heading size="lg" mb={6} display="flex" alignItems="center" gap={2} color="gray.800">
        <Icon as={Music} color="blue.500" />
        Upload Track
      </Heading>
      
      <Box h="calc(100% - 80px)">
        <IngestView />
      </Box>
    </Container>
  );
};