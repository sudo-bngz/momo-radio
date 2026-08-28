import React, { useState, useEffect, useRef } from 'react';
import { Box, Input, Icon, Spinner, Text, Flex, Image } from '@chakra-ui/react';
import { Search, Music } from 'lucide-react';
import { api, type SearchHit } from '../services/api';

// Safely extracts strings from Go's sql.NullString, structs, or arrays
const parseString = (val: any, fallback = ''): string => {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map((v) => parseString(v)).join(', ');
  if (typeof val === 'object') return val.name || val.title || val.String || fallback;
  return String(val);
};

interface LibrarySearchProps {
  onSelectTrack?: (track: SearchHit) => void;
}

export const LibrarySearch: React.FC<LibrarySearchProps> = ({ onSelectTrack }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handler = setTimeout(async () => {
      try {
        const hits = await api.searchLibrary(query, { limit: 10 });
        setResults(hits);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Box position="relative" w="100%" ref={dropdownRef}>
      {/* Search Input */}
      <Icon 
        as={Search} 
        position="absolute" 
        left={4} 
        top="50%" 
        transform="translateY(-50%)" 
        color="gray.400" 
        boxSize={4} 
        zIndex={2} 
      />
      <Input
        pl={10}
        pr={10}
        h="42px"
        fontSize="sm"
        placeholder="Search songs, artists, BPM, scale..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        borderRadius="full"
        bg="gray.50"
        border="1px solid"
        borderColor="transparent"
        _focus={{ bg: "white", shadow: "sm", borderColor: "gray.200" }}
        transition="all 0.2s"
      />
      {loading && (
        <Flex position="absolute" right={4} top="0" h="100%" align="center" zIndex={2}>
          <Spinner size="xs" color="gray.400" />
        </Flex>
      )}

      {/* Results Dropdown */}
      {isOpen && query.trim() !== '' && (
        <Box
          position="absolute"
          top="calc(100% + 8px)"
          left={0}
          right={0}
          bg="white"
          borderRadius="xl"
          shadow="xl"
          border="1px solid"
          borderColor="gray.100"
          zIndex={1000}
          maxH="400px"
          overflowY="auto"
          py={2}
        >
          {results.length === 0 && !loading ? (
            <Text p={4} fontSize="sm" color="gray.500" textAlign="center">
              No matching tracks found for "{query}"
            </Text>
          ) : (
            results.map((track) => (
              <Flex
                key={track.id}
                p={3}
                gap={4}
                align="center"
                cursor="pointer"
                _hover={{ bg: "gray.50" }}
                transition="background 0.2s"
                onClick={() => {
                  onSelectTrack?.(track);
                  setIsOpen(false);
                }}
              >
                {/* Artwork */}
                {track.cover_url ? (
                  <Image
                    src={track.cover_url}
                    alt={track.title}
                    boxSize="40px"
                    borderRadius="md"
                    objectFit="cover"
                    bg="gray.100"
                    flexShrink={0}
                  />
                ) : (
                  <Flex boxSize="40px" borderRadius="md" bg="gray.100" align="center" justify="center" flexShrink={0}>
                    <Icon as={Music} color="gray.400" boxSize={5} />
                  </Flex>
                )}

                {/* Track Details */}
                <Box flex="1" minW={0}>
                  <Text fontSize="sm" fontWeight="600" color="gray.800" truncate>
                    {track.title}
                  </Text>
                  <Text fontSize="xs" color="gray.500" truncate mt={0.5}>
                    {parseString(track.artists_names, 'Unknown Artist')}
                    {track.album_title && typeof track.album_title !== 'undefined' 
                      ? ` • ${parseString(track.album_title)}` 
                      : ''}
                  </Text>
                </Box>

                {/* Acoustic Metadata */}
                <Flex align="center" gap={2} flexShrink={0}>
                  {track.scale && (
                    <Box px={2} py={0.5} bg="indigo.50" color="indigo.600" border="1px solid" borderColor="indigo.100" borderRadius="md" fontSize="xs" fontWeight="bold" fontFamily="mono">
                      {track.scale}
                    </Box>
                  )}
                  {track.bpm && (
                    <Box px={2} py={0.5} bg="gray.100" color="gray.700" borderRadius="md" fontSize="xs" fontWeight="bold" fontFamily="mono">
                      {Math.round(track.bpm)}
                    </Box>
                  )}
                  <Text fontSize="xs" color="gray.400" w="40px" textAlign="right" display={{ base: "none", sm: "block" }}>
                    {formatDuration(track.duration)}
                  </Text>
                </Flex>
              </Flex>
            ))
          )}
        </Box>
      )}
    </Box>
  );
};