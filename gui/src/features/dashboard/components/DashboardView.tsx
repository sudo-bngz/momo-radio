import React from 'react';
import { 
  Box, VStack, HStack, Text, Heading, SimpleGrid, 
  Icon, Spinner, Badge, Button, Separator 
} from '@chakra-ui/react';
import { 
  Radio, Music, ListMusic, HardDrive, Activity, PlayCircle, Clock 
} from 'lucide-react';
import { useDashboard } from '../hook/useDashboard';

export const DashboardView: React.FC = () => {
  const { stats, recentTracks, nowPlaying, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <VStack justify="center" h="50vh" gap={4}>
        <Spinner size="xl" color="blue.500"/>
        <Text color="gray.500">Syncing with station...</Text>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" gap={10} animation="fade-in 0.4s ease-out">
      
      {/* 1. NOW PLAYING HERO */}
      <Box 
        bg="gray.900" 
        borderRadius="2xl" 
        p={8} 
        color="white" 
        position="relative" 
        overflow="hidden"
        boxShadow="2xl"
      >
        <Icon as={Radio} position="absolute" right="-5%" top="-20%" boxSize="300px" color="whiteAlpha.100" />
        
        <HStack justify="space-between" position="relative" zIndex={1}>
          <VStack align="start" gap={4}>
            <Badge colorPalette="red" variant="solid" px={3} py={1} borderRadius="full">
              <HStack gap={1}>
                <Box w="6px" h="6px" bg="white" borderRadius="full" />
                <Text fontWeight="bold">ON AIR</Text>
              </HStack>
            </Badge>
            
            <Box>
              <Text fontSize="lg" color="gray.400" mb={1}>{nowPlaying.artist || "Momo Radio"}</Text>
              <Heading size="3xl" fontWeight="semibold" letterSpacing="tight" mb={2}>
                {nowPlaying.title || "Tuning in..."}
              </Heading>
              <HStack color="blue.300" fontSize="sm" gap={6}>
                <HStack gap={1}>
                  <Icon as={ListMusic} boxSize="14px" />
                  {/* Fixed mapping for the new Go Backend structure */}
                  <Text>{nowPlaying.playlist_name || "General Rotation"}</Text>
                </HStack>
                <HStack gap={1}>
                  <Icon as={Clock} boxSize="14px" />
                  <Text>{nowPlaying.timeRemaining || "0:00"} remaining</Text>
                </HStack>
              </HStack>
            </Box>
          </VStack>

          <Button 
            bg="white" 
            color="gray.900" 
            size="xl" 
            w="72px" 
            h="72px" 
            borderRadius="full" 
            _hover={{ transform: 'scale(1.1)', bg: 'blue.50' }}
            transition="all 0.2s"
          >
            <PlayCircle size={36} fill="currentColor" />
          </Button>
        </HStack>
      </Box>

      {/* 2. STATS GRID */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={6}>
        <StatCard icon={Music} label="Library Size" value={stats.totalTracks.toString()} color="blue" />
        <StatCard icon={ListMusic} label="Playlists" value={stats.totalPlaylists.toString()} color="purple" />
        <StatCard icon={HardDrive} label="Cloud Storage" value={stats.storageUsed} color="orange" />
        <StatCard icon={Activity} label="Uptime" value={stats.uptime} color="green" />
      </SimpleGrid>

      <Separator borderColor="gray.100" />

      {/* 3. RECENT INGESTS */}
      <Box>
        <Heading size="md" mb={6} color="gray.800" fontWeight="bold">
          Recently Ingested
        </Heading>
        <VStack align="stretch" gap={3}>
          {recentTracks.map((track, index) => (
            <HStack 
              // Added fallback key to prevent React warnings if ID is missing
              key={track.id || `recent-${index}`} 
              justify="space-between" 
              p={4} 
              bg="gray.50" 
              borderRadius="xl" 
              borderWidth="1px" 
              borderColor="gray.100"
              _hover={{ bg: "white", borderColor: "blue.200", boxShadow: "sm" }}
              transition="all 0.2s"
            >
              <HStack gap={4}>
                <Box p={2.5} bg="white" borderRadius="lg" shadow="xs">
                  <Icon as={Music} boxSize="18px" color="blue.500" />
                </Box>
                <VStack align="start" gap={0}>
                  <Text fontWeight="bold" color="gray.800">{track.title}</Text>
                  <Text fontSize="sm" color="gray.500">{track.artist}</Text>
                </VStack>
              </HStack>
              
              <HStack gap={8}>
                <Text color="gray.400" fontSize="xs" fontWeight="mono">
                  {track.created_at ? new Date(track.created_at).toLocaleDateString() : "New"}
                </Text>
                <Badge variant="outline" colorPalette="gray" size="sm">
                  {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                </Badge>
              </HStack>
            </HStack>
          ))}
        </VStack>
      </Box>
    </VStack>
  );
};

// Internal Stat Card Component
const StatCard = ({ icon, label, value, color }: { icon: any, label: string, value: string, color: string }) => (
  <Box p={6} bg="white" borderRadius="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="sm">
    <HStack gap={4} mb={4}>
      <Box p={3} bg={`${color}.50`} color={`${color}.500`} borderRadius="xl">
        <Icon as={icon} boxSize="20px" />
      </Box>
      <Text color="gray.500" fontWeight="bold" fontSize="sm" textTransform="uppercase" letterSpacing="wider">
        {label}
      </Text>
    </HStack>
    <Heading size="3xl" color="gray.900" letterSpacing="tight">{value}</Heading>
  </Box>
);