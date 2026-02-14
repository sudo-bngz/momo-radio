// src/features/schedule/components/CalendarSidebar.tsx
import React, { useEffect, useRef } from 'react';
import { Box, VStack, Text, Heading, HStack, Badge } from '@chakra-ui/react';
import { Draggable } from '@fullcalendar/interaction';
import { ListMusic } from 'lucide-react';
import type { Playlist } from '../../../types';

export const CalendarSidebar = ({ playlists }: { playlists: Playlist[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Guard clause if the ref isn't ready
    if (!containerRef.current) return;

    // 2. Save the instance to a variable
    const draggable = new Draggable(containerRef.current, {
      itemSelector: '.fc-event',
      eventData: function(eventEl) {
        return {
          title: eventEl.getAttribute('data-title'),
          backgroundColor: eventEl.getAttribute('data-color'),
          extendedProps: {
            playlistId: eventEl.getAttribute('data-id')
          }
        };
      }
    });

    // 3. FIX: Cleanup function! 
    // This tells React to destroy the old drag listener before making a new one.
    return () => {
      draggable.destroy();
    };
  }, [playlists]);

  return (
    <VStack align="stretch" w="300px" bg="white" p={5} borderRadius="xl" borderWidth="1px" borderColor="gray.200">
      <Heading size="md" color="gray.800" mb={4}>Playlists</Heading>

      <Box ref={containerRef} overflowY="auto" flex="1">
        {playlists.map((pl) => (
          <Box 
            key={pl.ID}
            className="fc-event" 
            data-id={pl.ID}
            data-title={pl.name}
            data-color={pl.color || '#3182ce'}
            p={3}
            mb={3}
            bg="gray.50"
            borderLeftWidth="4px"
            borderColor={pl.color || '#3182ce'}
            borderRadius="md"
            cursor="grab"
            _hover={{ bg: "gray.100", transform: "scale(1.02)" }}
            transition="all 0.2s"
          >
            <HStack gap={3}>
              <ListMusic size={18} color="gray" />
              <VStack align="start" gap={0}>
                <Text fontWeight="bold" fontSize="sm" color="gray.800">{pl.name}</Text>
                <Text fontSize="xs" color="gray.500">
                  {Math.floor((pl.total_duration || 0) / 60)} mins
                </Text>
              </VStack>
            </HStack>
          </Box>
        ))}
        {playlists.length === 0 && (
          <Badge colorPalette="orange" p={2}>No playlists found.</Badge>
        )}
      </Box>
    </VStack>
  );
};