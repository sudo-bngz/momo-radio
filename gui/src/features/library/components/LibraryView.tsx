// src/features/library/components/LibraryView.tsx
// src/features/library/components/LibraryView.tsx
import React from 'react';
import { 
  Box, VStack, HStack, Text, Input, Icon, Spinner, Table, Heading, Button 
} from '@chakra-ui/react';
import { Search, Clock, Play, Disc } from 'lucide-react';
import { useLibrary } from '../hook/useLibrary';
import type { SortOption } from '../hook/useLibrary'

export const LibraryView: React.FC = () => {
  const { 
    tracks, 
    totalTracks, 
    isLoading, 
    searchQuery, 
    setSearchQuery,
    setSortBy,
    sortBy
  } = useLibrary();

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <VStack align="stretch" h="100%" gap={8} bg="white" p={8} data-theme="light">
      
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
          {/* Main Play Action */}
          <Button 
            bg="blue.600" 
            color="white" 
            borderRadius="full" 
            w="48px" 
            h="48px" 
            p={0}
            _hover={{ bg: "blue.700" }}
          >
            <Play fill="currentColor" size={20} style={{ marginLeft: '4px' }} />
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
              boxSize="20px" 
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
              color="gray.800" // FIX: Explicitly set text color to dark
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
              color: 'var(--chakra-colors-gray-800)', // FIX: Explicitly set text color
              fontWeight: '500'
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
              "& th": { 
                borderBottom: "1px solid var(--chakra-colors-gray-200)", 
                py: 4, 
                fontWeight: "500",
                color: "var(--chakra-colors-gray-600)"
              },
              "& td": { 
                py: 4, 
                borderBottom: "1px solid var(--chakra-colors-gray-50)",
                color: "var(--chakra-colors-gray-800)" 
              }
            }}>
              <Table.Header position="sticky" top={0} bg="white" zIndex={1}>
                <Table.Row>
                  <Table.ColumnHeader w="60px">#</Table.ColumnHeader>
                  <Table.ColumnHeader w="50px"></Table.ColumnHeader>
                  <Table.ColumnHeader>Title</Table.ColumnHeader>
                  <Table.ColumnHeader>Artist</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">
                    <Icon as={Clock} boxSize="16px" />
                  </Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {tracks.map((track, index) => (
                  <Table.Row key={track.ID} _hover={{ bg: "gray.50" }}>
                    <Table.Cell color="gray.400" fontSize="xs">{index + 1}</Table.Cell>
                    <Table.Cell px={0}>
                      <Box w="36px" h="36px" bg="gray.100" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
                        <Disc size={18} color="#A0AEC0" />
                      </Box>
                    </Table.Cell>
                    <Table.Cell fontWeight="500">{track.Title}</Table.Cell>
                    <Table.Cell color="gray.600">{track.Artist}</Table.Cell>
                    <Table.Cell textAlign="right" color="gray.500" fontVariantNumeric="tabular-nums">
                      {formatDuration(track.Duration)}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Box>
    </VStack>
  );
};
