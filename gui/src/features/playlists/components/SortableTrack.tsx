import React from 'react';
import { Box, Text, Button, Icon, Grid } from '@chakra-ui/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import type { Track } from '../../../types';

interface SortableTrackProps {
  track: Track;
  index: number;
  onRemove: (id: number) => void;
}

export const SortableTrack: React.FC<SortableTrackProps> = ({ track, index, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: track.id.toString() 
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    boxShadow: isDragging ? "0 10px 15px -3px rgba(0, 0, 0, 0.1)" : "none",
    position: isDragging ? "relative" : "static",
  } as React.CSSProperties; 

  const totalSeconds = Math.round(track.duration || 0);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const timeString = `${m}:${s.toString().padStart(2, '0')}`;

  return (
    <Box 
      ref={setNodeRef} style={style} 
      bg="white" borderBottomWidth="1px" borderColor="gray.100"
      _hover={{ bg: "gray.50" }} transition="background 0.2s"
      className="group"
    >
      <Grid templateColumns="40px 1fr 1fr 80px 50px" gap={4} px={6} py={3} alignItems="center">
        
        {/* DRAG HANDLE */}
        <Box 
          {...attributes} {...listeners} 
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          display="flex" justifyContent="center" alignItems="center"
          touchAction="none" position="relative" w="24px" h="24px"
        >
          <Text fontSize="sm" color="gray.400" fontWeight="medium" position="absolute" opacity={1} _groupHover={{ opacity: 0 }} transition="opacity 0.2s">
            {index}
          </Text>
          <Icon as={GripVertical} color="gray.500" position="absolute" opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.2s" />
        </Box>
        
        <Text fontWeight="bold" fontSize="sm" color="gray.800" truncate>{track.title}</Text>
        <Text fontSize="sm" color="gray.600" truncate>{track.artist}</Text>
        <Text fontSize="sm" fontWeight="mono" color="gray.500" textAlign="right">{timeString}</Text>

        <Box display="flex" justifyContent="flex-end" opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.2s">
          <Button 
            size="xs" bg="transparent" color="red.500" _hover={{ bg: "red.50" }} 
            onPointerDown={(e) => e.stopPropagation()} 
            onClick={() => onRemove(track.id)}
          >
            <Trash2 size={16} />
          </Button>
        </Box>

      </Grid>
    </Box>
  );
};