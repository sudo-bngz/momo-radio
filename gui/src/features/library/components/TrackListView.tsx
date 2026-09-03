import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Box, VStack, HStack, Text, Spinner, Table, Badge, Icon, Button 
} from '@chakra-ui/react';
import { Play, Pause, Music, RefreshCw, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLibrary } from '../hook/useLibrary';
import { usePlayer } from '../../../context/PlayerContext';
import { TrackDetailDrawer } from './TrackDetailDrawer'; 
import { ShareDrawer } from '../../shared/components/ShareDrawer'; 
import { api } from '../../../services/api';
import { toaster } from '../../../components/ui/toaster';
import { useSearchStore } from '../../../store/useSearchStore';
import { useAuthStore } from '../../../store/useAuthStore';

interface TrackListViewProps {
  sortBy: string;
}

export const TrackListView: React.FC<TrackListViewProps> = ({ sortBy }) => {
  const navigate = useNavigate();
  
  const globalSearch = useSearchStore((state: any) => state.globalSearch);
  const setGlobalSearch = useSearchStore((state: any) => state.setGlobalSearch || state.setSearch); 

  const { 
    tracks, setTracks, globalTotal, isLoading, 
    isFetchingMore, setSearchQuery, setSortBy, loadMore, hasMore
  } = useLibrary();


  useEffect(() => { 
    if (!globalSearch) {
      setSearchQuery('');
      // Reload legacy list if search is cleared
      return;
    }

    // 1. If user typed or clicked "tag:Electronic"
    if (globalSearch.startsWith('tag:')) {
      const tag = globalSearch.replace('tag:', '').trim();
      if (tag) {
         api.searchTracksByTag(tag, 100).then(data => {
           setTracks(data?.hits ? data.hits as any : []);
         });
      }
      return; 
    }

    // 2. If user manually types "filter: bpm > 120 AND genre = 'dub'"
    if (globalSearch.startsWith('filter:')) {
      const rawFilter = globalSearch.replace('filter:', '').trim();
      if (rawFilter) {
         // Direct call to Meilisearch using your axios client
         api.searchTracksByTag("").then(() => {}); // Dummy call to satisfy imports if needed, but better to fetch:
         fetch(`/api/v1/tracks/search?q=&filter=${encodeURIComponent(rawFilter)}&limit=100`, {
           headers: { Authorization: `Bearer ${useAuthStore.getState().session?.access_token}` }
         })
         .then(res => res.json())
         .then(data => setTracks(data?.hits ? data.hits as any : []))
         .catch(err => console.error("Filter error:", err));
      }
      return;
    }

    // 3. Normal text? Send to legacy Postgres hook
    setSearchQuery(globalSearch); 
  }, [globalSearch, setSearchQuery, setTracks]);
  useEffect(() => { setSortBy(sortBy as any); }, [sortBy, setSortBy]);

  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayer();
  
  const [selectedTrack, setSelectedTrack] = useState<any | null>(null);
  const [shareTrack, setShareTrack] = useState<any | null>(null);

  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    const handleNewUpload = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { track_id } = customEvent.detail;
      
      if (tracksRef.current.some(t => t.id === track_id)) return;

      const newTrack = {
        id: track_id,
        title: "Analyzing Audio...",
        artist: "Processing...",
        album: "-",
        processing_status: "pending",
        status: "pending",
        duration: 0,
      } as any;

      setTracks([newTrack, ...tracksRef.current]);
    };

    window.addEventListener('track_uploaded', handleNewUpload);
    return () => window.removeEventListener('track_uploaded', handleNewUpload);
  }, [setTracks]);

  const pendingIdsStr = useMemo(() => {
    return tracks
      .filter(t => ['pending', 'processing'].includes(t.processing_status || '') || ['pending', 'processing'].includes(t.status || ''))
      .map(t => t.id)
      .sort()
      .join(',');
  }, [tracks]);

  useEffect(() => {
    if (!pendingIdsStr) return;

    const pendingIds = pendingIdsStr.split(',').map(Number);

    const interval = setInterval(() => {
      pendingIds.forEach(async (id) => {
        try {
          const updated = await api.getTrack(id) as any; 
          
          if (updated.processing_status === 'completed') {
            const token = useAuthStore.getState().session?.access_token;
            const orgId = useAuthStore.getState().activeOrganizationId;

            const res = await fetch(`/api/v1/tracks?search=${encodeURIComponent(updated.title)}&org_id=${orgId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            
            const formattedTrack = data.data?.find((t: any) => t.id === updated.id);

            if (formattedTrack) {
              setTracks(tracksRef.current.map(track => track.id === updated.id ? formattedTrack : track));
            } else {
              setTracks(tracksRef.current.map(track => track.id === updated.id ? { ...track, title: updated.title, processing_status: 'completed', status: 'completed' } : track));
            }

            toaster.create({ title: `Analysis complete: ${updated.title}`, type: "success" });
            
          } else if (updated.processing_status === 'failed') {
            setTracks(tracksRef.current.map(track => track.id === updated.id ? { ...track, processing_status: 'failed', status: 'failed' } : track));
            toaster.create({ title: `Analysis failed for track.`, type: "error" });
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      });
    }, 3000); 

    return () => clearInterval(interval);
  }, [pendingIdsStr, setTracks]);

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
      setTracks(tracksRef.current.map(t => t.id === trackId ? { ...t, processing_status: 'pending', status: 'pending' } : t));
    } catch (error) {
      toaster.create({ title: "Failed to restart", type: "error" });
    }
  };

  // ⚡️ KILLER FEATURE: Prefill "tag:" in search bar, fetch raw tag from MeiliSearch
  const handleTagClick = async (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    
    // 1. Update the Search Bar UI with the Pro Syntax
    const uiSyntax = `tag:${tag}`;
    if (setGlobalSearch) setGlobalSearch(uiSyntax);
    
    // 2. Pass the RAW tag to MeiliSearch so it doesn't try to query the word "tag"
    try {
      const data = await api.searchTracksByTag(tag, 100);
      
      if (data && data.hits) {
        const mappedTracks = data.hits.map((hit: any) => ({
          id: Number(hit.id),
          organization_id: hit.organization_id || '',
          key: hit.id, 
          title: hit.title,
          artist: hit.artists_names?.join(', ') || 'Unknown Artist',
          album: hit.album_title || '',
          genre: hit.genre || '',
          style: hit.style || '',
          duration: hit.duration || 0,
          cover_url: hit.cover_url || '',
          bpm: hit.bpm || 0,
          musical_key: hit.musical_key || '',
          scale: hit.scale || '',
          status: 'completed',
          processing_status: 'completed'
        }));
        
        setTracks(mappedTracks as any);
      } else {
        setTracks([]); // Clear table if no results
      }
    } catch (error) {
      console.error("Failed to execute tag search:", error);
      toaster.create({ title: "Tag search failed", type: "error" });
    }
  };

  return (
    <VStack align="stretch" h="100%" gap={0} position="relative">
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
              "& td": { py: 3, borderBottom: "1px solid var(--chakra-colors-gray-50)", color: "var(--chakra-colors-gray-800)", transition: "background 0.2s" }
            }}>
              <Table.Header position="sticky" top={0} bg="white" zIndex={1}>
                <Table.Row>
                  <Table.ColumnHeader w="50px"></Table.ColumnHeader>
                  <Table.ColumnHeader w="64px">Artwork</Table.ColumnHeader>
                  <Table.ColumnHeader>Track ({globalTotal})</Table.ColumnHeader>
                  <Table.ColumnHeader>Artist</Table.ColumnHeader>
                  <Table.ColumnHeader>Album</Table.ColumnHeader>
                  <Table.ColumnHeader>Genre</Table.ColumnHeader>
                  <Table.ColumnHeader>BPM</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">Time</Table.ColumnHeader>
                  <Table.ColumnHeader w="50px"></Table.ColumnHeader>
                </Table.Row>
            </Table.Header>
             <Table.Body>
                {!isLoading && tracks.length === 0 && (
                  <Table.Row>
                    <Table.Cell colSpan={9} textAlign="center" py={12} color="gray.500">
                      <VStack gap={2}>
                        <Icon as={Music} boxSize={8} color="gray.300" />
                        <Text fontWeight="500" color="gray.900">No tracks found</Text>
                        <Text fontSize="sm">Try adjusting your search query.</Text>
                      </VStack>
                    </Table.Cell>
                  </Table.Row>
                )}

                {tracks.map((track) => {
                  const isThisTrackPlaying = currentTrack?.id === track.id;
                  const isThisTrackActiveAndPlaying = isThisTrackPlaying && isPlaying;
                  const hasAudioData = track.duration && track.duration > 0;
                  const hasPendingFlag = ['pending', 'processing'].includes(track.status || '') || ['pending', 'processing'].includes(track.processing_status || '');
                  const isPending = !hasAudioData || (hasPendingFlag && !hasAudioData);

                  const rawTags = [
                    ...(track.genre ? track.genre.split(',') : []),
                    ...(track.style ? track.style.split(',') : [])
                  ];
                  const mergedTags = Array.from(new Set(rawTags.map(t => t.trim()).filter(Boolean)));

                  const rawAlbum = track.album as any;
                  const albumName = typeof rawAlbum === 'object' ? rawAlbum?.title : rawAlbum;
                  const albumId = (track as any).album_id || (typeof rawAlbum === 'object' ? rawAlbum?.id : null);

                  return (
                    <Table.Row 
                      key={track.id} 
                      className="group" 
                      bg={isPending ? "gray.50" : (isThisTrackPlaying ? "blue.50" : "transparent")}
                      opacity={isPending ? 0.6 : 1} 
                      cursor={isPending ? "not-allowed" : "default"}
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
                            cursor="pointer"
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
                      >
                        <HStack gap={2}>
                          <Text
                            cursor={isPending ? "not-allowed" : "pointer"}
                            transition="color 0.2s"
                            _hover={isPending ? {} : { textDecoration: "underline", color: "blue.600" }}
                            onClick={(e) => {
                              if (!isPending) {
                                e.stopPropagation();
                                setSelectedTrack(track); 
                              }
                            }}
                          >
                            {track.title}
                          </Text>
                          {track.processing_status === 'failed' && (
                            <Button size="xs" variant="ghost" borderRadius="full" h="24px" w="24px" p={0} color="red.500" onClick={(e) => handleRetry(e, track.id)} _hover={{ bg: "red.50" }}>
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
                                    cursor="pointer"
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

                      <Table.Cell>
                        {albumName && albumId ? (
                          <Text
                            color="gray.600"
                            cursor={isPending ? "not-allowed" : "pointer"}
                            transition="color 0.2s"
                            _hover={isPending ? {} : { textDecoration: "underline", color: "blue.600" }}
                            onClick={(e) => {
                              if (!isPending) {
                                e.stopPropagation();
                                navigate(`/library/albums/${albumId}`); 
                              }
                            }}
                          >
                            {albumName}
                          </Text>
                        ) : (
                          <Text color="gray.500">{albumName || '-'}</Text>
                        )}
                      </Table.Cell>
                      
                      <Table.Cell>
                        <HStack gap={1} flexWrap="wrap">
                          {mergedTags.length > 0 ? (
                            mergedTags.map((cleanTag, index) => (
                              <Badge 
                                key={index} size="sm" colorPalette={getColorForGenre(cleanTag)} variant="subtle" borderRadius="md" px={2} 
                                cursor={isPending ? "not-allowed" : "pointer"}
                                _hover={isPending ? {} : { opacity: 0.8, transform: "scale(1.05)" }}
                                onClick={(e) => { 
                                  if (!isPending) handleTagClick(e, cleanTag); 
                                }}
                              >
                                {cleanTag}
                              </Badge>
                            ))
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

                      <Table.Cell px={2}>
                        {!isPending && (
                          <Button
                            size="xs" variant="ghost" borderRadius="md" color="gray.400" opacity={0}
                            _groupHover={{ opacity: 1, bg: "pink.50", color: "pink.600" }} transition="all 0.2s" cursor="pointer"
                            onClick={(e) => { e.stopPropagation(); setShareTrack(track); }} title="Share Track"
                          >
                            <Icon as={Share2} boxSize={4} />
                          </Button>
                        )}
                      </Table.Cell>
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
        onTrackUpdated={(data) => setTracks(tracksRef.current.map(t => t.id === data.id ? {...t, ...data} : t))}
      />

      <ShareDrawer 
        isOpen={!!shareTrack} 
        onClose={() => setShareTrack(null)} 
        track={shareTrack} 
      />
    </VStack>
  );
};

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