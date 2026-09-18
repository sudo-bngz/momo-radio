import React from 'react';
import { Box, VStack, Heading, Text, Icon, Button } from '@chakra-ui/react';
import { LayoutTemplate } from 'lucide-react';

export const PageBuilder: React.FC = () => {
  return (
    <Box p={10} bg="gray.50" borderRadius="xl" border="1px dashed" borderColor="gray.300" textAlign="center">
      <VStack gap={4}>
        <Icon as={LayoutTemplate} boxSize={10} color="gray.400" />
        <Heading size="md" color="gray.700">Drag & Drop Editor</Heading>
        <Text color="gray.500" maxW="400px">
          The visual page builder is coming soon. You will be able to design your public station page using customizable widgets like chat boxes, schedules, and donation links.
        </Text>
        <Button variant="outline" colorScheme="blue" mt={2} disabled>
          Available in v2
        </Button>
      </VStack>
    </Box>
  );
};