import React, { useState } from 'react';
import { 
  Box, VStack, HStack, Text, Button, Input, Icon, Flex, Badge
} from '@chakra-ui/react';
import { 
  DndContext, closestCenter, PointerSensor, useSensor, useSensors 
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Save, Music, Plus, Search, Clock, ListMusic, ChevronLeft, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { usePlaylistBuilder } from '../hook/usePlaylistBuilder';
import { SortableTrack } from './SortableTrack';

export const PlaylistBuilder: React.FC = () => {
  const navigate = useNavigate();
  const {
    libraryTracks, playlistTracks, playlistName, playlistDescription, isSaving,
    setPlaylistName, addTrackToPlaylist, setPlaylistDescription, removeTrackFromPlaylist,
    handleDragEnd, savePlaylist, playlistId
  } = usePlaylistBuilder();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const totalSeconds = (playlistTracks || []).reduce((acc, t) => acc + Math.round(t?.duration || 0), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);
  
  const filteredLibrary = (libraryTracks || []).filter(t => {
    const title = (t?.title || "").toLowerCase();
    const artist = (t?.artist || "").toLowerCase();
    const search = (searchQuery || "").toLowerCase();
    return title.includes(search) || artist.includes(search);
  });

  const handleSaveClick = async () => {
    const success = await savePlaylist();
    if (success) setShowSuccessModal(true);
  };

  return (
    <>
      {/* --- SUCCESS MODAL OVERLAY --- */}
      {showSuccessModal && (
        <Flex 
          position="fixed" top="0" left="0" w="100vw" h="100vh" 
          bg="blackAlpha.600" zIndex={9999} align="center" justify="center" backdropFilter="blur(4px)"
        >
          <VStack bg="white" p={8} borderRadius="2xl" shadow="2xl" gap={4} maxW="sm" textAlign="center">
            <Icon as={CheckCircle} boxSize={16} color="green.500" />
            <VStack gap={1}>
              <Text fontSize="xl" fontWeight="bold" color="gray.900">Playlist Saved</Text>
              <Text color="gray.500" fontSize="sm">
                "{playlistName}" has been updated in your library.
              </Text>
            </VStack>
            <Button 
              w="full" mt={4} size="lg" bg="gray.900" color="white" _hover={{ bg: "black" }} borderRadius="full"
              onClick={() => navigate('/playlists')} 
            >
              Back to Playlists
            </Button>
          </VStack>
        </Flex>
      )}

      <Flex direction="column" h="full" w="full" gap={6} data-theme="light" bg="transparent">
        
        {/* 1. MINIMALIST HEADER */}
        <Flex justify="space-between" align="end" px={1}>
          <HStack gap={4}>
            <Button 
              variant="ghost" size="sm" color="gray.500" _hover={{ bg: "gray.100", color: "gray.900" }} 
              onClick={() => navigate('/playlists')} borderRadius="full" px={2}
            >
              <ChevronLeft size={20} />
            </Button>
            <VStack align="start" gap={0}>
              <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                {playlistId ? 'Edit Rotation' : 'New Rotation'}
              </Text>
              <Input 
                value={playlistName} onChange={(e) => setPlaylistName(e.target.value)} 
                fontSize="2xl" fontWeight="extrabold" color="gray.900" variant="flushed" 
                placeholder="Name your playlist..." border="none" px={0} h="auto" py={1}
                _focus={{ boxShadow: "none" }} _placeholder={{ color: 'gray.300' }}
              />
              <Input 
                value={playlistDescription} 
                onChange={(e) => setPlaylistDescription(e.target.value)} 
                fontSize="sm" color="gray.500" variant="flushed" 
                placeholder="Add a short description..." border="none" px={0} h="auto" py={0}
                _focus={{ boxShadow: "none" }} _placeholder={{ color: 'gray.300' }}
              />
            </VStack>
          </HStack>

          <HStack gap={4}>
            <Badge variant="subtle" colorPalette="gray" borderRadius="full" px={3} py={1.5} fontSize="xs" fontWeight="bold">
              <HStack gap={1}><Clock size={12}/> <Text>{totalMinutes} mins</Text></HStack>
            </Badge>
            <Button 
              bg="gray.900" color="white" _hover={{ bg: "black", transform: "translateY(-1px)" }} 
              transition="all 0.2s" size="sm" px={5} borderRadius="full" onClick={handleSaveClick} loading={isSaving}
            >
              <Save size={16} style={{ marginRight: '6px' }} /> Save
            </Button>
          </HStack>
        </Flex>

        {/* 2. STUDIO LAYOUT (No heavy borders, floating panels) */}
        <Flex gap={6} flex="1" minH="0" w="full">
          
          {/* LEFT COLUMN: Library */}
          <VStack w="320px" align="stretch" h="full" bg="white" borderRadius="2xl" shadow="sm" border="1px solid" borderColor="gray.100" overflow="hidden">
            <Box p={4} borderBottom="1px solid" borderColor="gray.50">
              <HStack bg="gray.50" px={3} py={2} borderRadius="xl" border="1px solid" borderColor="gray.100">
                <Icon as={Search} boxSize={4} color="gray.400" />
                <Input variant="flushed" placeholder="Search library..." size="sm" border="none" _focus={{ boxShadow: 'none' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
              </HStack>
            </Box>
            
            <Box overflowY="auto" flex="1" p={2}>
              {(filteredLibrary || []).map((track) => {
                const trackId = track?.id ?? Math.random();
                const trackTitle = track?.title ?? "Unknown";
                const trackArtist = track?.artist ?? "Unknown";

                return (
                  <HStack key={trackId} p={2} mb={1} borderRadius="xl" _hover={{ bg: "gray.50" }} transition="all 0.2s" className="group">
                    <Flex align="center" justify="center" w={8} h={8} borderRadius="md" bg="gray.100" color="gray.500" _groupHover={{ bg: "blue.50", color: "blue.500" }}>
                      <Music size={14} />
                    </Flex>
                    <VStack align="start" gap={0} flex="1" overflow="hidden">
                      <Text fontSize="sm" fontWeight="bold" color="gray.800" truncate w="full">{trackTitle}</Text>
                      <Text fontSize="xs" color="gray.500" truncate w="full">{trackArtist}</Text>
                    </VStack>
                    <Button size="sm" bg="transparent" border="none" color="gray.400" _hover={{ color: "gray.900" }} opacity={0} _groupHover={{ opacity: 1 }} onClick={() => addTrackToPlaylist(track)}>
                      <Plus size={18} />
                    </Button>
                  </HStack>
                );
              })}
              
              {filteredLibrary.length === 0 && (
                <VStack py={10} color="gray.300">
                  <Music size={24} />
                  <Text fontSize="sm">No tracks found</Text>
                </VStack>
              )}
            </Box>
          </VStack>

          {/* RIGHT COLUMN: Builder */}
          <VStack flex="1" align="stretch" h="full" bg="white" borderRadius="2xl" shadow="sm" border="1px solid" borderColor="gray.100" overflow="hidden">
            <Box flex="1" overflowY="auto" p={4}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={(playlistTracks || []).map(t => (t?.id || '').toString())} strategy={verticalListSortingStrategy}>
                  {(playlistTracks || []).map((track, index) => (
                    // Make sure your SortableTrack component doesn't have a hard black border either!
                    <SortableTrack key={`${track.id}-${index}`} track={track} index={index + 1} onRemove={removeTrackFromPlaylist} />
                  ))}
                </SortableContext>
              </DndContext>
              
              {(playlistTracks || []).length === 0 && (
                <VStack justify="center" h="full" color="gray.400" border="1px dashed" borderColor="gray.200" borderRadius="xl" m={2}>
                  <Icon as={ListMusic} boxSize={10} mb={2} opacity={0.3} />
                  <Text fontSize="md" fontWeight="medium">Playlist is empty</Text>
                  <Text fontSize="xs">Search the library and click + to add tracks</Text>
                </VStack>
              )}
            </Box>
          </VStack>

        </Flex>
      </Flex>
    </>
  );
};