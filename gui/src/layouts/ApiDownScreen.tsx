import React from 'react';
import { Flex, VStack, Heading, Text, Button, Icon } from '@chakra-ui/react';
import { WifiOff, RefreshCw } from 'lucide-react';

export const ApiDownScreen: React.FC = () => {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <Flex w="100vw" h="100vh" align="center" justify="center" bg="gray.50">
      <VStack gap={6} maxW="md" textAlign="center" p={8} bg="white" borderRadius="xl" shadow="sm" border="1px solid" borderColor="gray.200">
        
        <Flex w="64px" h="64px" bg="red.50" color="red.500" borderRadius="full" align="center" justify="center">
          <Icon as={WifiOff} boxSize={8} />
        </Flex>
        
        <VStack gap={2}>
          <Heading size="lg" color="gray.900" letterSpacing="tight">Connection Lost</Heading>
          <Text color="gray.500" fontSize="sm" lineHeight="1.6">
            We are unable to reach the Momo.Radio servers. The service might be undergoing routine maintenance, or your network is offline.
          </Text>
        </VStack>

        <Button 
          onClick={handleReload} 
          bg="gray.900" color="white" _hover={{ bg: "black" }} 
          borderRadius="md" mt={4} w="full" size="lg"
        >
          <Icon as={RefreshCw} mr={2} boxSize={4} /> Try Again
        </Button>

      </VStack>
    </Flex>
  );
};
