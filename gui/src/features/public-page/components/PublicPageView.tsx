import React, { useState } from 'react';
import { 
  Box, Flex, Heading, Text, VStack, HStack, Button, Spinner, Center, Icon 
} from '@chakra-ui/react';
import { Save, Globe, ExternalLink } from 'lucide-react'; 
import { usePublicPage } from '../hooks/usePublicPage';
import { PageSettings } from './PageSettings';
import { PageBuilder } from './PageBuilder';

type Tab = 'settings' | 'builder';

export const PublicPageView: React.FC = () => {
  const { 
    config, loading, saving, slugError, 
    handleSlugChange, updateConfig, saveConfig, uploadImage 
  } = usePublicPage();
  
  const [activeTab, setActiveTab] = useState<Tab>('settings');

  if (loading || !config) {
    return (
      <Center h="100%" minH="400px" bg="transparent">
        <Spinner size="xl" color="fg.muted" />
      </Center>
    );
  }

  // ⚡️ Construct the live URL based on the current slug
  const liveUrl = `https://${config.slug}.${config.base_domain || 'momoradio.fm'}`;

  return (
    // ⚡️ Removed hardcoded background and data-theme to support global dark mode
    <VStack align="stretch" h="100%" gap={8} bg="transparent">
      
      {/* HEADER */}
      <Flex justify="space-between" align="flex-end" wrap="wrap" gap={4}>
        <VStack align="start" gap={1}>
          <HStack gap={2} fontSize="sm" color="fg.muted" mb={1}>
            <Box w="24px" h="24px" bg="pink.500" _dark={{ bg: "pink.400" }} color="white" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
              <Icon as={Globe} boxSize={3} strokeWidth={3} />
            </Box>
            <Text color="fg" fontWeight="500">Public Page</Text>
          </HStack>
          <Heading size="3xl" fontWeight="normal" color="fg" letterSpacing="tight">
            Listener Portal
          </Heading>
        </VStack>

        <HStack gap={3}>
          <Button 
            onClick={() => window.open(liveUrl, '_blank', 'noopener,noreferrer')}
            variant="outline" 
            borderRadius="full" 
            px={6} 
            borderColor="border"
            color="fg.muted"
            _hover={{ bg: "gray.50", color: "fg", _dark: { bg: "whiteAlpha.100" } }}
            disabled={!!slugError}
          >
            <Icon as={ExternalLink} boxSize={4} mr={2} />
            View Live
          </Button>

          <Button 
            bg="blue.600" color="white" _dark={{ bg: "blue.500" }} borderRadius="full" px={6} 
            _hover={{ bg: "blue.700", _dark: { bg: "blue.400" } }} 
            onClick={saveConfig} disabled={saving || !!slugError}
          >
            {saving ? <Spinner size="sm" mr={2} color="white" /> : <Icon as={Save} boxSize={4} mr={2} />}
            Publish Changes
          </Button>
        </HStack>
      </Flex>

      {/* TABS */}
      <Flex justify="flex-start" align="center" pb={2}>
        <HStack gap={2}>
          <Button
            onClick={() => setActiveTab('settings')} size="sm" borderRadius="full" px={5} h="36px"
            bg={activeTab === 'settings' ? 'fg' : 'transparent'} 
            color={activeTab === 'settings' ? 'bg' : 'fg.muted'} 
            fontWeight={activeTab === 'settings' ? '600' : '500'}
            _hover={activeTab === 'settings' ? {} : { bg: 'gray.100', color: 'fg', _dark: { bg: 'whiteAlpha.100' } }} 
            transition="all 0.2s"
          >
            Station Settings
          </Button>
          <Button
            onClick={() => setActiveTab('builder')} size="sm" borderRadius="full" px={5} h="36px"
            bg={activeTab === 'builder' ? 'fg' : 'transparent'} 
            color={activeTab === 'builder' ? 'bg' : 'fg.muted'} 
            fontWeight={activeTab === 'builder' ? '600' : '500'}
            _hover={activeTab === 'builder' ? {} : { bg: 'gray.100', color: 'fg', _dark: { bg: 'whiteAlpha.100' } }} 
            transition="all 0.2s"
          >
            Page Builder
          </Button>
        </HStack>
      </Flex>

      {/* CONTENT ROUTER */}
      <Box flex="1" overflow="hidden" display="flex" flexDirection="column">
        {activeTab === 'settings' ? (
          <PageSettings 
            config={config}
            slugError={slugError}
            handleSlugChange={handleSlugChange}
            updateConfig={updateConfig}
            uploadImage={uploadImage}
          />
        ) : (
          <PageBuilder />
        )}
      </Box>

    </VStack>
  );
};