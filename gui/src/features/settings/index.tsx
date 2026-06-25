import React, { useEffect, useState } from 'react';
import { Box, Flex, VStack, Text, Icon, Heading, Center, Spinner, HStack } from '@chakra-ui/react';
import { Settings as SettingsIcon, Radio, HardDrive, Users, CreditCard, ArrowLeft, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Hook
import { useSettings } from './hook/useSettings';

// Components
import { GeneralSettings } from './components/GeneralSettings';
import { AdvancedFfmpegSettings } from './components/AdvancedFfmpegSettings';
import { StorageSettings } from './components/StorageSettings';
import { UsersManagement } from './components/UsersManagement';
import { StreamSettings } from './components/StreamSettings';
import { AccountSettings } from './components/AccountSettings';
import { User } from 'lucide-react'; // Add User to your lucide-react imports

const TABS = [
  { id: 'account', label: 'Account', icon: User }, // ⚡️ Added Account tab
  { id: 'general', label: 'Workspace', icon: Radio },
  { id: 'engine', label: 'Broadcast Engine', icon: SettingsIcon },
  { id: 'stream', label: 'Stream Config', icon: Activity }, 
  { id: 'storage', label: 'Storage & Assets', icon: HardDrive },
  { id: 'team', label: 'Members', icon: Users },
  { id: 'billing', label: 'Billing', icon: CreditCard },
];

export const SettingsFeature: React.FC = () => {
  const [activeTab, setActiveTab] = useState('account');
  const { fetchSettings, isLoading } = useSettings();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  if (isLoading) {
    return (
      <Center h="100%" w="100%">
        <Spinner size="xl" color="gray.400" />
      </Center>
    );
  }

  return (
    <Flex h="100%" w="100%" bg="white">
      {/* LEFT: Settings Sidebar */}
      <Flex direction="column" w="240px" borderRight="1px solid" borderColor="gray.100" bg="gray.50" p={6}>
        
        {/* Escape Hatch / Back Button */}
        <HStack 
          mb={8} 
          cursor="pointer" 
          color="gray.500" 
          _hover={{ color: "gray.900" }}
          onClick={() => navigate('/dashboard')}
          transition="color 0.2s"
        >
          <Icon as={ArrowLeft} boxSize={4} />
          <Text fontSize="sm" fontWeight="600">Back to App</Text>
        </HStack>

        <Heading size="sm" color="gray.800" mb={6} pl={3}>Settings</Heading>
        
        <VStack align="stretch" gap={1} flex="1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Flex
                key={tab.id}
                align="center"
                gap={3}
                p={2}
                px={3}
                borderRadius="md"
                cursor="pointer"
                bg={isActive ? "white" : "transparent"}
                color={isActive ? "blue.600" : "gray.600"}
                shadow={isActive ? "sm" : "none"}
                _hover={!isActive ? { bg: "gray.100", color: "gray.900" } : {}}
                onClick={() => setActiveTab(tab.id)}
                transition="all 0.2s"
              >
                <Icon as={tab.icon} boxSize={4} />
                <Text fontSize="sm" fontWeight={isActive ? "600" : "500"}>
                  {tab.label}
                </Text>
              </Flex>
            );
          })}
        </VStack>
      </Flex>

      {/* RIGHT: Main Content Area */}
      <Box flex="1" p={10} overflowY="auto" bg="gray.50">
        <Box maxW="800px" mx="auto">
          {/* ⚡️ REPLACED PLACEHOLDERS WITH ACTUAL COMPONENTS */}
          {activeTab === 'account' && <AccountSettings />}
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'engine' && <AdvancedFfmpegSettings />}
          {activeTab === 'stream' && <StreamSettings />}
          {activeTab === 'storage' && <StorageSettings />}
          {activeTab === 'team' && <UsersManagement />}
          {activeTab === 'billing' && (
            <Box>
              <Heading size="lg" color="gray.900" mb={2}>Billing</Heading>
              <Text fontSize="sm" color="gray.500" mb={8}>Manage your subscription and payment methods.</Text>
              <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="gray.200" shadow="sm">
                <Text fontSize="sm" color="gray.600">Billing configuration coming soon.</Text>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Flex>
  );
};