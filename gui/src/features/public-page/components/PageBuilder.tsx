import React from 'react';
import { Box, VStack, Heading, Text, Icon, Button } from '@chakra-ui/react';
import { LayoutTemplate } from 'lucide-react';

export const PageBuilder: React.FC = () => {
  return (
    <Box p={10} bg="bg.panel" borderRadius="xl" border="1px dashed" borderColor="border" textAlign="center">
      <VStack gap={4}>
        <Icon as={LayoutTemplate} boxSize={10} color="fg.muted" />
        <Heading size="md" color="fg">Drag & Drop Editor</Heading>
        <Text color="fg.muted" maxW="400px">
          The visual page builder is coming soon. You will be able to design your public station page using customizable widgets like chat boxes, schedules, and donation links.
        </Text>
        <Button variant="outline" colorPalette="blue" mt={2} disabled>
          Available in v2
        </Button>
      </VStack>
    </Box>
  );
};