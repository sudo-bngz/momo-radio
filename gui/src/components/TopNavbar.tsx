import React from 'react';
import { Box, HStack, Text, Flex, Icon, Spinner } from '@chakra-ui/react';
import { Avatar, Menu } from '@chakra-ui/react';
import { keyframes } from '@emotion/react'; // 👈 IMPORT THIS
import { LogOut, Settings, BookOpen, Users, Music, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useDashboard } from '../features/dashboard/hook/useDashboard';

// 1. Define the animation outside the component using the helper
// This ensures the animation is registered globally in the CSSOM
const scrollAnimation = keyframes`
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
`;

export const TopNav: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { nowPlaying, isLoading } = useDashboard(); 

  if (!user) return null;

  const roleColor = user.role === 'admin' ? 'red' : user.role === 'manager' ? 'purple' : 'blue';
  
  const trackText = nowPlaying?.artist 
    ? `${nowPlaying.artist} - ${nowPlaying.title}` 
    : "AutoDJ is active";

  return (
    // Container: Passthrough clicks (pointerEvents="none") so dashboard works underneath
    <Box w="100%" pt={4} pr={6} mb={4} zIndex={50} pointerEvents="none" position="relative">
      
      <Flex justify="flex-end" align="start" gap={4}>

        {/* 1. ON AIR WIDGET */}
        <HStack 
          gap={0} 
          bg="white" 
          h="42px"
          pl={4} pr={2}
          borderRadius="full" 
          shadow="sm"
          border="1px solid" borderColor="gray.100"
          display={{ base: 'none', lg: 'flex' }}
          pointerEvents="auto" // Re-enable clicks
        >
          {/* Live Indicator */}
          <HStack gap={2} mr={4}>
            <Box w={2} h={2} bg="red.500" borderRadius="full" animation="pulse 2s infinite" />
            <Text fontSize="10px" fontWeight="900" color="red.500" letterSpacing="widest">LIVE</Text>
          </HStack>
          
          <Box w="1px" h="16px" bg="gray.100" mr={4} />
          
          {/* SCROLLING TRACK TEXT */}
          <HStack gap={3} mr={4} w="180px" overflow="hidden" position="relative">
            {/* Flex shrink 0 prevents the icon from getting squashed */}
            <Icon as={Music} boxSize={3.5} color="gray.400" flexShrink={0} zIndex={2} bg="white" />
            
            {isLoading ? (
              <Spinner size="xs" color="gray.400" />
            ) : (
              <Box 
                flex="1" 
                overflow="hidden" 
                position="relative" 
                h="20px" // Define height to contain the text
                display="flex"
                alignItems="center"
              >
                <Text 
                  fontSize="xs" 
                  fontWeight="600" 
                  color="gray.700" 
                  whiteSpace="nowrap"
                  
                  // ⚡️ THE FIX:
                  // 1. display="inline-block" is required for transform to work
                  // 2. We use the 'scrollAnimation' variable defined above
                  display="inline-block"
                  animation={`${scrollAnimation} 12s linear infinite`}
                  
                  // Optimization: Tells browser to expect changes
                  willChange="transform" 
                >
                  {trackText}
                </Text>
              </Box>
            )}
          </HStack>
          
          {/* Listeners Badge */}
          <HStack bg="gray.50" py={1} px={2.5} borderRadius="full" gap={1.5}>
            <Icon as={Users} boxSize={3} color="gray.500" />
            <Text fontSize="xs" fontWeight="bold" color="gray.700">42</Text>
          </HStack>
        </HStack>

        {/* 2. USER PROFILE */}
        <Box pointerEvents="auto"> 
          <Menu.Root positioning={{ placement: "bottom-end" }}>
            <Menu.Trigger asChild>
              <HStack 
                bg="white"
                h="42px"
                pl={1.5} pr={3}
                borderRadius="full" 
                shadow="sm"
                border="1px solid" borderColor="gray.100"
                cursor="pointer"
                transition="all 0.2s"
                _hover={{ transform: "translateY(-1px)", shadow: "md" }}
                gap={3}
              >
                <Avatar.Root size="xs">
                  <Avatar.Fallback bg={`${roleColor}.100`} color={`${roleColor}.700`} fontWeight="bold" fontSize="xs">
                    {user.username.substring(0, 2).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar.Root>
                
                <Flex direction="column" align="flex-start" gap={0}>
                  <Text fontSize="xs" fontWeight="bold" color="gray.800" lineHeight="1.2">
                    {user.username}
                  </Text>
                </Flex>
                <Icon as={ChevronDown} boxSize={3.5} color="gray.400" />
              </HStack>
            </Menu.Trigger>

            <Menu.Positioner>
              <Menu.Content 
                minW="180px" 
                bg="white" 
                borderRadius="xl" 
                boxShadow="xl" 
                p={2}
                mt={2}
                border="1px solid" borderColor="gray.100"
                zIndex={100}
              >
                <Menu.Item value="settings" borderRadius="md" _hover={{ bg: "gray.50" }} cursor="pointer">
                  <HStack gap={3}>
                    <Icon as={Settings} boxSize={4} color="gray.500" />
                    <Text fontSize="sm">Settings</Text>
                  </HStack>
                </Menu.Item>
                
                <Menu.Item value="docs" borderRadius="md" _hover={{ bg: "gray.50" }} cursor="pointer">
                  <HStack gap={3}>
                    <Icon as={BookOpen} boxSize={4} color="gray.500" />
                    <Text fontSize="sm">Docs</Text>
                  </HStack>
                </Menu.Item>
                
                <Box h="1px" bg="gray.100" my={2} />
                
                <Menu.Item 
                  value="logout" 
                  color="red.600" 
                  borderRadius="md" 
                  _hover={{ bg: "red.50" }} 
                  cursor="pointer"
                  onClick={logout}
                >
                  <HStack gap={3}>
                    <Icon as={LogOut} boxSize={4} />
                    <Text fontSize="sm" fontWeight="medium">Sign Out</Text>
                  </HStack>
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>
        </Box>

      </Flex>
    </Box>
  );
};