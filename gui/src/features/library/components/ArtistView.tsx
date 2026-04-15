import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Flex, VStack, HStack, Text, Icon, Spinner, Grid, GridItem 
} from '@chakra-ui/react';
import { Music, User } from 'lucide-react';
import { api } from '../../../services/api';
import type { Track } from '../../../types';

export const ArtistView: React.FC = () => {
  const { artistName } = useParams<{ artistName: string }>();
  const navigate = useNavigate();
  
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Discography' | 'Tracks'>('Discography');

  // Fetch tracks for this artist
  useEffect(() => {
    if (!artistName) return;
    
    let isMounted = true;
    setIsLoading(true);
    
    // We use your existing search endpoint, then strictly filter by artist client-side
    // to ensure we don't accidentally show a track where the *title* matches the artist name.
    api.getTracks({ search: artistName, limit: 100 })
      .then(res => {
        if (isMounted) {
          const exactMatches = (res.data || []).filter(
            t => t.artist.toLowerCase() === artistName.toLowerCase()
          );
          setTracks(exactMatches);
        }
      })
      .catch(err => console.error(err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [artistName]);

  // Derived Stats & Data Grouping
  const stats = useMemo(() => {
    const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
    const mins = Math.floor(totalDuration / 60);
    const secs = Math.floor(totalDuration % 60);
    
    // Group tracks by Album
    const albumsMap = new Map<string, Track[]>();
    tracks.forEach(track => {
      const albumName = track.album || 'Unknown Album';
      if (!albumsMap.has(albumName)) albumsMap.set(albumName, []);
      albumsMap.get(albumName)!.push(track);
    });

    const albums = Array.from(albumsMap.entries()).map(([name, albumTracks]) => ({
      name,
      year: albumTracks[0]?.year || 'Unknown Year',
      trackCount: albumTracks.length
    }));

    return {
      trackCount: tracks.length,
      albumCount: albums.length,
      durationStr: `${mins} min ${secs} sec`,
      albums
    };
  }, [tracks]);

  if (isLoading) {
    return <Flex h="100%" align="center" justify="center"><Spinner size="xl" color="blue.500" /></Flex>;
  }

  return (
    <VStack align="stretch" h="100%" bg="white" data-theme="light" gap={0}>
      
      {/* 1. Breadcrumbs */}
      <HStack px={8} py={4} gap={2} color="gray.500" fontSize="sm">
        <Flex align="center" justify="center" w={6} h={6} bg="blue.600" color="white" borderRadius="md" cursor="pointer" onClick={() => navigate('/library')}>
          <Icon as={Music} boxSize={3.5} />
        </Flex>
        <Text cursor="pointer" _hover={{ color: "gray.900" }} onClick={() => navigate('/library')}>Library</Text>
        <Text>/</Text>
        <Text cursor="pointer" _hover={{ color: "gray.900" }}>Artists</Text>
        <Text>/</Text>
        <Text color="gray.900" fontWeight="500">{artistName}</Text>
      </HStack>

      {/* 2. Header */}
      <HStack px={8} py={6} gap={6}>
        <Flex align="center" justify="center" w="140px" h="140px" bg="gray.800" color="gray.400" borderRadius="full" position="relative">
          <Icon as={User} boxSize={16} />
          <Flex position="absolute" bottom={1} right={1} w={10} h={10} bg="gray.700" borderRadius="full" align="center" justify="center" border="3px solid white">
            <Icon as={Music} boxSize={5} color="white" />
          </Flex>
        </Flex>
        <VStack align="start" gap={2}>
          <Text fontSize="4xl" fontWeight="600" color="gray.900" letterSpacing="tight">
            {artistName}
          </Text>
          <Text fontSize="sm" color="gray.500">
            {stats.albumCount} album{stats.albumCount !== 1 ? 's' : ''} • {stats.trackCount} track{stats.trackCount !== 1 ? 's' : ''} • {stats.durationStr}
          </Text>
        </VStack>
      </HStack>

      {/* 3. Tabs */}
      <HStack px={8} borderBottom="1px solid" borderColor="gray.200" gap={6}>
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

      {/* 4. Content Area */}
      <Box flex="1" overflowY="auto" p={8}>
        {activeTab === 'Discography' && (
          <VStack align="stretch" gap={6}>
            <Text fontSize="lg" fontWeight="600" color="gray.900">Artist releases</Text>
            <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={6}>
              {stats.albums.map((album, idx) => (
                <GridItem key={idx}>
                  <VStack align="start" gap={3} cursor="pointer" className="group">
                    {/* Album Art Placeholder */}
                    <Flex w="100%" aspectRatio={1} bg="gray.800" color="gray.500" borderRadius="md" align="center" justify="center" transition="all 0.2s" _groupHover={{ opacity: 0.8, transform: 'scale(1.02)' }}>
                      <Icon as={Music} boxSize={16} />
                    </Flex>
                    <VStack align="start" gap={0}>
                      <Text fontWeight="600" color="gray.900" fontSize="md" lineClamp={1} _groupHover={{ color: "blue.600" }}>
  {album.name}
</Text>
                      <Text fontSize="sm" color="gray.500">
                        {album.year} • Album
                      </Text>
                    </VStack>
                  </VStack>
                </GridItem>
              ))}
            </Grid>
          </VStack>
        )}

        {activeTab === 'Tracks' && (
          <Text color="gray.500">Your track list table can go here (reuse the table from LibraryView)!</Text>
        )}
      </Box>
    </VStack>
  );
};

// Helper component for the Tabs
const TabButton = ({ isActive, onClick, label, count }: any) => (
  <HStack 
    px={2} py={4} cursor="pointer" onClick={onClick}
    borderBottom="2px solid" borderColor={isActive ? "blue.600" : "transparent"}
    color={isActive ? "blue.600" : "gray.500"} transition="all 0.2s"
    _hover={{ color: isActive ? "blue.600" : "gray.900" }}
  >
    <Text fontWeight={isActive ? "600" : "500"}>{label}</Text>
    <Flex px={2} py={0.5} bg={isActive ? "blue.600" : "gray.200"} color={isActive ? "white" : "gray.600"} borderRadius="full" fontSize="xs" fontWeight="bold">
      {count}
    </Flex>
  </HStack>
);