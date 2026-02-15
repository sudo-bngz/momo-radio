import React, { useState } from 'react';
import { 
  Box, VStack, HStack, Text, Button, Input, Heading, Icon, Badge, Flex, Grid
} from '@chakra-ui/react';
import { 
  DndContext, closestCenter, PointerSensor, useSensor, useSensors 
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Save, Music, Plus, Search, Clock, ListMusic } from 'lucide-react';

import { usePlaylistBuilder } from '../hook/usePlaylistBuilder';
import { SortableTrack } from './SortableTrack';

// FIX: Define the props interface
interface PlaylistBuilderProps {
  playlistId?: number | null;
}

export const PlaylistBuilder: React.FC<PlaylistBuilderProps> = ({ playlistId }) => {
  const {
    libraryTracks, playlistTracks, playlistName, isSaving,
    setPlaylistName, addTrackToPlaylist, removeTrackFromPlaylist,
    handleDragEnd, savePlaylist
  } = usePlaylistBuilder(/* playlistId */);

  const [searchQuery, setSearchQuery] = useState('');

  // Requires a 5px drag distance to prevent accidental drags on click
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const totalSeconds = playlistTracks.reduce((acc, t) => acc + Math.round(t.Duration || 0), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);
  
  const filteredLibrary = libraryTracks.filter(t => 
    t.Title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.Artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Flex gap={6} h="full" w="full" data-theme="light">
      
      {/* LEFT COLUMN: Library */}
      <VStack w="350px" align="stretch" h="calc(100vh - 120px)" bg="gray.50" borderRadius="xl" borderWidth="1px" borderColor="gray.200" overflow="hidden">
        <Box p={4} borderBottomWidth="1px" borderColor="gray.200" bg="white">
          <Heading size="sm" color="gray.800" mb={3}>Music Library</Heading>
          <HStack bg="gray.50" px={3} py={2} borderRadius="md" borderWidth="1px" borderColor="gray.200">
            <Icon as={Search} boxSize={4} color="gray.400" />
            <Input 
              variant="flushed" placeholder="Search tracks..." size="sm" border="none" 
              _focus={{ boxShadow: 'none' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              color="gray.900" _placeholder={{ color: 'gray.400' }}
            />
          </HStack>
        </Box>
        
        <Box overflowY="auto" flex="1" p={2}>
          {filteredLibrary.map(track => (
            <HStack 
              key={track.ID} p={2} mb={1} borderRadius="md" 
              _hover={{ bg: "white", shadow: "sm", transform: "translateY(-1px)" }} transition="all 0.2s" 
              className="group"
            >
              <Box p={2} bg="gray.100" borderRadius="md" color="gray.500" _groupHover={{ bg: "blue.50", color: "blue.500" }}>
                <Icon as={Music} boxSize={4} />
              </Box>
              <VStack align="start" gap={0} flex="1" overflow="hidden">
                <Text fontSize="sm" fontWeight="bold" color="gray.800" truncate w="full">{track.Title}</Text>
                <Text fontSize="xs" color="gray.500" truncate w="full">{track.Artist}</Text>
              </VStack>
              <Button 
                size="xs" bg="transparent" color="blue.500" _hover={{ bg: "blue.50" }} 
                opacity={0} _groupHover={{ opacity: 1 }} 
                onClick={() => addTrackToPlaylist(track)}
              >
                <Icon as={Plus} boxSize={5} />
              </Button>
            </HStack>
          ))}
          {filteredLibrary.length === 0 && (
            <Text fontSize="sm" color="gray.500" textAlign="center" mt={10}>No tracks found.</Text>
          )}
        </Box>
      </VStack>

      {/* RIGHT COLUMN: Studio Builder */}
      <VStack flex="1" align="stretch" h="calc(100vh - 120px)" bg="white" borderRadius="xl" borderWidth="1px" borderColor="gray.200" shadow="sm" overflow="hidden">
        <Flex p={5} borderBottomWidth="1px" borderColor="gray.200" justify="space-between" align="flex-end" bg="gray.50">
          <VStack align="start" gap={3} maxW="50%">
            <Badge colorPalette="purple" variant="subtle" size="sm" letterSpacing="wider">
              <HStack gap={1}><ListMusic size={12}/> <Text>GENERAL ROTATION</Text></HStack>
            </Badge>
            <Input 
              value={playlistName} onChange={(e) => setPlaylistName(e.target.value)} 
              fontSize="2xl" fontWeight="extrabold" color="gray.900" variant="flushed" placeholder="Name your playlist..."
              _placeholder={{ color: 'gray.300' }} _focus={{ borderColor: "purple.500", boxShadow: "none" }}
            />
          </VStack>
          <HStack gap={6}>
            <VStack align="end" gap={0}>
              <Text fontSize="xs" color="gray.500" fontWeight="bold" textTransform="uppercase">Total Duration</Text>
              <HStack color="gray.700">
                <Icon as={Clock} boxSize={4} />
                <Text fontSize="lg" fontWeight="mono">{totalMinutes} mins</Text>
              </HStack>
            </VStack>
            <Button colorPalette="purple" size="lg" onClick={savePlaylist} loading={isSaving} shadow="md">
              <Save size={18} style={{ marginRight: '8px' }} /> Save Playlist
            </Button>
          </HStack>
        </Flex>

        <Grid templateColumns="40px 1fr 1fr 80px 50px" gap={4} px={6} py={3} bg="white" borderBottomWidth="1px" borderColor="gray.200" fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" letterSpacing="wider">
          <Text textAlign="center">#</Text><Text>Track Title</Text><Text>Artist</Text><Text textAlign="right">Time</Text><Text></Text>
        </Grid>

        <Box flex="1" overflowY="auto" bg="white">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={playlistTracks.map(t => t.ID.toString())} strategy={verticalListSortingStrategy}>
              {playlistTracks.map((track, index) => (
                <SortableTrack key={`${track.ID}-${index}`} track={track} index={index + 1} onRemove={removeTrackFromPlaylist} />
              ))}
            </SortableContext>
          </DndContext>
          
          {playlistTracks.length === 0 && (
            <VStack justify="center" h="full" color="gray.400" bg="gray.50">
              <Icon as={ListMusic} boxSize={12} mb={3} opacity={0.5} />
              <Text fontSize="lg" fontWeight="medium" color="gray.500">This playlist is empty</Text>
              <Text fontSize="sm">Click the + button on tracks to add them.</Text>
            </VStack>
          )}
        </Box>
      </VStack>
    </Flex>
  );
};