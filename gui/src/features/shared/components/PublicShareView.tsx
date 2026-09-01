import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Spinner,
  Icon,
  Button,
  Badge,
  Flex,
} from '@chakra-ui/react';
import { Play, Pause, Download, AlertCircle, Music, Radio } from 'lucide-react';
import { api } from '../../../services/api';

const getApiBaseUrl = () => {
  const configUrl = (window as any).__RUNTIME_CONFIG__?.API_URL;
  const envUrl = import.meta.env.VITE_API_URL;
  const base = configUrl || envUrl || 'http://localhost:8081';
  return base.replace(/\/api\/v1\/?$/, '');
};

export const PublicShareView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchShare = async () => {
      try {
        const res = await api.getPublicShare(token!);
        setData(res);
      } catch (err: any) {
        setError(err.response?.data?.error || "This link is invalid or has expired.");
      } finally {
        setLoading(false);
      }
    };
    fetchShare();
  }, [token]);

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

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Number(e.target.value);
      setProgress(Number(e.target.value));
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Detailed format for the metadata row (e.g., "4 min 58 sec")
  const formatDurationLong = (time: number) => {
    if (isNaN(time)) return '0 min';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m} min ${s} sec`;
  };

  if (loading) {
    return (
      <Flex w="100vw" h="100vh" align="center" justify="center" bg="gray.900">
        <Spinner size="xl" color="blue.500" />
      </Flex>
    );
  }

  if (error || !data) {
    return (
      <Flex w="100vw" h="100vh" align="center" justify="center" bg="gray.900" p={4}>
        <VStack gap={4} p={8} bg="whiteAlpha.100" backdropFilter="blur(10px)" borderRadius="2xl" maxW="md" textAlign="center" border="1px solid" borderColor="whiteAlpha.200">
          <Icon as={AlertCircle} boxSize={12} color="red.400" />
          <Heading size="md" color="white">Track Unavailable</Heading>
          <Text color="gray.400">{error}</Text>
        </VStack>
      </Flex>
    );
  }

  const { track, allow_download } = data;
  const artistName = track.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';
  const albumName = track.album?.title || 'Single';
  
  const streamUrl = `${getApiBaseUrl()}${track.stream_url}`;
  const downloadUrl = `${getApiBaseUrl()}/api/v1/public/shares/${token}/download`;

  return (
    <Flex w="100vw" h="100vh" align="center" justify="center" position="relative" overflow="hidden" bg="gray.900">
      
      {/* 1. Dynamic Blurred Background */}
      <Box position="absolute" top={0} left={0} w="100%" h="100%" zIndex={0}>
        {track.cover_url ? (
          <Box
            w="100%" h="100%"
            backgroundImage={`url(${track.cover_url})`}
            backgroundSize="cover"
            backgroundPosition="center"
            filter="blur(80px) brightness(0.4)"
            transform="scale(1.2)"
          />
        ) : (
          <Box w="100%" h="100%" bgGradient="linear(to-br, gray.800, gray.900)" />
        )}
      </Box>

      {/* 2. Top Bar: "Shared by" (Matches screenshot info) */}
      <Flex position="absolute" top={0} left={0} w="100%" p={{ base: 4, md: 8 }} zIndex={10} justify="space-between" align="center">
        <HStack gap={3}>
           <Box bg="whiteAlpha.200" p={2.5} borderRadius="lg" backdropFilter="blur(12px)" border="1px solid" borderColor="whiteAlpha.200">
             <Icon as={Radio} color="white" boxSize={5} />
           </Box>
           <VStack gap={0} align="start">
             <Text fontSize="xs" color="whiteAlpha.600" fontWeight="600" textTransform="uppercase" letterSpacing="wider">
               Shared via
             </Text>
             <Text fontSize="sm" color="white" fontWeight="700" letterSpacing="tight">
               Momo.Radio
             </Text>
           </VStack>
        </HStack>
      </Flex>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={streamUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />

      {/* 3. Glassmorphism Player Card */}
      <VStack 
        zIndex={1} 
        w="90%" 
        maxW="440px" 
        bg="whiteAlpha.100" 
        backdropFilter="blur(32px)" 
        borderRadius="3xl" 
        p={{ base: 6, md: 8 }} 
        gap={6} 
        border="1px solid" 
        borderColor="whiteAlpha.300" 
        shadow="dark-lg"
      >
        {/* Cover Art */}
        <Box 
          w="100%" 
          aspectRatio={1} 
          borderRadius="2xl" 
          overflow="hidden" 
          bg="gray.800" 
          display="flex" 
          alignItems="center" 
          justifyContent="center"
          shadow="xl"
        >
          {track.cover_url ? (
            <img src={track.cover_url} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Icon as={Music} boxSize={20} color="gray.600" />
          )}
        </Box>

        {/* Metadata */}
        <VStack gap={1.5} textAlign="center" w="100%">
          <Heading size="xl" color="white" fontWeight="700" letterSpacing="tight" lineClamp={1}>
            {track.title}
          </Heading>
          <Text color="whiteAlpha.800" fontSize="md" fontWeight="500">
            {artistName}
          </Text>
          
          {/* Detailed Info Row (Matches screenshot context) */}
          <Text fontSize="sm" color="whiteAlpha.600" fontWeight="500" mt={1}>
            1 track • {formatDurationLong(track.duration)} • Album: {albumName}
          </Text>
        </VStack>

        <HStack gap={2} justify="center" flexWrap="wrap">
          {track.bpm && <Badge size="sm" bg="whiteAlpha.200" color="white" border="none" borderRadius="full" px={3}>{Math.round(track.bpm)} BPM</Badge>}
          {track.musical_key && <Badge size="sm" bg="whiteAlpha.200" color="white" border="none" borderRadius="full" px={3}>{track.musical_key} {track.scale}</Badge>}
        </HStack>

        {/* Scrubber / Progress Bar */}
        <VStack w="100%" gap={2} pt={2}>
          <input 
            type="range" 
            min={0} 
            max={track.duration || 100} 
            value={progress} 
            onChange={handleSeek}
            style={{ 
              width: '100%', 
              cursor: 'pointer',
              accentColor: 'var(--chakra-colors-blue-500)'
            }} 
          />
          <HStack w="100%" justify="space-between">
            <Text fontSize="xs" color="whiteAlpha.700" fontWeight="600">{formatTime(progress)}</Text>
            <Text fontSize="xs" color="whiteAlpha.700" fontWeight="600">{formatTime(track.duration)}</Text>
          </HStack>
        </VStack>

        {/* Controls */}
        <HStack w="100%" justify="center" gap={6} pt={2}>
          <Button 
            w="64px" h="64px" borderRadius="full" bg="white" color="gray.900" 
            _hover={{ bg: "gray.200", transform: "scale(1.05)" }}
            _active={{ transform: "scale(0.95)" }}
            transition="all 0.2s" onClick={togglePlay} p={0}
          >
            <Icon as={isPlaying ? Pause : Play} boxSize={7} fill="currentColor" ml={isPlaying ? "0" : "4px"} />
          </Button>
        </HStack>

        {/* Conditional Download Button */}
        {allow_download && (
          <Box w="100%" pt={5} borderTop="1px solid" borderColor="whiteAlpha.200">
            <a href={downloadUrl} style={{ width: '100%', textDecoration: 'none', display: 'block' }}>
              <Button 
                w="100%" variant="surface" bg="whiteAlpha.200" color="white"
                _hover={{ bg: "whiteAlpha.300" }} borderRadius="xl" h="48px"
              >
                <Icon as={Download} boxSize={4} mr={2} />
                Download Track
              </Button>
            </a>
          </Box>
        )}
      </VStack>

      {/* 4. Footer (Matches screenshot context) */}
      <Flex position="absolute" bottom={0} left={0} w="100%" p={{ base: 4, md: 8 }} zIndex={10} justify="center" align="center">
         <Text fontSize="sm" color="whiteAlpha.600" fontWeight="500">
            Powered by <Box as="span" color="white" fontWeight="700">Momo.Radio</Box>
         </Text>
      </Flex>
      
    </Flex>
  );
};