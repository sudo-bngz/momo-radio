import React from 'react';
import { Box } from '@chakra-ui/react';
import { ScheduleBuilder } from './components/ScheduleBuilder';

export const ScheduleFeature: React.FC = () => {
  return (
    <Box w="full" h="100%" data-theme="light" bg="transparent">
      {/* We removed the duplicate Heading and Icon here. 
          The 'ScheduleBuilder' now handles the 'Broadcast Schedule' 
          title and pill-shaped navigation internally.
      */}
      <Box h="full" w="full">
        <ScheduleBuilder />
      </Box>
    </Box>
  );
};