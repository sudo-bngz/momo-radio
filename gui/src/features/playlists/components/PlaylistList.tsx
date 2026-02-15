import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, Heading, Text, Button, Icon, HStack, VStack, Spinner 
} from '@chakra-ui/react';
import { Plus, Edit2, Trash2, ListMusic, AlertTriangle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api'; 
import type { Playlist } from '../../../types';

export const PlaylistList: React.FC = () => { 
  const navigate = useNavigate();
  
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
    } catch (error) {
      console.error("Failed to delete playlist:", error);
    } finally {
      setIsDeleting(null);
      setPlaylistToDelete(null);
    }
  };

  return (
    <>
      {/* --- SLEEK DELETE MODAL --- */}
      {playlistToDelete && (
        <Flex 
          position="fixed" top="0" left="0" w="100vw" h="100vh" 
          bg="blackAlpha.600" zIndex={9999} align="center" justify="center" backdropFilter="blur(4px)"
        >
          <VStack bg="white" p={8} borderRadius="2xl" shadow="2xl" gap={5} maxW="sm" textAlign="center">
            <Box p={3} bg="red.50" borderRadius="full">
              <Icon as={AlertTriangle} boxSize={8} color="red.500" />
            </Box>
            <VStack gap={2}>
              <Text fontSize="xl" fontWeight="bold" color="gray.900">Delete Playlist?</Text>
              <Text color="gray.500" fontSize="sm">
                Are you sure you want to delete <b>"{playlistToDelete.name}"</b>? 
              </Text>
            </VStack>
            <HStack w="full" mt={2} gap={3}>
              <Button flex={1} variant="outline" color="gray.600" onClick={() => setPlaylistToDelete(null)} disabled={isDeleting === playlistToDelete.id}>
                Cancel
              </Button>
              <Button flex={1} bg="red.600" color="white" _hover={{ bg: "red.700" }} onClick={confirmDelete} loading={isDeleting === playlistToDelete.id}>
                Delete
              </Button>
            </HStack>
          </VStack>
        </Flex>
      )}

      {/* --- MINIMALIST MAIN UI --- */}
      <Box w="full" h="full" bg="transparent">
        
        {/* 1. Minimal Header */}
        <Flex justify="space-between" align="end" mb={6} px={1}>
          <Heading size="lg" fontWeight="semibold" color="gray.900" letterSpacing="tight">
            Playlists
          </Heading>
          
          <Button 
            onClick={() => navigate('/playlists/new')}
            bg="gray.900"
            color="white"
            _hover={{ bg: "black", transform: "translateY(-1px)" }}
            transition="all 0.2s"
            size="sm"
            borderRadius="full"
            px={5}
            shadow="sm"
          >
            <Plus size={16} style={{ marginRight: '6px' }} />
            New Playlist
          </Button>
        </Flex>

        {/* 2. List Content */}
        {isLoading ? (
          <Flex justify="center" align="center" h="200px"><Spinner color="blue.500" /></Flex>
        ) : playlists.length === 0 ? (
          <VStack justify="center" py={20} color="gray.400" bg="white" borderRadius="2xl" border="1px dashed" borderColor="gray.200">
            <Icon as={ListMusic} boxSize={12} mb={3} opacity={0.3} />
            <Text fontSize="lg" fontWeight="medium" color="gray.500">No playlists yet</Text>
            <Text fontSize="sm">Create your first rotation to get started.</Text>
          </VStack>
        ) : (
          <VStack gap={3} align="stretch" pb={10}>
            {playlists.map((playlist) => {
              // Calculate minutes safely
              const totalMinutes = Math.floor((playlist.total_duration || 0) / 60);
              const trackCount = playlist.tracks?.length || playlist.tracks?.length || 0;

              return (
                <Flex 
                  key={playlist.id} 
                  bg="white" 
                  p={4} 
                  borderRadius="xl" 
                  borderWidth="1px" 
                  borderColor="gray.100" 
                  shadow="sm" 
                  align="center"
                  justify="space-between"
                  transition="all 0.2s"
                  _hover={{ shadow: "md", borderColor: "gray.200" }}
                >
                  
                  {/* Left Side: Icon, Title & Description */}
                  <HStack gap={4} flex="1">
                    <Flex 
                      align="center" justify="center" w={12} h={12} borderRadius="lg" flexShrink={0}
                      bg={`${playlist.color || '#3182ce'}15`} 
                      color={playlist.color || "blue.500"}
                    >
                      <ListMusic size={20} />
                    </Flex>
                    
                    <VStack align="start" gap={0} maxW="70%">
                      <Text fontWeight="bold" fontSize="md" color="gray.900" truncate>{playlist.name}</Text>
                      {/* NEW: Displays the description if it exists, otherwise shows default text */}
                      <Text fontSize="xs" color="gray.500" fontWeight="medium" truncate>
                        {playlist.description || "Standard Rotation"}
                      </Text>
                    </VStack>
                  </HStack>

                  {/* Right Side: Stats & Actions */}
                  <HStack gap={6} flexShrink={0}>
                    
                    {/* NEW: Clean Stats Block (Tracks + Duration) */}
                    <HStack gap={4} bg="gray.50" px={4} py={1.5} borderRadius="full" border="1px solid" borderColor="gray.100">
                      <HStack gap={1.5} color="gray.700">
                        <ListMusic size={14} />
                        <Text fontSize="xs" fontWeight="bold">{trackCount}</Text>
                      </HStack>
                      <Box w="1px" h="12px" bg="gray.300" />
                      <HStack gap={1.5} color="gray.600">
                        <Clock size={14} />
                        <Text fontSize="xs" fontWeight="bold">{totalMinutes}m</Text>
                      </HStack>
                    </HStack>

                    {/* Actions - Always visible now, but subtle gray */}
                    <HStack gap={1}>
                      <Button 
                        size="sm" variant="ghost" color="gray.400" 
                        _hover={{ color: "blue.600", bg: "blue.50" }}
                        onClick={() => navigate(`/playlists/edit/${playlist.id}`)}
                        px={2}
                      >
                        <Edit2 size={18} />
                      </Button>
                      
                      <Button 
                        size="sm" variant="ghost" color="gray.400" 
                        _hover={{ color: "red.600", bg: "red.50" }}
                        onClick={() => setPlaylistToDelete(playlist)}
                        px={2}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </HStack>

                  </HStack>
                </Flex>
              );
            })}
          </VStack>
        )}
      </Box>
    </>
  );
};