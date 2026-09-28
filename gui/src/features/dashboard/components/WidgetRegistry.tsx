import { Box, VStack, HStack, Text, Grid, Icon, Badge, Button, Flex } from '@chakra-ui/react';
import { Radio, Disc, ListMusic, Clock, Music, HardDrive, Server, Globe, Activity, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useDashboard } from '../hook/useDashboard';
import { useAuthStore } from '../../../store/useAuthStore';
import { useBroadcastStore } from '../../../store/useBroadcast';
import { DashboardCard, CompactStat, EndpointRow, getArtistName, timeAgo, LiveCountdown } from './DashboardWidgets';

export const WidgetRegistry = ({ type }: { type: string }) => {
  const activeOrgId = useAuthStore((state: any) => state.activeOrganizationId);
  
  // ⚡️ FIXED: Pass activeOrgId to useDashboard to ensure it targets the correct SSE stream
  const { stats, recentTracks, nowPlaying } = useDashboard(activeOrgId); 
  const isLive = useBroadcastStore((state: any) => state.isLive);
  
  const navigate = useNavigate();

  const publicDomain = window.location.hostname === 'localhost' ? 'http://localhost:5173' : 'https://momoradio.fm';

  switch (type) {
    case 'live-broadcast': {
      // ⚡️ FIXED: Safe artist parsing logic identical to TopNav to handle arrays
      let safeArtistName = "Unknown Artist";
      if (nowPlaying?.artist) {
        if (typeof nowPlaying.artist === 'string') {
          safeArtistName = nowPlaying.artist;
        } else if (Array.isArray(nowPlaying.artist)) {
          safeArtistName = (nowPlaying.artist as any[])
            .map((a: any) => (typeof a === 'string' ? a : (a?.name || "Unknown Artist")))
            .filter(Boolean)
            .join(', ');
        } else if (typeof nowPlaying.artist === 'object') {
          safeArtistName = (nowPlaying.artist as any).name || "Unknown Artist";
        }
      }

      return (
        <DashboardCard 
          title="Live Broadcast" 
          icon={Radio} 
          rightElement={
            <Badge 
              bg={isLive ? "red.500" : "gray.500"} 
              color="white" 
              px={2} 
              py={0.5} 
              borderRadius="sm" 
              fontSize="2xs" 
              animation={isLive ? "pulse-fast 2s infinite" : "none"}
            >
              {isLive ? "ON AIR" : "OFF AIR"}
            </Badge>
          }
        >
          <HStack gap={4} align="center">
            <Box 
              boxSize="80px" borderRadius="md" bg="gray.50" _dark={{ bg: "whiteAlpha.50" }} 
              border="1px solid" borderColor="border" overflow="hidden" flexShrink={0}
            >
              {isLive && nowPlaying?.cover_url ? (
                <img src={nowPlaying.cover_url} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Flex w="100%" h="100%" align="center" justify="center">
                  <Icon as={Disc} color="gray.300" _dark={{ color: "gray.500" }} boxSize="32px" />
                </Flex>
              )}
            </Box>

            <VStack align="start" gap={1} flex="1">
              <Text fontSize="md" fontWeight="bold" color={isLive ? "fg" : "fg.muted"} truncate w="full">
                {isLive ? (nowPlaying?.title || "Waiting for stream...") : "Offline"}
              </Text>
              <Text fontSize="sm" color="fg.muted" truncate w="full">
                {isLive ? safeArtistName : "-"}
              </Text>
              
              {isLive && (
                <HStack gap={4} mt={1}>
                  <HStack gap={1.5} color="fg.muted" fontSize="xs">
                    <Icon as={ListMusic} boxSize="12px" />
                    <Text>{nowPlaying?.playlist_name || "General Rotation"}</Text>
                  </HStack>
                  <HStack gap={1.5} color="blue.500" _dark={{ color: "blue.400" }} fontSize="xs">
                    <Icon as={Clock} boxSize="12px" />
                    <LiveCountdown endsAt={nowPlaying?.ends_at} />
                  </HStack>
                </HStack>
              )}
            </VStack>
          </HStack>
        </DashboardCard>
      );
    }

    case 'system-stats':
      return (
        <DashboardCard title="System Metrics" icon={Activity}>
          <Grid templateColumns="repeat(2, 1fr)" gap={3}>
            <CompactStat icon={Music} label="Tracks" value={stats?.totalTracks?.toString() || "0"} color="blue" />
            <CompactStat icon={ListMusic} label="Playlists" value={stats?.totalPlaylists?.toString() || "0"} color="purple" />
            <CompactStat icon={HardDrive} label="Storage" value={stats?.storageUsed || "0 GB"} color="orange" />
            <CompactStat icon={Server} label="Uptime" value={stats?.uptime || "0%"} color="green" />
          </Grid>
        </DashboardCard>
      );

    case 'recent-tracks':
      return (
        <DashboardCard 
          title="Recently Played" 
          icon={Clock} 
          rightElement={
            <Button variant="ghost" size="xs" color="blue.500" _dark={{ color: "blue.400" }} onClick={() => navigate('/library')}>
              View All
            </Button>
          }
        >
          <VStack align="stretch" gap={1}>
            {recentTracks?.slice(0, 5).map((track: any, index: number) => (
              <HStack 
                key={track.id || index} justify="space-between" p={2} borderRadius="md" 
                _hover={{ bg: "gray.50", _dark: { bg: "whiteAlpha.100" } }} transition="all 0.2s"
              >
                <HStack gap={3} overflow="hidden">
                  <Box 
                    boxSize="32px" borderRadius="sm" overflow="hidden" flexShrink={0}
                    bg="gray.50" _dark={{ bg: "whiteAlpha.50" }}
                  >
                    {track.cover_url ? (
                      <img src={track.cover_url} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Flex w="100%" h="100%" align="center" justify="center">
                        <Icon as={Music} color="gray.300" _dark={{ color: "gray.500" }} boxSize="14px" />
                      </Flex>
                    )}
                  </Box>
                  <VStack align="start" gap={0} minW="0">
                    <Text fontSize="sm" fontWeight="500" color="fg" truncate w="full">
                      {track.title || 'Unknown Track'}
                    </Text>
                    <Text fontSize="xs" color="fg.muted" truncate w="full">
                      {getArtistName(track.artist)}
                    </Text>
                  </VStack>
                </HStack>
                <Text color="fg.muted" fontSize="xs" whiteSpace="nowrap">
                  {timeAgo(track.created_at || track.played_at)}
                </Text>
              </HStack>
            ))}
          </VStack>
        </DashboardCard>
      );

    case 'endpoints':
      return (
        <DashboardCard title="Endpoints" icon={Globe}>
          <VStack align="stretch" gap={3}>
            <EndpointRow label="HLS Live Stream" url={`${publicDomain}/api/v1/hls/${activeOrgId}/live.m3u8`} />
            <EndpointRow label="Icecast Stream (128kbps)" url={`${publicDomain}/listen/${activeOrgId}/radio.mp3`} />
            <EndpointRow label="Public Station Page" url={`${publicDomain}/public/${activeOrgId}`} />
          </VStack>
        </DashboardCard>
      );

    case 'public-page':
      const publicUrl = `${publicDomain}/public/${activeOrgId}`;
      return (
        <DashboardCard 
          title="Public Page" 
          icon={Globe}
          rightElement={
            <Button 
              asChild
              variant="ghost" 
              size="xs" 
              color="purple.500" 
              _dark={{ color: "purple.400" }}
              display="flex"
              alignItems="center"
              gap={1}
            >
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                Visit <Icon as={ExternalLink} boxSize={3.5} />
              </a>
            </Button>
          }
        >
          <VStack h="100%" justify="center" align="stretch" gap={4}>
            <Box p={5} bg="gray.50" _dark={{ bg: "whiteAlpha.50" }} borderRadius="lg" border="1px solid" borderColor="border" textAlign="center">
              <Flex 
                w="48px" h="48px" bg="purple.100" color="purple.500" 
                _dark={{ bg: "purple.900/40", color: "purple.300" }} 
                borderRadius="full" align="center" justify="center" mx="auto" mb={3}
              >
                <Icon as={Globe} boxSize={6} />
              </Flex>
              <Text fontSize="sm" fontWeight="600" color="fg">Your Web Radio is Live</Text>
              <Text fontSize="xs" color="fg.muted" mb={4}>Share this link with your listeners to tune in directly from their browser.</Text>
              
              <Box textAlign="left">
                <EndpointRow label="Direct URL" url={publicUrl} />
              </Box>
            </Box>
          </VStack>
        </DashboardCard>
      );

    default:
      return <Box p={4} bg="bg.panel" borderRadius="md" border="1px solid" borderColor="border">Unknown Widget Type</Box>;
  }
};