import React from 'react';
import { Box, Heading, Text, Button, Flex } from '@chakra-ui/react';

export const UsersManagement: React.FC = () => {
  return (
    <Box>
      <Heading size="lg" color="gray.900" mb={2}>Members</Heading>
      <Text fontSize="sm" color="gray.500" mb={8}>
        Manage team access and roles for your workspace.
      </Text>

      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="gray.200" shadow="sm">
        <Flex justify="space-between" align="center">
          <Text fontSize="sm" color="gray.600">User management coming soon.</Text>
          <Button size="sm" disabled>Invite Member</Button>
        </Flex>
      </Box>
    </Box>
  );
};