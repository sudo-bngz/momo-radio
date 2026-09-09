import React from 'react';
import { 
  Box, VStack, HStack, Text, Heading, Icon, Button, IconButton, Flex 
} from '@chakra-ui/react';
import { Activity, Settings, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ⚡️ V2.0.0 UPDATE: Using the official legacy entry point for WidthProvider and data-grid support
import { WidthProvider, Responsive } from 'react-grid-layout/legacy';

const ResponsiveGridLayout = WidthProvider(Responsive);

// Grid styles required for dragging and resizing
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { useDashboardLayoutStore } from '../../../store/useDashboardLayoutStore';
import { WidgetRegistry } from './WidgetRegistry';

export const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { 
    widgets, isEditMode, setEditMode, updateLayouts, removeWidget, addWidget 
  } = useDashboardLayoutStore();

  const handleLayoutChange = (layout: any) => {
    updateLayouts(layout);
  };

  return (
    <VStack align="stretch" h="100%" gap={8} bg="white" data-theme="light" animation="fade-in 0.3s ease-out">
      
      {/* 1. HEADER (Pixel-perfect match to LibraryView) */}
      <VStack align="start" gap={1}>
        <HStack gap={2} fontSize="sm" color="gray.500" mb={1}>
          <Box w="24px" h="24px" bg="blue.500" color="white" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
            <Icon as={Activity} boxSize={3} strokeWidth={3} />
          </Box>
          <Text cursor="pointer" _hover={{ textDecoration: "underline", color: "gray.900" }} onClick={() => navigate('/')}>
            Dashboard
          </Text>
          <Text color="gray.300">/</Text>
          <Text color="gray.900" fontWeight="500">Overview</Text>
        </HStack>
        <Heading size="3xl" fontWeight="normal" color="gray.900" letterSpacing="tight">
          Station Overview
        </Heading>
      </VStack>

      {/* 2. DASHBOARD CONTROLS */}
      <Flex justify="flex-end" align="center" pb={2}>
        <HStack gap={3}>
          {isEditMode && (
            <Button size="sm" bg="gray.900" color="white" _hover={{ bg: "black" }} borderRadius="full" px={4} onClick={() => addWidget('live-broadcast')}>
              <Icon as={Plus} boxSize={4} mr={1.5} />
              Add Widget
            </Button>
          )}
          <Button 
            size="sm" 
            variant={isEditMode ? "solid" : "outline"} 
            bg={isEditMode ? "green.500" : "transparent"}
            color={isEditMode ? "white" : "gray.700"}
            borderColor={isEditMode ? "green.500" : "gray.200"}
            _hover={isEditMode ? { bg: "green.600" } : { bg: "gray.50" }}
            borderRadius="full"
            px={4}
            onClick={() => setEditMode(!isEditMode)}
          >
            <Icon as={Settings} boxSize={4} mr={1.5} />
            {isEditMode ? "Save Layout" : "Customize Layout"}
          </Button>
        </HStack>
      </Flex>

      {/* 3. THE INTERACTIVE GRID */}
      <Box flex="1" overflowX="hidden" overflowY="auto" pb={8} mx="-12px" px="12px">
        <ResponsiveGridLayout
          className="layout"
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
                position="relative" 
                h="100%" 
                w="100%"
                transition="outline 0.2s"
                _hover={isEditMode ? { outline: '2px dashed #CBD5E1', outlineOffset: '4px', cursor: 'grab' } : {}}
              >
                {/* Delete Button (Only visible in edit mode) */}
                {isEditMode && (
                  <IconButton
                    aria-label="Remove widget"
                    size="xs"
                    position="absolute"
                    top="-10px"
                    right="-10px"
                    bg="red.500"
                    color="white"
                    borderRadius="full"
                    zIndex={10}
                    onClick={() => removeWidget(widget.id)}
                    _hover={{ bg: "red.600" }}
                  >
                    <Icon as={X} boxSize={3} />
                  </IconButton>
                )}
                
                {/* THE WIDGET CONTENT */}
                <Box h="100%" w="100%" pointerEvents={isEditMode ? 'none' : 'auto'} css={{ '> div': { height: '100%' } }}>
                   <WidgetRegistry type={widget.type} />
                </Box>
              </Box>
            </div>
          ))}
        </ResponsiveGridLayout>
      </Box>

      {/* Grid specific animation and styling adjustments */}
      <style>{`
        @keyframes pulse-fast { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
        .react-grid-item.react-grid-placeholder {
          background: #E2E8F0 !important;
          border-radius: 16px;
          opacity: 0.5;
        }
        .react-resizable-handle {
          opacity: ${isEditMode ? 1 : 0};
          transition: opacity 0.2s;
        }
      `}</style>
    </VStack>
  );
};