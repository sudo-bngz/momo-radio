import React, { useState, useEffect } from 'react';
import { Box, Flex, Heading, Text, SimpleGrid, Spinner, VStack, Icon } from '@chakra-ui/react';
import { Users, Mic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { useSearchStore } from '../../../store/useSearchStore';

export const ArtistGridView: React.FC = () => {
  const navigate = useNavigate();
  const { globalSearch } = useSearchStore();
  
  const [artists, setArtists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const filteredArtists = artists.filter(a => 
    a.name && a.name.toLowerCase().includes(globalSearch.toLowerCase())
  );

  return (
    <Box w="full" h="100%" overflowY="auto" pt={2} pb={10}>
      <Text fontSize="sm" color="gray.500" mb={4}>{artists.length} artists in your collection</Text>

      {isLoading ? (
        <Flex justify="center" align="center" h="40vh"><Spinner size="xl" color="blue.500" /></Flex>
      ) : filteredArtists.length === 0 ? (
        <VStack justify="center" py={24} bg="gray.50" borderRadius="3xl" border="1px dashed" borderColor="gray.200">
          <Box p={6} bg="white" borderRadius="full" mb={2} shadow="sm">
            <Icon as={Users} boxSize={12} color="gray.400" />
          </Box>
          <Heading size="md" color="gray.800">No Artists Found</Heading>
        </VStack>
      ) : (
        <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5, xl: 6 }} gap={6} px={1}>
          {filteredArtists.map((artist) => (
            <VStack 
              key={artist.id} 
              className="group" 
              cursor="pointer" 
              onClick={() => navigate(`/library/artists/${artist.id}`, { state: { activeTab: 'artists' } })}
              gap={3}
            >
              {/* Circular Avatar for Artists */}
              <Box w="100%" pb="100%" position="relative" borderRadius="full" overflow="hidden" shadow="sm" bg="gray.100" border="1px solid" borderColor="gray.200" transition="transform 0.2s" _groupHover={{ transform: "scale(1.05)", shadow: "md" }}>
                <Flex position="absolute" inset={0} align="center" justify="center">
                  <Icon as={Mic} boxSize={12} color="gray.300" />
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
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
};