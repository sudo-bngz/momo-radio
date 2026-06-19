import React, { useState } from 'react';
import { 
  Box, VStack, HStack, Heading, Text, Button, Icon, Input, Textarea, Flex
} from '@chakra-ui/react';
import { Copy, Check, Globe, Instagram, Link as LinkIcon } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore'; 

export const PublicPageView: React.FC = () => {
  const [copied, setCopied] = useState(false);
  
  // Get the current organization from the Auth Store
  const currentOrg = useAuthStore(state => state.organizations.find(o => o.id === state.activeOrganizationId));
  
  // ⚡️ UPDATED: Simple flat URL structure using the Tenant ID
  const publicUrl = `https://env.momosbasement.com/listen?org=${currentOrg?.id || 'demo-id'}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box w="100%" bg="white" p={8} borderRadius="2xl" border="1px solid" borderColor="gray.100" shadow="sm">
      <Flex direction={{ base: "column", md: "row" }} gap={10}>
        
        {/* Left Side: Form */}
        <VStack align="start" flex="1" gap={6} maxW="600px">
          <Box>
            <Heading size="md" fontWeight="bold" color="gray.800" mb={2}>Your Public Radio Page</Heading>
            <Text fontSize="sm" color="gray.500">
              This is the link you share with your listeners. It includes a live audio player, the currently playing track, and links to your social profiles.
            </Text>
          </Box>

          {/* URL Display */}
          <Box w="100%">
            <Text fontSize="sm" fontWeight="600" color="gray.700" mb={2}>Listener Link</Text>
            <HStack w="100%">
              <Input 
                value={publicUrl} 
                readOnly 
                bg="gray.50" 
                color="gray.600" 
                fontFamily="mono" 
                fontSize="sm" 
              />
              <Button onClick={copyToClipboard} colorPalette="gray" variant="outline" w="100px">
                <Icon as={copied ? Check : Copy} color={copied ? "green.500" : "inherit"} mr={2} boxSize={4}/>
                {copied ? "Copied" : "Copy"}
              </Button>
            </HStack>
          </Box>

          {/* Basic Info */}
          <Box w="100%">
            <Text fontSize="sm" fontWeight="600" color="gray.700" mb={2}>Station Description</Text>
            <Textarea 
              placeholder="Tell your listeners what kind of music you broadcast..." 
              rows={4}
              resize="none"
            />
          </Box>

          {/* Social Links */}
          <Box w="100%">
            <Text fontSize="sm" fontWeight="600" color="gray.700" mb={4}>Social Profiles</Text>
            <VStack gap={3}>
              <HStack w="100%">
                <Box bg="gray.100" p={2} borderRadius="md"><Icon as={Instagram} boxSize={4} color="gray.600" /></Box>
                <Input placeholder="Instagram Username (e.g. momo.radio)" />
              </HStack>
              <HStack w="100%">
                <Box bg="gray.100" p={2} borderRadius="md"><Icon as={LinkIcon} boxSize={4} color="gray.600" /></Box>
                <Input placeholder="Website or Linktree URL" />
              </HStack>
            </VStack>
          </Box>

          <Button bg="blue.600" color="white" _hover={{ bg: "blue.700" }} px={8} mt={4}>
            Save Changes
          </Button>
        </VStack>

        {/* Right Side: Preview Illustration */}
        <Box flex="1" bg="gray.50" borderRadius="xl" border="1px solid" borderColor="gray.100" p={8} display="flex" flexDirection="column" alignItems="center" justifyContent="center">
          <Icon as={Globe} boxSize={16} color="gray.300" mb={4} />
          <Heading size="sm" color="gray.600" mb={2}>Live Preview</Heading>
          <Text fontSize="sm" color="gray.400" textAlign="center" maxW="250px">
            Your listeners will see a beautiful, mobile-friendly player here when they visit your link.
          </Text>
        </Box>

      </Flex>
    </Box>
  );
};