import React from 'react';
import { Box, HStack, Text, Avatar, Menu, Flex, Icon, Spinner } from '@chakra-ui/react';
import { LogOut, Settings, BookOpen, Users, Music, ChevronDown } from 'lucide-react';
// FIX 1: Import the Zustand store instead of the old Context
import { useAuthStore } from '../store/useAuthStore';
import { useDashboard } from '../features/dashboard/hook/useDashboard';

export const TopNav: React.FC = () => {
  // FIX 2: Access user and logout directly from Zustand
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { nowPlaying, isLoading } = useDashboard(); 

  // If the store hasn't hydrated or user isn't logged in, don't show the nav
  if (!user) return null;

  const roleColor = user.role === 'admin' ? 'red' : user.role === 'manager' ? 'purple' : 'blue';
  const trackText = nowPlaying?.artist ? `${nowPlaying.artist} - ${nowPlaying.title}` : "AutoDJ is loading...";

  return (
    <Box h="64px" px={6} bg="gray.50" borderBottom="1px solid" borderColor="gray.200" shadow="sm">
      
      <style>
        {`
          @keyframes marquee {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
        `}
      </style>

      <Flex justify="flex-end" align="center" h="100%" gap={6}>

        {/* ON AIR PILL */}
        <HStack 
          gap={4} 
          bg="white" 
          px={4} 
          py={1.5} 
          borderRadius="full" 
          borderWidth="1px" 
          borderColor="gray.200"
          display={{ base: 'none', lg: 'flex' }}
          shadow="sm"
        >
          <HStack gap={2}>
            <Box w={2} h={2} bg="red.500" borderRadius="full" animation="pulse 2s infinite" />
            <Text fontSize="xs" fontWeight="bold" color="red.500" letterSpacing="widest">ON AIR</Text>
          </HStack>
          
          <Box w="1px" h="16px" bg="gray.300" />
          
          <HStack gap={2}>
            <Icon as={Music} boxSize="14px" color="gray.500" />
            {isLoading ? (
              <Spinner size="xs" />
            ) : (
              <Box 
                w="200px" 
                overflow="hidden" 
                whiteSpace="nowrap"
                style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}
              >
                <Text 
                  fontSize="sm" 
                  fontWeight="bold" 
                  color="gray.700" 
                  display="inline-block"
                  animation="marquee 12s linear infinite"
                >
                  {trackText}
                </Text>
              </Box>
            )}
          </HStack>
          
          <Box w="1px" h="16px" bg="gray.300" />
          
          <HStack gap={1.5}>
            <Icon as={Users} boxSize="14px" color="gray.500" />
            <Text fontSize="sm" fontWeight="bold" color="gray.700">42</Text>
          </HStack>
        </HStack>

        {/* USER MENU */}
        <Box position="relative">
          <Menu.Root positioning={{ placement: "bottom-end" }}>
            <Menu.Trigger asChild>
              <HStack 
                gap={3} 
                cursor="pointer" 
                p={1.5} 
                pr={3}
                borderRadius="full" 
                _hover={{ bg: 'gray.100' }} 
                transition="all 0.2s"
              >
                <Avatar.Root size="sm" shape="rounded">
                  <Avatar.Fallback 
                    bg={`${roleColor}.500`} 
                    color="white" 
                    fontWeight="bold"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    lineHeight="1"
                  >
                    {user.username.substring(0, 2).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar.Root>
                
                <Flex direction="column" align="flex-start" justify="center">
                  <Text fontSize="sm" fontWeight="bold" lineHeight="1" color="gray.800">
                    {user.username}
                  </Text>
                  <Text fontSize="10px" color={`${roleColor}.600`} fontWeight="bold" mt={0.5} letterSpacing="wider">
                    {user.role.toUpperCase()}
                  </Text>
                </Flex>
                <Icon as={ChevronDown} boxSize="16px" color="gray.400" />
              </HStack>
            </Menu.Trigger>

            <Menu.Content 
              position="absolute" 
              top="calc(100% + 12px)" 
              right="0" 
              minW="200px" 
              zIndex="9999"
              bg="white"
              boxShadow="xl"
              borderRadius="md"
              border="1px solid"
              borderColor="gray.100"
            >
              <Menu.Item value="settings">
                <HStack gap={2}>
                  <Settings size={16} />
                  <Text>Station Settings</Text>
                </HStack>
              </Menu.Item>
              <Menu.Item value="docs">
                <HStack gap={2}>
                  <BookOpen size={16} />
                  <Text>Documentation</Text>
                </HStack>
              </Menu.Item>
              <Menu.Separator />
              {/* FIX 3: Correctly triggers the Zustand logout action */}
              <Menu.Item value="logout" color="red.500" onClick={logout}>
                <HStack gap={2}>
                  <LogOut size={16} />
                  <Text>Logout</Text>
                </HStack>
              </Menu.Item>
            </Menu.Content>
          </Menu.Root>
        </Box>

      </Flex>
    </Box>
  );
};
