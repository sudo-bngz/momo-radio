// src/features/playlists/components/SortableTrack.tsx
import React from 'react';
import { Box, HStack, VStack, Text, Button, Icon, Card } from '@chakra-ui/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import type { Track } from '../hook/usePlaylistBuilder';

interface SortableTrackProps {
  track: Track;
  onRemove: (id: number) => void;
}

export const SortableTrack: React.FC<SortableTrackProps> = ({ track, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.ID });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  // FIX 1: Round the total seconds before doing the math
  const totalSeconds = Math.round(track.Duration || 0);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const timeString = `${m}:${s.toString().padStart(2, '0')}`;

  return (
    <Card.Root ref={setNodeRef} style={style} mb={2} variant="outline" bg="white" borderColor="gray.200">
      <Card.Body p={3}>
        <HStack gap={4}>
          {/* Drag Handle */}
          <Box {...attributes} {...listeners} cursor="grab" _active={{ cursor: "grabbing" }}>
            <Icon as={GripVertical} color="gray.400" />
          </Box>
          
          {/* Track Info */}
          <VStack align="start" flex="1" gap={0}>
            <Text fontWeight="bold" fontSize="sm" color="gray.800">{track.Title}</Text>
            <Text fontSize="xs" color="gray.500">{track.Artist}</Text>
          </VStack>

          {/* Clean Rounded Duration */}
          <Text fontSize="xs" fontWeight="mono" color="blue.500">
            {timeString}
          </Text>

          {/* FIX 2: Explicitly style the button to prevent black dark-mode bleed */}
          <Button 
            size="xs" 
            bg="red.50" 
            color="red.500" 
            _hover={{ bg: "red.100" }}
            onClick={() => onRemove(track.ID)}
          >
            <Trash2 size={14} />
          </Button>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
};