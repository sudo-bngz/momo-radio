import React, { useState, useEffect } from 'react';
import { Box, Flex, Heading, Text, Spinner, VStack, HStack, Icon, IconButton, Grid } from '@chakra-ui/react';
import { Play, Share, Mic, Disc } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';

interface ArtistDetailViewProps {
  id?: string;
  onArtistLoad?: (title: string) => void;
}

export const ArtistDetailView: React.FC<ArtistDetailViewProps> = ({ id: propId, onArtistLoad }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId || paramId; 
  const navigate = useNavigate();

  const [artist, setArtist] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchArtist = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const data = await api.getArtist(id);
        setArtist(data);
        if (onArtistLoad) onArtistLoad(data.name);
      } catch (error) {
        console.error("Error loading artist details:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchArtist();
  }, [id, onArtistLoad]);

  const handlePlayArtist = () => console.log("▶️ Playing artist radio:", artist?.name);

  if (isLoading) return <Flex justify="center" align="center" h="40vh"><Spinner size="xl" color="blue.500" /></Flex>;
  if (!artist) return <Flex justify="center" align="center" h="40vh"><Text color="gray.500">Artist not found</Text></Flex>;

  const formatTime = (seconds: number) => {
    if (!seconds) return "-";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Box w="full" h="100%" overflowY="auto" pt={2} pb={20} bg="white" color="gray.900">
      
      <Heading size="xl" fontWeight="700" mb={6} letterSpacing="tight">
        {artist.name}
      </Heading>

      <Flex gap={8} flexDir={{ base: "column", md: "row" }} mb={10} align="flex-start">
        
        {/* LEFT COLUMN: ARTWORK & ACTIONS */}
        <Box w={{ base: "100%", md: "250px", lg: "300px" }} flexShrink={0}>
          <Box w="100%" pb="100%" position="relative" border="1px solid" borderColor="gray.200" bg="gray.50" mb={4} borderRadius="md">
            <Flex position="absolute" inset={0} align="center" justify="center">
              <Icon as={Mic} boxSize={20} color="gray.300" />
            </Flex>
          </Box>

          <HStack gap={2} w="100%">
            <IconButton aria-label="Play Artist" onClick={handlePlayArtist} flex="1" bg="gray.900" color="white" _hover={{ bg: "black" }} borderRadius="sm">
              <Play fill="currentColor" size={20} />
            </IconButton>
            <IconButton aria-label="Share" onClick={() => console.log("Share")} flex="1" border="1px solid" borderColor="gray.200" bg="white" color="gray.700" _hover={{ bg: "gray.50" }} borderRadius="sm">
              <Share size={20} />
            </IconButton>
          </HStack>
        </Box>

        {/* RIGHT COLUMN: METADATA GRID */}
        <VStack align="flex-start" flex="1" gap={1} fontSize="sm">
          <Grid templateColumns="100px 1fr" gap={2} w="full" rowGap={2}>
            
            <Text fontWeight="600" color="gray.600">Profile:</Text>
            <Text color="gray.900">Musician / DJ / Producer</Text>

            {artist.artist_country && (
              <>
                <Text fontWeight="600" color="gray.600">Country:</Text>
                <Text color="blue.600" cursor="pointer" _hover={{ textDecoration: "underline" }}>
                  {artist.artist_country}
                </Text>
              </>
            )}

            <Text fontWeight="600" color="gray.600">In Library:</Text>
            <Text color="gray.900">
              {artist.albums?.length || 0} Albums, {artist.tracks?.length || 0} Tracks
            </Text>

          </Grid>
        </VStack>
      </Flex>

      {/* TRACKLIST / DISCOGRAPHY */}
      <Box w="full">
        <HStack justify="space-between" borderBottom="2px solid" borderColor="gray.200" pb={2} mb={2}>
          <Heading size="md" fontWeight="700">Appears On (Library Tracks)</Heading>
        </HStack>

        <VStack align="stretch" gap={0}>
          {artist.tracks?.map((track: any, index: number) => (
            <HStack 
              key={track.id} className="group" px={2} py={3} borderBottom="1px solid" borderColor="gray.100" _hover={{ bg: "gray.50" }} gap={4}
            >
              <Box w="30px" textAlign="left" color="gray.500" fontSize="sm" fontWeight="600">
                <Box as="span" display="block" _groupHover={{ display: "none" }}>{index + 1}</Box>
                <Icon as={Play} fill="currentColor" boxSize={4} color="gray.900" display="none" _groupHover={{ display: "block" }} cursor="pointer" />
              </Box>

              {/* Added Album Title context for Artist view */}
              <Box flex="1" overflow="hidden">
                <Text fontSize="sm" fontWeight="500" color="gray.900" truncate>{track.title}</Text>
                {track.album && (
                  <HStack fontSize="xs" color="gray.500" mt={0.5} gap={1} cursor="pointer" _hover={{ color: "blue.600", textDecoration: "underline" }} onClick={() => navigate(`/library/albums/${track.album.id}`, { state: { activeTab: 'albums' } })}>
                    <Icon as={Disc} boxSize={3} />
                    <Text truncate>{track.album.title}</Text>
                  </HStack>
                )}
              </Box>

              <HStack gap={6} color="gray.500" fontSize="xs">
                <Text display={{ base: "none", sm: "block" }} w="40px" textAlign="right">
                  {track.bpm > 0 ? Math.round(track.bpm) : ""}
                </Text>
                <Text display={{ base: "none", sm: "block" }} w="40px" textAlign="right">
                  {track.musical_key ? `${track.musical_key}${track.scale === 'minor' ? 'm' : ''}` : ""}
                </Text>
                <Text w="40px" textAlign="right" fontWeight="500" color="gray.700">
                  {formatTime(track.duration)}
                </Text>
              </HStack>
            </HStack>
          ))}
        </VStack>
      </Box>

    </Box>
  );
};