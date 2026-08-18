import React, { useState } from 'react';
import { 
  Box, Button, Heading, Text, VStack, HStack, 
  Badge, Separator 
} from '@chakra-ui/react';
import { CheckCircle2 } from 'lucide-react';

import { useAuthStore } from '../../../store/useAuthStore'; 
import { api } from '../../../services/api'; 

export const BillingSettings: React.FC = () => {
  const organization = useAuthStore((state) => state.activeOrganization);
  const [isLoading, setIsLoading] = useState(false);

  const planTier = organization?.plan_tier || 'free';
  const billingStatus = organization?.billing_status || 'active';
  const isPro = planTier === 'pro';

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      const data = await api.createCheckoutSession();
      window.location.href = data.url; 
    } catch (error) {
      console.error('Checkout error:', error);
      // Note: If you generated the Chakra v3 toaster snippet, you can use:
      // toaster.create({ title: "Error initiating checkout", type: "error" })
      alert('Error initiating checkout. Please try again later.');
      setIsLoading(false);
    }
  };

  const handlePortal = async () => {
    setIsLoading(true);
    try {
      const data = await api.createPortalSession();
      window.location.href = data.url; 
    } catch (error) {
      console.error('Portal error:', error);
      alert('Unable to access billing management.');
      setIsLoading(false);
    }
  };

  return (
    <Box>
      <Heading size="lg" color="gray.900" mb={2}>Billing & Subscription</Heading>
      <Text fontSize="sm" color="gray.500" mb={8}>
        Manage your subscription tier, payment methods, and billing history.
      </Text>

      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="gray.200" shadow="sm">
        <HStack justify="space-between" mb={4} align="flex-start">
          <VStack align="start" gap={1}>
            <Heading size="sm" color="gray.700">Current Plan</Heading>
            <HStack mt={1} gap={3}>
              <Text fontSize="2xl" fontWeight="bold" color="gray.900" textTransform="capitalize">
                {planTier}
              </Text>
              
              {/* Chakra v3 uses colorPalette instead of colorScheme */}
              {billingStatus === 'past_due' && (
                <Badge colorPalette="red">Payment Failed</Badge>
              )}
              {isPro && billingStatus === 'active' && (
                <Badge colorPalette="green">Active</Badge>
              )}
            </HStack>
          </VStack>
          
          {isPro ? (
            <Button 
              variant="outline"
              onClick={handlePortal} 
              loading={isLoading} // Chakra v3 uses `loading` instead of `isLoading`
            >
              Manage Billing
            </Button>
          ) : (
            <Button 
              colorPalette="blue" 
              onClick={handleCheckout} 
              loading={isLoading}
            >
              Upgrade to Pro
            </Button>
          )}
        </HStack>

        {/* Divider is now Separator */}
        <Separator my={6} />
        
        <Heading size="sm" color="gray.700" mb={4}>Plan Features</Heading>
        
        {/* Replaced List/ListIcon with simpler VStack/HStack for v3 compatibility */}
        <VStack align="start" gap={3}>
          <HStack gap={3}>
            <CheckCircle2 color="var(--chakra-colors-green-500)" size={20} /> 
            <Text fontSize="sm" color="gray.700">Unlimited Tracks & Library Storage</Text>
          </HStack>
          <HStack gap={3}>
            <CheckCircle2 color="var(--chakra-colors-green-500)" size={20} /> 
            <Text fontSize="sm" color="gray.700">Standard 128kbps HLS Stream</Text>
          </HStack>
          
          <HStack gap={3} opacity={isPro ? 1 : 0.5}>
            <CheckCircle2 color={isPro ? "var(--chakra-colors-green-500)" : "var(--chakra-colors-gray-400)"} size={20} /> 
            <Text fontSize="sm" color="gray.700">320kbps High-Fidelity Audio</Text>
          </HStack>
          <HStack gap={3} opacity={isPro ? 1 : 0.5}>
            <CheckCircle2 color={isPro ? "var(--chakra-colors-green-500)" : "var(--chakra-colors-gray-400)"} size={20} /> 
            <Text fontSize="sm" color="gray.700">Advanced Listener Analytics & Export</Text>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
};