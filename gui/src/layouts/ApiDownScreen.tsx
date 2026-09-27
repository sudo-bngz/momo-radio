import React from 'react';
import { Flex, VStack, Heading, Text, Button, Icon } from '@chakra-ui/react';
import { WifiOff, RefreshCw } from 'lucide-react';

export const ApiDownScreen: React.FC = () => {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <Flex w="100vw" minH="100dvh" align="center" justify="center" bg="bg">
      <VStack 
        gap={6} 
        maxW="md" 
        textAlign="center" 
        p={{ base: 6, sm: 8 }} 
        bg={{ base: "transparent", sm: "bg.panel" }} 
        borderRadius={{ base: "none", sm: "2xl" }} 
        shadow={{ base: "none", sm: "xl" }} 
        border={{ base: "none", sm: "1px solid" }} 
        borderColor="border"
      >
        
        <Flex 
          w={{ base: "80px", sm: "64px" }} 
          h={{ base: "80px", sm: "64px" }} 
          bg="red.50" 
          color="red.600" 
          _dark={{ bg: "red.900/30", color: "red.400" }}
          borderRadius="full" 
          align="center" 
          justify="center"
          mb={2}
        >
          <Icon as={WifiOff} boxSize={{ base: 10, sm: 8 }} />
        </Flex>
        
        <VStack gap={2}>
          <Heading size="lg" color="fg" letterSpacing="tight">Connection Lost</Heading>
          <Text color="fg.muted" fontSize="sm" lineHeight="1.6">
            We are unable to reach the station. The service might be undergoing routine maintenance, or your network is offline.
          </Text>
        </VStack>

        <Button 
          onClick={handleReload} 
          bg="fg" 
          color="bg" 
          _hover={{ opacity: 0.8 }} 
          _active={{ transform: "scale(0.98)" }}
          transition="all 0.2s"
          borderRadius="xl" 
          mt={4} 
          w="full" 
          h={{ base: "56px", sm: "48px" }} 
          fontSize="16px"
          fontWeight="600"
        >
          <Icon as={RefreshCw} mr={2} boxSize={5} /> Try Again
        </Button>

      </VStack>
    </Flex>
  );
};