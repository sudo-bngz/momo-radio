import React, { useState } from 'react';
import { 
  Box, Flex, Heading, Text, VStack, HStack, Button, Spinner, Center, Icon 
} from '@chakra-ui/react';
import { Save, Globe, ExternalLink } from 'lucide-react'; // ⚡️ IMPORTED: ExternalLink
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
      <Center h="100%" minH="400px" bg="white">
        <Spinner size="xl" color="gray.400" />
      </Center>
    );
  }

  // ⚡️ Construct the live URL based on the current slug
  const liveUrl = `https://${config.slug}.${config.base_domain || 'momoradio.fm'}`;

  return (
    <VStack align="stretch" h="100%" gap={8} bg="white" data-theme="light">
      
      {/* HEADER */}
      <Flex justify="space-between" align="flex-end" wrap="wrap" gap={4}>
        <VStack align="start" gap={1}>
          <HStack gap={2} fontSize="sm" color="gray.500" mb={1}>
            <Box w="24px" h="24px" bg="pink.500" color="white" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
              <Icon as={Globe} boxSize={3} strokeWidth={3} />
            </Box>
            <Text color="gray.900" fontWeight="500">Public Page</Text>
          </HStack>
          <Heading size="3xl" fontWeight="normal" color="gray.900" letterSpacing="tight">
            Listener Portal
          </Heading>
        </VStack>

        <HStack gap={3}>
          <Button 
            onClick={() => window.open(liveUrl, '_blank', 'noopener,noreferrer')}
            variant="outline" 
            borderRadius="full" 
            px={6} 
            borderColor="gray.200"
            color="gray.700"
            _hover={{ bg: "gray.50", borderColor: "gray.300" }}
            disabled={!!slugError}
          >
            <Icon as={ExternalLink} boxSize={4} mr={2} />
            View Live
          </Button>

          <Button 
            bg="blue.500" color="white" borderRadius="full" px={6} _hover={{ bg: "blue.600" }} 
            onClick={saveConfig} disabled={saving || !!slugError}
          >
            {saving ? <Spinner size="sm" mr={2} /> : <Icon as={Save} boxSize={4} mr={2} />}
            Publish Changes
          </Button>
        </HStack>
      </Flex>

      {/* TABS */}
      <Flex justify="flex-start" align="center" pb={2}>
        <HStack gap={2}>
          <Button
            onClick={() => setActiveTab('settings')} size="sm" borderRadius="full" px={5} h="36px"
            bg={activeTab === 'settings' ? 'gray.900' : 'transparent'} 
            color={activeTab === 'settings' ? 'white' : 'gray.600'} 
            fontWeight={activeTab === 'settings' ? '600' : '500'}
            _hover={activeTab === 'settings' ? {} : { bg: 'gray.100', color: 'gray.900' }} 
            transition="all 0.2s"
          >
            Station Settings
          </Button>
          <Button
            onClick={() => setActiveTab('builder')} size="sm" borderRadius="full" px={5} h="36px"
            bg={activeTab === 'builder' ? 'gray.900' : 'transparent'} 
            color={activeTab === 'builder' ? 'white' : 'gray.600'} 
            fontWeight={activeTab === 'builder' ? '600' : '500'}
            _hover={activeTab === 'builder' ? {} : { bg: 'gray.100', color: 'gray.900' }} 
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