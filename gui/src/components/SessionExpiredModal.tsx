import React from 'react';
import { Dialog, Button, Text, VStack, Icon } from '@chakra-ui/react';
import { AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const SessionExpiredModal: React.FC = () => {
  const isSessionExpired = useAuthStore((state) => state.isSessionExpired);
  const logout = useAuthStore((state) => state.logout);

  return (
    // ⚡️ v3 uses 'open' instead of 'isOpen'
    // By not providing an onOpenChange handler, we force the modal to stay open!
    <Dialog.Root 
      open={isSessionExpired} 
      closeOnInteractOutside={false}
      closeOnEscape={false}
    >
      <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(8px)" />
      
      <Dialog.Positioner>
        <Dialog.Content 
          bg="bg.panel" 
          border="1px solid" 
          borderColor="border" 
          borderRadius="xl" 
          boxShadow="2xl" 
          maxW="md"
        >
          
          <Dialog.Header textAlign="center" pt={8}>
            <VStack gap={4}>
              <Icon as={AlertCircle} boxSize={12} color="orange.500" _dark={{ color: "orange.400" }} />
              <Dialog.Title fontSize="xl" fontWeight="bold" color="fg">Session Expired</Dialog.Title>
            </VStack>
          </Dialog.Header>
          
          <Dialog.Body pb={6}>
            <Text textAlign="center" color="fg.muted">
              For your security, your session has timed out. Please log in again to continue managing your radio station.
            </Text>
          </Dialog.Body>

          <Dialog.Footer pb={8} justifyContent="center">
            <Button 
              bg="blue.600" 
              color="white" 
              _dark={{ bg: "blue.500" }}
              _hover={{ bg: "blue.700", _dark: { bg: "blue.400" } }}
              size="lg" 
              w="full" 
              mx={4} 
              onClick={logout} 
            >
              Reconnect to Momo Radio
            </Button>
          </Dialog.Footer>

        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};