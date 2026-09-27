import React, { useState } from 'react';
import { Box, HStack, Text, Flex, Icon, Spinner, IconButton, Drawer } from '@chakra-ui/react';
import { Avatar, Menu } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { LogOut, Settings, BookOpen, Music, ChevronDown, Menu as MenuIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../store/useAuthStore';
import { useDashboard } from '../features/dashboard/hook/useDashboard';
import { useBroadcastStore } from '../store/useBroadcast';
import { SearchBar } from './SearchBar'; 
import Sidebar from './Sidebar';

const scrollAnimation = keyframes`
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
`;

export const TopNav: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const activeOrgId = useAuthStore((state: any) => state.activeOrganizationId);
  const { nowPlaying, isLoading: isDashboardLoading } = useDashboard(activeOrgId); 
  
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Pull live state instantly from our new SSE Broadcast store
  const isLive = useBroadcastStore((state) => state.isLive);

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

  // ⚡️ Improved display logic: Prevents showing "Offline" when the stream is booting up
  let trackText = "Offline";
  if (nowPlaying?.title && nowPlaying.title !== "Silence") {
    trackText = `${safeArtistName} - ${nowPlaying.title}`;
  } else if (isLive) {
    trackText = "Live Broadcast";
  }

  return (
    <>
      <Drawer.Root 
        open={isDrawerOpen} 
        onOpenChange={(e) => setIsDrawerOpen(e.open)} 
        placement="start"
      >
        <Drawer.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Drawer.Positioner>
          <Drawer.Content 
            bg="bg.panel" 
            maxW="260px" 
            p={0} 
            borderRight="1px solid" 
            borderColor="border"
          >
            <Drawer.Body p={0} h="100%">
              <Sidebar onCloseMobile={() => setIsDrawerOpen(false)} />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>

      <Box w="100%" px={{ base: 4, md: 8 }} py={{ base: 3, md: 4 }} zIndex={50} bg="transparent">
        <Flex justify="space-between" align="center" gap={{ base: 2, sm: 4 }}>
          
          <HStack gap={2} flex="1" maxW="600px">
            <IconButton
              aria-label="Open navigation menu"
              variant="ghost"
              size="sm"
              display={{ base: "flex", md: "none" }}
              onClick={() => setIsDrawerOpen(true)}
              color="fg"
              _hover={{ bg: "whiteAlpha.100" }}
            >
              <Icon as={MenuIcon} boxSize={5} />
            </IconButton>

            <Box flex="1">
              <SearchBar />
            </Box>
          </HStack>

          <HStack gap={{ base: 2, md: 4 }}>
            
            <HStack 
              gap={0} 
              bg="bg.panel" 
              h="42px" 
              pl={4} 
              pr={2} 
              borderRadius="full" 
              shadow="sm" 
              border="1px solid" 
              borderColor="border" 
              display={{ base: 'none', lg: 'flex' }}
            >
              <HStack gap={2} mr={4}>
                <Box w={2} h={2} bg={isLive ? "red.500" : "fg.muted"} borderRadius="full" animation={isLive ? "pulse 2s infinite" : "none"} />
                <Text fontSize="10px" fontWeight="900" color={isLive ? "red.500" : "fg.muted"} letterSpacing="widest">
                  {isLive ? "LIVE" : "OFF AIR"}
                </Text>
              </HStack>
              
              <Box w="1px" h="16px" bg="border" mr={4} />
              
              <HStack gap={3} mr={4} w="160px" overflow="hidden">
                <Icon as={Music} boxSize={3.5} color={isLive ? "fg.muted" : "border"} flexShrink={0} />
                {isDashboardLoading && isLive ? (
                  <Spinner size="xs" color="fg.muted" />
                ) : (
                  <Box flex="1" overflow="hidden" h="20px" display="flex" alignItems="center">
                    <Text fontSize="xs" fontWeight="600" color={isLive ? "fg" : "fg.muted"} whiteSpace="nowrap" display="inline-block" animation={isLive && trackText.length > 25 ? `${scrollAnimation} 12s linear infinite` : "none"}>
                      {trackText}
                    </Text>
                  </Box>
                )}
              </HStack>
            </HStack>

            <Menu.Root positioning={{ placement: "bottom-end" }}>
              <Menu.Trigger asChild>
                <HStack 
                  bg="bg.panel" 
                  h="42px" 
                  pl={1.5} 
                  pr={{ base: 1.5, sm: 3 }} 
                  borderRadius="full" 
                  shadow="sm" 
                  border="1px solid" 
                  borderColor="border" 
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
                  <Text fontSize="sm" fontWeight="600" color="fg" display={{ base: "none", sm: "block" }}>
                    {displayName}
                  </Text>
                  <Icon as={ChevronDown} boxSize={3.5} color="fg.muted" display={{ base: "none", sm: "block" }} />
                </HStack>
              </Menu.Trigger>

              <Menu.Positioner zIndex={100}>
                <Menu.Content minW="180px" bg="bg.panel" borderRadius="xl" boxShadow="xl" p={2} border="1px solid" borderColor="border">
                  
                  <Menu.Item value="settings" onClick={() => navigate('/settings')} _hover={{ bg: "gray.50" }} _dark={{ _hover: { bg: "whiteAlpha.100" } }} cursor="pointer" display="flex" alignItems="center" gap={3}>
                    <Icon as={Settings} boxSize={4} /> 
                    <Text>Settings</Text>
                  </Menu.Item>
                  
                  <Menu.Item value="docs" onClick={() => window.open('https://docs.momo.radio', '_blank')} _hover={{ bg: "gray.50" }} _dark={{ _hover: { bg: "whiteAlpha.100" } }} cursor="pointer" display="flex" alignItems="center" gap={3}>
                    <Icon as={BookOpen} boxSize={4} /> 
                    <Text>Docs</Text>
                  </Menu.Item>
                  
                  <Menu.Separator my={1} />
                  
                  <Menu.Item value="logout" onClick={logout} color="red.500" _dark={{ color: "red.400", _hover: { bg: "whiteAlpha.100" } }} _hover={{ bg: "red.50" }} cursor="pointer" display="flex" alignItems="center" gap={3}>
                    <Icon as={LogOut} boxSize={4} /> 
                    <Text>Sign Out</Text>
                  </Menu.Item>

                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
          </HStack>
        </Flex>
      </Box>
    </>
  );
};