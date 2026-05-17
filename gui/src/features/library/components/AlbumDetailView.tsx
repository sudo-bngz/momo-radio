import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, Heading, Text, Image, Spinner, VStack, HStack, Icon, IconButton, Grid 
} from '@chakra-ui/react';
import { Play, Download, Disc } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { api } from '../../../services/api';

interface AlbumDetailViewProps {
  id?: string;
  onAlbumLoad?: (title: string) => void;
}

export const AlbumDetailView: React.FC<AlbumDetailViewProps> = ({ id: propId, onAlbumLoad }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId || paramId; 

  const [album, setAlbum] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAlbum = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const data = await api.getAlbum(id);
        setAlbum(data);
        if (onAlbumLoad) {
          onAlbumLoad(data.title);
        }
      } catch (error) {
        console.error("Error loading album details:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAlbum();
  }, [id, onAlbumLoad]);

  const handlePlayAlbum = () => console.log("▶️ Playing entire album:", album?.title);
  const handlePlayTrack = (e: React.MouseEvent, track: any) => {
    e.stopPropagation();
    console.log("▶️ Playing track:", track.title);
  };

  if (isLoading) {
    return <Flex justify="center" align="center" h="40vh"><Spinner size="xl" color="blue.500" /></Flex>;
  }

  if (!album) {
    return <Flex justify="center" align="center" h="40vh"><Text color="gray.500">Album not found</Text></Flex>;
  }

  // Fallback for tracks that might not have artist data yet
  const albumArtistString = album.artists && album.artists.length > 0 
    ? album.artists.map((a: any) => a.name).join(', ') 
    : "Unknown Artist";

  const coverUrl = album.cover_url || album.artwork_url;
  
  const formatTime = (seconds: number) => {
    if (!seconds) return "-";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const uniqueTags = Array.from(new Set(
    album.tracks?.flatMap((track: any) => {
      const tags: string[] = [];
      if (track.genre) tags.push(...track.genre.split(',').map((g: string) => g.trim()));
      if (track.style) tags.push(...track.style.split(',').map((s: string) => s.trim()));
      return tags;
    }) || []
  )).filter(Boolean);

  return (
    <Box w="full" h="100%" overflowY="auto" pt={2} pb={20} bg="white" color="gray.900">
      
      <Flex gap={8} flexDir={{ base: "column", md: "row" }} mb={10} align="flex-start">
        
        {/* =========================================
            1. LEFT COLUMN: ARTWORK & ACTIONS
            ========================================= */}
        <Box w={{ base: "100%", md: "250px", lg: "300px" }} flexShrink={0}>
          <Box w="100%" pb="100%" position="relative" border="1px solid" borderColor="gray.200" bg="gray.50" mb={4}>
            {coverUrl ? (
              <Image src={coverUrl} alt={album.title} position="absolute" inset={0} w="100%" h="100%" objectFit="cover" />
            ) : (
              <Flex position="absolute" inset={0} align="center" justify="center">
                <Icon as={Disc} boxSize={16} color="gray.300" />
              </Flex>
            )}
          </Box>

          {/* ⚡️ FIXED: Action Buttons reduced to icons only */}
          <HStack gap={2} w="100%">
            <IconButton aria-label="Play Album" onClick={handlePlayAlbum} flex="1" bg="gray.900" color="white" _hover={{ bg: "black" }} borderRadius="sm">
              <Play fill="currentColor" size={20} />
            </IconButton>
            <IconButton aria-label="Download" onClick={() => console.log("Download")} flex="1" border="1px solid" borderColor="gray.200" bg="white" color="gray.700" _hover={{ bg: "gray.50" }} borderRadius="sm">
              <Download size={20} />
            </IconButton>
          </HStack>
        </Box>

        {/* =========================================
            2. RIGHT COLUMN: METADATA GRID
            ========================================= */}
        <VStack align="flex-start" flex="1" gap={1} fontSize="sm">
          <Grid templateColumns="100px 1fr" gap={2} w="full" rowGap={1}>
            
            {/* ⚡️ FIXED: Distinct Multiple Artist Links */}
            <Text fontWeight="600" color="gray.600">Artist:</Text>
            <Box>
              {album.artists && album.artists.length > 0 ? (
                album.artists.map((artist: any, i: number) => (
                  <React.Fragment key={artist.id || i}>
                    <Text as="span" color="blue.600" cursor="pointer" fontWeight="500" _hover={{ textDecoration: "underline" }}>
                      {artist.name}
                    </Text>
                    {i < album.artists.length - 1 && ", "}
                  </React.Fragment>
                ))
              ) : (
                <Text color="gray.900">Unknown Artist</Text>
              )}
            </Box>

            {/* ⚡️ FIXED: Title moved to grid */}
            <Text fontWeight="600" color="gray.600">Title:</Text>
            <Text color="gray.900" fontWeight="500">{album.title}</Text>

            <Text fontWeight="600" color="gray.600">Label:</Text>
            {album.publisher ? (
              <Text color="blue.600" cursor="pointer" _hover={{ textDecoration: "underline" }}>
                {album.publisher} {album.catalog_number ? `– ${album.catalog_number}` : ''}
              </Text>
            ) : (
              <Text color="gray.900">{album.catalog_number || "Unknown"}</Text>
            )}

            <Text fontWeight="600" color="gray.600">Format:</Text>
            <Text color="gray.900">Digital, High-Quality File</Text>

            <Text fontWeight="600" color="gray.600">Country:</Text>
            <Text color="blue.600" cursor="pointer" _hover={{ textDecoration: "underline" }}>
              {album.release_country || "Unknown"}
            </Text>

            <Text fontWeight="600" color="gray.600">Released:</Text>
            <Text color="blue.600" cursor="pointer" _hover={{ textDecoration: "underline" }}>
              {album.year || "Unknown"}
            </Text>

            {uniqueTags.length > 0 && (
              <>
                <Text fontWeight="600" color="gray.600">Style:</Text>
                <Text color="blue.600" cursor="pointer">
                  {uniqueTags.map((tag, i) => (
                    <React.Fragment key={i}>
                      <Text as="span" _hover={{ textDecoration: "underline" }}>{tag as string}</Text>
                      {i < uniqueTags.length - 1 && ", "}
                    </React.Fragment>
                  ))}
                </Text>
              </>
            )}
          </Grid>
        </VStack>
      </Flex>

      {/* =========================================
          3. TRACKLIST (Full Width Bottom)
          ========================================= */}
      <Box w="full">
        <HStack justify="space-between" borderBottom="2px solid" borderColor="gray.200" pb={2} mb={2}>
          <Heading size="md" fontWeight="700">Tracklist</Heading>
        </HStack>

        <VStack align="stretch" gap={0}>
          {album.tracks?.map((track: any, index: number) => {
            const trackArtistString = track.artists?.map((a: any) => a.name).join(', ') || albumArtistString;
            const isVariousArtists = trackArtistString !== albumArtistString;
            
            return (
              <HStack 
                key={track.id} 
                className="group"
                px={2} py={2}
                borderBottom="1px solid" borderColor="gray.100"
                _hover={{ bg: "gray.50" }}
                gap={4}
              >
                <Box w="30px" textAlign="left" color="gray.500" fontSize="sm" fontWeight="600">
                  <Box as="span" display="block" _groupHover={{ display: "none" }}>{index + 1}</Box>
                  <Icon 
                    as={Play} fill="currentColor" boxSize={4} color="gray.900" 
                    display="none" _groupHover={{ display: "block" }} 
                    cursor="pointer" onClick={(e) => handlePlayTrack(e, track)}
                  />
                </Box>

                <Box flex="1" overflow="hidden">
                  <Text fontSize="sm" fontWeight="500" color="gray.900" truncate>{track.title}</Text>
                  
                  {isVariousArtists && (
                    <Box fontSize="xs" color="gray.500" truncate mt={0.5}>
                      Performer – {track.artists?.map((artist: any, i: number) => (
                        <React.Fragment key={artist.id || i}>
                          <Text as="span" color="blue.600" cursor="pointer" _hover={{ textDecoration: "underline" }}>
                            {artist.name}
                          </Text>
                          {i < track.artists.length - 1 && ", "}
                        </React.Fragment>
                      ))}
                    </Box>
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
            );
          })}
        </VStack>
      </Box>

    </Box>
  );
};