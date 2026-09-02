import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, Heading, Text, Image, Spinner, VStack, HStack, Icon, IconButton 
} from '@chakra-ui/react';
import { Play, Pause, Disc } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { usePlayer } from '../../../context/PlayerContext';

interface AlbumDetailViewProps {
  id?: string;
  onAlbumLoad?: (title: string) => void;
}

export const AlbumDetailView: React.FC<AlbumDetailViewProps> = ({ id: propId, onAlbumLoad }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId || paramId; 
  const navigate = useNavigate();

  const [album, setAlbum] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayer();

  useEffect(() => {
    const fetchAlbum = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const data = await api.getAlbum(id);
        setAlbum(data);
        if (onAlbumLoad) onAlbumLoad(data.title);
      } catch (error) {
        console.error("Error loading album details:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAlbum();
  }, [id, onAlbumLoad]);

  // --- Playback Handlers ---
  const isAlbumPlaying = album?.tracks?.some((t: any) => t.id === currentTrack?.id) && isPlaying;

  // Helper to attach the album cover to the tracks so the Global Player looks good!
  const getPlayableTracks = () => {
    return album.tracks.map((t: any) => ({
      ...t,
      cover_url: coverUrl,
      album: { title: album.title } // Inject album title for the player UI
    }));
  };

  const handlePlayAlbum = () => {
    if (!album?.tracks || album.tracks.length === 0) return;
    
    if (isAlbumPlaying) {
      togglePlayPause();
    } else {
      const playableTracks = getPlayableTracks();
      const trackToPlay = playableTracks.find((t: any) => t.id === currentTrack?.id) || playableTracks[0];
      playTrack(trackToPlay, playableTracks);
    }
  };

  const handlePlayTrack = (e: React.MouseEvent, track: any) => {
    e.stopPropagation();
    if (currentTrack?.id === track.id) {
      togglePlayPause();
    } else {
      const playableTracks = getPlayableTracks();
      const trackToPlay = playableTracks.find((t: any) => t.id === track.id);
      playTrack(trackToPlay, playableTracks);
    }
  };

  if (isLoading) {
    return <Flex justify="center" align="center" h="40vh"><Spinner size="xl" color="blue.500" /></Flex>;
  }

  if (!album) {
    return <Flex justify="center" align="center" h="40vh"><Text color="gray.500">Album not found</Text></Flex>;
  }

  const coverUrl = imgError ? '' : album.cover_url;

  const totalSeconds = album.tracks?.reduce((acc: number, t: any) => acc + (t.duration || 0), 0) || 0;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const remainderSeconds = Math.floor(totalSeconds % 60);

  const uniqueTags = Array.from(new Set(
    album.tracks?.flatMap((track: any) => {
      const tags: string[] = [];
      if (track.genre) tags.push(...track.genre.split(',').map((g: string) => g.trim()));
      if (track.style) tags.push(...track.style.split(',').map((s: string) => s.trim()));
      return tags;
    }) || []
  )).filter(Boolean);

  const formatTime = (seconds: number) => {
    if (!seconds) return "-";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const albumArtistString = album.artists && album.artists.length > 0 
    ? album.artists.map((a: any) => a.name).join(', ') 
    : "Unknown Artist";

  return (
    <Box w="full" h="100%" overflowY="auto" pt={6} pb={20} bg="white" color="gray.900">
      
      {/* 1. HEADER SECTION */}
      <Flex gap={8} mb={10} align="center" flexDir={{ base: "column", sm: "row" }} px={{ base: 4, md: 0 }}>
        
        <Box position="relative" w={{ base: "100%", sm: "200px" }} maxW="300px" aspectRatio={1} flexShrink={0}>
          <Box w="100%" h="100%" borderRadius="lg" overflow="hidden" bg="gray.100" border="1px solid" borderColor="gray.200" shadow="sm">
            {coverUrl ? (
              <Image 
                src={coverUrl} 
                alt={album.title} 
                w="100%" h="100%" objectFit="cover" 
                onError={() => setImgError(true)}
              />
            ) : (
              <Flex w="100%" h="100%" align="center" justify="center">
                <Icon as={Disc} boxSize={16} color="gray.300" strokeWidth={1} />
              </Flex>
            )}
          </Box>
          
          <IconButton 
            aria-label={isAlbumPlaying ? "Pause Album" : "Play Album"}
            position="absolute"
            bottom="-4"
            right="-4"
            borderRadius="full"
            w="56px"
            h="56px"
            bg="blue.500"
            color="white"
            _hover={{ bg: "blue.600", transform: "scale(1.05)" }}
            _active={{ transform: "scale(0.95)" }}
            shadow="lg"
            border="4px solid white"
            onClick={handlePlayAlbum}
            zIndex={2}
          >
            <Icon as={isAlbumPlaying ? Pause : Play} boxSize={6} ml={isAlbumPlaying ? 0 : 1} fill="currentColor" />
          </IconButton>
        </Box>

        {/* Text Metadata */}
        <VStack align="flex-start" justify="center" flex="1" gap={3}>
          <Heading size="2xl" fontWeight="700" letterSpacing="tight" color="gray.900" lineHeight="1.1">
            {album.title}
          </Heading>
          
          <HStack color="gray.500" fontSize="sm" fontWeight="500" gap={2} flexWrap="wrap">
            <Text color="gray.900" fontWeight="600">
              {album.artists && album.artists.length > 0 ? (
                album.artists.map((artist: any, i: number) => (
                  <React.Fragment key={artist.id || i}>
                    <Text as="span" cursor="pointer" _hover={{ textDecoration: "underline" }} onClick={() => navigate(`/artists/${encodeURIComponent(artist.name)}`)}>
                      {artist.name}
                    </Text>
                    {i < album.artists.length - 1 && ", "}
                  </React.Fragment>
                ))
              ) : (
                "Unknown Artist"
              )}
            </Text>
            {/* ⚡️ Added Year explicitly in the stats row */}
            <Text>•</Text>
            <Text>{album.year || 'Unknown Year'}</Text>
            <Text>•</Text>
            <Text>{album.tracks?.length || 0} Tracks</Text>
            <Text>•</Text>
            <Text>{totalMinutes} min {remainderSeconds} sec</Text>
          </HStack>

          {/* ⚡️ Added Styles as Tags */}
          {uniqueTags.length > 0 && (
            <HStack flexWrap="wrap" gap={2}>
              {uniqueTags.map((tag, i) => (
                <Box key={i} bg="gray.100" color="gray.700" px={2} py={1} borderRadius="md" fontSize="xs" fontWeight="500">
                  {tag as string}
                </Box>
              ))}
            </HStack>
          )}

          {/* ⚡️ Cleaned up label info so we don't duplicate the year/tags */}
          {(album.publisher || album.release_country) && (
            <Text fontSize="sm" color="gray.500" mt={1}>
              {album.release_country ? `${album.release_country} release` : 'Released'} via {album.publisher || 'Unknown Label'} {album.catalog_number ? `(${album.catalog_number})` : ''}
            </Text>
          )}
        </VStack>
      </Flex>

      {/* 2. TAB DIVIDER */}
      <Box borderBottom="1px solid" borderColor="gray.200" w="full" mb={6} px={{ base: 4, md: 0 }}>
        <HStack gap={8}>
          <Box 
            borderBottom="2px solid" 
            borderColor="blue.500" 
            pb={3} 
            color="blue.600" 
            fontWeight="600" 
            fontSize="sm"
            display="flex"
            alignItems="center"
            gap={2}
          >
            Tracks
            <Box as="span" bg="gray.100" color="gray.500" fontSize="xs" px={1.5} py={0.5} borderRadius="full">
              {album.tracks?.length || 0}
            </Box>
          </Box>
        </HStack>
      </Box>

      {/* 3. MINIMALIST TRACKLIST */}
      <Box w="full" px={{ base: 4, md: 0 }}>
        <VStack align="stretch" gap={0}>
          {album.tracks?.map((track: any, index: number) => {
            const trackArtistString = track.artists?.map((a: any) => a.name).join(', ') || albumArtistString;
            const isVariousArtists = trackArtistString !== albumArtistString;
            
            const isThisTrackPlaying = currentTrack?.id === track.id;
            const isThisTrackActiveAndPlaying = isThisTrackPlaying && isPlaying;
            
            return (
              <HStack 
                key={track.id} 
                className="group"
                px={4} py={3}
                borderBottom="1px solid" borderColor="gray.100"
                bg={isThisTrackPlaying ? "blue.50" : "transparent"}
                _hover={{ bg: isThisTrackPlaying ? "blue.50" : "gray.50" }}
                transition="background 0.2s"
                gap={4}
                borderRadius="md"
              >
                <Box w="30px" textAlign="left" color={isThisTrackPlaying ? "blue.600" : "gray.400"} fontSize="sm" fontWeight="600">
                  {!isThisTrackPlaying && <Box as="span" display="block" _groupHover={{ display: "none" }}>{index + 1}</Box>}
                  
                  <Box 
                    display={isThisTrackPlaying ? "block" : "none"} 
                    _groupHover={{ display: "block" }} 
                    cursor="pointer" 
                    onClick={(e) => handlePlayTrack(e, track)}
                  >
                    <Icon as={isThisTrackActiveAndPlaying ? Pause : Play} fill="currentColor" boxSize={4} color={isThisTrackPlaying ? "blue.600" : "gray.900"} />
                  </Box>
                </Box>

                <Box flex="1" overflow="hidden">
                  <Text fontSize="sm" fontWeight={isThisTrackPlaying ? "600" : "500"} color={isThisTrackPlaying ? "blue.700" : "gray.900"} truncate>
                    {track.title}
                  </Text>
                  
                  {isVariousArtists && (
                    <Box fontSize="xs" color="gray.500" truncate mt={0.5}>
                      {track.artists?.map((artist: any, i: number) => (
                        <React.Fragment key={artist.id || i}>
                          <Text as="span" cursor="pointer" _hover={{ textDecoration: "underline", color: "blue.600" }} onClick={(e) => { e.stopPropagation(); navigate(`/artists/${encodeURIComponent(artist.name)}`); }}>
                            {artist.name}
                          </Text>
                          {i < track.artists.length - 1 && ", "}
                        </React.Fragment>
                      ))}
                    </Box>
                  )}
                </Box>

                <HStack gap={8} color="gray.500" fontSize="xs">
                  <Text display={{ base: "none", sm: "block" }} w="40px" textAlign="right">
                    {track.bpm > 0 ? Math.round(track.bpm) : ""}
                  </Text>
                  <Text display={{ base: "none", sm: "block" }} w="40px" textAlign="right">
                    {track.musical_key ? `${track.musical_key}${track.scale === 'minor' ? 'm' : ''}` : ""}
                  </Text>
                  <Text w="40px" textAlign="right" fontWeight="500" color={isThisTrackPlaying ? "blue.700" : "gray.700"}>
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