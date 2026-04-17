import React, { useState } from 'react';
import { 
  Box, VStack, HStack, Text, Input, Spinner, Table, Heading, Button 
} from '@chakra-ui/react';
import { Search, Clock, Play, Pause, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLibrary } from '../hook/useLibrary';
import { usePlayer } from '../../../context/PlayerContext';
import { TrackDetailDrawer } from './TrackDetailDrawer'; 
import type { SortOption } from '../hook/useLibrary';
import { Select, Icon } from '@chakra-ui/react';
import { ChevronDown } from 'lucide-react';
import { createListCollection } from "@chakra-ui/react"

const sortOptions = createListCollection({
  items: [
    { label: "Newest First", value: "newest" },
    { label: "A-Z", value: "alphabetical" },
    { label: "Duration", value: "duration" },
  ],
})

export const LibraryView: React.FC = () => {
  const navigate = useNavigate();
  const { 
    tracks, setTracks, globalTotal, isLoading, 
    isFetchingMore, searchQuery, setSearchQuery,
    setSortBy, sortBy, loadMore, hasMore
  } = useLibrary();

  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayer();
  const [selectedTrack, setSelectedTrack] = useState<any | null>(null);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    // If the user scrolls within 100px of the bottom, fetch more!
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      if (hasMore && !isFetchingMore && !isLoading) {
        loadMore();
      }
    }
  };

  return (
    <VStack align="stretch" h="100%" gap={8} bg="white" data-theme="light">
      
      {/* 1. Header Section */}
      <VStack align="start" gap={1}>
        <Heading size="3xl" fontWeight="normal" color="gray.900" letterSpacing="tight">
          Music Library
        </Heading>
        <Text fontSize="sm" color="gray.500">
          {globalTotal} tracks in your collection
        </Text>
      </VStack>

      {/* 2. Controls */}
      <HStack justify="space-between" w="100%" gap={6}>
        <HStack gap={4} flex="1">
          <Button bg="gray.900" color="white" borderRadius="full" w="48px" h="48px" p={0} _hover={{ bg: "black" }} onClick={() => navigate('/ingest')}>
            <Icon as={Plus} boxSize={6} />
          </Button>
          <Box position="relative" flex="1" maxW="600px">
            <Icon as={Search} position="absolute" left={4} top="50%" transform="translateY(-50%)" color="gray.400" zIndex={2} />
            <Input 
              pl={12} h="48px" fontSize="lg" placeholder="Search..." 
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              borderRadius="xl" bg="gray.50" border="none" color="gray.900" 
            />
          </Box>
        </HStack>
        <Select.Root 
          collection={sortOptions} 
          value={[sortBy]} 
          onValueChange={(details) => setSortBy(details.value[0] as SortOption)}
          width="200px" // Slightly wider to fit "Newest First"
        >
          <Select.Trigger 
            height="48px"
            bg="white" 
            color="gray.900" 
            border="1px solid"
            borderColor="gray.300" 
            borderRadius="12px"
            px={4}
            _hover={{ borderColor: "blue.500" }}
          >
            {/* ⚡️ Explicitly set the color here too */}
            <Select.ValueText placeholder="Sort by" color="gray.900" fontWeight="600" />
            <Icon as={ChevronDown} color="gray.500" />
          </Select.Trigger>

          <Select.Positioner zIndex={100}>
            <Select.Content 
              bg="white"
              borderRadius="xl" 
              shadow="md" 
              border="1px solid" 
              borderColor="gray.200"
            >
              {sortOptions.items.map((item) => (
                <Select.Item 
                  item={item} 
                  key={item.value}
                  p={2}
                  _hover={{ bg: "blue.50" }}
                  cursor="pointer"
                >
                  {/* ⚡️ Explicitly set item text color */}
                  <Select.ItemText color="gray.800" fontSize="sm" fontWeight="500">
                    {item.label}
                  </Select.ItemText>
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Select.Root>
      </HStack>

      {/* 3. Table Area with onScroll event */}
      <Box 
        flex="1" 
        overflowY="auto" 
        onScroll={handleScroll}
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
              "& td": { py: 4, borderBottom: "1px solid var(--chakra-colors-gray-50)", color: "var(--chakra-colors-gray-800)" }
            }}>
              <Table.Header position="sticky" top={0} bg="white" zIndex={1}>
                <Table.Row>
                  <Table.ColumnHeader w="60px"></Table.ColumnHeader>
                  <Table.ColumnHeader>Title</Table.ColumnHeader>
                  <Table.ColumnHeader>Artist</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right"><Icon as={Clock} boxSize={4} /></Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {tracks.map((track) => {
                  const isThisTrackPlaying = currentTrack?.id === track.id;
                  const isThisTrackActiveAndPlaying = isThisTrackPlaying && isPlaying;
                  return (
                    <Table.Row key={track.id} className="group" _hover={{ bg: "gray.50" }} bg={isThisTrackPlaying ? "blue.50" : "transparent"}>
                      <Table.Cell px={0}>
                        <Box w="36px" h="36px" bg={isThisTrackPlaying ? "blue.500" : "gray.100"} borderRadius="md" display="flex" alignItems="center" justifyContent="center" cursor="pointer" color={isThisTrackPlaying ? "white" : "gray.400"} onClick={() => isThisTrackPlaying ? togglePlayPause() : playTrack(track, tracks)}>
                          {isThisTrackActiveAndPlaying ? <Icon as={Pause} boxSize={5} fill="currentColor" /> : <Icon as={Play} boxSize={5} fill="currentColor" ml="2px" />}
                        </Box>
                      </Table.Cell>
                      <Table.Cell fontWeight={isThisTrackPlaying ? "bold" : "500"} color={isThisTrackPlaying ? "blue.600" : "gray.900"} cursor="pointer" onClick={() => setSelectedTrack(track)}>{track.title}</Table.Cell>
                      
                      {/* ⚡️ ONLY CHANGED THIS CELL ⚡️ */}
                      <Table.Cell 
                        color={isThisTrackPlaying ? "blue.500" : "gray.600"}
                        cursor="pointer"
                        _hover={{ textDecoration: "underline", color: "blue.600" }}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevents row click events from firing if you add them later
                          navigate(`/artists/${encodeURIComponent(track.artist)}`);
                        }}
                      >
                        {track.artist}
                      </Table.Cell>

                      <Table.Cell textAlign="right" color="gray.500">{formatDuration(track.duration)}</Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>

            {/* ⚡️ Bottom Spinner for loading more */}
            {isFetchingMore && (
              <Box py={6} display="flex" justifyContent="center">
                <Spinner size="md" color="blue.500" />
              </Box>
            )}
          </>
        )}
      </Box>

      <TrackDetailDrawer 
        isOpen={!!selectedTrack} 
        onClose={() => setSelectedTrack(null)} 
        track={selectedTrack} 
        onTrackUpdated={(data) => setTracks(prev => prev.map(t => t.id === data.id ? {...t, ...data} : t))}
      />
    </VStack>
  );
};