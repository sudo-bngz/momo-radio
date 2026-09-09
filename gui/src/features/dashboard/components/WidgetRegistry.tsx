import { Box, VStack, HStack, Text, Grid, Icon, Badge, Button, Flex } from '@chakra-ui/react';
import { Radio, Disc, ListMusic, Clock, Music, HardDrive, Server, Globe, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useDashboard } from '../hook/useDashboard';
import { useAuthStore } from '../../../store/useAuthStore';
import { DashboardCard, CompactStat, EndpointRow, getArtistName, timeAgo, LiveCountdown } from './DashboardWidgets';

export const WidgetRegistry = ({ type }: { type: string }) => {
  const { stats, recentTracks, nowPlaying } = useDashboard();
  const navigate = useNavigate();
  const activeOrgId = useAuthStore((state: any) => state.activeOrganizationId);

  const publicDomain = window.location.hostname === 'localhost' ? 'http://localhost:5173' : 'https://momo.radio';

  switch (type) {
    case 'live-broadcast':
      return (
        <DashboardCard 
          title="Live Broadcast" 
          icon={Radio} 
          rightElement={
            <Badge colorScheme="red" variant="solid" px={2} py={0.5} borderRadius="sm" fontSize="2xs" animation="pulse-fast 2s infinite">
              ON AIR
            </Badge>
          }
        >
          <HStack gap={4} align="center">
            <Box boxSize="80px" borderRadius="md" bg="gray.100" border="1px solid" borderColor="gray.200" overflow="hidden" flexShrink={0}>
              {nowPlaying?.cover_url ? (
                <img src={nowPlaying.cover_url} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Flex w="100%" h="100%" align="center" justify="center">
                  <Icon as={Disc} color="gray.300" boxSize="32px" />
                </Flex>
              )}
            </Box>

            <VStack align="start" gap={1} flex="1">
              <Text fontSize="md" fontWeight="bold" color="gray.900" truncate w="full">
                {nowPlaying?.title || "Waiting for stream..."}
              </Text>
              <Text fontSize="sm" color="gray.500" truncate w="full">
                {getArtistName(nowPlaying?.artist)}
              </Text>
              
              <HStack gap={4} mt={1}>
                <HStack gap={1.5} color="gray.500" fontSize="xs">
                  <Icon as={ListMusic} boxSize="12px" />
                  <Text>{nowPlaying?.playlist_name || "General Rotation"}</Text>
                </HStack>
                <HStack gap={1.5} color="blue.500" fontSize="xs">
                  <Icon as={Clock} boxSize="12px" />
                  <LiveCountdown endsAt={nowPlaying?.ends_at} />
                </HStack>
              </HStack>
            </VStack>
          </HStack>
        </DashboardCard>
      );

    case 'stats':
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
            <Button variant="ghost" size="xs" color="blue.500" onClick={() => navigate('/library')}>
              View All
            </Button>
          }
        >
          <VStack align="stretch" gap={1}>
            {recentTracks?.slice(0, 5).map((track: any, index: number) => (
              <HStack key={track.id || index} justify="space-between" p={2} borderRadius="md" _hover={{ bg: "gray.50" }} transition="all 0.2s">
                <HStack gap={3} overflow="hidden">
                  <Box boxSize="32px" borderRadius="sm" overflow="hidden" bg="gray.100" flexShrink={0}>
                    {track.cover_url ? (
                      <img src={track.cover_url} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Flex w="100%" h="100%" align="center" justify="center">
                        <Icon as={Music} color="gray.400" boxSize="14px" />
                      </Flex>
                    )}
                  </Box>
                  <VStack align="start" gap={0} minW="0">
                    <Text fontSize="sm" fontWeight="500" color="gray.800" truncate w="full">
                      {track.title || 'Unknown Track'}
                    </Text>
                    <Text fontSize="xs" color="gray.500" truncate w="full">
                      {getArtistName(track.artist)}
                    </Text>
                  </VStack>
                </HStack>
                <Text color="gray.400" fontSize="xs" whiteSpace="nowrap">
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

    default:
      return <Box p={4} bg="gray.50" borderRadius="md">Unknown Widget Type</Box>;
  }
};