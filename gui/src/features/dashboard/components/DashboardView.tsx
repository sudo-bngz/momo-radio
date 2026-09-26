import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, VStack, HStack, Text, Heading, Icon, Button, IconButton, Flex 
} from '@chakra-ui/react';
import { Activity, Settings, Plus, X } from 'lucide-react';
import { WidthProvider, Responsive } from 'react-grid-layout/legacy';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { useDashboardLayoutStore } from '../../../store/useDashboardLayoutStore';
import { WidgetRegistry } from './WidgetRegistry';
import { SectionColors } from '../../../theme';

const ResponsiveGridLayout = WidthProvider(Responsive);

export const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { widgets, isEditMode, setEditMode, updateLayouts, removeWidget, addWidget } = useDashboardLayoutStore();

  const handleLayoutChange = (layout: any) => {
    updateLayouts(layout);
  };

  return (
    <VStack 
      align="stretch" h="100%" gap={8} animation="fade-in 0.3s ease-out"
      bg="transparent" // ⚡️ Let it inherit the dark background from the App layout
      color="fg" // ⚡️ Semantic foreground color
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
            <Button 
              size="sm" bg="fg" color="bg" borderRadius="full" px={4} 
              _hover={{ opacity: 0.8 }} 
              onClick={() => addWidget('live-broadcast')}
            >
              <Icon as={Plus} boxSize={4} mr={1.5} />
              Add Widget
            </Button>
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
            onClick={() => setEditMode(!isEditMode)}
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
                position="relative" h="100%" w="100%" transition="outline 0.2s"
                _hover={isEditMode ? { outline: '2px dashed', outlineColor: 'border', outlineOffset: '4px', cursor: 'grab' } : {}}
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