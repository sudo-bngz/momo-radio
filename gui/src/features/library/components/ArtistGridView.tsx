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
      {/* ⚡️ Semantic foreground muted text */}
      <Text fontSize="sm" color="fg.muted" mb={4}>{artists.length} artists in your collection</Text>

      {isLoading ? (
        <Flex justify="center" align="center" h="40vh">
          <Spinner size="xl" color="blue.500" _dark={{ color: "blue.400" }} borderWidth="3px" />
        </Flex>
      ) : filteredArtists.length === 0 ? (
        // ⚡️ Empty state semantic adaptation
        <VStack justify="center" py={24} bg="bg.panel" borderRadius="3xl" border="1px dashed" borderColor="border">
          <Box p={6} bg="bg" borderRadius="full" mb={2} shadow="sm" border="1px solid" borderColor="border">
            <Icon as={Users} boxSize={12} color="fg.muted" />
          </Box>
          <Heading size="md" color="fg">No Artists Found</Heading>
        </VStack>
      ) : (
        <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5, xl: 6 }} gap={6} px={1}>
          {filteredArtists.map((artist) => {
            const imageUrl = artist.image_url || artist.picture_url || artist.cover_url;

            return (
              <VStack 
                key={artist.id} 
                className="group" 
                cursor="pointer" 
                onClick={() => navigate(`/artists/${artist.id}`)}
                gap={3}
              >
                <Box 
                  w="100%" pb="100%" position="relative" borderRadius="full" overflow="hidden" shadow="sm" 
                  bg="gray.100" border="1px solid" borderColor="border" 
                  // ⚡️ Combined _dark properties into a single object for the avatar container
                  _dark={{ bg: "whiteAlpha.200", borderColor: "whiteAlpha.200" }}
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
                      <Icon as={User} boxSize={12} color="fg.muted" />
                    </Flex>
                  )}

                  <Flex 
                    position="absolute" inset={0} bg="blackAlpha.400" opacity={0} 
                    _groupHover={{ opacity: 1 }} transition="opacity 0.2s" 
                    align="center" justify="center"
                  >
                    {/* ⚡️ Play button transitions correctly in dark mode */}
                    <Flex 
                      w="48px" h="48px" bg="white" color="gray.900" borderRadius="full" align="center" justify="center"
                      _dark={{ bg: "blue.500", color: "white" }}
                      transform="translateY(10px)" _groupHover={{ transform: "translateY(0)" }} transition="all 0.2s"
                      shadow="lg" _hover={{ scale: 1.1, _dark: { bg: "blue.400" } }}
                      onClick={(e) => handlePlayArtist(e, artist)}
                    >
                      {loadingArtistId === artist.id ? (
                        <Spinner size="sm" color="inherit" />
                      ) : (
                        <Icon as={Play} boxSize={5} fill="currentColor" ml="2px" />
                      )}
                    </Flex>
                  </Flex>
                </Box>
                
                <VStack align="center" gap={0} w="100%">
                  {/* ⚡️ Semantic text colors for metadata */}
                  <Text fontSize="md" fontWeight="700" color="fg" truncate w="100%" textAlign="center">
                    {artist.name}
                  </Text>
                  {artist.artist_country && (
                    <Text fontSize="xs" fontWeight="500" color="fg.muted" truncate w="100%" textAlign="center">
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