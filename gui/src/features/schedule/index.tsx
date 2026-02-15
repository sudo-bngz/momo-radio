// src/features/schedule/index.tsx
import React from 'react';
import { Box, Heading, Icon, Container } from '@chakra-ui/react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { ScheduleBuilder } from './components/ScheduleBuilder';

export const ScheduleFeature: React.FC = () => {
  return (
    <Container maxW="container.xl" h="100%" data-theme="light">
      <Heading size="lg" mb={6} display="flex" alignItems="center" gap={2} color="gray.800">
        <Icon as={CalendarIcon} color="blue.500" />
        Timetable
      </Heading>
      
      <Box h="calc(100% - 80px)">
        <ScheduleBuilder />
      </Box>
    </Container>
  );
};
