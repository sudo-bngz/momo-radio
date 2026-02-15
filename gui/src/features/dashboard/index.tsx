import React from 'react';
import { Box, Heading, Icon } from '@chakra-ui/react';
import { Activity } from 'lucide-react';
import { DashboardView } from './components/DashboardView';

export const DashboardFeature: React.FC = () => {
  return (

    <Box w="full" h="full" bg="white" data-theme="light">
      
      <Heading size="xl" mb={8} display="flex" alignItems="center" gap={3} color="gray.900" fontWeight="semibold" letterSpacing="tight">
        <Icon as={Activity} color="blue.500" boxSize="28px" />
        Station Overview
      </Heading>
      
      <DashboardView />
      
    </Box>
  );
};