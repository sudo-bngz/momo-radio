import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, Heading, Text, Button, Icon, HStack, VStack, Spinner, SimpleGrid, Badge, Input, Image, Grid
} from '@chakra-ui/react';
import { Plus, Edit2, Trash2, ListMusic, AlertTriangle, Clock, Play, Disc3, Tag, Search, Music, DownloadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api'; 
import { toaster } from '../../../components/ui/toaster';
import type { Playlist } from '../../../types';

// --- MOSAIC HELPER COMPONENT ---
const PlaylistMosaic = ({ tracks = [] }: { tracks: any[] }) => {
  const rawCovers = (tracks || [])
    .map(t => t.cover_url || t?.album?.cover_url || t?.artwork_url || t?.artwork || t?.image_url || "")
    .filter(url => typeof url === 'string' && url.trim() !== "");

  if (rawCovers.length === 0) {
    return (
      <Flex w="full" h="full" bg="gray.100" _dark={{ bg: "whiteAlpha.100" }} align="center" justify="center">
        <Icon as={Music} boxSize={10} color="fg.muted" _dark={{ color: "whiteAlpha.300" }} />
      </Flex>
    );
  }

  if (rawCovers.length < 4) {
    return (
      <Image src={rawCovers[0]} w="full" h="full" objectFit="cover" />
    );
  }

  const covers = rawCovers.slice(0, 4);
  return (
    <Grid templateColumns="repeat(2, 1fr)" templateRows="repeat(2, 1fr)" w="full" h="full">
      {covers.map((src, i) => (
        <Box 
          key={i} w="full" h="full" 
          minH="0" minW="0" overflow="hidden" 
          borderRight={i % 2 === 0 ? "2px solid" : "none"} 
          borderBottom={i < 2 ? "2px solid" : "none"} 
          borderColor="bg.panel" // ⚡️ Matches the card background beautifully in both modes
        >
          <Image src={src} w="full" h="full" objectFit="cover" />
        </Box>
      ))}
    </Grid>
  );
};

export const PlaylistList: React.FC = () => { 
  const navigate = useNavigate();
  
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
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
      description: "Packaging files for Rekordbox. This may take a moment...",
      type: "info",
      duration: 4000,
    });
    
    try {
      await api.exportToM3u(playlist.id); 
    } catch (error) {
      toaster.create({
        title: "Export Failed",
        description: "Could not start the export job.",
        type: "error",
      });
    }
  };

  const filteredPlaylists = playlists.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      {/* --- DELETE MODAL --- */}
      {playlistToDelete && (
        <Flex 
          position="fixed" top="0" left="0" w="100vw" h="100vh" 
          bg="blackAlpha.600" zIndex={9999} align="center" justify="center" backdropFilter="blur(4px)"
        >
          {/* ⚡️ Semantic panel styling */}
          <VStack bg="bg.panel" p={8} borderRadius="2xl" shadow="2xl" gap={5} maxW="sm" textAlign="center" animation="fade-in 0.2s ease-out">
            <Box p={4} bg="red.50" _dark={{ bg: "red.900" }} borderRadius="full">
              <Icon as={AlertTriangle} boxSize={8} color="red.500" _dark={{ color: "red.400" }} />
            </Box>
            <VStack gap={2}>
              <Heading size="md" color="fg">Delete Playlist?</Heading>
              <Text color="fg.muted" fontSize="sm">
                Are you sure you want to permanently delete <Text as="span" fontWeight="bold" color="fg">"{playlistToDelete.name}"</Text>? 
              </Text>
            </VStack>
            <HStack w="full" mt={4} gap={3}>
              <Button flex={1} variant="ghost" color="fg" borderRadius="xl" onClick={() => setPlaylistToDelete(null)} disabled={isDeleting === playlistToDelete.id} _hover={{ bg: "gray.100", _dark: { bg: "whiteAlpha.200" } }}>
                Cancel
              </Button>
              <Button flex={1} bg="red.500" color="white" borderRadius="xl" _hover={{ bg: "red.600", _dark: { bg: "red.400" } }} onClick={confirmDelete} loading={isDeleting === playlistToDelete.id}>
                Delete
              </Button>
            </HStack>
          </VStack>
        </Flex>
      )}

      {/* --- MAIN UI CONTAINER --- */}
      {/* ⚡️ Removed hardcoded white background so it inherits correctly */}
      <Box w="full" minH="100vh" bg="transparent" pt={0} pb={10} animation="fade-in 0.4s ease-out">
        
        {/* HEADER & BREADCRUMB */}
        <VStack align="start" gap={1} mb={8}>
          <HStack gap={2} fontSize="sm" color="fg.muted" mb={3}>
            <Box w="24px" h="24px" bg="blue.500" _dark={{ bg: "blue.400" }} color="white" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
              <Icon as={ListMusic} boxSize={3} strokeWidth={3} />
            </Box>
            <Text color="fg" fontWeight="500">Playlists</Text>
          </HStack>

          <Heading size="3xl" fontWeight="normal" color="fg" letterSpacing="tight">
            Playlists
          </Heading>
          <Text fontSize="sm" color="fg.muted">
            {playlists.length} curated rotations
          </Text>
        </VStack>

        {/* ACTION TOOLBAR */}
        <HStack justify="space-between" w="100%" gap={6} mb={10} flexWrap="wrap">
          <HStack gap={4} flex="1" maxW="600px">
            {/* ⚡️ Semantic dynamic button */}
            <Button 
              bg="fg" color="bg" borderRadius="full" w="48px" h="48px" p={0} 
              _hover={{ opacity: 0.8, transform: "scale(1.05)" }} transition="all 0.2s"
              onClick={() => navigate('/playlists/new')} flexShrink={0}
            >
              <Icon as={Plus} boxSize={6} />
            </Button>
            
            <Box position="relative" flex="1">
              <Icon as={Search} position="absolute" left={4} top="50%" transform="translateY(-50%)" color="fg.muted" zIndex={2} />
              <Input 
                pl={12} h="48px" fontSize="lg" placeholder="Search rotations..." 
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                borderRadius="xl" bg="bg.panel" border="1px solid" borderColor="transparent" color="fg" 
                _placeholder={{ color: "fg.muted" }}
                _focus={{ bg: "bg", shadow: "sm", ring: "1px", ringColor: "blue.500", _dark: { ringColor: "blue.400" } }}
              />
            </Box>
          </HStack>
        </HStack>

        {/* CONTENT GRID */}
        {isLoading ? (
          <Flex justify="center" align="center" h="40vh"><Spinner size="xl" color="blue.500" _dark={{ color: "blue.400" }} borderWidth="3px" /></Flex>
        ) : filteredPlaylists.length === 0 ? (
          <VStack justify="center" py={24} bg="bg.panel" borderRadius="3xl" border="1px dashed" borderColor="border">
            <Box p={6} bg="bg" borderRadius="full" mb={2} shadow="sm" border="1px solid" borderColor="border">
              <Icon as={Disc3} boxSize={12} color="fg.muted" />
            </Box>
            <Heading size="md" color="fg">No Playlists Found</Heading>
            <Text fontSize="sm" color="fg.muted" mb={4}>
              {searchQuery ? "Try adjusting your search terms." : "Group your tracks into seamless rotations."}
            </Text>
            {!searchQuery && (
              <Button bg="fg" color="bg" borderRadius="full" onClick={() => navigate('/playlists/new')} _hover={{ opacity: 0.8 }}>
                Create your first
              </Button>
            )}
          </VStack>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3, "2xl": 4 }} gap={6}>
            {filteredPlaylists.map((playlist) => {
              const totalMinutes = Math.floor((playlist.total_duration || 0) / 60);
              const trackCount = playlist.tracks?.length || 0;

              return (
                <Flex 
                  key={playlist.id} 
                  direction="column"
                  bg="bg.panel" 
                  borderRadius="2xl" 
                  borderWidth="1px" 
                  borderColor="border" 
                  overflow="hidden"
                  shadow="sm" 
                  transition="all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)"
                  className="group"
                  _hover={{ shadow: "xl", transform: "translateY(-4px)", borderColor: "fg.muted" }}
                >
                  {/* --- MOSAIC HEADER --- */}
                  <Box position="relative" h="160px" w="full" bg="gray.50" _dark={{ bg: "whiteAlpha.100" }} flexShrink={0} overflow="hidden">
                    <PlaylistMosaic tracks={playlist.tracks || []} />
                    
                    <Box 
                      position="absolute" inset={0} bg="blackAlpha.500" 
                      opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.2s" 
                    />

                    {/* ⚡️ ENHANCED HOVER ACTIONS */}
                    <HStack position="absolute" top={3} right={3} gap={2} opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.2s">
                      <Button size="xs" variant="solid" bg="whiteAlpha.900" color="purple.600" _dark={{ bg: "gray.800", color: "purple.300" }} backdropFilter="blur(10px)" _hover={{ bg: "white", transform: "scale(1.05)", _dark: { bg: "gray.700" } }} onClick={(e) => handleExport(e, playlist)} title="Export to Rekordbox">
                        <DownloadCloud size={14} />
                      </Button>
                      <Button size="xs" variant="solid" bg="whiteAlpha.900" color="gray.800" _dark={{ bg: "gray.800", color: "white" }} backdropFilter="blur(10px)" _hover={{ bg: "white", transform: "scale(1.05)", _dark: { bg: "gray.700" } }} onClick={() => navigate(`/playlists/edit/${playlist.id}`)}>
                        <Edit2 size={14} />
                      </Button>
                      <Button size="xs" variant="solid" bg="whiteAlpha.900" color="red.600" _dark={{ bg: "gray.800", color: "red.400" }} backdropFilter="blur(10px)" _hover={{ bg: "white", transform: "scale(1.05)", _dark: { bg: "gray.700" } }} onClick={() => setPlaylistToDelete(playlist)}>
                        <Trash2 size={14} />
                      </Button>
                    </HStack>

                    <Button 
                      position="absolute" bottom={4} right={4}
                      size="lg" w="48px" h="48px" borderRadius="full" 
                      bg="white" color="gray.900" _dark={{ bg: "blue.500", color: "white" }} shadow="xl"
                      transform="translateY(20px)" opacity={0} _groupHover={{ transform: "translateY(0)", opacity: 1 }}
                      transition="all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" _hover={{ scale: 1.1, _dark: { bg: "blue.400" } }}
                      onClick={(e) => handlePlay(e, playlist)}
                    >
                      <Play size={20} fill="currentColor" style={{ marginLeft: '4px' }} />
                    </Button>
                  </Box>

                  {/* --- CARD BODY --- */}
                  <VStack align="stretch" p={5} gap={4} flex="1">
                    <Box>
                      <Heading size="md" color="fg" letterSpacing="tight" mb={1} truncate>
                        {playlist.name}
                      </Heading>
                      <Text fontSize="sm" color="fg.muted" fontWeight="500" lineClamp={2}>
                        {playlist.description || "General station rotation."}
                      </Text>
                    </Box>

                    <Flex direction="column" justify="flex-end" flex="1" gap={4}>
                      <HStack flexWrap="wrap" gap={2}>
                        <Badge size="sm" variant="subtle" borderRadius="md" px={2} py={0.5} bg="gray.100" color="gray.600" _dark={{ bg: "whiteAlpha.200", color: "whiteAlpha.800" }}>
                          <HStack gap={1}><Tag size={10} /> <Text>Curated</Text></HStack>
                        </Badge>
                      </HStack>

                      <HStack justify="space-between" pt={4} borderTop="1px solid" borderColor="border">
                        <HStack color="fg.muted" gap={1.5}>
                          <Icon as={ListMusic} boxSize="14px" />
                          <Text fontSize="xs" fontWeight="700">{trackCount} Tracks</Text>
                        </HStack>
                        <HStack color="fg.muted" gap={1.5}>
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

      <style>{`
        .group:hover .group-hover-visible { opacity: 1; transform: translateY(0); }
      `}</style>
    </>
  );
};