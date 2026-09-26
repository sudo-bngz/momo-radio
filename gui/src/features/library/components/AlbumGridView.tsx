import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, Heading, Text, SimpleGrid, Image, Spinner, VStack, Icon 
} from '@chakra-ui/react';
import { Disc3, Play, Music } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { useSearchStore } from '../../../store/useSearchStore';
import { usePlayer } from '../../../context/PlayerContext';
import { toaster } from '../../../components/ui/toaster';

export const AlbumGridView: React.FC = () => {
  const navigate = useNavigate();
  const { globalSearch } = useSearchStore();
  
  const { playTrack } = usePlayer();
  
  const [albums, setAlbums] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingAlbumId, setLoadingAlbumId] = useState<number | null>(null);

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

  const handlePlayAlbum = async (e: React.MouseEvent, albumId: number) => {
    e.stopPropagation(); 
    setLoadingAlbumId(albumId);

    try {
      const response = await api.getAlbumTracks(albumId); 
      const tracks = response.data || response || [];

      if (tracks.length > 0) {
        playTrack(tracks[0], tracks);
      } else {
        toaster.create({ title: "This album is empty", type: "warning" });
      }
    } catch (error) {
      console.error("Failed to load album tracks", error);
      toaster.create({ title: "Failed to play album", type: "error" });
    } finally {
      setLoadingAlbumId(null);
    }
  };

  const filteredAlbums = albums.filter(a => {
    const matchesTitle = a.title && a.title.toLowerCase().includes(globalSearch.toLowerCase());
    const matchesArtist = a.artists && a.artists.some((artist: any) => 
      artist.name && artist.name.toLowerCase().includes(globalSearch.toLowerCase())
    );
    return matchesTitle || matchesArtist;
  });

  return (
    <Box 
      w="full" h="100%" overflowY="auto" pt={2} pb={10} animation="fade-in 0.4s ease-out"
      // ⚡️ Inherit dark background natively and use dynamic border token for the scrollbar thumb
      bg="transparent"
      css={{
        '&::-webkit-scrollbar': { width: '8px' },
        '&::-webkit-scrollbar-thumb': { background: 'var(--chakra-colors-border)', borderRadius: '4px' },
      }}
    >
      <Text fontSize="sm" color="fg.muted" mb={4}>
        {albums.length} albums in your collection
      </Text>

      {isLoading ? (
        <Flex justify="center" align="center" h="40vh"><Spinner size="xl" color="blue.500" _dark={{ color: "blue.400" }} borderWidth="3px" /></Flex>
      ) : filteredAlbums.length === 0 ? (
        // ⚡️ Semantic tokens for the Empty State
        <VStack justify="center" py={24} bg="bg.panel" borderRadius="3xl" border="1px dashed" borderColor="border">
          <Box p={6} bg="bg" borderRadius="full" mb={2} shadow="sm" border="1px solid" borderColor="border">
            <Icon as={Disc3} boxSize={12} color="fg.muted" />
          </Box>
          <Heading size="md" color="fg">No Albums Found</Heading>
          <Text fontSize="sm" color="fg.muted">
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
                onClick={() => navigate(`/library/albums/${album.id}`)}
              >
                {/* Square Image Container */}
                {/* ⚡️ _dark fallback background if cover image fails/is missing */}
                <Box position="relative" w="100%" pb="100%" mb={3} borderRadius="md" overflow="hidden" shadow="sm" bg="gray.100" _dark={{ bg: "whiteAlpha.200" }}>
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
                      <Icon as={Music} boxSize={10} color="fg.muted" />
                    </Flex>
                  )}
                  
                  {/* Hover Overlay with Play Button */}
                  <Flex 
                    position="absolute" inset={0} bg="blackAlpha.400" opacity={0} 
                    _groupHover={{ opacity: 1 }} transition="opacity 0.2s" 
                    align="center" justify="center"
                  >
                    {/* ⚡️ Play button transitions to blue in dark mode for better pop */}
                    <Flex 
                      w="48px" h="48px" bg="white" color="gray.900" _dark={{ bg: "blue.500", color: "white" }} borderRadius="full" align="center" justify="center"
                      transform="translateY(10px)" _groupHover={{ transform: "translateY(0)" }} transition="all 0.2s"
                      shadow="lg" _hover={{ scale: 1.1, _dark: { bg: "blue.400" } }}
                      onClick={(e) => handlePlayAlbum(e, album.id)}
                    >
                      {loadingAlbumId === album.id ? (
                        <Spinner size="sm" color="inherit" />
                      ) : (
                        <Icon as={Play} boxSize={5} fill="currentColor" ml="2px" />
                      )}
                    </Flex>
                  </Flex>
                </Box>

                {/* Metadata */}
                <VStack align="start" gap={0}>
                  {/* ⚡️ Semantic foreground tokens */}
                  <Text fontSize="sm" fontWeight="700" color="fg" truncate w="100%">
                    {album.title}
                  </Text>
                  <Text fontSize="xs" fontWeight="500" color="fg.muted" truncate w="100%">
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