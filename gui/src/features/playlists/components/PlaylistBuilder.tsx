import React, { useState } from 'react';
import { 
  Box, VStack, HStack, Text, Button, Input, Icon, Flex, Badge, Heading
} from '@chakra-ui/react';
import { 
  DndContext, closestCenter, PointerSensor, useSensor, useSensors 
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Save, Music, Plus, Search, Clock, ListMusic, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { usePlaylistBuilder } from '../hook/usePlaylistBuilder';
import { SortableTrack } from './SortableTrack';

// ⚡️ FIXED: Helper to safely extract the artist name from the new Relation object
const getArtistName = (artistData: any): string => {
  if (!artistData) return "Unknown Artist";
  if (typeof artistData === 'string') return artistData;
  if (typeof artistData === 'object' && 'name' in artistData) return artistData.name || "Unknown Artist";
  return "Unknown Artist";
};

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
  
  // ⚡️ FIXED: Search filter now safely checks the extracted string name
  const filteredLibrary = (libraryTracks || []).filter(t => {
    const title = (t?.title || "").toLowerCase();
    const artistName = getArtistName(t?.artist).toLowerCase();
    const search = (searchQuery || "").toLowerCase();
    return title.includes(search) || artistName.includes(search);
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
          <VStack bg="white" p={8} borderRadius="3xl" shadow="2xl" gap={5} maxW="sm" textAlign="center" animation="fade-in 0.2s ease-out">
            <Icon as={CheckCircle} boxSize={16} color="green.500" />
            <VStack gap={2}>
              <Heading size="md" color="gray.900">Playlist Saved</Heading>
              <Text color="gray.500" fontSize="sm">
                "{playlistName}" has been successfully updated in your vault.
              </Text>
            </VStack>
            <Button 
              w="full" mt={4} h="48px" bg="gray.900" color="white" _hover={{ bg: "black" }} borderRadius="full"
              onClick={() => navigate('/playlists')} 
            >
              Back to Playlists
            </Button>
          </VStack>
        </Flex>
      )}

      {/* --- MAIN UI CONTAINER (Matches Library & Playlists spacing) --- */}
      <Box w="full" h="100vh" display="flex" flexDirection="column" bg="white" pt={0} pb={10} animation="fade-in 0.4s ease-out">
        
        {/* =========================================
            1. STANDARDIZED HEADER & BREADCRUMB
            ========================================= */}
        <VStack align="start" gap={1} mb={8} flexShrink={0}>
          <HStack gap={2} fontSize="sm" color="gray.500" mb={3}>
            <Box w="24px" h="24px" bg="blue.500" color="white" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
              <Icon as={ListMusic} boxSize={3} strokeWidth={3} />
            </Box>
            <Text cursor="pointer" _hover={{ color: "blue.500" }} onClick={() => navigate('/playlists')}>
              Playlists
            </Text>
            <Text color="gray.300">/</Text>
            <Text color="gray.900" fontWeight="500">
              {playlistId ? 'Edit Playlist' : 'New Playlist'}
            </Text>
          </HStack>

          <HStack w="full" justify="space-between" align="flex-start" gap={6}>
            {/* The Invisible Inputs (Styled like Library Headings) */}
            <VStack align="start" flex="1" gap={0}>
              <Input 
                value={playlistName} onChange={(e) => setPlaylistName(e.target.value)} 
                fontSize="4xl" fontWeight="normal" color="gray.900" letterSpacing="tight"
                placeholder="Name your playlist..." border="none" bg="transparent" px={0} h="auto" py={0}
                _focus={{ boxShadow: "none", outline: "none" }} _placeholder={{ color: 'gray.300' }}
              />
              <Input 
                value={playlistDescription} 
                onChange={(e) => setPlaylistDescription(e.target.value)} 
                fontSize="sm" color="gray.500" border="none" bg="transparent" mt={1}
                placeholder="Add a short description..." px={0} h="auto" py={0}
                _focus={{ boxShadow: "none", outline: "none" }} _placeholder={{ color: 'gray.300' }}
              />
            </VStack>

            {/* Standardized Actions */}
            <HStack gap={4}>
              <Badge variant="subtle" colorPalette="gray" borderRadius="full" px={4} py={2} fontSize="sm" fontWeight="bold">
                <HStack gap={1.5}><Clock size={14}/> <Text>{totalMinutes} mins</Text></HStack>
              </Badge>
              <Button 
                bg="gray.900" color="white" _hover={{ bg: "black", transform: "scale(1.05)" }} 
                transition="all 0.2s" h="48px" px={6} borderRadius="full" onClick={handleSaveClick} loading={isSaving}
              >
                <Save size={18} style={{ marginRight: '8px' }} /> Save Playlist
              </Button>
            </HStack>
          </HStack>
        </VStack>

        {/* =========================================
            2. STUDIO LAYOUT (Library vs Builder)
            ========================================= */}
        <Flex gap={6} flex="1" minH="0" w="full">
          
          {/* LEFT COLUMN: Library */}
          <VStack w={{ base: "full", md: "350px", xl: "400px" }} align="stretch" h="full" bg="white" borderRadius="2xl" shadow="sm" border="1px solid" borderColor="gray.100" overflow="hidden">
            <Box p={4} borderBottom="1px solid" borderColor="gray.50">
              <HStack bg="gray.50" px={4} py={2} borderRadius="xl" border="1px solid" borderColor="gray.100">
                <Icon as={Search} boxSize={4} color="gray.400" />
                <Input border="none" bg="transparent" placeholder="Search library..." size="sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} _focus={{ boxShadow: "none", outline: "none" }} />
              </HStack>
            </Box>
            
            <Box overflowY="auto" flex="1" p={3} className="custom-scrollbar">
              {filteredLibrary.map((track) => {
                const trackId = track?.id ?? Math.random();
                const trackTitle = track?.title ?? "Unknown Track";
                const trackArtist = getArtistName(track?.artist); // ⚡️ FIXED CRASH

                return (
                  <HStack key={trackId} p={2.5} mb={1} borderRadius="xl" _hover={{ bg: "gray.50" }} transition="all 0.2s" className="group">
                    <Flex align="center" justify="center" w={10} h={10} borderRadius="lg" bg="gray.100" color="gray.400" _groupHover={{ bg: "blue.50", color: "blue.500" }}>
                      <Music size={16} />
                    </Flex>
                    <VStack align="start" gap={0} flex="1" overflow="hidden">
                      <Text fontSize="sm" fontWeight="bold" color="gray.900" truncate w="full">{trackTitle}</Text>
                      <Text fontSize="xs" color="gray.500" truncate w="full">{trackArtist}</Text>
                    </VStack>
                    <Button size="sm" bg="white" border="1px solid" borderColor="gray.200" borderRadius="full" w={8} h={8} p={0} color="gray.600" _hover={{ bg: "gray.900", color: "white", borderColor: "gray.900" }} opacity={0} _groupHover={{ opacity: 1 }} onClick={() => addTrackToPlaylist(track)}>
                      <Plus size={16} />
                    </Button>
                  </HStack>
                );
              })}
              
              {filteredLibrary.length === 0 && (
                <VStack py={16} color="gray.400" gap={3}>
                  <Box p={4} bg="gray.50" borderRadius="full"><Music size={24} /></Box>
                  <Text fontSize="sm" fontWeight="500">No tracks found</Text>
                </VStack>
              )}
            </Box>
          </VStack>

          {/* RIGHT COLUMN: Drag & Drop Builder */}
          <VStack flex="1" align="stretch" h="full" bg="gray.50" borderRadius="2xl" border="1px solid" borderColor="gray.100" overflow="hidden">
            <Box flex="1" overflowY="auto" p={6} className="custom-scrollbar">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                {/* ⚡️ FIXED: Strict String conversion to match the SortableTrack ID */}
                <SortableContext items={(playlistTracks || []).map(t => String(t.id))} strategy={verticalListSortingStrategy}>
                  {(playlistTracks || []).map((track, index) => (
                    <SortableTrack key={String(track.id)} track={track} index={index + 1} onRemove={removeTrackFromPlaylist} />
                  ))}
                </SortableContext>
              </DndContext>
              
              {(playlistTracks || []).length === 0 && (
                <VStack justify="center" h="full" color="gray.400" border="2px dashed" borderColor="gray.200" borderRadius="2xl" m={2}>
                  <Box p={4} bg="white" borderRadius="full" mb={2} shadow="sm"><Icon as={ListMusic} boxSize={8} color="gray.300" /></Box>
                  <Heading size="sm" color="gray.600">Playlist is empty</Heading>
                  <Text fontSize="sm">Search the library and click + to add tracks</Text>
                </VStack>
              )}
            </Box>
          </VStack>

        </Flex>
      </Box>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
      `}</style>
    </>
  );
};