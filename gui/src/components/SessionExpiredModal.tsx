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
      {/* ⚡️ v3 separates the Backdrop and Positioner */}
      <Dialog.Backdrop bg="blackAlpha.400" backdropFilter="blur(8px)" />
      
      <Dialog.Positioner>
        <Dialog.Content borderRadius="xl" boxShadow="2xl" maxW="md">
          
          <Dialog.Header textAlign="center" pt={8}>
            <VStack gap={4}>
              <Icon as={AlertCircle} boxSize={12} color="orange.400" />
              <Dialog.Title fontSize="xl" fontWeight="bold">Session Expired</Dialog.Title>
            </VStack>
          </Dialog.Header>
          
          <Dialog.Body pb={6}>
            <Text textAlign="center" color="gray.600">
              For your security, your session has timed out. Please log in again to continue managing your radio station.
            </Text>
          </Dialog.Body>

          <Dialog.Footer pb={8} justifyContent="center">
            <Button 
              colorScheme="blue" 
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