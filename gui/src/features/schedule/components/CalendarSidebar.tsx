import { useEffect, useRef } from 'react';
import { Box, VStack, Text, Heading, HStack, Flex, Icon } from '@chakra-ui/react';
import { Draggable } from '@fullcalendar/interaction';
import { ListMusic, Clock, GripVertical, Music } from 'lucide-react';
import type { Playlist } from '../../../types';

export const CalendarSidebar = ({ playlists }: { playlists: Playlist[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

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

    return () => {
      draggable.destroy();
    };
  }, [playlists]);

  return (
    <Flex direction="column" h="full" bg="transparent">
      
      {/* 1. Clean Header Area */}
      <Box p={5} borderBottom="1px solid" borderColor="gray.100" bg="white">
        <Heading size="md" fontWeight="bold" color="gray.900" letterSpacing="tight">
          Library
        </Heading>
        <Text fontSize="xs" color="gray.500" mt={1} fontWeight="medium">
          Drag playlists to schedule
        </Text>
      </Box>

      {/* 2. Scrollable Playlist List */}
      <Box ref={containerRef} p={4} overflowY="auto" flex="1" bg="gray.50">
        
        {playlists.map((pl) => {
          const color = pl.color || '#3182ce'; // Fallback to blue
          const durationMins = Math.floor((pl.total_duration || 0) / 60);
          // Safely grab the ID whether the backend sends lowercase 'id' or uppercase 'ID'
          const safeId = pl.id ?? pl.id; 

          return (
            /* 3. Sleek Draggable Block */
            <Flex 
              key={safeId}
              className="fc-event group" // 'group' enables hover effects on children
              data-id={safeId}
              data-title={pl.name}
              data-color={color}
              align="center"
              p={3}
              mb={3}
              bg="white"
              borderRadius="xl"
              borderWidth="1px"
              borderColor="gray.100"
              shadow="sm"
              cursor="grab"
              transition="all 0.2s"
              _hover={{ 
                shadow: "md", 
                borderColor: "gray.200", 
                transform: "translateY(-2px)" // physically lifts up on hover
              }}
              _active={{ cursor: "grabbing" }}
            >
              <HStack gap={3} flex="1" overflow="hidden">
                
                {/* Colored Icon Square */}
                <Flex 
                  align="center" justify="center" w={10} h={10} borderRadius="lg" flexShrink={0}
                  bg={`${color}15`} // Adds 15% opacity to the hex color
                  color={color}
                >
                  <ListMusic size={18} />
                </Flex>
                
                {/* Title and Duration Text */}
                <VStack align="start" gap={0} flex="1" overflow="hidden">
                  <Text fontWeight="bold" fontSize="sm" color="gray.800" truncate>
                    {pl.name}
                  </Text>
                  <HStack color="gray.400" gap={1} mt="2px">
                    <Clock size={12} />
                    <Text fontSize="xs" fontWeight="medium">{durationMins} mins</Text>
                  </HStack>
                </VStack>

                {/* Drag Handle Indicator */}
                <Icon 
                  as={GripVertical} 
                  boxSize={4} 
                  color="gray.200" 
                  transition="color 0.2s"
                  _groupHover={{ color: "gray.400" }} // Darkens slightly when the card is hovered
                  flexShrink={0}
                />
              </HStack>
            </Flex>
          );
        })}

        {/* 4. Elegant Empty State */}
        {playlists.length === 0 && (
          <VStack justify="center" py={10} color="gray.400" bg="white" borderRadius="xl" border="1px dashed" borderColor="gray.200">
            <Icon as={Music} boxSize={8} mb={2} opacity={0.3} />
            <Text fontSize="sm" fontWeight="medium">Library is empty</Text>
          </VStack>
        )}

      </Box>
    </Flex>
  );
};