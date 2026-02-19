import React, { useState } from 'react';
import { Box, Flex, Heading, VStack, Icon, Text, HStack } from '@chakra-ui/react';
import { Users, Radio, HardDrive, Cpu } from 'lucide-react';
import { UserManagement } from './components/UsersManagement';
import { StreamSettings } from './components/StreamSettings';
import { StorageSettings } from './components/StorageSettings';
import { AdvancedFfmpegSettings } from './components/AdvancedFfmpegSettings';

type SettingsTab = 'users' | 'stream' | 'storage' | 'advanced';

export const SettingsFeature: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('users');

  const menuItems = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'stream', label: 'Broadcast', icon: Radio },
    { id: 'storage', label: 'Storage', icon: HardDrive },
    { id: 'advanced', label: 'Advanced', icon: Cpu },
  ];

  return (
    <Box w="full" h="full" data-theme="light" p={2}>
      <Flex gap={12} h="full" align="start">
        {/* Navigation Sidebar */}
        <VStack w="240px" align="stretch" gap={1} pt={2}>
          <Heading size="md" mb={6} fontWeight="bold" px={4}>Settings</Heading>
          {menuItems.map((item) => (
            <HStack
              key={item.id}
              as="button"
              onClick={() => setActiveTab(item.id as SettingsTab)}
              px={4}
              py={3}
              borderRadius="xl"
              bg={activeTab === item.id ? "gray.900" : "transparent"}
              color={activeTab === item.id ? "white" : "gray.500"}
              transition="all 0.2s"
              _hover={activeTab === item.id ? {} : { bg: "gray.100", color: "gray.900" }}
            >
              <Icon as={item.icon} size="sm" />
              <Text fontSize="sm" fontWeight="bold">{item.label}</Text>
            </HStack>
          ))}
        </VStack>

        {/* Content Card */}
        <Box 
          flex="1" 
          bg="white" 
          p={10} 
          borderRadius="3xl" 
          shadow="sm" 
          border="1px solid" 
          borderColor="gray.100" 
          overflowY="auto" 
          h="full"
        >
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'stream' && <StreamSettings />}
          {activeTab === 'storage' && <StorageSettings />}
          {activeTab === 'advanced' && <AdvancedFfmpegSettings />}
        </Box>
      </Flex>
    </Box>
  );
};