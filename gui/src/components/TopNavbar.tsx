import React from 'react';
import { Box, HStack, Text, Flex, Icon, Spinner, Input } from '@chakra-ui/react';
import { Avatar, Menu } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { LogOut, Settings, BookOpen, Music, ChevronDown, Search } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useDashboard } from '../features/dashboard/hook/useDashboard';
import { useSearchStore } from '../store/useSearchStore';

const scrollAnimation = keyframes`
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
`;

export const TopNav: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const { globalSearch, setGlobalSearch } = useSearchStore();
  const logout = useAuthStore((state) => state.logout);
  const { nowPlaying, isLoading } = useDashboard(); 

  if (!user) return null;

  const metadata = user.user_metadata || {};
  const avatarUrl = metadata.avatar_url;
  const displayName = metadata.full_name || metadata.name || user.email || "User";

  let safeArtistName = "Unknown Artist";
  if (nowPlaying?.artist) {
    if (typeof nowPlaying.artist === 'string') {
      safeArtistName = nowPlaying.artist;
    } else if (typeof nowPlaying.artist === 'object') {
      safeArtistName = (nowPlaying.artist as any).name || "Unknown Artist";
    }
  }

  const trackText = nowPlaying?.title 
    ? `${safeArtistName} - ${nowPlaying.title}` 
    : "AutoDJ is active";

  return (
    <Box w="100%" px={8} py={4} zIndex={50} bg="white" borderBottom="1px solid" borderColor="gray.100">
      <Flex justify="space-between" align="center" gap={4}>
        
        {/* 1. SEARCH BAR (Left Aligned) */}
        <Box position="relative" w="100%" maxW="400px" ml={2}>
          <Icon as={Search} position="absolute" left={4} top="50%" transform="translateY(-50%)" color="gray.400" boxSize={4} zIndex={2} />
          <Input 
            pl={10} h="42px" fontSize="sm" placeholder="Search songs, albums, artists..."
            value={globalSearch} 
            onChange={(e) => setGlobalSearch(e.target.value)}
            borderRadius="full" bg="gray.50" border="1px solid" borderColor="transparent"
            _focus={{ bg: "white", shadow: "sm", borderColor: "gray.200" }} 
          />
        </Box>

        {/* 2. RIGHT SIDE GROUP (Live + User Profile) */}
        <HStack gap={4}>
          
          {/* Live Widget */}
          <HStack 
            gap={0} 
            bg="white" 
            h="42px"
            pl={4} pr={2}
            borderRadius="full" 
            shadow="sm"
            border="1px solid" borderColor="gray.100"
            display={{ base: 'none', lg: 'flex' }}
          >
            <HStack gap={2} mr={4}>
              <Box w={2} h={2} bg="red.500" borderRadius="full" animation="pulse 2s infinite" />
              <Text fontSize="10px" fontWeight="900" color="red.500" letterSpacing="widest">LIVE</Text>
            </HStack>
            
            <Box w="1px" h="16px" bg="gray.100" mr={4} />
            
            <HStack gap={3} mr={4} w="160px" overflow="hidden">
              <Icon as={Music} boxSize={3.5} color="gray.400" flexShrink={0} />
              {isLoading ? (
                <Spinner size="xs" color="gray.400" />
              ) : (
                <Box flex="1" overflow="hidden" h="20px" display="flex" alignItems="center">
                  <Text 
                    fontSize="xs" 
                    fontWeight="600" 
                    color="gray.700" 
                    whiteSpace="nowrap"
                    display="inline-block"
                    animation={`${scrollAnimation} 12s linear infinite`}
                  >
                    {trackText}
                  </Text>
                </Box>
              )}
            </HStack>
          </HStack>

          {/* User Profile Menu */}
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
                _hover={{ shadow: "md" }}
                gap={3}
              >
                <Avatar.Root size="xs">
                  <Avatar.Image src={avatarUrl} />
                  <Avatar.Fallback fontWeight="bold" fontSize="xs">
                    {displayName.slice(0, 2).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar.Root>
                
                <Text fontSize="sm" fontWeight="600" color="gray.800">
                  {displayName}
                </Text>
                <Icon as={ChevronDown} boxSize={3.5} color="gray.400" />
              </HStack>
            </Menu.Trigger>

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
              <Menu.Item value="settings" _hover={{ bg: "gray.50" }} cursor="pointer">
                <Icon as={Settings} boxSize={4} /> Settings
              </Menu.Item>
              <Menu.Item value="docs" _hover={{ bg: "gray.50" }} cursor="pointer">
                <Icon as={BookOpen} boxSize={4} /> Docs
              </Menu.Item>
              <Menu.Separator />
              <Menu.Item 
                value="logout" 
                color="red.600" 
                _hover={{ bg: "red.50" }} 
                cursor="pointer"
                onClick={logout}
              >
                <Icon as={LogOut} boxSize={4} /> Sign Out
              </Menu.Item>
            </Menu.Content>
          </Menu.Root>
        </HStack>

      </Flex>
    </Box>
  );
};