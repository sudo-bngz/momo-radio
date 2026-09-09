import React from 'react';
import { Box } from '@chakra-ui/react';
import { DashboardView } from './components/DashboardView';

export const DashboardFeature: React.FC = () => {
  return (
    // We remove the duplicate <Heading> here. 
    // DashboardView now completely controls the layout, matching the Library 1:1.
    <Box w="full" h="full">
      <DashboardView />
    </Box>
  );
};