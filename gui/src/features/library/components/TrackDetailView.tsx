import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, VStack, HStack, Text, Heading, Spinner, 
  Button, Icon, SimpleGrid, Badge, Flex, Image
} from '@chakra-ui/react';
import { Play, Pause, Music, Activity, Zap, Disc3, Clock, Hash, Tag } from 'lucide-react';
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

  const isThisTrackPlaying = currentTrack?.id === track?.id;
  const isThisTrackActiveAndPlaying = isThisTrackPlaying && isPlaying;

  useEffect(() => {
    if (!audioRef.current) return;
    if (isThisTrackActiveAndPlaying) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [isThisTrackActiveAndPlaying]);

  const handlePlayClick = () => {
    if (isThisTrackPlaying) {
      togglePlayPause();
    } else {
      const trackForPlayer = {
        ...track,
        cover_url: buildCdnUrl(track.album?.cover_key),
        waveform_key: track.waveform_key
      };
      playTrack(trackForPlayer, [trackForPlayer]);
    }
  };

  if (isLoading) {
    return (
      <Flex h="100%" align="center" justify="center" bg="transparent">
        <Spinner size="md" color="fg.muted" />
      </Flex>
    );
  }

  if (!track) {
    return (
      <Flex h="100%" align="center" justify="center" direction="column" gap={3} bg="transparent">
        <Icon as={Disc3} boxSize={8} color="fg.muted" />
        <Text color="fg.muted" fontSize="sm">Track not found.</Text>
        <Button 
          onClick={() => navigate('/library')} 
          variant="outline" size="sm" 
          color="fg" borderColor="border" 
          _hover={{ bg: "gray.50", _dark: { bg: "whiteAlpha.100" } }}
        >
          Return to Library
        </Button>
      </Flex>
    );
  }

  const artistName = track.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';
  const coverUrl = buildCdnUrl(track.album?.cover_key);
  const audioUrl = buildCdnUrl(track.master_key);
  const waveformUrl = buildCdnUrl(track.waveform_key);

  return (
    // ⚡️ Removed bg="white" and data-theme="light", relying on global layout bg
    <VStack align="stretch" h="100%" gap={8} bg="transparent">
      
      {/* =========================================
          1. HEADER & BREADCRUMB
          ========================================= */}
      <VStack align="start" gap={1}>
        <HStack gap={2} fontSize="sm" color="fg.muted" mb={1}>
          <Box 
            w="24px" h="24px" bg="blue.500" _dark={{ bg: "blue.400" }} color="white" 
            borderRadius="md" display="flex" alignItems="center" justifyContent="center"
          >
            <Icon as={Music} boxSize={3} strokeWidth={3} />
          </Box>
          <Text cursor="pointer" _hover={{ textDecoration: "underline", color: "fg" }} onClick={() => navigate('/library', { state: { activeTab: 'tracks' } })}>
            Library
          </Text>
          <Text color="border">/</Text>
          <Text cursor="pointer" _hover={{ textDecoration: "underline", color: "fg" }} onClick={() => navigate('/library', { state: { activeTab: 'tracks' } })}>
            Tracks
          </Text>
          <Text color="border">/</Text>
          <Text color="fg" fontWeight="600">{track.title}</Text>
        </HStack>
      </VStack>

      <Box flex="1" overflowY="auto" pb={8} css={{ '&::-webkit-scrollbar': { display: 'none' } }}>
        
        {/* =========================================
            2. HERO SECTION (Adaptive Mode, Compact)
            ========================================= */}
        <Box 
          bg="gray.50" _dark={{ bg: "whiteAlpha.50" }}
          border="1px solid" borderColor="border"
          borderRadius="xl" p={6} mb={8}
        >
          <Flex direction={{ base: 'column-reverse', md: 'row' }} gap={6} align="stretch" justify="space-between">
            
            {/* LEFT SIDE: Play, Info, Waveform */}
            <Flex flex="1" direction="column" justify="space-between" minW={0}>
              
              <HStack align="start" gap={4}>
                <Button 
                  w="56px" h="56px" 
                  borderRadius="full" 
                  colorPalette="blue" 
                  onClick={handlePlayClick}
                  flexShrink={0}
                  disabled={!audioUrl}
                  boxShadow="sm"
                >
                  <Icon as={isThisTrackActiveAndPlaying ? Pause : Play} boxSize={6} ml={isThisTrackActiveAndPlaying ? 0 : 0.5} />
                </Button>

                <VStack align="start" gap={0.5} mt={0.5}>
                  <Text fontSize="10px" fontWeight="700" textTransform="uppercase" letterSpacing="widest" color="fg.muted">
                    {track.album?.title || 'Single'}
                  </Text>
                  <Heading size="xl" fontWeight="700" letterSpacing="tight" lineClamp={2} color="fg">
                    {track.title}
                  </Heading>
                  <Text fontSize="md" color="fg.muted" fontWeight="500">
                    {artistName}
                  </Text>
                </VStack>
              </HStack>

              {/* WAVEFORM */}
              <Box w="100%" h="60px" mt={6} position="relative" borderRadius="sm" overflow="hidden">
                <audio ref={audioRef} src={audioUrl} preload="metadata" muted crossOrigin="anonymous" />
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
            </Flex>

            {/* RIGHT SIDE: Cover Artwork (Reduced Size) */}
            <Box 
              w={{ base: "100%", md: "220px" }} 
              h={{ base: "auto", md: "220px" }} 
              aspectRatio={1} 
              flexShrink={0} 
              borderRadius="md" 
              overflow="hidden" 
              bg="gray.100" _dark={{ bg: "whiteAlpha.100" }} 
              border="1px solid" borderColor="border"
              boxShadow="sm"
            >
              {coverUrl ? (
                <Image src={coverUrl} alt={track.title} w="100%" h="100%" objectFit="cover" />
              ) : (
                <Flex w="100%" h="100%" align="center" justify="center">
                  <Icon as={Music} boxSize={12} color="fg.muted" />
                </Flex>
              )}
            </Box>
          </Flex>
        </Box>

        {/* =========================================
            3. BODY SECTION (Two Columns)
            ========================================= */}
        <SimpleGrid columns={{ base: 1, lg: 3 }} gap={8}>
          
          {/* LEFT COLUMN: Artist & Tags */}
          <Box gridColumn={{ lg: 'span 2' }}>
            
            {/* Artist Mini-Profile */}
            <HStack align="center" mb={8} gap={4}>
              <Box 
                w="56px" h="56px" borderRadius="full" display="flex" alignItems="center" justifyContent="center"
                bg="gray.100" _dark={{ bg: "whiteAlpha.200" }} border="1px solid" borderColor="border" 
              >
                <Text fontWeight="bold" fontSize="lg" color="fg.muted">{artistName.charAt(0)}</Text>
              </Box>
              <VStack align="start" gap={0}>
                <Text fontWeight="700" fontSize="md" color="fg">{artistName}</Text>
                <Text fontSize="xs" color="fg.muted">Artist</Text>
              </VStack>
            </HStack>

            {/* Genres & Styles */}
            <Box mb={8}>
              <HStack gap={2} mb={3}>
                <Icon as={Tag} boxSize={4} color="fg.muted" />
                <Text fontSize="sm" fontWeight="600" color="fg">Tags & Genres</Text>
              </HStack>
              <HStack gap={2} flexWrap="wrap">
                {track.genre && track.genre.split(',').map((g: string) => (
                  <Badge key={g} colorPalette="blue" variant="surface" px={3} py={1} borderRadius="full" fontWeight="500">{g.trim()}</Badge>
                ))}
                {track.style && track.style.split(',').map((s: string) => (
                  <Badge key={s} colorPalette="gray" variant="surface" px={3} py={1} borderRadius="full" fontWeight="500">{s.trim()}</Badge>
                ))}
              </HStack>
            </Box>

            {/* ML Tags */}
            {track.ml_characteristics && track.ml_characteristics.length > 0 && (
              <Box mb={8}>
                <Text fontSize="xs" fontWeight="700" color="fg.muted" textTransform="uppercase" letterSpacing="widest" mb={3}>
                  Machine Learning Characteristics
                </Text>
                <HStack flexWrap="wrap" gap={2}>
                  {track.ml_characteristics.map((char: string) => (
                    <Badge 
                      key={char} px={3} py={1} borderRadius="sm" fontWeight="500"
                      bg="gray.100" color="gray.700" _dark={{ bg: "whiteAlpha.200", color: "whiteAlpha.900" }}
                    >
                      {char}
                    </Badge>
                  ))}
                </HStack>
              </Box>
            )}
          </Box>

          {/* RIGHT COLUMN: Acoustic Insights Sidebar */}
          <Box gridColumn={{ lg: 'span 1' }}>
            <Text fontSize="xs" fontWeight="700" color="fg.muted" textTransform="uppercase" letterSpacing="widest" mb={4}>
              Acoustic Insights
            </Text>
            
            <VStack align="stretch" gap={3}>
              <InsightBox icon={Activity} label="Tempo" value={track.bpm ? `${Math.round(track.bpm)} BPM` : '--'} />
              <InsightBox icon={Hash} label="Musical Key" value={track.musical_key ? `${track.musical_key} ${track.scale}` : '--'} />
              <InsightBox icon={Clock} label="Duration" value={formatDuration(track.duration)} />
              <InsightBox icon={Zap} label="Energy" value={track.energy ? `${Math.round(track.energy * 100)}%` : '--'} />
            </VStack>
          </Box>

        </SimpleGrid>

      </Box>
    </VStack>
  );
};

// SoundCloud-style Insight Row (Adaptive Theme)
const InsightBox = ({ icon, label, value }: { icon: any, label: string, value: string }) => (
  <HStack p={3} bg="bg.panel" borderRadius="md" border="1px solid" borderColor="border" justify="space-between">
    <HStack color="fg.muted" gap={3}>
      <Icon as={icon} boxSize={4} />
      <Text fontSize="xs" fontWeight="600">{label}</Text>
    </HStack>
    <Text fontSize="sm" fontWeight="700" color="fg" fontFamily="mono">{value}</Text>
  </HStack>
);

const formatDuration = (s: number) => {
  if (!s) return '--:--';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};