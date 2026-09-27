import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, VStack, HStack, Text, Heading, Icon, Button, IconButton, Flex, Popover 
} from '@chakra-ui/react';
import { Activity, Settings, Plus, X, Radio, Clock, Globe } from 'lucide-react';
import { WidthProvider, Responsive } from 'react-grid-layout/legacy';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { useDashboardLayoutStore } from '../../../store/useDashboardLayoutStore';
import { WidgetRegistry } from './WidgetRegistry';
import { SectionColors } from '../../../theme';

const ResponsiveGridLayout = WidthProvider(Responsive);

export const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  
  const { 
    widgets, isEditMode, setEditMode, updateLayouts, 
    removeWidget, addWidget, fetchLayout, saveLayoutToDb 
  } = useDashboardLayoutStore();

  useEffect(() => {
    fetchLayout();
  }, [fetchLayout]);

  const handleLayoutChange = (layout: any) => {
    updateLayouts(layout);
  };

  const handleToggleEditMode = async () => {
    if (isEditMode) {
      await saveLayoutToDb();
    }
    setEditMode(!isEditMode);
  };

  return (
    <VStack 
      align="stretch" h="100%" gap={8} animation="fade-in 0.3s ease-out"
      bg="transparent"
      color="fg"
    >
      
      {/* HEADER */}
      <VStack align="start" gap={1}>
        <HStack gap={2} fontSize="sm" color="fg.muted" mb={1}>
          <Box 
            w="24px" h="24px" color="white" borderRadius="md" display="flex" alignItems="center" justifyContent="center"
            bg={`${SectionColors.dashboard}.500`}
            _dark={{ bg: `${SectionColors.dashboard}.400` }}
          >
            <Icon as={Activity} boxSize={3} strokeWidth={3} />
          </Box>
          <Text cursor="pointer" _hover={{ textDecoration: "underline", color: "fg" }} onClick={() => navigate('/')}>
            Dashboard
          </Text>
          <Text color="border">/</Text>
          <Text color="fg" fontWeight="500">Overview</Text>
        </HStack>
        
        <Heading size="3xl" fontWeight="normal" color="fg" letterSpacing="tight">
          Station Overview
        </Heading>
      </VStack>

      {/* CONTROLS */}
      <Flex justify="flex-end" align="center" pb={2}>
        <HStack gap={3}>
          {isEditMode && (
            <Popover.Root positioning={{ placement: "bottom-end" }}>
              <Popover.Trigger asChild>
                <Button 
                  size="sm" bg="fg" color="bg" borderRadius="full" px={4} 
                  _hover={{ opacity: 0.8 }} 
                >
                  <Icon as={Plus} boxSize={4} mr={1.5} />
                  Add Widget
                </Button>
              </Popover.Trigger>
              <Popover.Positioner zIndex={50}>
                <Popover.Content w="220px" shadow="xl" border="1px solid" borderColor="border" borderRadius="xl" bg="bg.panel">
                  <Popover.Arrow />
                  <Popover.Body p={2}>
                    <VStack align="stretch" gap={1}>
                      <Button variant="ghost" justifyContent="flex-start" onClick={() => addWidget('live-broadcast')}>
                        <Icon as={Radio} mr={3} boxSize={4} color="red.500" />
                        Live Broadcast
                      </Button>
                      <Button variant="ghost" justifyContent="flex-start" onClick={() => addWidget('recent-tracks')}>
                        <Icon as={Clock} mr={3} boxSize={4} color="pink.500" />
                        Recently Played
                      </Button>
                      {/* ⚡️ Fixed: Changed 'system-stats' to 'stats' to match WidgetRegistry */}
                      <Button variant="ghost" justifyContent="flex-start" onClick={() => addWidget('system-stats')}>
                        <Icon as={Activity} mr={3} boxSize={4} color="teal.500" />
                        System Metrics
                      </Button>
                      <Button variant="ghost" justifyContent="flex-start" onClick={() => addWidget('endpoints')}>
                        <Icon as={Globe} mr={3} boxSize={4} color="blue.500" />
                        Endpoints
                      </Button>
                      <Button variant="ghost" justifyContent="flex-start" onClick={() => addWidget('public-page')}>
                        <Icon as={Globe} mr={3} boxSize={4} color="purple.500" />
                        Public Page
                      </Button>
                    </VStack>
                  </Popover.Body>
                </Popover.Content>
              </Popover.Positioner>
            </Popover.Root>
          )}
          
          <Button 
            size="sm" 
            variant={isEditMode ? "solid" : "outline"} 
            bg={isEditMode ? "green.500" : "transparent"}
            color={isEditMode ? "white" : "fg"}
            borderColor={isEditMode ? "green.500" : "border"}
            _dark={{
              bg: isEditMode ? "green.600" : "transparent",
            }}
            borderRadius="full"
            px={4}
            onClick={handleToggleEditMode}
          >
            <Icon as={Settings} boxSize={4} mr={1.5} />
            {isEditMode ? "Save Layout" : "Customize Layout"}
          </Button>
        </HStack>
      </Flex>

      {/* GRID */}
      <Box flex="1" overflowX="hidden" overflowY="auto" pb={8} mx="-12px" px="12px">
        <ResponsiveGridLayout
          className={`layout ${isEditMode ? 'is-editing' : ''}`}
          layouts={{ lg: widgets.map(w => w.layout) }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={80} 
          onLayoutChange={handleLayoutChange} 
          isDraggable={isEditMode}
          isResizable={isEditMode}
          margin={[24, 24]} 
          useCSSTransforms={true}
        >
          {widgets.map((widget) => (
            <div key={widget.id} data-grid={widget.layout}>
              <Box 
                position="relative" h="100%" w="100%" transition="outline 0.2s" borderRadius="xl"
                _hover={isEditMode ? { outline: '2px dashed', outlineColor: 'blue.400', outlineOffset: '4px', cursor: 'grab' } : {}}
              >
                {isEditMode && (
                  <IconButton
                    aria-label="Remove widget" size="xs" position="absolute" top="-10px" right="-10px"
                    bg="red.500" color="white" borderRadius="full" zIndex={10}
                    onClick={() => removeWidget(widget.id)}
                    _hover={{ bg: "red.600" }}
                  >
                    <Icon as={X} boxSize={3} />
                  </IconButton>
                )}
                
                {/* Ensure the registry container matches the grid cell height perfectly */}
                <Box h="100%" w="100%" pointerEvents={isEditMode ? 'none' : 'auto'} css={{ '> div': { height: '100%' } }}>
                   <WidgetRegistry type={widget.type} />
                </Box>
              </Box>
            </div>
          ))}
        </ResponsiveGridLayout>
      </Box>
    </VStack>
  );
};