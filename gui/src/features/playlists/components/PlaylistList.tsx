import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, Heading, Text, Button, Grid, HStack, VStack, Spinner, Circle 
} from '@chakra-ui/react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { api } from '../../../services/api'; 
import type { Playlist } from '../../../types';

interface PlaylistListProps {
  onCreate: () => void;
  onEdit: (id: number) => void;
}

export const PlaylistList: React.FC<PlaylistListProps> = ({ onCreate, onEdit }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

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

  const handleDelete = async (id: number) => {
    if (!id) return; 
    if (!window.confirm("Are you sure you want to delete this playlist?")) return;
    
    setIsDeleting(id);
    try {
      await api.deletePlaylist(id);
      fetchPlaylists();
    } catch (error) {
      console.error("Failed to delete playlist:", error);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <Box w="full" bg="white" borderRadius="xl" borderWidth="1px" borderColor="gray.200" shadow="sm" overflow="hidden">
      
      {/* Header: Blue Button Fixed */}
      <Flex p={6} borderBottomWidth="1px" borderColor="gray.200" justify="space-between" align="center" bg="gray.50">
        <VStack align="start" gap={1}>
          <Heading size="md" color="gray.900">All Playlists</Heading>
          <Text fontSize="sm" color="gray.500">Manage your station's rotation and scheduled blocks.</Text>
        </VStack>
        
        <Button 
          onClick={onCreate}
          bg="blue.600" 
          color="white"
          _hover={{ bg: "blue.700" }}
          size="lg"
          px={6}
        >
          <Plus size={18} style={{ marginRight: '8px' }} />
          ADD PLAYLIST
        </Button>
      </Flex>

      {/* Table Header */}
      <Grid templateColumns="2fr 2fr 1fr 180px" gap={4} px={6} py={4} bg="white" borderBottomWidth="1px" borderColor="gray.200" fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase">
        <Text>Playlist Name</Text>
        <Text>Details</Text>
        <Text>Tracks</Text>
        <Text textAlign="right">Actions</Text>
      </Grid>

      <Box overflowY="auto">
        {isLoading ? (
          <Flex justify="center" align="center" h="200px"><Spinner color="blue.500" /></Flex>
        ) : (
          <>
            {playlists.map((playlist) => (
              /* The 'id' is now lowercase because we updated the Go struct tags */
              <Grid key={playlist.id} templateColumns="2fr 2fr 1fr 180px" gap={4} px={6} py={5} borderBottomWidth="1px" borderColor="gray.100" _hover={{ bg: "gray.50" }} transition="all 0.2s" alignItems="center">
                
                <VStack align="start" gap={1.5}>
                  <Text fontWeight="bold" fontSize="md" color="gray.800">{playlist.name}</Text>
                  <HStack bg="gray.100" px={2} py={0.5} borderRadius="full" borderWidth="1px" borderColor="gray.200">
                    <Circle size="8px" bg={playlist.color || "#3182ce"} />
                    <Text fontSize="10px" fontWeight="bold" color="gray.600">ROTATION</Text>
                  </HStack>
                </VStack>

                <Text fontSize="sm" color="gray.600" fontWeight="medium">Standard Rotation</Text>

                <Text fontSize="sm" fontWeight="bold" color="blue.600">
                  {playlist.tracks?.length || 0} tracks
                </Text>

                {/* Actions: Colors Locked */}
                <HStack justify="flex-end" gap={2}>
                  <Button 
                    size="sm" 
                    bg="gray.800" 
                    color="white" 
                    _hover={{ bg: "gray.900" }}
                    onClick={() => onEdit(playlist.id)}
                  >
                    <Edit2 size={14} style={{ marginRight: '4px' }} /> Edit
                  </Button>
                  
                  <Button 
                    size="sm" 
                    bg="red.600" 
                    color="white" 
                    _hover={{ bg: "red.700" }}
                    onClick={() => handleDelete(playlist.id)}
                    loading={isDeleting === playlist.id}
                  >
                    <Trash2 size={16} />
                  </Button>
                </HStack>
              </Grid>
            ))}
          </>
        )}
      </Box>
    </Box>
  );
};