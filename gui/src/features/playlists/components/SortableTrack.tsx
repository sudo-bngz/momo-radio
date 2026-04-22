import React from 'react';
import { Box, Text, Button, Icon, Grid } from '@chakra-ui/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import type { Track } from '../../../types';

const getArtistName = (artistData: any): string => {
  if (!artistData) return "Unknown Artist";
  if (typeof artistData === 'string') return artistData;
  if (typeof artistData === 'object' && 'name' in artistData) return artistData.name || "Unknown Artist";
  return "Unknown Artist";
};

interface SortableTrackProps {
  track: Track;
  index: number;
  onRemove: (id: number) => void;
}

export const SortableTrack: React.FC<SortableTrackProps> = ({ track, index, onRemove }) => {
  // ⚡️ 1. Force strict string ID to prevent mismatch crashes
  const safeId = String(track.id);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: safeId 
  });

  // ⚡️ 2. Clean physics styles
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 1,
    position: isDragging ? ("relative" as const) : ("static" as const),
  };

  const totalSeconds = Math.round(track.duration || 0);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const timeString = `${m}:${s.toString().padStart(2, '0')}`;
  const artistName = getArtistName(track.artist);

  return (
    // ⚡️ 3. THE FIX: A native div isolates dnd-kit's physics from Chakra's CSS engine
    <div ref={setNodeRef} style={style}>
      <Box 
        bg="white" borderBottomWidth="1px" borderColor="gray.100"
        _hover={{ bg: "gray.50" }} transition="all 0.2s"
        className="group"
        borderRadius={isDragging ? "xl" : "none"}
        boxShadow={isDragging ? "0 20px 25px -5px rgba(0, 0, 0, 0.1)" : "none"}
        opacity={isDragging ? 0.9 : 1}
      >
        <Grid templateColumns="40px 1fr 1fr 80px 50px" gap={4} px={6} py={3} alignItems="center">
          
          {/* DRAG HANDLE */}
          <Box 
            {...attributes} {...listeners} 
            style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
            display="flex" justifyContent="center" alignItems="center"
            position="relative" w="24px" h="24px"
          >
            <Text fontSize="sm" color="gray.400" fontWeight="medium" position="absolute" opacity={1} _groupHover={{ opacity: 0 }} transition="opacity 0.2s">
              {index}
            </Text>
            <Icon as={GripVertical} color="gray.500" position="absolute" opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.2s" />
          </Box>
          
          <Text fontWeight="bold" fontSize="sm" color="gray.900" truncate>{track.title}</Text>
          <Text fontSize="sm" color="gray.500" truncate>{artistName}</Text>
          <Text fontSize="sm" fontWeight="mono" color="gray.500" textAlign="right">{timeString}</Text>

          <Box display="flex" justifyContent="flex-end" opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.2s">
            <Button 
              size="xs" bg="white" border="1px solid" borderColor="gray.200" borderRadius="full" w={8} h={8} p={0}
              color="red.500" _hover={{ bg: "red.500", color: "white", borderColor: "red.500" }} 
              onPointerDown={(e) => e.stopPropagation()} 
              onClick={() => onRemove(track.id)}
            >
              <Trash2 size={14} />
            </Button>
          </Box>

        </Grid>
      </Box>
    </div>
  );
};