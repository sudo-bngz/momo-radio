import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, Heading, Text, SimpleGrid, Image, Spinner, VStack, Icon 
} from '@chakra-ui/react';
import { Disc3, Play, Music } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { useSearchStore } from '../../../store/useSearchStore';

export const AlbumGridView: React.FC = () => {
  const navigate = useNavigate();
  const { globalSearch } = useSearchStore();
  
  const [albums, setAlbums] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAlbums = async () => {
      setIsLoading(true);
      try {
        const response = await api.getAlbums(); 
        setAlbums(response.data || response || []);
      } catch (error) {
        console.error("Error loading albums:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlbums();
  }, []);

  const filteredAlbums = albums.filter(a => {
    const matchesTitle = a.title && a.title.toLowerCase().includes(globalSearch.toLowerCase());
    const matchesArtist = a.artists && a.artists.some((artist: any) => 
      artist.name && artist.name.toLowerCase().includes(globalSearch.toLowerCase())
    );
    return matchesTitle || matchesArtist;
  });

  return (
    <Box w="full" h="100%" overflowY="auto" pt={2} pb={10} animation="fade-in 0.4s ease-out"
      css={{
        '&::-webkit-scrollbar': { width: '8px' },
        '&::-webkit-scrollbar-thumb': { background: 'var(--chakra-colors-gray-200)', borderRadius: '4px' },
      }}
    >
      <Text fontSize="sm" color="gray.500" mb={4}>
        {albums.length} albums in your collection
      </Text>

      {isLoading ? (
        <Flex justify="center" align="center" h="40vh"><Spinner size="xl" color="blue.500" borderWidth="3px" /></Flex>
      ) : filteredAlbums.length === 0 ? (
        <VStack justify="center" py={24} bg="gray.50" borderRadius="3xl" border="1px dashed" borderColor="gray.200">
          <Box p={6} bg="white" borderRadius="full" mb={2} shadow="sm">
            <Icon as={Disc3} boxSize={12} color="gray.400" />
          </Box>
          <Heading size="md" color="gray.800">No Albums Found</Heading>
          <Text fontSize="sm" color="gray.500">
            {globalSearch ? "Try adjusting your search terms." : "Upload tracks to start building your album library."}
          </Text>
        </VStack>
      ) : (
        <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5, xl: 6, "2xl": 7 }} gap={6} px={1}>
          {filteredAlbums.map((album) => {
            const coverUrl = album.cover_url || album.artwork_url;
            
            const artistName = album.artists && album.artists.length > 0 
              ? album.artists.map((a: any) => a.name).join(', ') 
              : "Unknown Artist";

            const year = album.year ? ` • ${album.year}` : "";
            const type = album.type || "Album";

            return (
              <Box 
                key={album.id} 
                className="group" 
                cursor="pointer" 
                onClick={() => navigate(`/albums/${encodeURIComponent(album.title)}`)}
              >
                {/* Square Image Container */}
                <Box position="relative" w="100%" pb="100%" mb={3} borderRadius="md" overflow="hidden" shadow="sm" bg="gray.100">
                  {coverUrl ? (
                    <Image 
                      src={coverUrl} 
                      alt={album.title} 
                      position="absolute" top={0} left={0} w="100%" h="100%" objectFit="cover"
                      transition="transform 0.3s ease"
                      _groupHover={{ transform: "scale(1.05)" }}
                    />
                  ) : (
                    <Flex position="absolute" inset={0} align="center" justify="center">
                      <Icon as={Music} boxSize={10} color="gray.300" />
                    </Flex>
                  )}
                  
                  {/* Hover Overlay with Play Button */}
                  <Flex 
                    position="absolute" inset={0} bg="blackAlpha.400" opacity={0} 
                    _groupHover={{ opacity: 1 }} transition="opacity 0.2s" 
                    align="center" justify="center"
                  >
                    <Flex 
                      w="48px" h="48px" bg="white" borderRadius="full" align="center" justify="center"
                      transform="translateY(10px)" _groupHover={{ transform: "translateY(0)" }} transition="all 0.2s"
                      shadow="lg" _hover={{ scale: 1.1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Add play album logic here
                      }}
                    >
                      <Icon as={Play} boxSize={5} color="gray.900" fill="currentColor" ml="2px" />
                    </Flex>
                  </Flex>
                </Box>

                {/* Metadata */}
                <VStack align="start" gap={0}>
                  <Text fontSize="sm" fontWeight="700" color="gray.900" truncate w="100%">
                    {album.title}
                  </Text>
                  <Text fontSize="xs" fontWeight="500" color="gray.500" truncate w="100%">
                    {type} • {artistName}{year}
                  </Text>
                </VStack>
              </Box>
            );
          })}
        </SimpleGrid>
      )}
    </Box>
  );
};