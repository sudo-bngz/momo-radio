import React, { useState, useEffect } from 'react';
import { Box, VStack, HStack, Heading, Text, Button, Icon, Flex } from '@chakra-ui/react';
import { Plus, Radio } from 'lucide-react';
import { useNavigate, useMatch, useLocation } from 'react-router-dom'; 

import { MountPoints } from './MountPoints'; 
import { SectionColors } from '../../../theme';

type BroadcastTab = 'streams';
const TABS: { id: BroadcastTab; label: string }[] = [{ id: 'streams', label: 'Streams' }];

export const BroadcastView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation(); 
  const streamDetailMatch = useMatch('/broadcast/streams/:id');
  
  const [activeTab, setActiveTab] = useState<BroadcastTab>((location.state as any)?.activeTab || 'streams');
  useEffect(() => {
    if ((location.state as any)?.activeTab) setActiveTab((location.state as any).activeTab);
  }, [location.state]);

  const currentTabLabel = TABS.find(t => t.id === activeTab)?.label || 'Streams';
  const isDetailViewActive = !!streamDetailMatch;

  return (
    // ⚡️ Transparent background to inherit the parent layout natively
    <VStack align="stretch" h="100%" gap={8} bg="transparent">
      
      {/* 1. HEADER */}
      <Flex justify="space-between" align="flex-end" wrap="wrap" gap={4}>
        <VStack align="start" gap={1}>
          <HStack gap={2} fontSize="sm" color="fg.muted" mb={1}>
            
            <Box 
              w="24px" h="24px" color="white" borderRadius="md" display="flex" alignItems="center" justifyContent="center"
              bg={`${SectionColors.broadcast}.500`} 
              _dark={{ bg: `${SectionColors.broadcast}.400` }}
            >
              <Icon as={Radio} boxSize={3} strokeWidth={3} />
            </Box>

            <Text cursor="pointer" _hover={{ textDecoration: "underline", color: "fg" }} onClick={() => navigate('/broadcast')}>
              Broadcasting
            </Text>
            <Text color="border">/</Text>
            
            {streamDetailMatch ? (
              <>
                <Text cursor="pointer" _hover={{ textDecoration: "underline", color: "fg" }} onClick={() => navigate('/broadcast')}>
                  Streams
                </Text>
                <Text color="border">/</Text>
                <Text color="fg" fontWeight="600">Edit Stream</Text>
              </>
            ) : (
              <Text color="fg" fontWeight="500">{currentTabLabel}</Text>
            )}
          </HStack>

          {!isDetailViewActive && (
            <Heading size="3xl" fontWeight="normal" color="fg" letterSpacing="tight">
              Radio Engine
            </Heading>
          )}
        </VStack>
      </Flex>

      {/* 2. CONTROLS (Mobile Optimized Horizontal Scroll) */}
      {!isDetailViewActive && (
        <Flex 
          w="100%" 
          align="center" 
          pb={2} 
          gap={3} 
          overflowX="auto" 
          css={{ 
            '&::-webkit-scrollbar': { display: 'none' }, 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none' 
          }}
        >
          {activeTab === 'streams' && (
            <Button 
              bg="fg" color="bg" borderRadius="full" w="48px" h="48px" p={0} 
              _hover={{ opacity: 0.8 }} 
              onClick={() => navigate('/broadcast/streams/new')} 
              flexShrink={0} // ⚡️ Prevents button from squishing on mobile
            >
              <Icon as={Plus} boxSize={6} />
            </Button>
          )}

          <HStack gap={2} flexShrink={0}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <Button
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id)} 
                  size="sm" 
                  borderRadius="full" 
                  px={5} 
                  h="36px"
                  bg={isActive ? 'fg' : 'bg.panel'} 
                  color={isActive ? 'bg' : 'fg.muted'} 
                  fontWeight={isActive ? '600' : '500'}
                  border="1px solid"
                  borderColor={isActive ? "transparent" : "border"}
                  _hover={isActive ? {} : { bg: 'gray.100', color: 'fg', _dark: { bg: 'whiteAlpha.100' } }} 
                  transition="all 0.2s"
                  flexShrink={0} // ⚡️ Prevents tabs from breaking into multiple lines on mobile
                >
                  {tab.label}
                </Button>
              );
            })}
          </HStack>
        </Flex>
      )}

      {/* 3. CONTENT ROUTER */}
      <Box flex="1" overflow="hidden" display="flex" flexDirection="column">
        {streamDetailMatch ? (
          <Box p={6} border="1px dashed" borderColor="border" borderRadius="xl" textAlign="center">
             <Text color="fg.muted">Edit Stream Placeholder</Text>
          </Box>
        ) : (
          <>{activeTab === 'streams' && <MountPoints />}</>
        )}
      </Box>
    </VStack>
  );
};
