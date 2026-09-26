import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Flex, VStack, HStack, Text, Icon, Spinner, Grid, GridItem, Image, Link
} from '@chakra-ui/react';
import { Music, User, Play, Disc, Globe, ExternalLink } from 'lucide-react';
import { api } from '../../../services/api';
import { usePlayer } from '../../../context/PlayerContext';

export const ArtistView: React.FC = () => {
  const { artistName, id: paramId } = useParams<{ artistName?: string, id?: string }>();
  const identifier = artistName || paramId;
  
  const navigate = useNavigate();
  const { playTrack } = usePlayer();
  
  const [artist, setArtist] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Discography' | 'Tracks'>('Discography');

  useEffect(() => {
    if (!identifier) return;
    
    let isMounted = true;
    setIsLoading(true);
    
    api.getArtist(identifier)
      .then(payload => {
        if (isMounted) {
          const artistData = payload.artist ? payload.artist : payload;
          setArtist({ 
            ...artistData, 
            resolved_image_url: payload.image_url,
            resolved_albums: payload.albums
          });
        }
      })
      .catch(err => console.error(err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [identifier]);

  const name = artist?.name || artist?.Name || identifier;
  const imageUrl = artist?.resolved_image_url || artist?.image_url;
  const country = artist?.artist_country || artist?.ArtistCountry;
  const bio = artist?.bio || artist?.Bio;
  const tracks = artist?.tracks || artist?.Tracks || [];
  const albums = artist?.resolved_albums || artist?.albums || artist?.Albums || [];
  
  const discogsUrl = artist?.discogs_url || artist?.DiscogsUrl || artist?.discogs;
  const websiteUrl = artist?.website_url || artist?.WebsiteUrl || artist?.website;
  const soundcloudUrl = artist?.soundcloud_url || artist?.SoundcloudUrl || artist?.soundcloud;

  const stats = useMemo(() => {
    const totalDuration = tracks.reduce((sum: number, t: any) => sum + (t.duration || t.Duration || 0), 0);
    const mins = Math.floor(totalDuration / 60);
    const secs = Math.floor(totalDuration % 60);
    
    return {
      trackCount: tracks.length,
      albumCount: albums.length,
      durationStr: `${mins} min ${secs} sec`,
    };
  }, [tracks, albums]);

  const formatTime = (seconds: number) => {
    if (!seconds) return "-";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return <Flex h="100%" align="center" justify="center"><Spinner size="xl" color="blue.500" _dark={{ color: "blue.400" }} /></Flex>;
  }

  return (
    // ⚡️ Transparent background to inherit from layout, semantic default text color
    <VStack align="stretch" h="100%" bg="transparent" color="fg" gap={8} animation="fade-in 0.3s ease-out">
      
      {/* 1. HEADER SECTION */}
      <VStack align="start" gap={1}>
        <HStack gap={2} color="fg.muted" fontSize="sm" mb={3}>
          <Flex align="center" justify="center" w="24px" h="24px" bg="blue.500" _dark={{ bg: "blue.400" }} color="white" borderRadius="md" cursor="pointer" onClick={() => navigate('/library')}>
            <Icon as={Music} boxSize={3} strokeWidth={3} />
          </Flex>
          <Text cursor="pointer" _hover={{ color: "fg" }} onClick={() => navigate('/library')}>Library</Text>
          <Text color="border">/</Text>
          
          <Text 
            cursor="pointer" 
            _hover={{ color: "fg" }} 
            onClick={() => navigate('/library', { state: { activeTab: 'artists' } })}
          >
            Artists
          </Text>
          
          <Text color="border">/</Text>
          <Text color="fg" fontWeight="500">{name}</Text>
        </HStack>
        
        <Flex gap={8} mt={2} flexDir={{ base: "column", md: "row" }} align="flex-start" w="100%">
          
          <Box position="relative" w="180px" h="180px" flexShrink={0}>
            {/* ⚡️ Avatar background and border adapted for dark mode */}
            <Flex align="center" justify="center" w="100%" h="100%" bg="gray.50" _dark={{ bg: "whiteAlpha.100" }} color="fg.muted" borderRadius="full" border="1px solid" borderColor="border" overflow="hidden">
              {imageUrl ? (
                <Image src={imageUrl} alt={name} w="100%" h="100%" objectFit="cover" />
              ) : (
                <Icon as={User} boxSize={20} />
              )}
            </Flex>
            
            {/* ⚡️ Play button uses borderColor="bg" so the border flawlessly matches the background in any theme */}
            <Flex 
              position="absolute" bottom="8px" right="8px" 
              w={12} h={12} bg="blue.500" borderRadius="full" 
              align="center" justify="center" border="4px solid" borderColor="bg" 
              color="white"
              _dark={{ bg: "blue.400", borderColor: "bg" }}
              cursor="pointer" _hover={{ transform: "scale(1.1)", bg: "blue.600", _dark: { bg: "blue.500" } }} transition="all 0.2s" 
              onClick={() => tracks.length > 0 && playTrack(tracks[0], tracks)}
            >
              <Icon as={Play} boxSize={5} fill="currentColor" ml="2px" />
            </Flex>
          </Box>
          
          <VStack align="start" gap={3} flex="1">
            <Text fontSize="4xl" fontWeight="700" color="fg" letterSpacing="tight">
              {name}
            </Text>
            
            <HStack gap={3} color="fg.muted" fontSize="sm" fontWeight="500">
              <Text>{stats.albumCount} Album{stats.albumCount !== 1 ? 's' : ''}</Text>
              <Text>•</Text>
              <Text>{stats.trackCount} Track{stats.trackCount !== 1 ? 's' : ''}</Text>
              <Text>•</Text>
              <Text>{stats.durationStr}</Text>
              {country && (
                <>
                  <Text>•</Text>
                  <Text color="blue.600" _dark={{ color: "blue.400" }}>{country}</Text>
                </>
              )}
            </HStack>

            {(discogsUrl || websiteUrl || soundcloudUrl) && (
              <HStack gap={4} pt={1} flexWrap="wrap" fontSize="sm">
                {discogsUrl && (
                  <Link href={discogsUrl} target="_blank" rel="noopener noreferrer" color="blue.600" _dark={{ color: "blue.400" }} _hover={{ textDecoration: "underline" }} display="flex" alignItems="center" gap={1.5}>
                    <Icon as={Disc} boxSize={3.5} /> Discogs
                  </Link>
                )}
                {soundcloudUrl && (
                  <Link href={soundcloudUrl} target="_blank" rel="noopener noreferrer" color="orange.500" _dark={{ color: "orange.400" }} _hover={{ textDecoration: "underline" }} display="flex" alignItems="center" gap={1.5}>
                    <Icon as={ExternalLink} boxSize={3.5} /> SoundCloud
                  </Link>
                )}
                {websiteUrl && (
                  <Link href={websiteUrl} target="_blank" rel="noopener noreferrer" color="fg.muted" _hover={{ textDecoration: "underline" }} display="flex" alignItems="center" gap={1.5}>
                    <Icon as={Globe} boxSize={3.5} /> Website
                  </Link>
                )}
              </HStack>
            )}

            {bio && (
              <Text color="fg.muted" fontSize="sm" mt={2} lineClamp={3} title={bio} maxW="800px">
                {bio}
              </Text>
            )}
          </VStack>
        </Flex>
      </VStack>

      {/* 2. TABS */}
      <HStack borderBottom="1px solid" borderColor="border" gap={6}>
        <TabButton 
          isActive={activeTab === 'Discography'} 
          onClick={() => setActiveTab('Discography')} 
          label="Discography" 
          count={stats.albumCount} 
        />
        <TabButton 
          isActive={activeTab === 'Tracks'} 
          onClick={() => setActiveTab('Tracks')} 
          label="Tracks" 
          count={stats.trackCount} 
        />
      </HStack>

      {/* 3. CONTENT AREA */}
      <Box flex="1" overflowY="auto" pb={8}>
        
        {/* DISCOGRAPHY TAB */}
        {activeTab === 'Discography' && (
          <VStack align="stretch" gap={6}>
            <Text fontSize="lg" fontWeight="600" color="fg">Releases</Text>
            {albums.length === 0 ? (
              <Text color="fg.muted" fontSize="sm">No albums found for this artist.</Text>
            ) : (
              <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={6}>
                {albums.map((album: any, idx: number) => {
                  const albumTitle = album.title || album.Title;
                  const albumYear = album.year || album.Year || 'Unknown Year';
                  const albumId = album.id || album.ID;
                  const coverUrl = album.cover_url || album.CoverUrl || album.CoverKey; 

                  return (
                    <GridItem key={idx}>
                      <VStack align="start" gap={3} cursor="pointer" className="group" onClick={() => navigate(`/library/albums/${albumId}`)}>
                        <Flex 
                          w="100%" aspectRatio={1} borderRadius="md" align="center" justify="center" 
                          transition="all 0.2s" _groupHover={{ opacity: 0.8, transform: 'scale(1.02)' }} 
                          overflow="hidden" position="relative" border="1px solid" 
                          borderColor="border" bg="gray.100" color="fg.muted" _dark={{ bg: "whiteAlpha.200" }}
                        >
                          {coverUrl ? (
                            <Image src={coverUrl} alt={albumTitle} w="100%" h="100%" objectFit="cover" />
                          ) : (
                            <Icon as={Disc} boxSize={16} />
                          )}
                        </Flex>
                        <VStack align="start" gap={0}>
                          <Text 
                            fontWeight="600" color="fg" fontSize="md" lineClamp={1} 
                            _groupHover={{ color: "blue.600", _dark: { color: "blue.400" } }}
                          >
                            {albumTitle}
                          </Text>
                          <Text fontSize="sm" color="fg.muted">
                            {albumYear} • Album
                          </Text>
                        </VStack>
                      </VStack>
                    </GridItem>
                  );
                })}
              </Grid>
            )}
          </VStack>
        )}

        {/* TRACKS TAB */}
        {activeTab === 'Tracks' && (
          <VStack align="stretch" gap={0}>
            {tracks.length === 0 ? (
               <Text color="fg.muted" fontSize="sm" py={4}>No tracks found for this artist.</Text>
            ) : (
              tracks.map((track: any, index: number) => {
                const trackTitle = track.title || track.Title;
                const trackBpm = track.bpm || track.BPM;
                const trackKey = track.musical_key || track.MusicalKey;
                const trackScale = track.scale || track.Scale;
                const trackDuration = track.duration || track.Duration;
                const album = track.album || track.Album;

                return (
                  <HStack 
                    key={track.id || index} 
                    className="group" 
                    px={2} py={3} 
                    borderBottom="1px solid" borderColor="border" 
                    _hover={{ bg: "gray.50", _dark: { bg: "whiteAlpha.50" } }} gap={4}
                    onDoubleClick={() => playTrack(track, tracks)}
                  >
                    <Box w="30px" textAlign="left" color="fg.muted" fontSize="sm" fontWeight="600">
                      <Box as="span" display="block" _groupHover={{ display: "none" }}>{index + 1}</Box>
                      <Icon 
                        as={Play} fill="currentColor" boxSize={4} color="fg" 
                        display="none" _groupHover={{ display: "block" }} cursor="pointer" 
                        onClick={() => playTrack(track, tracks)}
                      />
                    </Box>

                    <Box flex="1" overflow="hidden">
                      <Text fontSize="sm" fontWeight="500" color="fg" truncate>{trackTitle}</Text>
                      {album && (
                        <HStack 
                          fontSize="xs" color="fg.muted" mt={0.5} gap={1} cursor="pointer" 
                          _hover={{ color: "blue.600", textDecoration: "underline", _dark: { color: "blue.400" } }} 
                          onClick={(e) => { e.stopPropagation(); navigate(`/library/albums/${album.id || album.ID}`); }}
                        >
                          <Icon as={Disc} boxSize={3} />
                          <Text truncate>{album.title || album.Title}</Text>
                        </HStack>
                      )}
                    </Box>

                    <HStack gap={6} color="fg.muted" fontSize="xs">
                      <Text display={{ base: "none", sm: "block" }} w="40px" textAlign="right">
                        {trackBpm > 0 ? Math.round(trackBpm) : ""}
                      </Text>
                      <Text display={{ base: "none", sm: "block" }} w="40px" textAlign="right">
                        {trackKey ? `${trackKey}${trackScale === 'minor' ? 'm' : ''}` : ""}
                      </Text>
                      <Text w="40px" textAlign="right" fontWeight="500" color="fg">
                        {formatTime(trackDuration)}
                      </Text>
                    </HStack>
                  </HStack>
                );
              })
            )}
          </VStack>
        )}
      </Box>
    </VStack>
  );
};

const TabButton = ({ isActive, onClick, label, count }: any) => (
  <HStack 
    py={4} cursor="pointer" onClick={onClick}
    borderBottom="2px solid" 
    borderColor={isActive ? "blue.600" : "transparent"}
    color={isActive ? "blue.600" : "fg.muted"} 
    _dark={{ 
      borderColor: isActive ? "blue.400" : "transparent",
      color: isActive ? "blue.400" : "fg.muted" 
    }}
    transition="all 0.2s"
    _hover={{ color: isActive ? "blue.600" : "fg", _dark: { color: isActive ? "blue.400" : "fg" } }}
  >
    <Text fontWeight={isActive ? "600" : "500"}>{label}</Text>
    <Flex 
      px={2} py={0.5} borderRadius="full" fontSize="xs" fontWeight="bold"
      bg={isActive ? "blue.50" : "gray.100"} color={isActive ? "blue.600" : "fg.muted"} 
      _dark={{ bg: isActive ? "whiteAlpha.100" : "whiteAlpha.200", color: isActive ? "blue.300" : "whiteAlpha.800" }}
    >
      {count}
    </Flex>
  </HStack>
);