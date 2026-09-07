import React, { useState, useEffect, useMemo } from 'react';
import { Box, VStack, Spinner, Table } from '@chakra-ui/react';
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
  const setGlobalSearch = useSearchStore((state: any) => state.setGlobalSearch || state.setSearch); 

  const { 
    tracks, setTracks, globalTotal, isLoading, 
    isFetchingMore, setSearchQuery, setSortBy, loadMore, hasMore
  } = useLibrary();

  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayer();
  
  const [selectedTrack, setSelectedTrack] = useState<any | null>(null);
  const [shareTrack, setShareTrack] = useState<any | null>(null);

  // ⚡️ Run our extracted logic hooks silently
  useAdvancedSearch(setTracks, setSearchQuery);
  useTrackProcessing(tracks, setTracks);

  useEffect(() => { 
    setSortBy(sortBy as any); 
  }, [sortBy, setSortBy]);

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
      setTracks(tracks.map(t => t.id === trackId ? { ...t, processing_status: 'pending', status: 'pending' } : t));
    } catch (error) {
      toaster.create({ title: "Failed to restart", type: "error" });
    }
  };

  const handleDelete = async (e: React.MouseEvent, trackId: number) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to remove this failed track?")) return;
    try {
      await api.deleteTrack(trackId);
      setTracks(tracks.filter(t => t.id !== trackId));
      toaster.create({ title: "Track removed", type: "success" });
    } catch (error) {
      console.error("Delete failed:", error);
      toaster.create({ title: "Failed to remove track", type: "error" });
    }
  };

  const handleAttributeClick = (e: React.MouseEvent, type: 'genre' | 'style', val: string) => {
    e.stopPropagation();
    if (setGlobalSearch) setGlobalSearch(`${type}: ${val}`);
  };

  // Deduplicate tracks for React rendering stability
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
        css={{
          '&::-webkit-scrollbar': { width: '8px' },
          '&::-webkit-scrollbar-thumb': { background: 'var(--chakra-colors-gray-200)', borderRadius: '4px' },
        }}
      >
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
                  handleDelete={handleDelete}
                  handleAttributeClick={handleAttributeClick}
                />
              ))
            )}
          </Table.Body>
        </Table.Root>

        {isFetchingMore && (
          <Box py={6} display="flex" justifyContent="center">
            <Spinner size="md" color="blue.500" />
          </Box>
        )}
      </Box>

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