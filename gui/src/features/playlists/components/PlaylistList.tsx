import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, Heading, Text, Button, Icon, HStack, VStack, Spinner, SimpleGrid, Badge, Input
} from '@chakra-ui/react';
import { Plus, Edit2, Trash2, ListMusic, AlertTriangle, Clock, Play, Disc3, Tag, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api'; 
import type { Playlist } from '../../../types';

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
    } catch (error) {
      console.error("Failed to delete playlist:", error);
    } finally {
      setIsDeleting(null);
      setPlaylistToDelete(null);
    }
  };

  const handlePlay = (e: React.MouseEvent, playlist: Playlist) => {
    e.stopPropagation(); 
    console.log(`▶️ Now playing playlist: ${playlist.name}`);
  };

  // Filter playlists based on search query
  const filteredPlaylists = playlists.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      {/* --- SLEEK DELETE MODAL --- */}
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
              <Button flex={1} variant="outline" borderRadius="xl" onClick={() => setPlaylistToDelete(null)} disabled={isDeleting === playlistToDelete.id}>
                Cancel
              </Button>
              <Button flex={1} bg="red.500" color="white" borderRadius="xl" _hover={{ bg: "red.600" }} onClick={confirmDelete} loading={isDeleting === playlistToDelete.id}>
                Delete
              </Button>
            </HStack>
          </VStack>
        </Flex>
      )}

      {/* --- MAIN UI CONTAINER --- */}
      <Box w="full" minH="100vh" bg="white" pt={0} pb={10} animation="fade-in 0.4s ease-out">
        
        {/* =========================================
            1. STANDARDIZED HEADER & BREADCRUMB
            ========================================= */}
        <VStack align="start" gap={1} mb={8}>
          <HStack gap={2} fontSize="sm" color="gray.500" mb={3}>
            <Box w="24px" h="24px" bg="blue.500" color="white" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
              <Icon as={ListMusic} boxSize={3} strokeWidth={3} />
            </Box>
            <Text cursor="pointer" _hover={{ color: "blue.500" }} onClick={() => navigate('/')}>
              Playlists
            </Text>
            <Text color="gray.300">/</Text>
            <Text color="gray.900" fontWeight="500">
              All Playlists
            </Text>
          </HStack>

          <Heading size="3xl" fontWeight="normal" color="gray.900" letterSpacing="tight">
            Playlists
          </Heading>
          <Text fontSize="sm" color="gray.500">
            {playlists.length} playlists in your collection
          </Text>
        </VStack>

        {/* =========================================
            2. STANDARDIZED ACTION TOOLBAR
            ========================================= */}
        <HStack justify="space-between" w="100%" gap={6} mb={10} flexWrap="wrap">
          <HStack gap={4} flex="1" maxW="600px">
            <Button 
              bg="gray.900" color="white" borderRadius="full" w="48px" h="48px" p={0} 
              _hover={{ bg: "black", transform: "scale(1.05)" }} transition="all 0.2s"
              onClick={() => navigate('/playlists/new')} flexShrink={0}
            >
              <Icon as={Plus} boxSize={6} />
            </Button>
            
            <Box position="relative" flex="1">
              <Icon as={Search} position="absolute" left={4} top="50%" transform="translateY(-50%)" color="gray.400" zIndex={2} />
              <Input 
                pl={12} h="48px" fontSize="lg" placeholder="Search..." 
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                borderRadius="xl" bg="gray.50" border="none" color="gray.900" 
                _focus={{ bg: "white", shadow: "sm", ring: "1px", ringColor: "blue.500" }}
              />
            </Box>
          </HStack>
        </HStack>

        {/* =========================================
            3. CONTENT GRID (Light Mode)
            ========================================= */}
        {isLoading ? (
          <Flex justify="center" align="center" h="40vh"><Spinner size="xl" color="blue.500" borderWidth="3px" /></Flex>
        ) : filteredPlaylists.length === 0 ? (
          <VStack justify="center" py={24} bg="gray.50" borderRadius="3xl" border="1px dashed" borderColor="gray.200">
            <Box p={6} bg="white" borderRadius="full" mb={2} shadow="sm">
              <Icon as={Disc3} boxSize={12} color="gray.400" />
            </Box>
            <Heading size="md" color="gray.800">No Playlists Found</Heading>
            <Text fontSize="sm" color="gray.500" mb={4}>
              {searchQuery ? "Try adjusting your search terms." : "Group your tracks into seamless rotations."}
            </Text>
            {!searchQuery && (
              <Button bg="gray.900" color="white" borderRadius="full" onClick={() => navigate('/playlists/new')} _hover={{ bg: "black" }}>
                Create your first
              </Button>
            )}
          </VStack>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3, "2xl": 4 }} gap={6}>
            {filteredPlaylists.map((playlist) => {
              const totalMinutes = Math.floor((playlist.total_duration || 0) / 60);
              const trackCount = playlist.tracks?.length || 0;
              const themeColor = playlist.color || "blue.500";

              return (
                <Flex 
                  key={playlist.id} 
                  direction="column"
                  bg="white" 
                  borderRadius="2xl" 
                  borderWidth="1px" 
                  borderColor="gray.100" 
                  overflow="hidden"
                  shadow="sm" 
                  transition="all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)"
                  className="group"
                  _hover={{ shadow: "xl", transform: "translateY(-4px)", borderColor: "gray.200" }}
                >
                  {/* --- CARD HEADER --- */}
                  <Box 
                    position="relative" 
                    h="140px" 
                    bgGradient={`to-br`}
                    gradientFrom={`${themeColor.split('.')[0]}.400`}
                    gradientTo={`${themeColor.split('.')[0]}.700`}
                    p={4}
                    display="flex"
                    alignItems="flex-end"
                    justifyContent="flex-end"
                    overflow="hidden"
                  >
                    <Icon as={Disc3} position="absolute" left="-10%" top="-20%" boxSize="150px" color="whiteAlpha.300" transform="rotate(15deg)" />
                    
                    <HStack position="absolute" top={3} right={3} gap={1} opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.2s">
                      <Button size="xs" variant="solid" bg="whiteAlpha.800" color="gray.800" backdropFilter="blur(10px)" _hover={{ bg: "white" }} onClick={() => navigate(`/playlists/edit/${playlist.id}`)}>
                        <Edit2 size={14} />
                      </Button>
                      <Button size="xs" variant="solid" bg="whiteAlpha.800" color="red.600" backdropFilter="blur(10px)" _hover={{ bg: "white" }} onClick={() => setPlaylistToDelete(playlist)}>
                        <Trash2 size={14} />
                      </Button>
                    </HStack>

                    <Button 
                      size="lg" w="56px" h="56px" borderRadius="full" bg="white" color="gray.900" shadow="xl"
                      transform="translateY(20px)" opacity={0} _groupHover={{ transform: "translateY(0)", opacity: 1 }}
                      transition="all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" _hover={{ scale: 1.1 }}
                      onClick={(e) => handlePlay(e, playlist)}
                    >
                      <Play size={24} fill="currentColor" style={{ marginLeft: '4px' }} />
                    </Button>
                  </Box>

                  {/* --- CARD BODY --- */}
                  <VStack align="stretch" p={5} gap={4} flex="1">
                    <Box>
                      <Heading size="md" color="gray.900" letterSpacing="tight" mb={1} truncate>
                        {playlist.name}
                      </Heading>
                      <Text fontSize="sm" color="gray.500" fontWeight="500" lineClamp={2}>
                        {playlist.description || "General station rotation containing mixed genres."}
                      </Text>
                    </Box>

                    <Flex direction="column" justify="flex-end" flex="1" gap={4}>
                      <HStack flexWrap="wrap" gap={2}>
                        <Badge size="sm" variant="subtle" colorPalette={themeColor.split('.')[0]} borderRadius="md" px={2} py={0.5}>
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

      <style>{`
        .group:hover .group-hover-visible { opacity: 1; transform: translateY(0); }
      `}</style>
    </>
  );
};