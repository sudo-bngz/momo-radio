import React from 'react';
import { Box, Heading, Text } from '@chakra-ui/react';

export const StreamSettings: React.FC = () => {
  return (
    <Box>
      <Heading size="lg" color="gray.900" mb={2}>Stream Configurations</Heading>
      <Text fontSize="sm" color="gray.500" mb={8}>
        Manage fallback behaviors and metadata output.
      </Text>

      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="gray.200" shadow="sm">
        <Text fontSize="sm" color="gray.600">Stream configurations coming soon.</Text>
      </Box>
    </Box>
  );
};