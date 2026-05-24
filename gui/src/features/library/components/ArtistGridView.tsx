import React, { useState, useEffect } from 'react';
import { Box, Flex, Heading, Text, SimpleGrid, Spinner, VStack, Icon, Image } from '@chakra-ui/react';
import { Users, User, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { useSearchStore } from '../../../store/useSearchStore';
import { usePlayer } from '../../../context/PlayerContext';
import { toaster } from '../../../components/ui/toaster';

export const ArtistGridView: React.FC = () => {
  const navigate = useNavigate();
  const { globalSearch } = useSearchStore();
  
  const { playTrack } = usePlayer();
  
  const [artists, setArtists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [loadingArtistId, setLoadingArtistId] = useState<number | null>(null);

  useEffect(() => {
    const fetchArtists = async () => {
      setIsLoading(true);
      try {
        const data = await api.getArtists(); 
        setArtists(data || []);
      } catch (error) {
        console.error("Error loading artists:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchArtists();
  }, []);

  const handlePlayArtist = async (e: React.MouseEvent, artist: any) => {
    e.stopPropagation();
    setLoadingArtistId(artist.id);

    try {
      // Reuse your existing getTracks endpoint to find all tracks by this artist
      const response = await api.getTracks({ search: artist.name, limit: 100 }); 
      const tracks = response.data || [];

      if (tracks.length > 0) {
        playTrack(tracks[0], tracks);
      } else {
        toaster.create({ title: "No tracks found for this artist", type: "warning" });
      }
    } catch (error) {
      console.error("Failed to load artist tracks", error);
      toaster.create({ title: "Failed to play artist", type: "error" });
    } finally {
      setLoadingArtistId(null);
    }
  };

  const filteredArtists = artists.filter(a => 
    a.name && a.name.toLowerCase().includes(globalSearch.toLowerCase())
  );

  return (
    <Box w="full" h="100%" overflowY="auto" pt={2} pb={10} animation="fade-in 0.4s ease-out">
      <Text fontSize="sm" color="gray.500" mb={4}>{artists.length} artists in your collection</Text>

      {isLoading ? (
        <Flex justify="center" align="center" h="40vh"><Spinner size="xl" color="blue.500" borderWidth="3px" /></Flex>
      ) : filteredArtists.length === 0 ? (
        <VStack justify="center" py={24} bg="gray.50" borderRadius="3xl" border="1px dashed" borderColor="gray.200">
          <Box p={6} bg="white" borderRadius="full" mb={2} shadow="sm">
            <Icon as={Users} boxSize={12} color="gray.400" />
          </Box>
          <Heading size="md" color="gray.800">No Artists Found</Heading>
        </VStack>
      ) : (
        <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5, xl: 6 }} gap={6} px={1}>
          {filteredArtists.map((artist) => {
            // Check common fields where your backend might store the image URL
            const imageUrl = artist.image_url || artist.picture_url || artist.cover_url;

            return (
              <VStack 
                key={artist.id} 
                className="group" 
                cursor="pointer" 
                onClick={() => navigate(`/library/artists/${artist.id}`, { state: { activeTab: 'artists' } })}
                gap={3}
              >
                {/* Circular Avatar for Artists */}
                <Box 
                  w="100%" pb="100%" position="relative" borderRadius="full" overflow="hidden" 
                  shadow="sm" bg="gray.100" border="1px solid" borderColor="gray.200" 
                  transition="transform 0.2s" _groupHover={{ transform: "scale(1.05)", shadow: "md" }}
                >
                  {imageUrl ? (
                    <Image 
                      src={imageUrl} 
                      alt={artist.name} 
                      position="absolute" top={0} left={0} w="100%" h="100%" objectFit="cover"
                    />
                  ) : (
                    <Flex position="absolute" inset={0} align="center" justify="center">
                      {/* ⚡️ CHANGED FROM MIC TO USER */}
                      <Icon as={User} boxSize={12} color="gray.300" />
                    </Flex>
                  )}

                  {/* ⚡️ HOVER OVERLAY WITH PLAY BUTTON */}
                  <Flex 
                    position="absolute" inset={0} bg="blackAlpha.400" opacity={0} 
                    _groupHover={{ opacity: 1 }} transition="opacity 0.2s" 
                    align="center" justify="center"
                  >
                    <Flex 
                      w="48px" h="48px" bg="white" borderRadius="full" align="center" justify="center"
                      transform="translateY(10px)" _groupHover={{ transform: "translateY(0)" }} transition="all 0.2s"
                      shadow="lg" _hover={{ scale: 1.1 }}
                      onClick={(e) => handlePlayArtist(e, artist)}
                    >
                      {loadingArtistId === artist.id ? (
                        <Spinner size="sm" color="blue.500" />
                      ) : (
                        <Icon as={Play} boxSize={5} color="gray.900" fill="currentColor" ml="2px" />
                      )}
                    </Flex>
                  </Flex>
                </Box>
                
                <VStack align="center" gap={0} w="100%">
                  <Text fontSize="md" fontWeight="700" color="gray.900" truncate w="100%" textAlign="center">
                    {artist.name}
                  </Text>
                  {artist.artist_country && (
                    <Text fontSize="xs" fontWeight="500" color="gray.500" truncate w="100%" textAlign="center">
                      {artist.artist_country}
                    </Text>
                  )}
                </VStack>
              </VStack>
            );
          })}
        </SimpleGrid>
      )}
    </Box>
  );
};