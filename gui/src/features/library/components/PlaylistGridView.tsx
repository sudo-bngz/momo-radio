import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, Heading, Text, Button, Icon, HStack, VStack, Spinner, SimpleGrid, Badge, Image, Grid
} from '@chakra-ui/react';
import { Edit2, Trash2, ListMusic, AlertTriangle, Clock, Play, Disc3, Tag, Music, DownloadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api'; 
import { toaster } from '../../../components/ui/toaster';
import type { Playlist } from '../../../types';
import { useSearchStore } from '../../../store/useSearchStore';

// --- MOSAIC HELPER COMPONENT ---
const PlaylistMosaic = ({ tracks = [] }: { tracks: any[] }) => {
  const rawCovers = (tracks || [])
    .map(t => t.cover_url || t?.album?.cover_url || t?.artwork_url || t?.artwork || t?.image_url || "")
    .filter(url => typeof url === 'string' && url.trim() !== "");

  if (rawCovers.length === 0) {
    return (
      <Flex w="full" h="full" bg="gray.50" align="center" justify="center">
        <Music size={40} color="#CBD5E1" />
      </Flex>
    );
  }

  if (rawCovers.length < 4) {
    return <Image src={rawCovers[0]} w="full" h="full" objectFit="cover" />;
  }

  const covers = rawCovers.slice(0, 4);
  return (
    <Grid templateColumns="repeat(2, 1fr)" templateRows="repeat(2, 1fr)" w="full" h="full">
      {covers.map((src, i) => (
        <Box 
          key={i} w="full" h="full" minH="0" minW="0" overflow="hidden" 
          borderRight={i % 2 === 0 ? "2px solid" : "none"} 
          borderBottom={i < 2 ? "2px solid" : "none"} 
          borderColor="white"
        >
          <Image src={src} w="full" h="full" objectFit="cover" />
        </Box>
      ))}
    </Grid>
  );
};


export const PlaylistGridView: React.FC = () => {
  const navigate = useNavigate();
  const { globalSearch } = useSearchStore();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal states
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null);

  const fetchPlaylists = async () => {
    setIsLoading(true);
    try {
      const response = await api.getPlaylists();
      setPlaylists(response.data || []);
    } catch (error) {
      console.error("Error loading playlists:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const confirmDelete = async () => {
    if (!playlistToDelete) return;
    setIsDeleting(playlistToDelete.id);
    try {
      await api.deletePlaylist(playlistToDelete.id);
      fetchPlaylists();
      toaster.create({ title: "Playlist deleted", type: "success" });
    } catch (error) {
      toaster.create({ title: "Failed to delete", type: "error" });
    } finally {
      setIsDeleting(null);
      setPlaylistToDelete(null);
    }
  };

  const handlePlay = (e: React.MouseEvent, playlist: Playlist) => {
    e.stopPropagation(); 
    console.log(`Now playing playlist: ${playlist.name}`);
  };

  const handleExport = async (e: React.MouseEvent, playlist: Playlist) => {
    e.stopPropagation();
    toaster.create({
      title: "Export Started",
      description: "Packaging files for M3U playlist. This may take a moment...", // ⚡️ Updated text
      type: "info",
      duration: 4000,
    });
    
    try {
      // ⚡️ Assumes you updated this function name in api.ts to exportToM3u
      await api.exportToRekordbox(playlist.id); 
    } catch (error) {
      toaster.create({
        title: "Export Failed",
        description: "Could not start the export job.",
        type: "error",
      });
    }
  };

  // ⚡️ Filter based on the prop passed down from the master LibraryView
const filteredPlaylists = playlists.filter(p => 
    p.name.toLowerCase().includes(globalSearch.toLowerCase()) || 
    (p.description && p.description.toLowerCase().includes(globalSearch.toLowerCase()))
  );

  return (
    <>
      {/* --- DELETE MODAL --- */}
      {playlistToDelete && (
        <Flex 
          position="fixed" top="0" left="0" w="100vw" h="100vh" 
          bg="blackAlpha.600" zIndex={9999} align="center" justify="center" backdropFilter="blur(4px)"
        >
          <VStack bg="white" p={8} borderRadius="2xl" shadow="2xl" gap={5} maxW="sm" textAlign="center" animation="fade-in 0.2s ease-out">
            <Box p={4} bg="red.50" borderRadius="full">
              <Icon as={AlertTriangle} boxSize={8} color="red.500" />
            </Box>
            <VStack gap={2}>
              <Heading size="md" color="gray.900">Delete Playlist?</Heading>
              <Text color="gray.500" fontSize="sm">
                Are you sure you want to permanently delete <b>"{playlistToDelete.name}"</b>? 
              </Text>
            </VStack>
            <HStack w="full" mt={4} gap={3}>
              <Button flex={1} variant="ghost" borderRadius="xl" onClick={() => setPlaylistToDelete(null)} disabled={isDeleting === playlistToDelete.id}>
                Cancel
              </Button>
              <Button flex={1} bg="red.500" color="white" borderRadius="xl" _hover={{ bg: "red.600" }} onClick={confirmDelete} loading={isDeleting === playlistToDelete.id}>
                Delete
              </Button>
            </HStack>
          </VStack>
        </Flex>
      )}

      {/* --- MAIN UI CONTAINER (Headers removed to fit inside Library Shell) --- */}
      <Box w="full" h="100%" overflowY="auto" pt={2} pb={10} animation="fade-in 0.4s ease-out"
        css={{
          '&::-webkit-scrollbar': { width: '8px' },
          '&::-webkit-scrollbar-thumb': { background: 'var(--chakra-colors-gray-200)', borderRadius: '4px' },
        }}
      >
        <Text fontSize="sm" color="gray.500" mb={4}>
          {playlists.length} curated rotations
        </Text>

        {/* CONTENT GRID */}
        {isLoading ? (
          <Flex justify="center" align="center" h="40vh"><Spinner size="xl" color="blue.500" borderWidth="3px" /></Flex>
        ) : filteredPlaylists.length === 0 ? (
          <VStack justify="center" py={24} bg="gray.50" borderRadius="3xl" border="1px dashed" borderColor="gray.200">
            <Box p={6} bg="white" borderRadius="full" mb={2} shadow="sm">
              <Icon as={Disc3} boxSize={12} color="gray.400" />
            </Box>
            <Heading size="md" color="gray.800">No Playlists Found</Heading>
            <Text fontSize="sm" color="gray.500" mb={4}>
              {globalSearch ? "Try adjusting your search terms." : "Group your tracks into seamless rotations."}
            </Text>
            {/* ⚡️ Changed to globalSearch */}
            {!globalSearch && (
              <Button bg="gray.900" color="white" borderRadius="full" onClick={() => navigate('/playlists/new')} _hover={{ bg: "black" }}>
                Create your first
              </Button>
            )}
          </VStack>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3, "2xl": 4 }} gap={6} px={1}>
            {filteredPlaylists.map((playlist) => {
              const totalMinutes = Math.floor((playlist.total_duration || 0) / 60);
              const trackCount = playlist.tracks?.length || 0;

              return (
                <Flex 
                  key={playlist.id} direction="column" bg="white" borderRadius="2xl" 
                  borderWidth="1px" borderColor="gray.100" overflow="hidden" shadow="sm" 
                  transition="all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)" className="group"
                  _hover={{ shadow: "xl", transform: "translateY(-4px)", borderColor: "gray.200" }}
                >
                  {/* --- MOSAIC HEADER --- */}
                  <Box position="relative" h="160px" w="full" bg="gray.50" flexShrink={0} overflow="hidden">
                    <PlaylistMosaic tracks={playlist.tracks || []} />
                    
                    <Box position="absolute" inset={0} bg="blackAlpha.400" opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.2s" />

                    <HStack position="absolute" top={3} right={3} gap={2} opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.2s">
                      <Button size="xs" variant="solid" bg="whiteAlpha.900" color="purple.600" backdropFilter="blur(10px)" _hover={{ bg: "white", transform: "scale(1.05)" }} onClick={(e) => handleExport(e, playlist)} title="Export to M3U">
                        <DownloadCloud size={14} />
                      </Button>
                      <Button size="xs" variant="solid" bg="whiteAlpha.900" color="gray.800" backdropFilter="blur(10px)" _hover={{ bg: "white", transform: "scale(1.05)" }} onClick={() => navigate(`/playlists/edit/${playlist.id}`)}>
                        <Edit2 size={14} />
                      </Button>
                      <Button size="xs" variant="solid" bg="whiteAlpha.900" color="red.600" backdropFilter="blur(10px)" _hover={{ bg: "white", transform: "scale(1.05)" }} onClick={() => setPlaylistToDelete(playlist)}>
                        <Trash2 size={14} />
                      </Button>
                    </HStack>

                    <Button 
                      position="absolute" bottom={4} right={4} size="lg" w="48px" h="48px" borderRadius="full" bg="white" color="gray.900" shadow="xl"
                      transform="translateY(20px)" opacity={0} _groupHover={{ transform: "translateY(0)", opacity: 1 }}
                      transition="all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" _hover={{ scale: 1.1 }}
                      onClick={(e) => handlePlay(e, playlist)}
                    >
                      <Play size={20} fill="currentColor" style={{ marginLeft: '4px' }} />
                    </Button>
                  </Box>

                  {/* --- CARD BODY --- */}
                  <VStack align="stretch" p={5} gap={4} flex="1">
                    <Box>
                      <Heading size="md" color="gray.900" letterSpacing="tight" mb={1} truncate>
                        {playlist.name}
                      </Heading>
                      <Text fontSize="sm" color="gray.500" fontWeight="500" lineClamp={2}>
                        {playlist.description || "General station rotation."}
                      </Text>
                    </Box>

                    <Flex direction="column" justify="flex-end" flex="1" gap={4}>
                      <HStack flexWrap="wrap" gap={2}>
                        <Badge size="sm" variant="subtle" colorPalette="gray" borderRadius="md" px={2} py={0.5} bg="gray.100" color="gray.600">
                          <HStack gap={1}><Tag size={10} /> <Text>Curated</Text></HStack>
                        </Badge>
                      </HStack>

                      <HStack justify="space-between" pt={4} borderTop="1px solid" borderColor="gray.100">
                        <HStack color="gray.500" gap={1.5}>
                          <Icon as={ListMusic} boxSize="14px" />
                          <Text fontSize="xs" fontWeight="700">{trackCount} Tracks</Text>
                        </HStack>
                        <HStack color="gray.500" gap={1.5}>
                          <Icon as={Clock} boxSize="14px" />
                          <Text fontSize="xs" fontWeight="700">{totalMinutes} Mins</Text>
                        </HStack>
                      </HStack>
                    </Flex>
                  </VStack>
                </Flex>
              );
            })}
          </SimpleGrid>
        )}
      </Box>
    </>
  );
};