// src/features/library/index.tsx
import React from 'react';
import { Box } from '@chakra-ui/react';
import { LibraryView } from './components/LibraryView';

export const LibraryFeature: React.FC = () => {
  return (
    // FIX: Changed from Container to a full-width Box
    <Box w="100%" h="100%" data-theme="light">
      <LibraryView />
    </Box>
  );
};