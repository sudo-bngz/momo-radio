import React, { useState, useEffect } from 'react';
import { 
  Box, VStack, HStack, Heading, Text, Button, Icon, Select, createListCollection, Flex, Spinner
} from '@chakra-ui/react';
import { Plus, Radio, ChevronDown, Play, Square } from 'lucide-react';
import { useNavigate, useMatch, useLocation } from 'react-router-dom'; 

import { MountPoints } from './MountPoints'; 
import { PublicPageView } from './PublicPageView';
import { api } from '../../../services/api'; // Adjust path if needed

type BroadcastTab = 'streams' | 'public_page';

const TABS: { id: BroadcastTab; label: string }[] = [
  { id: 'streams', label: 'Streams' },
  { id: 'public_page', label: 'Public Page' },
];

const sortOptions = createListCollection({
  items: [
    { label: "Default First", value: "default" },
    { label: "Highest Quality", value: "bitrate_desc" },
    { label: "Lowest Quality", value: "bitrate_asc" },
  ],
});

export const BroadcastView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation(); 
  
  const streamDetailMatch = useMatch('/broadcast/streams/:id');
  
  const [activeTab, setActiveTab] = useState<BroadcastTab>(
    (location.state as any)?.activeTab || 'streams'
  );
  
  const [sortBy, setSortBy] = useState('default');
  
  // ⚡️ NEW: Master Broadcast State
  const [isLive, setIsLive] = useState(false); // Ideally, fetch the initial state from your backend on mount!
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if ((location.state as any)?.activeTab) {
      setActiveTab((location.state as any).activeTab);
    }
  }, [location.state]);

  const currentTabLabel = TABS.find(t => t.id === activeTab)?.label || 'Streams';
  const isDetailViewActive = !!streamDetailMatch;

  // ⚡️ NEW: Toggle Handler
  const handleBroadcastToggle = async () => {
    try {
      setIsToggling(true);
      const action = isLive ? 'stop' : 'start';
      await api.toggleBroadcast(action);
      setIsLive(!isLive);
    } catch (error) {
      console.error("Failed to toggle broadcast state:", error);
      // Optional: Add a toast notification here to inform the user of the error
    } finally {
      setIsToggling(false);
    }
  };

  const handleAddClick = () => {
    navigate('/broadcast/streams/new');
  };

  return (
    <VStack align="stretch" h="100%" gap={8} bg="white" data-theme="light">
      
      {/* 1. HEADER & BREADCRUMB */}
      <Flex justify="space-between" align="flex-end" wrap="wrap" gap={4}>
        <VStack align="start" gap={1}>
          <HStack gap={2} fontSize="sm" color="gray.500" mb={1}>
            <Box w="24px" h="24px" bg={isLive ? "red.500" : "blue.500"} color="white" borderRadius="md" display="flex" alignItems="center" justifyContent="center" transition="background 0.3s">
              <Icon as={Radio} boxSize={3} strokeWidth={3} />
            </Box>
            <Text 
              cursor="pointer" 
              _hover={{ textDecoration: "underline", color: "gray.900" }} 
              onClick={() => navigate('/broadcast', { state: { activeTab: 'streams' } })}
            >
              Broadcasting
            </Text>
            <Text color="gray.300">/</Text>
            
            {streamDetailMatch ? (
              <>
                <Text 
                  cursor="pointer" 
                  _hover={{ textDecoration: "underline", color: "gray.900" }} 
                  onClick={() => {
                    setActiveTab('streams');
                    navigate('/broadcast', { state: { activeTab: 'streams' } });
                  }}
                >
                  Streams
                </Text>
                <Text color="gray.300">/</Text>
                <Text color="gray.900" fontWeight="600">Edit Stream</Text>
              </>
            ) : (
              <Text color="gray.900" fontWeight="500">{currentTabLabel}</Text>
            )}
          </HStack>

          {!isDetailViewActive && (
            <Heading size="3xl" fontWeight="normal" color="gray.900" letterSpacing="tight">
              Transmission
            </Heading>
          )}
        </VStack>

        {/* ⚡️ NEW: Master Power Button */}
        {!isDetailViewActive && (
          <Button
            size="lg"
            bg={isLive ? "red.50" : "gray.900"}
            color={isLive ? "red.600" : "white"}
            border={isLive ? "1px solid" : "none"}
            borderColor="red.200"
            _hover={isLive ? { bg: "red.100" } : { bg: "black" }}
            onClick={handleBroadcastToggle}
            disabled={isToggling}
            px={6}
            borderRadius="full"
            shadow={isLive ? "none" : "md"}
          >
            {isToggling ? (
              <Spinner size="sm" mr={2} />
            ) : (
              <Icon as={isLive ? Square : Play} boxSize={4} mr={2} fill={isLive ? "currentColor" : "none"} />
            )}
            {isLive ? "Stop Broadcast" : "Start Broadcast"}
          </Button>
        )}
      </Flex>

      {/* 2. CONTROLS */}
      {!isDetailViewActive && (
        <Flex justify="space-between" align="center" pb={2}>
          <HStack gap={4} overflowX="auto" css={{ '&::-webkit-scrollbar': { display: 'none' } }}>
            {activeTab === 'streams' && (
              <Button bg="gray.900" color="white" borderRadius="full" w="48px" h="48px" p={0} _hover={{ bg: "black" }} onClick={handleAddClick} flexShrink={0}>
                <Icon as={Plus} boxSize={6} />
              </Button>
            )}

            <HStack gap={2}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <Button
                    key={tab.id} onClick={() => setActiveTab(tab.id)} size="sm" borderRadius="full" px={5} h="36px"
                    bg={isActive ? 'gray.900' : 'transparent'} color={isActive ? 'white' : 'gray.600'} fontWeight={isActive ? '600' : '500'}
                    _hover={isActive ? {} : { bg: 'gray.100', color: 'gray.900' }} transition="all 0.2s"
                  >
                    {tab.label}
                  </Button>
                );
              })}
            </HStack>
          </HStack>

          {activeTab === 'streams' && (
            <Select.Root collection={sortOptions} value={[sortBy]} onValueChange={(details) => setSortBy(details.value[0])} width="180px">
              <Select.Trigger height="36px" bg="white" color="gray.700" fontSize="sm" border="1px solid" borderColor="gray.200" borderRadius="full" px={4} _hover={{ borderColor: "gray.300", bg: "gray.50" }}>
                <Select.ValueText placeholder="Sort by" fontWeight="600" />
                <Icon as={ChevronDown} color="gray.500" boxSize={4} />
              </Select.Trigger>
              <Select.Positioner zIndex={100}>
                <Select.Content bg="white" borderRadius="xl" shadow="md" border="1px solid" borderColor="gray.200" p={1}>
                  {sortOptions.items.map((item) => (
                    <Select.Item item={item} key={item.value} p={2} borderRadius="md" _hover={{ bg: "gray.50" }} cursor="pointer">
                      <Select.ItemText color="gray.800" fontSize="sm" fontWeight="500">{item.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Select.Root>
          )}
        </Flex>
      )}

      {/* 3. CONTENT ROUTER */}
      <Box flex="1" overflow="hidden" display="flex" flexDirection="column">
        {streamDetailMatch ? (
          <Box p={6} border="1px dashed" borderColor="gray.300" borderRadius="xl" textAlign="center">
             <Text color="gray.500">Edit Stream Placeholder</Text>
          </Box>
        ) : (
          <>
            {activeTab === 'streams' && <MountPoints />}
            {activeTab === 'public_page' && <PublicPageView />}
          </>
        )}
      </Box>

    </VStack>
  );
};