import React, { useState } from 'react';
import { 
  Box, VStack, HStack, Text, Heading, SimpleGrid, 
  Icon, Spinner, Badge, Button, Separator
} from '@chakra-ui/react';
import { 
   Music, ListMusic, HardDrive, Activity, PlayCircle, Clock 
} from 'lucide-react';
import { useDashboard } from '../hook/useDashboard';
import { useNavigate } from 'react-router-dom';
import { HydraBackground } from '../../../components/hydra/HydraBackground';
import { DEFAULT_HYDRA_SCRIPT } from '../../../components/hydra/presets/default';

export const DashboardView: React.FC = () => {
  const { stats, recentTracks, nowPlaying, isLoading } = useDashboard();
  const navigate = useNavigate();
  
  // ⚡️ Hold the script in state for future live-editing capabilities
  const [hydraScript ] = useState(DEFAULT_HYDRA_SCRIPT);

  if (isLoading) {
    return (
      <VStack justify="center" h="50vh" gap={4}>
        <Spinner size="xl" color="blue.500" borderWidth="3px" />
        <Text color="gray.500" fontWeight="500" animation="pulse 2s infinite">Syncing station...</Text>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" gap={10} animation="fade-in 0.5s ease-out">
      
      {/* =========================================
          1. NOW PLAYING HERO (With Hydra Synth)
          ========================================= */}
<Box 
        borderRadius="3xl" 
        p={10} 
        color="white" 
        position="relative" 
        overflow="hidden"
        boxShadow="xl"
        bg="black" 
      >
        {/* 1. The live Hydra synthesizer background */}
        <HydraBackground script={hydraScript} />
        
        {/* 2. ⚡️ THE OVERLAY: A semi-transparent black shield for text legibility */}
        <Box position="absolute" inset="0" bgGradient="to-r" gradientFrom="blackAlpha.800" gradientTo="transparent" zIndex={0} pointerEvents="none" />
        
        {/* 3. The Content (Notice zIndex={1} keeps it above the overlay) */}
        <HStack justify="space-between" position="relative" zIndex={1} flexWrap="wrap" gap={8}>
          
          <VStack align="start" gap={5} flex="1">
            <HStack gap={3}>
              <Badge bg="red.500" color="white" border="none" px={3} py={1.5} borderRadius="full" boxShadow="0 0 15px rgba(239, 68, 68, 0.4)">
                <HStack gap={1.5}>
                  <Box w="6px" h="6px" bg="white" borderRadius="full" animation="pulse-fast 1s infinite" />
                  <Text fontWeight="bold" fontSize="xs" letterSpacing="widest">ON AIR</Text>
                </HStack>
              </Badge>
              <LiveEqualizer />
            </HStack>
            
            <Box>
              {/* 1. Artist Name */}
              <Text fontSize="xl" color="blue.200" mb={1} fontWeight="500">
                {getArtistName(nowPlaying?.artist)}
              </Text>
              
              {/* 2. ⚡️ Title Track (Heading usually needs to be forced) */}
              <Heading size="4xl" fontWeight="bold" letterSpacing="tighter" mb={4} maxW="800px" lineClamp={2}>
                {nowPlaying?.title || "Station Tuning..."}
              </Heading>
              
              <HStack color="whiteAlpha.800" fontSize="sm" gap={6} bg="whiteAlpha.100" px={4} py={2} borderRadius="full" display="inline-flex" backdropFilter="blur(10px)">
                <HStack gap={2}>
                  <Icon as={ListMusic} boxSize="16px" color="blue.300" />
                  
                  {/* 3. ⚡️ Station Overview / Playlist Name */}
                  <Text fontWeight="500">
                    {nowPlaying?.playlist_name || "Station Overview"}
                  </Text>
                </HStack>
                <Box w="4px" h="4px" bg="whiteAlpha.400" borderRadius="full" />
                <HStack gap={2}>
                  <Icon as={Clock} boxSize="16px" color="blue.300" />
                  <LiveCountdown endsAt={nowPlaying?.ends_at} />
                </HStack>
              </HStack>
            </Box>
          </VStack>

          <Button 
            bg="white" 
            color="gray.900" 
            size="xl" 
            w="80px" 
            h="80px" 
            borderRadius="full" 
            boxShadow="0 10px 25px rgba(0,0,0,0.3)"
            _hover={{ transform: 'scale(1.05)', bg: 'gray.100' }}
            _active={{ transform: 'scale(0.95)' }}
            transition="all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)"
            flexShrink={0}
          >
            <PlayCircle size={40} fill="currentColor" />
          </Button>

        </HStack>
      </Box>

      {/* =========================================
          2. STATS GRID (Clean & Modern)
          ========================================= */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={6}>
        <StatCard icon={Music} label="Library" value={stats?.totalTracks?.toString() || "0"} color="blue" />
        <StatCard icon={ListMusic} label="Active Playlists" value={stats?.totalPlaylists?.toString() || "0"} color="purple" />
        <StatCard icon={HardDrive} label="Storage Used" value={stats?.storageUsed || "0 GB"} color="orange" />
        <StatCard icon={Activity} label="System Uptime" value={stats?.uptime || "0h"} color="green" />
      </SimpleGrid>

      <Separator borderColor="gray.100" />

      {/* =========================================
          3. RECENT INGESTS (Library Consistent)
          ========================================= */}
      <Box>
        <HStack justify="space-between" mb={6}>
          <Heading size="lg" color="gray.800" fontWeight="bold" letterSpacing="tight">
            Recently Played
          </Heading>
          <Button variant="ghost" size="sm" color="blue.500" onClick={() => navigate('/library')}>
            View All
          </Button>
        </HStack>
        
        <VStack align="stretch" gap={3}>
          {recentTracks
            ?.slice()
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((track: any, index: number) => (
            <HStack 
              key={track.id || `recent-${index}`} 
              justify="space-between" 
              p={3} pl={4}
              bg="gray.50" 
              borderRadius="2xl" 
              borderWidth="1px" 
              borderColor="transparent"
              _hover={{ bg: "white", borderColor: "gray.200", boxShadow: "sm", transform: "translateY(-1px)" }}
              transition="all 0.2s"
              className="group"
            >
              <HStack gap={4}>
                {/* Unified Artwork Block */}
                <Box w="48px" h="48px" borderRadius="xl" overflow="hidden" bg="gray.100" border="1px solid" borderColor="gray.200" display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
                  {track.cover_url ? (
                    <img src={track.cover_url} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Icon as={Music} color="gray.400" boxSize={5} />
                  )}
                </Box>

                <VStack align="start" gap={0.5}>
                  <Text fontWeight="bold" color="gray.900">{track.title || 'Unknown Track'}</Text>
                  <Text fontSize="sm" color="gray.500">{getArtistName(track.artist)}</Text>
                </VStack>
              </HStack>
              
              <HStack gap={6}>
                {/* Genre Badge (Consistent with Library) */}
                {track.genre && (
                  <Badge size="sm" colorPalette={getColorForGenre(track.genre)} variant="subtle" borderRadius="md" px={2} display={{ base: 'none', md: 'inline-flex' }}>
                    {track.genre}
                  </Badge>
                )}

                {/* BPM Badge (Consistent with Library) */}
                {track.bpm ? (
                  <Badge size="sm" bg={getBpmStyle(Math.round(track.bpm)).bg} color={getBpmStyle(Math.round(track.bpm)).color} border="none" borderRadius="md" px={2.5} fontWeight="700">
                    {Math.round(track.bpm)}
                  </Badge>
                ) : null}

                {/* Fixed Duration Formatting */}
                <Text color="gray.500" fontSize="sm" fontWeight="mono" w="45px" textAlign="right">
                  {formatDuration(track.duration)}
                </Text>

                {/* Smart Relative Time */}
                <Text color="gray.400" fontSize="xs" fontWeight="medium" w="80px" textAlign="right">
                  {timeAgo(track.created_at)}
                </Text>
              </HStack>
            </HStack>
          ))}
        </VStack>
      </Box>

      {/* Global Animation Styles */}
      <style>{`
        @keyframes pulse-fast {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes eq {
          0% { height: 4px; }
          50% { height: 16px; }
          100% { height: 4px; }
        }
      `}</style>
    </VStack>
  );
};

// --- Sub-Components ---

const StatCard = ({ icon, label, value, color }: { icon: any, label: string, value: string, color: string }) => (
  <Box p={6} bg="white" borderRadius="3xl" borderWidth="1px" borderColor="gray.100" boxShadow="sm" transition="all 0.2s" _hover={{ boxShadow: 'md', transform: 'translateY(-2px)' }}>
    <HStack gap={4} mb={4}>
      <Box p={3} bg={`${color}.50`} color={`${color}.500`} borderRadius="2xl">
        <Icon as={icon} boxSize="22px" strokeWidth={2.5} />
      </Box>
      <Text color="gray.500" fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wider">
        {label}
      </Text>
    </HStack>
    <Heading size="3xl" color="gray.900" letterSpacing="tighter">{value}</Heading>
  </Box>
);

const LiveEqualizer = () => (
  <HStack gap={1} h="16px" align="flex-end">
    <Box w="3px" bg="blue.400" borderRadius="full" animation="eq 1.2s ease-in-out infinite" />
    <Box w="3px" bg="blue.300" borderRadius="full" animation="eq 0.9s ease-in-out infinite 0.2s" />
    <Box w="3px" bg="blue.400" borderRadius="full" animation="eq 1.1s ease-in-out infinite 0.4s" />
    <Box w="3px" bg="blue.500" borderRadius="full" animation="eq 1s ease-in-out infinite 0.1s" />
  </HStack>
);

// --- Helpers ---

const getArtistName = (artistData: any): string => {
  if (!artistData) return "Unknown Artist";
  if (typeof artistData === 'string') return artistData;
  if (typeof artistData === 'object' && 'name' in artistData) return artistData.name || "Unknown Artist";
  return "Unknown Artist";
};

const formatDuration = (s: number | undefined) => {
  if (!s || isNaN(s)) return '-:--';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60); 
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const timeAgo = (dateString: string) => {
  if (!dateString) return "New";
  const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
};

const getColorForGenre = (genre: string) => {
  const colors = ['red', 'orange', 'green', 'teal', 'blue', 'cyan', 'purple', 'pink'];
  let hash = 0;
  for (let i = 0; i < genre.length; i++) {
    hash = genre.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getBpmStyle = (bpm: number) => {
  if (!bpm) return { bg: 'gray.100', color: 'gray.400' };
  if (bpm < 105) return { bg: 'gray.100', color: 'gray.500' }; 
  if (bpm < 120) return { bg: 'gray.200', color: 'gray.700' }; 
  if (bpm <= 128) return { bg: 'gray.300', color: 'gray.900' }; 
  if (bpm <= 140) return { bg: 'gray.600', color: 'white' }; 
  return { bg: 'gray.900', color: 'white' }; 
};

const LiveCountdown = ({ endsAt }: { endsAt?: string }) => {
  const [timeLeft, setTimeLeft] = React.useState("0:00");

  React.useEffect(() => {
    if (!endsAt) {
      setTimeLeft("0:00");
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const end = new Date(endsAt).getTime();
      const diffInSeconds = Math.floor((end - now) / 1000);

      if (diffInSeconds <= 0) {
        setTimeLeft("0:00");
        return false; 
      }

      const m = Math.floor(diffInSeconds / 60);
      const s = diffInSeconds % 60;
      setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
      return true; 
    };

    calculateTimeLeft();

    const interval = setInterval(() => {
      const keepGoing = calculateTimeLeft();
      if (!keepGoing) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval); 
  }, [endsAt]);

  return <Text fontWeight="500">{timeLeft} remaining</Text>;
};