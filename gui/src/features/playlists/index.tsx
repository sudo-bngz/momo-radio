import React from 'react';
import { Box } from '@chakra-ui/react';
import { Outlet } from 'react-router-dom';

export const PlaylistsFeature: React.FC = () => {
  return (
    <Box w="full" h="100%" data-theme="light">
      <Outlet />
    </Box>
  );
};