import React, { useState, useEffect } from 'react';
import { 
  Box, VStack, HStack, Heading, Text, Button, Icon, Flex 
} from '@chakra-ui/react';
import { Plus, Radio } from 'lucide-react';
import { useNavigate, useMatch, useLocation } from 'react-router-dom'; 

import { MountPoints } from './MountPoints'; 
import { PublicPageView } from './PublicPageView';

type BroadcastTab = 'streams' | 'public_page';

const TABS: { id: BroadcastTab; label: string }[] = [
  { id: 'streams', label: 'Streams' },
  { id: 'public_page', label: 'Public Page' },
];

export const BroadcastView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation(); 
  
  const streamDetailMatch = useMatch('/broadcast/streams/:id');
  
  const [activeTab, setActiveTab] = useState<BroadcastTab>(
    (location.state as any)?.activeTab || 'streams'
  );

  useEffect(() => {
    if ((location.state as any)?.activeTab) {
      setActiveTab((location.state as any).activeTab);
    }
  }, [location.state]);

  const currentTabLabel = TABS.find(t => t.id === activeTab)?.label || 'Streams';
  const isDetailViewActive = !!streamDetailMatch;

  const handleAddClick = () => {
    navigate('/broadcast/streams/new');
  };

  return (
    <VStack align="stretch" h="100%" gap={8} bg="white" data-theme="light">
      
      {/* 1. HEADER & BREADCRUMB */}
      <Flex justify="space-between" align="flex-end" wrap="wrap" gap={4}>
        <VStack align="start" gap={1}>
          <HStack gap={2} fontSize="sm" color="gray.500" mb={1}>
            <Box w="24px" h="24px" bg="blue.500" color="white" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
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
         Radio Engine
            </Heading>
          )}
        </VStack>
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