// src/features/playlists/index.tsx
import React from 'react';
import { Box, Heading, Icon, Container } from '@chakra-ui/react';
import { ListMusic } from 'lucide-react';
import { PlaylistBuilder } from './components/PlaylistBuilder';

export const PlaylistsFeature: React.FC = () => {
  return (
    <Container maxW="container.xl" h="100%" data-theme="light">
      <Heading size="lg" mb={6} display="flex" alignItems="center" gap={2} color="gray.800">
        <Icon as={ListMusic} color="purple.500" />
        Playlist Studio
      </Heading>
      
      <Box h="calc(100% - 80px)">
        <PlaylistBuilder />
      </Box>
    </Container>
  );
};
