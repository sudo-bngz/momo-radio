import React from 'react';
import { 
  Box, VStack, HStack, Text, Button, Input, Icon, Flex, Badge, Image
} from '@chakra-ui/react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Save, Music, Plus, Search, Clock, ListMusic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePlaylistBuilder } from '../hook/usePlaylistBuilder';
import { SortableTrack } from './SortableTrack';
import { toaster } from '../../../components/ui/toaster'; 

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
  
  const rawStyle = track?.style || track?.genre || "";
  const primaryStyle = typeof rawStyle === 'string' ? rawStyle.split(',')[0].trim() : "";
  
  return { title, artist, cover, hasCover, bpm, scale, musicalKey, style: primaryStyle };
};

const getBpmGrayscale = (bpm: number) => {
  if (!bpm) return "gray.400";
  const weight = Math.min(Math.max(Math.floor(((bpm - 70) / 90) * 400) + 400, 400), 800);
  return `gray.${weight}`;
};

export const getKeyInfo = (scale: string | undefined, musicalKey: string | undefined) => {
  const s = String(scale || "").trim().toUpperCase();
  const mk = String(musicalKey || "").trim().toUpperCase();
  const rawText = `${s} ${mk}`.trim();
  
  let color = "#94A3B8"; 
  let label = "--";

  if (!rawText) return { color, label };

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
    searchQuery, setSearchQuery, loadMore, hasMore, isLoadingLibrary,
    setPlaylistName, addTrackToPlaylist, setPlaylistDescription, removeTrackFromPlaylist,
    handleDragEnd, savePlaylist, playlistId
  } = usePlaylistBuilder();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const totalSeconds = (playlistTracks || []).reduce((acc, t) => acc + Math.round(t?.duration || 0), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);

  const handleSaveClick = async () => {
    const success = await savePlaylist();
    if (success) {
      toaster.create({ title: "Playlist Saved", description: "Your changes are now live.", type: "success", duration: 3000 });
    } else {
      toaster.create({ title: "Error", description: "Failed to save playlist.", type: "error", duration: 3000 });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 100;
    if (bottom && hasMore && !isLoadingLibrary) {
      loadMore();
    }
  };

  return (
    // ⚡️ Changed h="100vh" to h="100%" so it fits perfectly under your new TopBar without double-scrolling
    <VStack align="stretch" w="full" h="100%" gap={8} bg="white" data-theme="light">
      
      {/* =========================================
          1. HARMONIZED HEADER
          ========================================= */}
      <Flex justify="space-between" align="flex-end" wrap="wrap" gap={6} pb={4} borderBottom="1px solid" borderColor="gray.100">
        
        {/* Left: Breadcrumbs & Seamless Inputs */}
        <VStack align="start" gap={1} flex="1">
          <HStack gap={2} fontSize="sm" color="gray.500" mb={1}>
            <Box w="24px" h="24px" bg="blue.500" color="white" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
              <Icon as={ListMusic} boxSize={3} strokeWidth={3} />
            </Box>
            <Text cursor="pointer" _hover={{ color: "blue.500" }} onClick={() => navigate('/library')}>Library</Text>
            <Text color="gray.300">/</Text>
            {/* Navigates back to the library view, assuming your router keeps state or defaults to playlists */}
            <Text cursor="pointer" _hover={{ color: "blue.500" }} onClick={() => navigate(-1)}>Playlists</Text>
            <Text color="gray.300">/</Text>
            <Text color="gray.900" fontWeight="500">{playlistId ? 'Edit Playlist' : 'New Playlist'}</Text>
          </HStack>

          {/* ⚡️ Blended Inputs matching the "Music Library" typography */}
          <VStack align="start" w="100%" maxW="600px" gap={0}>
            <Input 
              value={playlistName} 
              onChange={(e) => setPlaylistName(e.target.value)} 
              fontSize="4xl" 
              fontWeight="normal" 
              letterSpacing="tight" 
              placeholder="Playlist Name..." 
              border="none" 
              bg="transparent" 
              p={0} 
              h="auto" 
              color="gray.900"
              _focus={{ outline: 'none', bg: 'gray.50', px: 2, borderRadius: 'md', ml: -2 }} 
              transition="all 0.2s"
            />
            <Input 
              value={playlistDescription} 
              onChange={(e) => setPlaylistDescription(e.target.value)} 
              fontSize="md" 
              color="gray.500" 
              placeholder="Add an optional description..."
              border="none" 
              bg="transparent" 
              p={0} 
              h="auto" 
              mt={1}
              _focus={{ outline: 'none', bg: 'gray.50', px: 2, borderRadius: 'md', ml: -2 }} 
              transition="all 0.2s"
            />
          </VStack>
        </VStack>

        {/* Right: Actions */}
        <HStack gap={4} flexShrink={0}>
          <Badge variant="subtle" px={4} py={2} borderRadius="full" bg="gray.100" color="gray.700">
            <HStack gap={1.5}><Clock size={14}/> <Text fontWeight="600">{totalMinutes} mins</Text></HStack>
          </Badge>
          <Button 
            bg="blue.600" color="white" h="44px" px={6} borderRadius="xl" 
            onClick={handleSaveClick} loading={isSaving} 
            _hover={{ bg: "blue.700", transform: "translateY(-1px)", shadow: "sm" }}
            transition="all 0.2s"
          >
            <Save size={18} style={{marginRight: '8px'}} /> Save Playlist
          </Button>
        </HStack>
      </Flex>

      {/* =========================================
          2. SPLIT BUILDER VIEW
          ========================================= */}
      <Flex gap={6} flex="1" minH="0">
        
        {/* --- LEFT SIDE: LIBRARY SEARCH & LIST --- */}
        <VStack w="400px" align="stretch" bg="white" borderRadius="2xl" border="1px solid" borderColor="gray.200" overflow="hidden" shadow="sm">
          <Box p={4} borderBottom="1px solid" borderColor="gray.100" bg="gray.50">
            <HStack bg="white" px={4} py={2} borderRadius="xl" border="1px solid" borderColor="gray.200">
              <Search size={16} color="#A0AEC0" />
              <Input 
                border="none" bg="transparent" placeholder="Search library..." size="sm" 
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} 
                _focus={{ outline: 'none' }} 
              />
            </HStack>
          </Box>
          
          <Box overflowY="auto" flex="1" p={2} onScroll={handleScroll} css={{ '&::-webkit-scrollbar': { display: 'none' } }}>
            {libraryTracks.map((track) => {
              const data = getTrackData(track);
              const harmonic = getKeyInfo(data.scale, data.musicalKey);

              return (
                <HStack key={track.id || Math.random()} p={2.5} mb={1} borderRadius="xl" _hover={{ bg: "gray.50" }} className="group">
                  {data.hasCover ? (
                    <Image src={data.cover} w={10} h={10} borderRadius="md" objectFit="cover" />
                  ) : (
                    <Flex w={10} h={10} bg="gray.100" borderRadius="md" alignItems="center" justifyContent="center">
                      <Music size={14} color="#A0AEC0"/>
                    </Flex>
                  )}
                  
                  <VStack align="start" gap={0} flex="1" overflow="hidden">
                    <Text fontSize="sm" fontWeight="600" color="gray.900" truncate w="full">{data.title}</Text>
                    <Text fontSize="11px" color="gray.500" truncate w="full">{data.artist}</Text>
                    
                    <HStack gap={2} fontSize="10px" mt={0.5}>
                      <Text color={getBpmGrayscale(data.bpm)} fontWeight="700">{data.bpm || '--'} BPM</Text>
                      <Box px={1.5} py={0.5} borderRadius="sm" bg={harmonic.color} color="white" fontWeight="700" textTransform="none">{harmonic.label}</Box>
                      {data.style && <Box px={1.5} py={0.5} borderRadius="sm" bg="gray.100" color="gray.600" fontWeight="600" textTransform="capitalize">{data.style}</Box>}
                    </HStack>
                  </VStack>
                  <Button size="sm" variant="ghost" color="blue.600" onClick={() => addTrackToPlaylist(track)} opacity={0} _groupHover={{ opacity: 1 }} borderRadius="full"><Plus size={16}/></Button>
                </HStack>
              );
            })}

            {isLoadingLibrary && <Text textAlign="center" fontSize="xs" color="gray.400" py={4}>Loading more tracks...</Text>}
          </Box>
        </VStack>

        {/* --- RIGHT SIDE: PLAYLIST BUILDER --- */}
        <VStack flex="1" align="stretch" bg="gray.50" borderRadius="2xl" border="1px dashed" borderColor="gray.200" overflow="hidden">
          <Box flex="1" overflowY="auto" p={6}>
            <DndContext 
              sensors={sensors} 
              collisionDetection={closestCenter} 
              onDragEnd={(e) => handleDragEnd(e, () => {
                toaster.create({ title: "Order saved", type: "info", duration: 1500 });
              })}
            >
              <SortableContext items={(playlistTracks || []).map(t => String(t.id))} strategy={verticalListSortingStrategy}>
                {playlistTracks.map((track, index) => (
                  <SortableTrack key={String(track.id)} track={track} index={index + 1} onRemove={removeTrackFromPlaylist} />
                ))}
              </SortableContext>
            </DndContext>
            
            {playlistTracks.length === 0 && (
              <Flex h="100%" align="center" justify="center" direction="column" color="gray.400" gap={3}>
                <ListMusic size={48} strokeWidth={1} />
                <Text>Drag tracks here or click the + button to build your playlist.</Text>
              </Flex>
            )}
          </Box>
        </VStack>

      </Flex>
    </VStack>
  );
};