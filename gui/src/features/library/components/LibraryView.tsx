import React from 'react';
import { 
  Box, VStack, HStack, Text, Input, Icon, Spinner, Table, Heading, Button 
} from '@chakra-ui/react';
import { Search, Clock, Play, Pause, Disc, Plus } from 'lucide-react'; // Added Plus
import { useNavigate } from 'react-router-dom'; // 1. Import navigation hook
import { useLibrary } from '../hook/useLibrary';
import { usePlayer } from '../../../context/PlayerContext';
import type { SortOption } from '../hook/useLibrary';

export const LibraryView: React.FC = () => {
  const navigate = useNavigate(); // 2. Initialize navigation
  const { 
    tracks, 
    totalTracks, 
    isLoading, 
    searchQuery, 
    setSearchQuery,
    setSortBy,
    sortBy
  } = useLibrary();

  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayer();

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <VStack align="stretch" h="100%" gap={8} bg="white" data-theme="light">
      
      {/* 1. Header Section */}
      <VStack align="start" gap={1}>
        <Heading size="3xl" fontWeight="normal" color="gray.900" letterSpacing="tight">
          Music Library
        </Heading>
        <Text fontSize="sm" color="gray.500">
          {totalTracks} tracks in your collection
        </Text>
      </VStack>

      {/* 2. Smart Search & Filters Row */}
      <HStack justify="space-between" w="100%" gap={6}>
        <HStack gap={4} flex="1">
          
          {/* 3. NEW: "Add Track" Button (Replaces Main Play Button) */}
          <Button 
            bg="gray.900" // Changed to dark for "Admin/Action" feel (or keep blue.600)
            color="white" 
            borderRadius="full" 
            w="48px" 
            h="48px" 
            p={0}
            _hover={{ bg: "black", transform: "scale(1.05)" }}
            transition="all 0.2s"
            onClick={() => navigate('/ingest')} // 👈 Navigates to Ingest Feature
            title="Add new track"
          >
            <Icon as={Plus} boxSize={6} />
          </Button>

          {/* Smart Search Bar */}
          <Box position="relative" flex="1" maxW="600px">
            <Icon 
              as={Search} 
              position="absolute" 
              left={4} 
              top="50%" 
              transform="translateY(-50%)" 
              color="gray.400" 
              boxSize={5} 
              zIndex={2}
            />
            <Input 
              pl={12} 
              h="48px"
              fontSize="lg"
              placeholder="Search by track, artist, or album..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              borderRadius="xl"
              bg="gray.50"
              border="none"
              color="gray.900" 
              _placeholder={{ color: "gray.400" }}
              _focus={{ bg: "white", ring: "2px", ringColor: "blue.500" }}
            />
          </Box>
        </HStack>

        <HStack gap={3}>
          {/* Sorting Dropdown */}
          <select 
            style={{ 
              height: '48px', 
              padding: '0 16px', 
              borderRadius: '12px', 
              border: 'none',
              fontSize: '14px',
              backgroundColor: 'var(--chakra-colors-gray-50)',
              cursor: 'pointer',
              color: 'var(--chakra-colors-gray-900)', 
              fontWeight: '500',
              outline: 'none'
            }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="newest">Newest First</option>
            <option value="alphabetical">A-Z</option>
            <option value="duration">Duration</option>
          </select>
        </HStack>
      </HStack>

      {/* 3. Minimalist Table Area */}
      <Box flex="1" overflow="hidden" display="flex" flexDirection="column">
        {isLoading ? (
          <VStack justify="center" flex="1"><Spinner size="xl" color="blue.500" /></VStack>
        ) : (
          <Box overflowY="auto" flex="1">
            <Table.Root css={{
              "& th": { borderBottom: "1px solid var(--chakra-colors-gray-200)", py: 4, fontWeight: "500", color: "var(--chakra-colors-gray-600)" },
              "& td": { py: 4, borderBottom: "1px solid var(--chakra-colors-gray-50)", color: "var(--chakra-colors-gray-800)" }
            }}>
              <Table.Header position="sticky" top={0} bg="white" zIndex={1}>
                <Table.Row>
                  <Table.ColumnHeader w="60px">#</Table.ColumnHeader>
                  <Table.ColumnHeader w="60px"></Table.ColumnHeader>
                  <Table.ColumnHeader>Title</Table.ColumnHeader>
                  <Table.ColumnHeader>Artist</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">
                    <Icon as={Clock} boxSize={4} />
                  </Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              
              <Table.Body>
                {tracks.map((track, index) => {
                  const isThisTrackPlaying = currentTrack?.id === track.id;
                  const isThisTrackActiveAndPlaying = isThisTrackPlaying && isPlaying;

                  return (
                    <Table.Row 
                      key={track.id} 
                      className="group" 
                      _hover={{ bg: "gray.50" }}
                      bg={isThisTrackPlaying ? "blue.50" : "transparent"} 
                      transition="background 0.2s"
                    >
                      <Table.Cell color="gray.400" fontSize="xs">
                        {index + 1}
                      </Table.Cell>
                      
                      <Table.Cell px={0}>
                        <Box 
                          w="36px" h="36px" 
                          bg={isThisTrackPlaying ? "blue.500" : "gray.100"} 
                          borderRadius="md" 
                          display="flex" alignItems="center" justifyContent="center"
                          cursor="pointer"
                          color={isThisTrackPlaying ? "white" : "gray.400"}
                          _groupHover={{ bg: "blue.500", color: "white" }}
                          transition="all 0.2s"
                          onClick={() => {
                            if (isThisTrackPlaying) {
                              togglePlayPause();
                            } else {
                              playTrack(track, tracks);
                            }
                          }}
                        >
                          {isThisTrackActiveAndPlaying ? (
                            <Icon as={Pause} boxSize={5} fill="currentColor" />
                          ) : (
                            <Box position="relative" w="18px" h="18px" display="flex" alignItems="center" justifyContent="center">
                              <Box 
                                position="absolute" 
                                opacity={isThisTrackPlaying ? 0 : 1}
                                _groupHover={{ opacity: 0 }}
                                transition="opacity 0.2s"
                              >
                                <Icon as={Disc} boxSize={5} />
                              </Box>
                              <Box 
                                position="absolute"
                                opacity={isThisTrackPlaying ? 1 : 0}
                                _groupHover={{ opacity: 1 }}
                                transition="opacity 0.2s"
                              >
                                <Icon as={Play} boxSize={5} fill="currentColor" ml="2px" />
                              </Box>
                            </Box>
                          )}
                        </Box>
                      </Table.Cell>

                      <Table.Cell fontWeight={isThisTrackPlaying ? "bold" : "500"} color={isThisTrackPlaying ? "blue.600" : "inherit"}>
                        {track.title}
                      </Table.Cell>
                      <Table.Cell color={isThisTrackPlaying ? "blue.500" : "gray.600"}>
                        {track.artist}
                      </Table.Cell>
                      <Table.Cell textAlign="right" color="gray.500" fontVariantNumeric="tabular-nums">
                        {formatDuration(track.duration)}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Box>
    </VStack>
  );
};