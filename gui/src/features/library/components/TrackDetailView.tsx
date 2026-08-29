import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, VStack, HStack, Text, Heading, Spinner, 
  Button, Icon, SimpleGrid, Badge, Flex, Image
} from '@chakra-ui/react';
import { Play, Pause, ArrowLeft, Music, Activity, Zap, Disc3, Clock, Hash } from 'lucide-react';
import { api, CDN_BASE_URL } from '../../../services/api';
import { useAuthStore } from '../../../store/useAuthStore';
import { WaveSurferPlayer } from '../../../features/player/WaveSurferPlayer';

export const TrackDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orgId = useAuthStore((state) => state.activeOrganizationId);

  const [track, setTrack] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Audio Player State
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

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

  // Audio Controls
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Sync state if audio ends naturally
  const handleAudioEnded = () => setIsPlaying(false);

  if (isLoading) {
    return (
      <Flex h="100%" align="center" justify="center">
        <Spinner size="xl" color="blue.500" />
      </Flex>
    );
  }

  if (!track) {
    return (
      <Flex h="100%" align="center" justify="center" direction="column" gap={4}>
        <Icon as={Disc3} boxSize={12} color="gray.400" />
        <Text color="gray.500">Track not found</Text>
        <Button onClick={() => navigate('/library')}>Back to Library</Button>
      </Flex>
    );
  }

  // Safely format artists
  const artistName = track.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';
  
  // Safely resolve cover URL via CDN
  const coverUrl = track.album?.cover_key ? `${CDN_BASE_URL}/${track.album.cover_key}` : null;
  
  // Assume the track master file is accessible via CDN for playback
  const audioUrl = track.master_key ? `${CDN_BASE_URL}/${track.master_key}` : '';

  return (
    <VStack align="stretch" h="100%" overflowY="auto" bg="gray.50" p={8} gap={8}>
      
      {/* 1. TOP BAR */}
      <HStack>
        <Button variant="ghost" color="gray.500" onClick={() => navigate(-1)}>
          <Icon as={ArrowLeft} boxSize={4} mr={2} />
          Back
        </Button>
      </HStack>

      {/* 2. HEADER: Artwork & Main Info */}
      <HStack align="start" gap={8} flexWrap={{ base: 'wrap', md: 'nowrap' }}>
        
        {/* Cover Art */}
        <Box 
          w={{ base: "100%", md: "250px" }} 
          h={{ base: "auto", md: "250px" }} 
          aspectRatio={1}
          borderRadius="2xl" 
          overflow="hidden" 
          bg="white" 
          boxShadow="xl"
          flexShrink={0}
        >
          {coverUrl ? (
            <Image src={coverUrl} alt={track.title} w="100%" h="100%" objectFit="cover" />
          ) : (
            <Flex w="100%" h="100%" align="center" justify="center" bg="gray.100">
              <Icon as={Music} boxSize={16} color="gray.300" />
            </Flex>
          )}
        </Box>

        {/* Info */}
        <VStack align="start" justify="center" flex="1" gap={4} py={4}>
          <Box>
            <Text color="blue.500" fontWeight="bold" letterSpacing="widest" fontSize="sm" textTransform="uppercase" mb={1}>
              {track.album?.title || 'Single'}
            </Text>
            <Heading size="2xl" color="gray.900" letterSpacing="tight">
              {track.title}
            </Heading>
            <Text fontSize="xl" color="gray.500" mt={2} fontWeight="500">
              {artistName}
            </Text>
          </Box>

          <HStack gap={2} flexWrap="wrap">
            {/* ⚡️ CHANGED colorScheme to colorPalette */}
            {track.genre && track.genre.split(',').map((g: string) => (
              <Badge key={g} colorPalette="purple" px={3} py={1} borderRadius="full">{g.trim()}</Badge>
            ))}
            {track.style && track.style.split(',').map((s: string) => (
              <Badge key={s} colorPalette="blue" variant="subtle" px={3} py={1} borderRadius="full">{s.trim()}</Badge>
            ))}
          </HStack>
        </VStack>
      </HStack>

      {/* 3. PLAYER SECTION (WaveSurfer integration) */}
      <Box bg="white" p={6} borderRadius="2xl" boxShadow="sm" border="1px solid" borderColor="gray.100">
        <HStack gap={6}>
          {/* ⚡️ CHANGED isDisabled to disabled AND colorScheme to colorPalette */}
          <Button 
            w="64px" h="64px" 
            borderRadius="full" 
            colorPalette="blue" 
            onClick={togglePlay}
            flexShrink={0}
            disabled={!audioUrl}
          >
            <Icon as={isPlaying ? Pause : Play} boxSize={8} ml={isPlaying ? 0 : 2} />
          </Button>

          <Box flex="1" h="80px" position="relative">
            {/* Hidden Audio Element */}
            <audio ref={audioRef} src={audioUrl} onEnded={handleAudioEnded} crossOrigin="anonymous" />
            
            {/* WaveSurfer Component */}
            {orgId && (
              <WaveSurferPlayer 
                trackId={track.id}
                audioRef={audioRef}
                isPlaying={isPlaying}
                waveformKey={track.waveform_key ? `${CDN_BASE_URL}/${track.waveform_key}` : undefined}
                orgId={orgId}
              />
            )}
          </Box>
        </HStack>
      </Box>

      {/* 4. ACOUSTIC METADATA GRID */}
      <Box bg="white" p={8} borderRadius="2xl" boxShadow="sm" border="1px solid" borderColor="gray.100">
        <Heading size="md" mb={6} color="gray.800">Acoustic Analysis</Heading>
        <SimpleGrid columns={{ base: 2, md: 4 }} gap={8}>
          
          <StatBox icon={Activity} label="Tempo" value={track.bpm ? `${Math.round(track.bpm)} BPM` : '--'} />
          <StatBox icon={Hash} label="Musical Key" value={track.musical_key ? `${track.musical_key} ${track.scale}` : '--'} />
          <StatBox icon={Clock} label="Duration" value={formatDuration(track.duration)} />
          <StatBox icon={Zap} label="Energy" value={track.energy ? `${Math.round(track.energy * 100)}%` : '--'} />

        </SimpleGrid>

        {/* ML Characteristics */}
        {track.ml_characteristics && track.ml_characteristics.length > 0 && (
          <Box mt={8} pt={8} borderTop="1px solid" borderColor="gray.100">
            <Text color="gray.500" fontSize="sm" fontWeight="bold" textTransform="uppercase" letterSpacing="wider" mb={4}>
              Audio Characteristics
            </Text>
            <HStack flexWrap="wrap" gap={2}>
              {track.ml_characteristics.map((char: string) => (
                <Badge key={char} bg="gray.100" color="gray.700" px={3} py={1.5} borderRadius="md" fontWeight="500">
                  {char}
                </Badge>
              ))}
            </HStack>
          </Box>
        )}
      </Box>

    </VStack>
  );
};

// Sub-component for the stats grid
const StatBox = ({ icon, label, value }: { icon: any, label: string, value: string }) => (
  <VStack align="start" gap={1}>
    <HStack color="gray.400" mb={1}>
      <Icon as={icon} boxSize={4} />
      <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">{label}</Text>
    </HStack>
    <Text fontSize="2xl" fontWeight="bold" color="gray.900" fontFamily="mono">{value}</Text>
  </VStack>
);

// Helper
const formatDuration = (s: number) => {
  if (!s) return '--:--';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};