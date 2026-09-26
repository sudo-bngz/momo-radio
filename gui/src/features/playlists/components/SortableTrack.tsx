import React from 'react';
import { Box, Text, Button, Icon, Grid, Flex, Image, VStack, HStack } from '@chakra-ui/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Music } from 'lucide-react';
import type { Track } from '../../../types';
// Import the shared robust extractors from the parent
import { getTrackData, getKeyInfo } from './PlaylistBuilder';

// ⚡️ FIXED: Matches the exact logic from PlaylistBuilder to output valid Chakra tokens and Dark Mode alpha scales
const getBpmGrayscale = (bpm: number) => {
  if (!bpm) return { light: "gray.400", dark: "whiteAlpha.400" };
  const weight = Math.min(Math.max(Math.round((((bpm - 70) / 90) * 400) / 100) * 100 + 400, 400), 800);
  
  const darkAlphaMap: Record<number, string> = {
    400: "whiteAlpha.500",
    500: "whiteAlpha.600",
    600: "whiteAlpha.700",
    700: "whiteAlpha.800",
    800: "whiteAlpha.900"
  };
  
  return { 
    light: `gray.${weight}`, 
    dark: darkAlphaMap[weight] || "whiteAlpha.700" 
  };
};

interface SortableTrackProps {
  track: Track | any;
  index: number;
  onRemove: (id: number) => void;
}

export const SortableTrack: React.FC<SortableTrackProps> = ({ track, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(track.id) });
  
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 1,
    position: isDragging ? ("relative" as const) : ("static" as const),
  };

  const data = getTrackData(track);
  const harmonic = getKeyInfo(track.scale, track.musical_key || track.musicalkey);
  
  const safeDuration = track.duration || 0;
  const timeString = `${Math.floor(safeDuration / 60)}:${Math.floor(safeDuration % 60).toString().padStart(2, '0')}`;

  const bpmColors = getBpmGrayscale(data.bpm);

  return (
    <div ref={setNodeRef} style={style}>
      <Box 
        // ⚡️ Distinct background during drag so it doesn't become transparent over other rows
        bg={isDragging ? "gray.50" : "bg"} 
        _dark={{ bg: isDragging ? "whiteAlpha.200" : "bg.panel" }}
        borderBottom="1px solid" borderColor="border" 
        px={4} py={3} className="group" 
        borderRadius={isDragging ? "xl" : "none"} 
        boxShadow={isDragging ? "2xl" : "none"}
      >
        <Grid templateColumns="40px 48px 1fr 100px 100px 60px 40px" gap={4} alignItems="center">
          
          <Box {...attributes} {...listeners} cursor="grab">
            <Icon as={GripVertical} color="gray.300" _dark={{ color: "whiteAlpha.400" }} _groupHover={{ color: "fg.muted" }} />
          </Box>

          {data.hasCover ? (
            <Image src={data.cover} w="40px" h="40px" borderRadius="md" objectFit="cover" />
          ) : (
            <Flex w="40px" h="40px" bg="gray.100" _dark={{ bg: "whiteAlpha.200" }} align="center" justify="center" borderRadius="md">
              <Music size={16} color="var(--chakra-colors-fg-muted)" />
            </Flex>
          )}
          
          <VStack align="start" gap={0} overflow="hidden">
            <Text fontWeight="bold" fontSize="sm" truncate w="full" color="fg">{data.title}</Text>
            <HStack gap={2} w="full" overflow="hidden" mt={0.5}>
              <Text fontSize="xs" color="fg.muted" truncate>{data.artist}</Text>
              
              {data.style && (
                <Box 
                  px={1.5} py={0.5} borderRadius="sm" 
                  bg="gray.100" color="gray.600" 
                  _dark={{ bg: "whiteAlpha.200", color: "whiteAlpha.800" }}
                  fontSize="9px" fontWeight="600" textTransform="capitalize" whiteSpace="nowrap" flexShrink={0}
                >
                  {data.style}
                </Box>
              )}
            </HStack>
          </VStack>

          <Text fontSize="xs" fontWeight="medium" color={bpmColors.light} _dark={{ color: bpmColors.dark }} textAlign="center">
            {data.bpm || '--'} BPM
          </Text>

          <Flex alignItems="center" justifyContent="center">
            <Box px={2} py={0.5} borderRadius="sm" bg={harmonic.color} color="white" fontSize="10px" fontWeight="700" textAlign="center" textTransform="none">
              {harmonic.label}
            </Box>
          </Flex>
          
          <Text fontSize="sm" fontWeight="mono" color="fg.muted" textAlign="right">{timeString}</Text>

          <Button 
            size="xs" variant="ghost" color="fg.muted" 
            _hover={{ color: "red.600", bg: "red.50", _dark: { color: "red.300", bg: "red.900" } }} 
            onClick={() => onRemove(track.id)} opacity={0} _groupHover={{ opacity: 1 }}
          >
            <Trash2 size={14} />
          </Button>
        </Grid>
      </Box>
    </div>
  );
};