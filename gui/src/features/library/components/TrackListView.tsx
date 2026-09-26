import React, { useState, useEffect, useMemo } from 'react';
import { Box, VStack, Spinner, Table, Dialog, Button, Text } from '@chakra-ui/react';
import { useLibrary } from '../hook/useLibrary';
import { usePlayer } from '../../../context/PlayerContext';
import { useSearchStore } from '../../../store/useSearchStore';
import { api } from '../../../services/api';
import { toaster } from '../../../components/ui/toaster';

// Modulized Hooks
import { useAdvancedSearch } from '../hook/useAdvancedSearch';
import { useTrackProcessing } from '../hook/useTrackProcessing';

// Modulized Components
import { TrackDetailDrawer } from './TrackDetailDrawer'; 
import { ShareDrawer } from '../../shared/components/ShareDrawer'; 
import { TrackTableRow } from './TrackTableRow';
import { TrackTableEmptyState } from './TrackTableEmptyState';

interface TrackListViewProps {
  sortBy: string;
}

export const TrackListView: React.FC<TrackListViewProps> = ({ sortBy }) => {
  const globalSearch = useSearchStore((state: any) => state.globalSearch || state.search);
  const setGlobalSearch = useSearchStore((state: any) => state.setGlobalSearch || state.setSearch); 

  const { 
    tracks, setTracks, globalTotal, isLoading, 
    isFetchingMore, setSearchQuery, setSortBy, loadMore, hasMore
  } = useLibrary();

  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayer();
  
  const [selectedTrack, setSelectedTrack] = useState<any | null>(null);
  const [shareTrack, setShareTrack] = useState<any | null>(null);
  const [trackToDelete, setTrackToDelete] = useState<any | null>(null);

  useAdvancedSearch(setTracks, setSearchQuery);
  useTrackProcessing(tracks, setTracks);

  useEffect(() => {
    setSearchQuery(globalSearch || '');
  }, [globalSearch, setSearchQuery]);

  useEffect(() => { 
    setSortBy(sortBy as any); 
  }, [sortBy, setSortBy]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      if (hasMore && !isFetchingMore && !isLoading) loadMore();
    }
  };

  const handleRetry = async (e: React.MouseEvent, rawId: number | string) => {
    e.stopPropagation();

    const targetId = typeof rawId === 'string' ? Number(rawId.replace('track-', '')) : rawId;

    try {
      await api.analysis(targetId);
      toaster.create({ title: "Analysis Restarted", type: "info" });
      
      setTracks(tracks.map(t => 
        String(t.id ?? t.id ?? t.key) === String(rawId) 
          ? { ...t, processing_status: 'pending', status: 'pending' } 
          : t
      ));
    } catch (error) {
      toaster.create({ title: "Failed to restart", type: "error" });
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, track: any) => {
    e.stopPropagation();
    setTrackToDelete(track);
  };

  const confirmDelete = async () => {
    if (!trackToDelete) return;

    const rawId = trackToDelete.id ?? trackToDelete.ID ?? trackToDelete.track_id ?? trackToDelete.key;
    const targetId = String(rawId);

    if (!rawId || targetId === 'undefined' || targetId === 'null') {
      setTracks(tracks.filter(t => t !== trackToDelete));
      setTrackToDelete(null);
      return;
    }

    try {
      await api.deleteTrack(targetId);
      setTracks(tracks.filter(t => String(t.id ?? t.id ?? t.key) !== targetId));
      toaster.create({ title: "Track deleted", type: "success" });
    } catch (error) {
      console.error("Delete failed:", error);
      toaster.create({ title: "Failed to delete track", type: "error" });
    } finally {
      setTrackToDelete(null); 
    }
  };

  const handleAttributeClick = (e: React.MouseEvent, type: 'genre' | 'style', val: string) => {
    e.stopPropagation();
    if (setGlobalSearch) setGlobalSearch(`${type}: ${val}`);
  };

  const uniqueTracks = useMemo(() => {
    const seen = new Set();
    return tracks.filter(track => {
      if (!track.id || seen.has(track.id)) return false;
      seen.add(track.id);
      return true;
    });
  }, [tracks]);

  return (
    <VStack align="stretch" h="100%" gap={0} position="relative">
      <Box flex="1" overflowY="auto" onScroll={handleScroll}
        // ⚡️ Custom scrollbar now inherits the global border token
        css={{
          '&::-webkit-scrollbar': { width: '8px' },
          '&::-webkit-scrollbar-thumb': { background: 'var(--chakra-colors-border)', borderRadius: '4px' },
        }}
      >
        {/* ⚡️ All raw CSS fully semanticized for dark mode */}
        <Table.Root css={{
          "& th": { borderBottom: "1px solid var(--chakra-colors-border)", py: 4, fontWeight: "500", color: "var(--chakra-colors-fg-muted)" },
          "& td": { py: 3, borderBottom: "1px solid var(--chakra-colors-border)", color: "var(--chakra-colors-fg)", transition: "background 0.2s" }
        }}>
          {/* ⚡️ bg="bg" so the sticky header adapts instead of staying white */}
          <Table.Header position="sticky" top={0} bg="bg" zIndex={1}>
            <Table.Row>
              <Table.ColumnHeader w="50px"></Table.ColumnHeader>
              <Table.ColumnHeader w="64px">Artwork</Table.ColumnHeader>
              <Table.ColumnHeader>Track ({globalTotal})</Table.ColumnHeader>
              <Table.ColumnHeader>Artist</Table.ColumnHeader>
              <Table.ColumnHeader>Album</Table.ColumnHeader>
              <Table.ColumnHeader>Genre & Style</Table.ColumnHeader>
              <Table.ColumnHeader>BPM</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Time</Table.ColumnHeader>
              <Table.ColumnHeader w="50px"></Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          
          <Table.Body>
            {isLoading || uniqueTracks.length === 0 ? (
              <TrackTableEmptyState isLoading={isLoading} colSpan={9} />
            ) : (
              uniqueTracks.map((track) => (
                <TrackTableRow 
                  key={track.id}
                  track={track}
                  tracks={tracks}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  playTrack={playTrack}
                  togglePlayPause={togglePlayPause}
                  setSelectedTrack={setSelectedTrack}
                  setShareTrack={setShareTrack}
                  handleRetry={handleRetry}
                  handleDelete={handleDeleteClick} 
                  handleAttributeClick={handleAttributeClick}
                />
              ))
            )}
          </Table.Body>
        </Table.Root>

        {isFetchingMore && (
          <Box py={6} display="flex" justifyContent="center">
            <Spinner size="md" color="blue.500" _dark={{ color: "blue.400" }} />
          </Box>
        )}
      </Box>

      <Dialog.Root open={!!trackToDelete} onOpenChange={(e) => { if (!e.open) setTrackToDelete(null); }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          {/* ⚡️ Ensure Dialog Content maps to the panel background explicitly */}
          <Dialog.Content bg="bg.panel" color="fg">
            <Dialog.Header>
              <Dialog.Title color="fg">Delete Track</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text color="fg.muted">
                Are you sure you want to delete <Text as="span" fontWeight="bold" color="fg">"{trackToDelete?.title}"</Text>? 
                This will permanently remove the audio files and all associated data from the infrastructure. This action cannot be undone.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => setTrackToDelete(null)} color="fg">Cancel</Button>
              <Button colorPalette="red" onClick={confirmDelete}>Yes, Delete Track</Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger color="fg.muted" _hover={{ bg: "whiteAlpha.100" }} />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <TrackDetailDrawer 
        isOpen={!!selectedTrack} onClose={() => setSelectedTrack(null)} track={selectedTrack} 
        onTrackUpdated={(data) => setTracks(tracks.map(t => t.id === data.id ? {...t, ...data} : t))}
      />

      <ShareDrawer 
        isOpen={!!shareTrack} 
        onClose={() => setShareTrack(null)} 
        track={shareTrack} 
      />
    </VStack>
  );
};