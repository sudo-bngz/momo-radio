import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, VStack, HStack, Text, Heading, Spinner, 
  Button, Icon, SimpleGrid, Badge, Flex, Image
} from '@chakra-ui/react';
import { Play, Pause, Music, Activity, Zap, Disc3, Clock, Hash } from 'lucide-react';
import { api, CDN_BASE_URL } from '../../../services/api';
import { useAuthStore } from '../../../store/useAuthStore';
import { WaveSurferPlayer } from '../../../features/player/WaveSurferPlayer';
import { usePlayer } from '../../../context/PlayerContext';

const buildCdnUrl = (key?: string) => {
  if (!key) return undefined;
  if (key.startsWith('http')) return key;
  const base = CDN_BASE_URL.startsWith('http') ? CDN_BASE_URL : `https://${CDN_BASE_URL}`;
  return `${base}/${key.replace(/^\//, '')}`;
};

export const TrackDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orgId = useAuthStore((state) => state.activeOrganizationId);

  const { playTrack, togglePlayPause, currentTrack, isPlaying } = usePlayer();

  const [track, setTrack] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dummy audio ref for WaveSurfer visual generation only
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const fetchTrack = async () => {
      if (!id) return;
      try {
        setIsLoading(true);
        const data = await api.getTrack(id);
        setTrack(data);
      } catch (error) {
        console.error('Failed to load track:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTrack();
  }, [id]);

  if (isLoading) {
    return (
      <Flex h="100%" align="center" justify="center" bg="white">
        <Spinner size="md" color="gray.400" />
      </Flex>
    );
  }

  if (!track) {
    return (
      <Flex h="100%" align="center" justify="center" direction="column" gap={3} bg="white">
        <Icon as={Disc3} boxSize={8} color="gray.300" />
        <Text color="gray.500" fontSize="sm">Track not found.</Text>
        <Button onClick={() => navigate('/library')} variant="outline" size="sm">Return to Library</Button>
      </Flex>
    );
  }

  const artistName = track.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';
  const coverUrl = buildCdnUrl(track.album?.cover_key);
  const audioUrl = buildCdnUrl(track.master_key);
  const waveformUrl = buildCdnUrl(track.waveform_key);

  const isThisTrackPlaying = currentTrack?.id === track.id;
  const isThisTrackActiveAndPlaying = isThisTrackPlaying && isPlaying;

  const handlePlayClick = () => {
    if (isThisTrackPlaying) {
      togglePlayPause();
    } else {
      // Send track to the global auto-DJ / bottom player
      playTrack(track, [track]); 
    }
  };

  return (
    <VStack align="stretch" h="100%" gap={8} bg="white" data-theme="light">
      
      {/* 1. HEADER & BREADCRUMB */}
      <VStack align="start" gap={1}>
        <HStack gap={2} fontSize="sm" color="gray.500" mb={1}>
          <Box w="24px" h="24px" bg="blue.500" color="white" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
            <Icon as={Music} boxSize={3} strokeWidth={3} />
          </Box>
          <Text cursor="pointer" _hover={{ textDecoration: "underline", color: "gray.900" }} onClick={() => navigate('/library', { state: { activeTab: 'tracks' } })}>
            Library
          </Text>
          <Text color="gray.300">/</Text>
          <Text cursor="pointer" _hover={{ textDecoration: "underline", color: "gray.900" }} onClick={() => navigate('/library', { state: { activeTab: 'tracks' } })}>
            Tracks
          </Text>
          <Text color="gray.300">/</Text>
          <Text color="gray.900" fontWeight="600">{track.title}</Text>
        </HStack>
      </VStack>

      <Box flex="1" overflowY="auto" pb={8} css={{ '&::-webkit-scrollbar': { display: 'none' } }}>
        
        {/* 2. TRACK INFO HEADER */}
        <HStack align="end" gap={6} mb={8} flexWrap={{ base: 'wrap', md: 'nowrap' }}>
          
          <Box w="140px" h="140px" borderRadius="md" border="1px solid" borderColor="gray.200" overflow="hidden" bg="gray.50" flexShrink={0}>
            {coverUrl ? (
              <Image src={coverUrl} alt={track.title} w="100%" h="100%" objectFit="cover" />
            ) : (
              <Flex w="100%" h="100%" align="center" justify="center">
                <Icon as={Music} boxSize={8} color="gray.300" />
              </Flex>
            )}
          </Box>

          <VStack align="start" justify="flex-end" gap={1} pb={1} flex="1" minW={0}>
            <Text color="gray.500" fontWeight="600" letterSpacing="widest" fontSize="10px" textTransform="uppercase">
              {track.album?.title || 'Single'}
            </Text>
            
            <Heading size="lg" color="gray.900" fontWeight="700" letterSpacing="tight" lineClamp={1}>
              {track.title}
            </Heading>
            
            <Text fontSize="sm" color="gray.600" fontWeight="500" lineClamp={1}>
              {artistName}
            </Text>

            <HStack gap={2} mt={2} flexWrap="wrap">
              {track.genre && track.genre.split(',').map((g: string) => (
                <Badge key={g} colorPalette="gray" variant="surface" px={2} py={0.5} borderRadius="sm" fontWeight="500">{g.trim()}</Badge>
              ))}
              {track.style && track.style.split(',').map((s: string) => (
                <Badge key={s} colorPalette="gray" variant="outline" px={2} py={0.5} borderRadius="sm" fontWeight="500">{s.trim()}</Badge>
              ))}
            </HStack>
          </VStack>
        </HStack>

        {/* 3. PLAYER BAR */}
        <Box border="1px solid" borderColor="gray.200" borderRadius="md" p={3} mb={8} bg="gray.50">
          <HStack gap={4}>
            <Button 
              size="sm" w="40px" h="40px" 
              colorPalette="blue" 
              onClick={handlePlayClick}
              flexShrink={0}
              disabled={!audioUrl}
            >
              <Icon as={isThisTrackActiveAndPlaying ? Pause : Play} boxSize={4} ml={isThisTrackActiveAndPlaying ? 0 : 0.5} />
            </Button>

            <Box flex="1" h="40px" position="relative" bg="white" border="1px solid" borderColor="gray.200" borderRadius="sm" overflow="hidden">
              {/* Muted dummy audio ref to allow WaveSurferPlayer to render visually without duplicate playback */}
              <audio ref={audioRef} src={audioUrl} preload="metadata" muted />
              
              {orgId && (
                <WaveSurferPlayer 
                  trackId={track.id}
                  audioRef={audioRef}
                  isPlaying={isThisTrackActiveAndPlaying}
                  waveformUrl={waveformUrl}
                  orgId={orgId}
                />
              )}
            </Box>
          </HStack>
        </Box>

        {/* 4. ACOUSTIC PROFILE */}
        <Box>
          <Text fontSize="10px" fontWeight="700" color="gray.500" textTransform="uppercase" letterSpacing="widest" mb={3}>
            Acoustic Profile
          </Text>
          
          <SimpleGrid columns={{ base: 2, md: 4 }} gap={4} mb={6}>
            <StatBox icon={Activity} label="Tempo" value={track.bpm ? `${Math.round(track.bpm)} BPM` : '--'} />
            <StatBox icon={Hash} label="Key" value={track.musical_key ? `${track.musical_key} ${track.scale}` : '--'} />
            <StatBox icon={Clock} label="Duration" value={formatDuration(track.duration)} />
            <StatBox icon={Zap} label="Energy" value={track.energy ? `${Math.round(track.energy * 100)}%` : '--'} />
          </SimpleGrid>

          {track.ml_characteristics && track.ml_characteristics.length > 0 && (
            <Box pt={4}>
              <Text fontSize="10px" fontWeight="700" color="gray.500" textTransform="uppercase" letterSpacing="widest" mb={3}>
                Machine Learning Tags
              </Text>
              <HStack flexWrap="wrap" gap={2}>
                {track.ml_characteristics.map((char: string) => (
                  <Badge key={char} bg="gray.100" color="gray.600" px={2} py={1} borderRadius="sm" fontWeight="500">
                    {char}
                  </Badge>
                ))}
              </HStack>
            </Box>
          )}
        </Box>

      </Box>
    </VStack>
  );
};

const StatBox = ({ icon, label, value }: { icon: any, label: string, value: string }) => (
  <Box p={3} border="1px solid" borderColor="gray.200" borderRadius="md" bg="white">
    <HStack color="gray.400" mb={1.5}>
      <Icon as={icon} boxSize={3.5} />
      <Text fontSize="10px" fontWeight="700" textTransform="uppercase" letterSpacing="wider">{label}</Text>
    </HStack>
    <Text fontSize="md" fontWeight="600" color="gray.800" fontFamily="mono">{value}</Text>
  </Box>
);

const formatDuration = (s: number) => {
  if (!s) return '--:--';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};