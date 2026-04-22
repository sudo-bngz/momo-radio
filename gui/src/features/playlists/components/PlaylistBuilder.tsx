import React, { useState } from 'react';
import { 
  Box, VStack, HStack, Text, Button, Input, Icon, Flex, Badge, Heading, Image
} from '@chakra-ui/react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Save, Music, Plus, Search, Clock, ListMusic, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePlaylistBuilder } from '../hook/usePlaylistBuilder';
import { SortableTrack } from './SortableTrack';

export const getTrackData = (track: any) => {
  const title = track?.title || track?.name || "Untitled Track";
  
  let artist = "Unknown Artist";
  if (typeof track?.artist === 'string') artist = track.artist;
  else if (track?.artist?.name) artist = track.artist.name;
  else if (track?.artist_name) artist = track.artist_name;

  const cover = track?.cover_url || track?.album?.cover_url || track?.artwork_url || track?.artwork || track?.image_url || "";
  const hasCover = typeof cover === 'string' && cover.trim() !== "";

  const bpm = track?.bpm ? Math.round(track.bpm) : 0;
  
  const scale = track?.scale || track?.Scale || "";
  const musicalKey = track?.musical_key || track?.musicalkey || track?.MusicalKey || "";
  
  // ⚡️ SMART STYLE EXTRACTION: Grab the first genre/style before a comma
  const rawStyle = track?.style || track?.genre || "";
  const primaryStyle = typeof rawStyle === 'string' ? rawStyle.split(',')[0].trim() : "";
  
  return { title, artist, cover, hasCover, bpm, scale, musicalKey, style: primaryStyle };
};

const getBpmGrayscale = (bpm: number) => {
  if (!bpm) return "gray.400";
  const weight = Math.min(Math.max(Math.floor(((bpm - 70) / 90) * 400) + 400, 400), 800);
  return `gray.${weight}`;
};

// --- SMART MUSICAL NOTATION PARSER (PREMIUM MATTE PALETTE) ---
export const getKeyInfo = (scale: string | undefined, musicalKey: string | undefined) => {
  const s = String(scale || "").trim().toUpperCase();
  const mk = String(musicalKey || "").trim().toUpperCase();
  const rawText = `${s} ${mk}`.trim();
  
  let color = "#94A3B8"; // Elegant Slate Gray fallback instead of harsh silver
  let label = "--";

  if (!rawText) return { color, label };

  // 1. Camelot Support with Muted/Premium Colors
  const camelotMatch = rawText.match(/\b([1-9]|1[0-2])[AB]\b/);
  if (camelotMatch) {
    const camelotMap: Record<string, string> = {
      "1A": "#5C92C3", "1B": "#5C92C3", "2A": "#5478C4", "2B": "#5478C4", 
      "3A": "#7265B8", "3B": "#7265B8", "4A": "#9257B3", "4B": "#9257B3", 
      "5A": "#B3539F", "5B": "#B3539F", "6A": "#C8587A", "6B": "#C8587A",
      "7A": "#D1675A", "7B": "#D1675A", "8A": "#D1845A", "8B": "#D1845A", 
      "9A": "#C9A055", "9B": "#C9A055", "10A": "#A5AD52", "10B": "#A5AD52", 
      "11A": "#6EAB5E", "11B": "#6EAB5E", "12A": "#4CA88B", "12B": "#4CA88B"
    };
    return { color: camelotMap[camelotMatch[0]] || color, label: camelotMatch[0] };
  }

  // 2. Standard Musical Notation with Muted/Premium Colors
  const noteMatch = rawText.match(/(?:^|\s|-)([A-G][#B]?)(?:\s|$|M|MIN)/);
  if (noteMatch) {
    let root = noteMatch[1];
    if (root.length === 2 && root[1] === 'B') root = root[0] + 'b'; 
    
    const isMinor = rawText.includes("MIN") || /\bM\b/.test(rawText);
    label = `${root}${isMinor ? 'm' : ''}`; 
    
    const standardMap: Record<string, string> = {
      "C": "#5C92C3", "C#": "#5478C4", "Db": "#5478C4", "D": "#7265B8", "D#": "#9257B3", "Eb": "#9257B3",
      "E": "#B3539F", "F": "#C8587A", "F#": "#D1675A", "Gb": "#D1675A", "G": "#D1845A", "G#": "#C9A055", 
      "Ab": "#C9A055", "A": "#A5AD52", "A#": "#6EAB5E", "Bb": "#6EAB5E", "B": "#4CA88B"
    };
    color = standardMap[root] || color;
  }

  return { color, label };
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
  
  const filteredLibrary = (libraryTracks || []).filter(t => {
    const search = searchQuery.toLowerCase();
    const data = getTrackData(t);
    return data.title.toLowerCase().includes(search) || data.artist.toLowerCase().includes(search);
  });

  const handleSaveClick = async () => {
    if (await savePlaylist()) setShowSuccessModal(true);
  };

  return (
    <>
      {showSuccessModal && (
        <Flex position="fixed" top="0" left="0" w="100vw" h="100vh" bg="blackAlpha.700" zIndex={9999} alignItems="center" justifyContent="center" backdropFilter="blur(8px)">
          <VStack bg="white" p={8} borderRadius="3xl" shadow="2xl" gap={5} maxW="sm" textAlign="center">
            <Icon as={CheckCircle} boxSize={16} color="green.500" />
            <Heading size="md">Playlist Saved</Heading>
            <Button w="full" h="48px" bg="gray.900" color="white" borderRadius="full" onClick={() => navigate('/playlists')}>Back to Playlists</Button>
          </VStack>
        </Flex>
      )}

      <Box w="full" h="100vh" display="flex" flexDirection="column" bg="white" pt={0} pb={10} animation="fade-in 0.4s ease-out">
        <VStack align="start" gap={1} mb={8} flexShrink={0}>
          <HStack gap={2} fontSize="sm" color="gray.500" mb={3}>
            <Box w="24px" h="24px" bg="blue.500" color="white" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
              <Icon as={ListMusic} boxSize={3} />
            </Box>
            <Text onClick={() => navigate('/playlists')} cursor="pointer">Playlists</Text>
            <Text color="gray.300">/</Text>
            <Text color="gray.900" fontWeight="500">{playlistId ? 'Edit playlist' : 'New Playlist'}</Text>
          </HStack>

          <HStack w="full" justify="space-between" align="start">
            <VStack align="start" flex="1" gap={0}>
              <Input value={playlistName} onChange={(e) => setPlaylistName(e.target.value)} fontSize="4xl" fontWeight="normal" placeholder="Rotation Name" border="none" bg="transparent" p={0} h="auto" _focus={{ outline: 'none' }} />
              <Input value={playlistDescription} onChange={(e) => setPlaylistDescription(e.target.value)} fontSize="sm" color="gray.500" border="none" bg="transparent" p={0} h="auto" _focus={{ outline: 'none' }} />
            </VStack>
            <HStack gap={4}>
              <Badge variant="subtle" px={4} py={2} borderRadius="full"><HStack gap={1.5}><Clock size={14}/> <Text>{totalMinutes} mins</Text></HStack></Badge>
              <Button bg="gray.900" color="white" h="48px" px={6} borderRadius="full" onClick={handleSaveClick} loading={isSaving}><Save size={18} style={{marginRight: '8px'}} /> Save Changes</Button>
            </HStack>
          </HStack>
        </VStack>

        <Flex gap={6} flex="1" minH="0">
          <VStack w="400px" align="stretch" bg="white" borderRadius="2xl" border="1px solid" borderColor="gray.100" overflow="hidden">
            <Box p={4} borderBottom="1px solid" borderColor="gray.50">
              <HStack bg="gray.50" px={4} py={2} borderRadius="xl">
                <Search size={16} color="#A0AEC0" />
                <Input border="none" bg="transparent" placeholder="Search library..." size="sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} _focus={{ outline: 'none' }} />
              </HStack>
            </Box>
            
            <Box overflowY="auto" flex="1" p={2}>
              {filteredLibrary.map((track) => {
                const data = getTrackData(track);
                const harmonic = getKeyInfo(data.scale, data.musicalKey);

                return (
                  <HStack key={track.id || Math.random()} p={2.5} mb={1} borderRadius="xl" _hover={{ bg: "gray.50" }} className="group">
                    {data.hasCover ? (
                      <Image src={data.cover} w={10} h={10} borderRadius="md" objectFit="cover" />
                    ) : (
                      <Flex w={10} h={10} bg="gray.50" borderRadius="md" alignItems="center" justifyContent="center">
                        <Music size={14} color="#CBD5E0"/>
                      </Flex>
                    )}
                    
                    <VStack align="start" gap={0} flex="1" overflow="hidden">
                      <Text fontSize="sm" fontWeight="bold" color="gray.900" truncate w="full">{data.title}</Text>
                      
                      <Text fontSize="11px" color="gray.500" truncate w="full">{data.artist}</Text>
                      
                      <HStack gap={2} fontSize="10px" mt={0.5}>
                        <Text color={getBpmGrayscale(data.bpm)} fontWeight="700">{data.bpm || '--'} BPM</Text>
                        
                        <Box px={1.5} py={0.5} borderRadius="sm" bg={harmonic.color} color="white" fontWeight="700" textTransform="none">
                          {harmonic.label}
                        </Box>

                        {/* ⚡️ PALE STYLE TAG */}
                        {data.style && (
                          <Box px={1.5} py={0.5} borderRadius="sm" bg="gray.100" color="gray.600" fontWeight="600" textTransform="capitalize">
                            {data.style}
                          </Box>
                        )}
                      </HStack>
                    </VStack>
                    <Button size="sm" variant="ghost" onClick={() => addTrackToPlaylist(track)} opacity={0} _groupHover={{ opacity: 1 }} borderRadius="full"><Plus size={16}/></Button>
                  </HStack>
                );
              })}
            </Box>
          </VStack>

          <VStack flex="1" align="stretch" bg="gray.50" borderRadius="2xl" border="1px solid" borderColor="gray.100" overflow="hidden">
            <Box flex="1" overflowY="auto" p={4}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={(playlistTracks || []).map(t => String(t.id))} strategy={verticalListSortingStrategy}>
                  {playlistTracks.map((track, index) => (
                    <SortableTrack key={String(track.id)} track={track} index={index + 1} onRemove={removeTrackFromPlaylist} />
                  ))}
                </SortableContext>
              </DndContext>
            </Box>
          </VStack>

        </Flex>
      </Box>
    </>
  );
};