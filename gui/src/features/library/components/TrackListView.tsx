import React, { useState, useEffect } from 'react';
import { Box, VStack, HStack, Text, Spinner, Table, Badge, Icon, Button } from '@chakra-ui/react';
import { Play, Pause, Music, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLibrary } from '../hook/useLibrary';
import { usePlayer } from '../../../context/PlayerContext';
import { TrackDetailDrawer } from './TrackDetailDrawer'; 
import { api } from '../../../services/api';
import { toaster } from '../../../components/ui/toaster';
import { useSearchStore } from '../../../store/useSearchStore';

interface TrackListViewProps {
  sortBy: string;
}

export const TrackListView: React.FC<TrackListViewProps> = ({ sortBy }) => {
  const navigate = useNavigate();
  const { globalSearch } = useSearchStore();
const { 
    tracks, setTracks, globalTotal, isLoading, 
    isFetchingMore, setSearchQuery, setSortBy, loadMore, hasMore
  } = useLibrary();

  // 5. Sync the global search with your local hook
  useEffect(() => { 
    setSearchQuery(globalSearch); 
  }, [globalSearch, setSearchQuery]);
  useEffect(() => { setSortBy(sortBy as any); }, [sortBy, setSortBy]);

  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayer();
  const [selectedTrack, setSelectedTrack] = useState<any | null>(null);

  const formatDuration = (s: number) => {
    if (!s) return '-';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      if (hasMore && !isFetchingMore && !isLoading) loadMore();
    }
  };

  const handleRetry = async (e: React.MouseEvent, trackId: number) => {
    e.stopPropagation();
    try {
      await api.analysis(trackId);
      toaster.create({ title: "Analysis Restarted", type: "info" });
      setTracks(prev => prev.map(t => t.id === trackId ? { ...t, processing_status: 'pending' } : t));
    } catch (error) {
      toaster.create({ title: "Failed to restart", type: "error" });
    }
  };

return (
    <VStack align="stretch" h="100%" gap={0}>
      {/* ⚡️ Standalone text removed from here! */}

      <Box flex="1" overflowY="auto" onScroll={handleScroll}
        css={{
          '&::-webkit-scrollbar': { width: '8px' },
          '&::-webkit-scrollbar-thumb': { background: 'var(--chakra-colors-gray-200)', borderRadius: '4px' },
        }}
      >
        {isLoading && tracks.length === 0 ? (
          <VStack justify="center" h="100%"><Spinner size="xl" color="blue.500" /></VStack>
        ) : (
          <>
            <Table.Root css={{
              "& th": { borderBottom: "1px solid var(--chakra-colors-gray-200)", py: 4, fontWeight: "500", color: "var(--chakra-colors-gray-600)" },
              "& td": { py: 3, borderBottom: "1px solid var(--chakra-colors-gray-50)", color: "var(--chakra-colors-gray-800)" }
            }}>
              <Table.Header position="sticky" top={0} bg="white" zIndex={1}>
                <Table.Row>
                  <Table.ColumnHeader w="50px"></Table.ColumnHeader>
                  <Table.ColumnHeader w="64px">Artwork</Table.ColumnHeader>
                  {/* ⚡️ The count is now cleanly tucked into the header! */}
                  <Table.ColumnHeader>Track ({globalTotal})</Table.ColumnHeader>
                  <Table.ColumnHeader>Artist</Table.ColumnHeader>
                  <Table.ColumnHeader>Album</Table.ColumnHeader>
                  <Table.ColumnHeader>Genre</Table.ColumnHeader>
                  <Table.ColumnHeader>BPM</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">Time</Table.ColumnHeader>
                </Table.Row>
            </Table.Header>
             <Table.Body>
                {tracks.map((track) => {
                  const isThisTrackPlaying = currentTrack?.id === track.id;
                  const isThisTrackActiveAndPlaying = isThisTrackPlaying && isPlaying;
                  const hasAudioData = track.duration && track.duration > 0;
                  const hasPendingFlag = ['pending', 'processing'].includes(track.status || '') || ['pending', 'processing'].includes(track.processing_status || '');
                  const isPending = !hasAudioData || (hasPendingFlag && !hasAudioData);

                  return (
                    <Table.Row 
                      key={track.id} className="group" 
                      bg={isPending ? "gray.50" : (isThisTrackPlaying ? "blue.50" : "transparent")}
                      opacity={isPending ? 0.6 : 1} cursor={isPending ? "not-allowed" : "pointer"}
                      _hover={isPending ? {} : { bg: "gray.50" }}
                      onDoubleClick={() => { if (!isPending) playTrack(track, tracks); }}
                    >
                      <Table.Cell px={0}>
                        {isPending ? (
                           <Box w="36px" h="36px" display="flex" alignItems="center" justifyContent="center">
                             <Spinner size="sm" color="blue.500" borderWidth="2px" />
                           </Box>
                        ) : (
                          <Box 
                            w="36px" h="36px" bg={isThisTrackPlaying ? "blue.500" : "gray.100"} 
                            borderRadius="md" display="flex" alignItems="center" justifyContent="center" 
                            color={isThisTrackPlaying ? "white" : "gray.400"} 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isPending) isThisTrackPlaying ? togglePlayPause() : playTrack(track, tracks);
                            }}
                          >
                            {isThisTrackActiveAndPlaying ? <Icon as={Pause} boxSize={5} fill="currentColor" /> : <Icon as={Play} boxSize={5} fill="currentColor" ml="2px" />}
                          </Box>
                        )}
                      </Table.Cell>

                      <Table.Cell px={2}>
                        <Box w="36px" h="36px" borderRadius="md" overflow="hidden" bg="gray.50" border="1px solid" borderColor="gray.200" display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
                          {track.cover_url ? (
                            <img src={track.cover_url} alt={track.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Icon as={Music} color="gray.300" boxSize={4} />
                          )}
                        </Box>
                      </Table.Cell>

                      <Table.Cell 
                        fontWeight={isThisTrackPlaying ? "bold" : "500"} 
                        color={isPending ? "blue.500" : (isThisTrackPlaying ? "blue.600" : "gray.900")} 
                        fontStyle={isPending ? "italic" : "normal"}
                        onClick={() => !isPending && setSelectedTrack(track)}
                      >
                        <HStack gap={2}>
                          <Text>{track.title} {isPending && "(Analyzing...)"}</Text>
                          {isPending && (
                            <Button size="xs" variant="ghost" borderRadius="full" h="24px" w="24px" p={0} color="blue.500" onClick={(e) => handleRetry(e, track.id)} _hover={{ bg: "blue.100" }}>
                              <Icon as={RefreshCw} boxSize={3.5} />
                            </Button>
                          )}
                        </HStack>
                      </Table.Cell>
                      
                      <Table.Cell>
                        <HStack gap={1} flexWrap="wrap">
                          {track.artist ? (
                            track.artist.split(',').map((artistName: string, index: number, arr: string[]) => {
                              const cleanArtist = artistName.trim();
                              return (
                                <React.Fragment key={index}>
                                  <Text 
                                    as="span" color={isThisTrackPlaying ? "blue.500" : "gray.600"} 
                                    _hover={isPending ? {} : { textDecoration: "underline", color: "blue.600" }} 
                                    onClick={(e) => { 
                                      if(!isPending) { e.stopPropagation(); navigate(`/artists/${encodeURIComponent(cleanArtist)}`); } 
                                    }}
                                  >
                                    {cleanArtist}
                                  </Text>
                                  {index < arr.length - 1 && <Text as="span" color="gray.500">, </Text>}
                                </React.Fragment>
                              );
                            })
                          ) : (
                            <Text color="gray.500">-</Text>
                          )}
                        </HStack>
                      </Table.Cell>

                      <Table.Cell color="gray.500">{track.album || '-'}</Table.Cell>
                      
                      <Table.Cell>
                        <HStack gap={1} flexWrap="wrap">
                          {track.style ? (
                            track.style.split(',').map((tag, index) => {
                              const cleanTag = tag.trim();
                              return (
                                <Badge 
                                  key={index} size="sm" colorPalette={getColorForGenre(cleanTag)} variant="subtle" borderRadius="md" px={2} cursor={isPending ? "not-allowed" : "pointer"}
                                  _hover={isPending ? {} : { opacity: 0.8, transform: "scale(1.05)" }}
                                  onClick={(e) => { if(!isPending){ e.stopPropagation(); setSearchQuery(cleanTag); } }}
                                >
                                  {cleanTag}
                                </Badge>
                              );
                            })
                          ) : (
                            <Badge size="sm" bg="gray.100" color="gray.400" variant="subtle" borderRadius="md" px={2}>-</Badge>
                          )}
                        </HStack>
                      </Table.Cell>
                      
                      <Table.Cell>
                        <Badge size="sm" bg={getBpmStyle(track.bpm ? Math.round(track.bpm) : 0).bg} color={getBpmStyle(track.bpm ? Math.round(track.bpm) : 0).color} border="none" borderRadius="md" px={2.5} py={0.5} fontWeight="700">
                          {track.bpm ? Math.round(track.bpm) : '-'}
                        </Badge>
                      </Table.Cell>

                      <Table.Cell textAlign="right" color="gray.500">{formatDuration(track.duration)}</Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>

            {isFetchingMore && (
              <Box py={6} display="flex" justifyContent="center">
                <Spinner size="md" color="blue.500" />
              </Box>
            )}
          </>
        )}
      </Box>

      <TrackDetailDrawer 
        isOpen={!!selectedTrack} onClose={() => setSelectedTrack(null)} track={selectedTrack} 
        onTrackUpdated={(data) => setTracks(prev => prev.map(t => t.id === data.id ? {...t, ...data} : t))}
      />
    </VStack>
  );
};

// Helpers
const getColorForGenre = (genre: string) => {
  const colors = ['red', 'orange', 'green', 'teal', 'blue', 'cyan', 'purple', 'pink'];
  let hash = 0;
  for (let i = 0; i < genre.length; i++) hash = genre.charCodeAt(i) + ((hash << 5) - hash);
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