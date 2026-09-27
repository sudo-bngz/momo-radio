import React, { useState, useEffect, useRef } from 'react';
import { Box, Input, Icon, Spinner, Text, Flex, Image, HStack, Badge } from '@chakra-ui/react';
import { Search, Music, X, SlidersHorizontal } from 'lucide-react';
import { api, type SearchHit } from '../services/api';

// Safely extracts strings from Go's sql.NullString, structs, or arrays
const parseString = (val: any, fallback = ''): string => {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map((v) => parseString(v)).join(', ');
  if (typeof val === 'object') return val.name || val.title || val.String || fallback;
  return String(val);
};

// Safely extracts the first genre to display as a pill
const getFirstGenre = (val: any): string | null => {
  if (!val) return null;
  if (Array.isArray(val) && val.length > 0) return String(val[0]);
  if (typeof val === 'string') return val.split(',')[0].trim();
  return null;
};

// Generates a consistent color palette for genre badges
const getColorForGenre = (genre: string) => {
  const colors = ['red', 'orange', 'green', 'teal', 'blue', 'cyan', 'purple', 'pink'];
  let hash = 0;
  for (let i = 0; i < genre.length; i++) hash = genre.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// Safely constructs the full image URL using the CDN if available
const getCoverUrl = (urlObj: any): string | null => {
  const url = parseString(urlObj);
  if (!url) return null;
  
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  
  const config = (window as any).__RUNTIME_CONFIG__ || {};
  if (config.CDN_URL) {
    let cdnBase = config.CDN_URL.replace(/\/$/, '');
    if (!cdnBase.startsWith('http')) cdnBase = `https://${cdnBase}`;
    return `${cdnBase}${url.startsWith('/') ? '' : '/'}${url}`;
  }
  
  const runtimeApiUrl = config.API_URL || "";
  let baseUrl = runtimeApiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  if (baseUrl && !baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
  
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
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
  const inputRef = useRef<HTMLInputElement>(null);

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
      {/* ⚡️ Left Search Icon */}
      <Icon 
        as={Search} 
        position="absolute" left={4} top="50%" transform="translateY(-50%)" 
        color="fg.muted" boxSize={4} zIndex={2} 
      />
      
      {/* Input */}
      <Input
        ref={inputRef}
        pl={10}
        pr={20} // ⚡️ Extra padding for the right-side icons
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
        bg="gray.50" _dark={{ bg: "whiteAlpha.100" }}
        color="fg"
        border="1px solid" borderColor="border"
        // ⚡️ YT Music-style blue focus ring
        _focus={{ bg: "bg.panel", shadow: "sm", borderColor: "blue.500", _dark: { bg: "bg", borderColor: "blue.400" } }}
        _placeholder={{ color: "fg.muted" }}
        transition="all 0.2s"
      />

      {/* ⚡️ Right Side Actions (Clear & Filter) */}
      <HStack position="absolute" right={4} top="50%" transform="translateY(-50%)" gap={3} zIndex={2}>
        {loading ? (
          <Spinner size="xs" color="fg.muted" />
        ) : query ? (
          <Icon 
            as={X} boxSize={4} color="fg.muted" cursor="pointer" 
            _hover={{ color: "fg" }} transition="color 0.2s"
            onClick={() => { setQuery(''); inputRef.current?.focus(); }} 
          />
        ) : null}
        
        {/* Separator and Sliders Icon */}
        <Box w="1px" h="16px" bg="border" />
        <Icon 
          as={SlidersHorizontal} boxSize={4} color="fg.muted" cursor="pointer" 
          _hover={{ color: "fg" }} transition="color 0.2s"
        />
      </HStack>

      {/* Results Dropdown */}
      {isOpen && query.trim() !== '' && (
        <Box
          position="absolute" top="calc(100% + 8px)" left={0} right={0}
          bg="bg.panel" borderRadius="xl" shadow="2xl" border="1px solid" borderColor="border"
          zIndex={1000} maxH="400px" overflowY="auto" py={2}
        >
          {results.length === 0 && !loading ? (
            <Text p={4} fontSize="sm" color="fg.muted" textAlign="center">
              No matching tracks found for "{query}"
            </Text>
          ) : (
            results.map((track) => {
              const coverSrc = getCoverUrl(track.cover_url);
              const firstGenre = getFirstGenre(track.genre);

              return (
                <Flex
                  key={track.id}
                  p={2.5}
                  px={4}
                  gap={3}
                  align="center"
                  cursor="pointer"
                  _hover={{ bg: "gray.50", _dark: { bg: "whiteAlpha.100" } }}
                  transition="background 0.2s"
                  onClick={() => { onSelectTrack?.(track); setIsOpen(false); }}
                >
                  {/* Artwork */}
                  {coverSrc ? (
                    <Image
                      src={coverSrc} alt={track.title} boxSize="40px" borderRadius="md"
                      objectFit="cover" bg="gray.100" _dark={{ bg: "whiteAlpha.200" }} flexShrink={0}
                    />
                  ) : (
                    <Flex boxSize="40px" borderRadius="md" bg="gray.100" _dark={{ bg: "whiteAlpha.200" }} align="center" justify="center" flexShrink={0}>
                      <Icon as={Music} color="fg.muted" boxSize={4} />
                    </Flex>
                  )}

                  {/* ⚡️ Compact Title & Genre/Artist Stack */}
                  <Flex direction="column" flex="1" minW={0} justify="center">
                    <Text fontSize="sm" fontWeight="600" color="fg" lineClamp={1}>
                      {track.title}
                    </Text>
                    
                    <HStack gap={1.5} mt={0.5}>
                      {firstGenre && (
                        <Badge size="sm" colorPalette={getColorForGenre(firstGenre)} variant="subtle" borderRadius="sm" px={1.5} py={0} fontSize="10px">
                          {firstGenre}
                        </Badge>
                      )}
                      <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                        {parseString(track.artists_names, 'Unknown Artist')}
                      </Text>
                    </HStack>
                  </Flex>

                  {/* ⚡️ Acoustic Metadata (Native App Styling) */}
                  <HStack align="center" gap={{ base: 2, md: 3 }} flexShrink={0}>
                    {track.scale && (
                      <Box 
                        px={2} py={0.5} 
                        bg="transparent" color="fg.muted" border="1px solid" borderColor="border" 
                        borderRadius="md" fontSize="11px" fontWeight="500"
                      >
                        {track.scale}
                      </Box>
                    )}
                    {track.bpm && (
                      <Box 
                        px={2} py={0.5} 
                        bg="blackAlpha.50" color="fg.muted" 
                        _dark={{ bg: "whiteAlpha.200", color: "whiteAlpha.800" }}
                        borderRadius="md" fontSize="11px" fontWeight="600"
                      >
                        {Math.round(track.bpm)}
                      </Box>
                    )}
                    <Text fontSize="xs" color="fg.muted" w="32px" textAlign="right">
                      {formatDuration(track.duration)}
                    </Text>
                  </HStack>
                </Flex>
              );
            })
          )}
        </Box>
      )}
    </Box>
  );
};