// src/features/playlists/components/PlaylistBuilder.tsx
import React from 'react';
import { 
  Box, VStack, HStack, Text, Button, SimpleGrid, Input, Heading, Icon, Badge
} from '@chakra-ui/react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Save, Music, Plus } from 'lucide-react';

import { usePlaylistBuilder } from '../hook/usePlaylistBuilder';
import { SortableTrack } from './SortableTrack';

export const PlaylistBuilder: React.FC = () => {
  const {
    libraryTracks,
    playlistTracks,
    playlistName,
    isSaving,
    setPlaylistName,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    handleDragEnd,
    savePlaylist
  } = usePlaylistBuilder();

  // Calculate total duration roughly
  const totalSeconds = playlistTracks.reduce((acc, t) => acc + (t.Duration || 0), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);

  return (
    <SimpleGrid columns={2} gap={8} h="full" data-theme="light">
      
      {/* LEFT COLUMN: Library */}
      <VStack align="stretch" h="75vh" p={5} bg="white" borderRadius="xl" borderWidth="1px" borderColor="gray.200">
        <Heading size="md" color="gray.800" mb={2}>Library</Heading>
        <Box overflowY="auto" flex="1" pr={2}>
          {libraryTracks.map(track => (
            <HStack 
              key={track.ID} 
              p={3} 
              mb={2} 
              bg="gray.50" 
              borderRadius="md" 
              borderWidth="1px"
              justify="space-between"
              _hover={{ bg: "gray.100" }}
            >
              <VStack align="start" gap={0}>
                <Text fontSize="sm" fontWeight="bold" color="gray.800">{track.Title}</Text>
                <Text fontSize="xs" color="gray.500">{track.Artist}</Text>
              </VStack>
              <Button size="xs" colorPalette="blue" variant="ghost" onClick={() => addTrackToPlaylist(track)}>
                <Plus size={16} />
              </Button>
            </HStack>
          ))}
          {libraryTracks.length === 0 && <Text fontSize="sm" color="gray.500">No tracks found. Upload some first!</Text>}
        </Box>
      </VStack>

      {/* RIGHT COLUMN: Sortable Playlist */}
      <VStack align="stretch" h="75vh" p={5} bg="gray.50" borderRadius="xl" borderWidth="1px" borderColor="gray.200">
        
        {/* Playlist Header */}
        <VStack align="stretch" mb={4} gap={3}>
          <HStack justify="space-between">
            <Badge colorPalette="purple" variant="solid">NEW PLAYLIST</Badge>
            <Text fontSize="sm" fontWeight="mono" color="gray.500">
              {playlistTracks.length} tracks • ~{totalMinutes} min
            </Text>
          </HStack>
          <HStack>
            <Input 
              value={playlistName} 
              onChange={(e) => setPlaylistName(e.target.value)} 
              bg="white" 
              fontWeight="bold"
              color="gray.800"
            />
            <Button colorPalette="blue" onClick={savePlaylist} loading={isSaving}>
              <HStack gap={2}>
                <Save size={16} />
                <Text>Save</Text>
              </HStack>
            </Button>
          </HStack>
        </VStack>

        {/* DND Kit Context */}
        <Box flex="1" overflowY="auto" p={1}>
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={playlistTracks.map(t => t.ID)} strategy={verticalListSortingStrategy}>
              {playlistTracks.map((track) => (
                <SortableTrack key={track.ID} track={track} onRemove={removeTrackFromPlaylist} />
              ))}
            </SortableContext>
          </DndContext>
          
          {playlistTracks.length === 0 && (
            <VStack justify="center" h="full" color="gray.400">
              <Icon as={Music} boxSize={10} mb={2} />
              <Text>Drag or add tracks here</Text>
            </VStack>
          )}
        </Box>
      </VStack>
    </SimpleGrid>
  );
};
