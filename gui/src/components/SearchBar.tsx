import { useRef, useState, useEffect } from 'react';
import { 
  Input, IconButton, VStack, HStack, Text, Badge, Box, Popover, Spinner, Flex
} from '@chakra-ui/react';
import { InputGroup } from './ui/input-group';
import { Search, SlidersHorizontal, Zap, X, Music } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSearchStore } from '../store/useSearchStore';
import { api } from '../services/api';

const formatDuration = (s: number) => {
  if (!s) return '-';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const ensureArray = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return val.split(',');
  return [];
};

const getColorForGenre = (genre: string) => {
  const colors = ['red', 'orange', 'green', 'teal', 'blue', 'cyan', 'purple', 'pink'];
  let hash = 0;
  for (let i = 0; i < genre.length; i++) hash = genre.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export const SearchBar = () => {
  const globalSearch = useSearchStore((state: any) => state.globalSearch);
  const setGlobalSearch = useSearchStore((state: any) => state.setGlobalSearch || state.setSearch);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();
  const location = useLocation(); // ⚡️ Check current route
  
  // ⚡️ Detect if we are currently on the library page
  const isLibraryPage = location.pathname.includes('/library'); 

  const [previewTracks, setPreviewTracks] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowPreview(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      // ⚡️ FIXED: If we are on the library page OR the search is empty, don't show the preview
      if (isLibraryPage || !globalSearch || !globalSearch.trim()) {
        setPreviewTracks([]);
        setShowPreview(false);
        return;
      }

      setIsSearching(true);
      setShowPreview(true);

      try {
        let filterStr = "";
        let textQuery = globalSearch;

        // 1. Raw Filter Mode
        if (globalSearch.toLowerCase().startsWith('filter:')) {
          filterStr = globalSearch.substring(7).trim();
          textQuery = "";
        } else {
          // 2. Smart Dictionary Parser 
          const filterMap: Record<string, string> = {
            artist: 'artists_names', album: 'album_title', genre: 'genre', style: 'style',
            mood: 'mood', scale: 'scale', key: 'musical_key', bpm: 'bpm', duration: 'duration', year: 'year'
          };
          const numericFields = ['bpm', 'duration', 'year'];
          const filterKeys = Object.keys(filterMap).join('|');
          const hasFilter = new RegExp(`\\b(${filterKeys})\\s*(:|>=|<=|>|<|=|!=)`, 'i').test(globalSearch);

          if (hasFilter) {
            const normalizedSearch = globalSearch.replace(/\s+and\s+/gi, ' AND ').replace(/\s+or\s+/gi, ' OR ');
            const tokens = normalizedSearch.split(/\s+(AND|OR)\s+/);

            const parsedTokens = tokens.map((token: string) => {
              if (token === 'AND' || token === 'OR') return token;
              const clauseMatch = token.match(new RegExp(`^\\s*(${filterKeys})\\s*(:|>=|<=|>|<|=|!=)\\s*(.+)$`, 'i'));
              if (clauseMatch) {
                 const field = clauseMatch[1].toLowerCase();
                 const operator = clauseMatch[2] === ':' ? '=' : clauseMatch[2];
                 let val = clauseMatch[3].trim().replace(/^["'](.*)["']$/, '$1');
                 const meiliField = filterMap[field];
                 const formattedVal = numericFields.includes(meiliField) ? val : `"${val.replace(/"/g, '\\"')}"`;
                 return `${meiliField} ${operator} ${formattedVal}`;
              }
              return token;
            });
            filterStr = parsedTokens.join(' ');
            textQuery = "";
          }
        }

        // 3. Execute isolated API fetch for the preview
        let hits: any[] = [];
        
        if (filterStr) {
          const res = await api.searchTracksByFilter(filterStr);
          hits = (res as any).hits || [];
        } else {
          const res = await api.getTracks({ search: textQuery, limit: 5 });
          hits = (res as any).data || [];
        }

        setPreviewTracks(hits.slice(0, 5));

      } catch (error) {
        console.error("Preview search failed", error);
        setPreviewTracks([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [globalSearch, isLibraryPage]); // ⚡️ ADDED isLibraryPage to dependencies

  const handleSuggestionClick = (query: string) => {
    setGlobalSearch(query);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleClear = () => {
    setGlobalSearch('');
    if (inputRef.current) inputRef.current.focus();
  };

  const handleResultClick = (trackTitle: string) => {
    setGlobalSearch(trackTitle);
    setShowPreview(false);
    navigate('/library'); 
  };

  return (
    <Box position="relative" w="full" maxW="600px" ref={containerRef}>
      <InputGroup 
        w="full"
        startElement={<Search size={18} color="var(--chakra-colors-gray-400)" />}
        endElement={
          <HStack gap={1}>
            {globalSearch && (
              <IconButton 
                aria-label="Clear search"
                variant="ghost" 
                size="xs"
                h="24px"
                w="24px"
                minW="24px"
                borderRadius="full"
                color="gray.400"
                _hover={{ bg: "gray.200", color: "gray.600" }}
                onClick={handleClear}
              >
                <X size={14} />
              </IconButton>
            )}

            <Popover.Root positioning={{ placement: "bottom-end" }}>
              <Popover.Trigger asChild>
                <IconButton 
                  aria-label="Advanced Filters"
                  variant="ghost" 
                  size="sm"
                  borderRadius="full"
                  color="gray.500"
                  _hover={{ bg: "gray.100", color: "blue.600" }}
                >
                  <SlidersHorizontal size={16} />
                </IconButton>
              </Popover.Trigger>
              
              <Popover.Positioner zIndex={50}>
                <Popover.Content w="340px" shadow="xl" border="1px solid" borderColor="gray.200" borderRadius="xl" bg="white">
                  <Popover.Arrow />
                  <Popover.Body p={4}>
                    <VStack align="stretch" gap={4}>
                      
                      <Box>
                        <HStack mb={2} color="blue.600">
                          <Zap size={14} />
                          <Text fontSize="xs" fontWeight="700" textTransform="uppercase">Quick Filters</Text>
                        </HStack>
                        <HStack flexWrap="wrap" gap={2}>
                          <Badge cursor="pointer" onClick={() => handleSuggestionClick("style: Techno")} _hover={{ opacity: 0.8 }} colorPalette="blue">Style: Techno</Badge>
                          <Badge cursor="pointer" onClick={() => handleSuggestionClick("bpm > 120")} _hover={{ opacity: 0.8 }} colorPalette="green">BPM {'>'} 120</Badge>
                          <Badge cursor="pointer" onClick={() => handleSuggestionClick("year >= 2024")} _hover={{ opacity: 0.8 }} colorPalette="purple">New Releases</Badge>
                          <Badge cursor="pointer" onClick={() => handleSuggestionClick("artist: I:cube")} _hover={{ opacity: 0.8 }} colorPalette="orange">Artist: I:cube</Badge>
                        </HStack>
                      </Box>

                      <Box borderTop="1px solid" borderColor="gray.100" pt={3}>
                        <Text fontSize="xs" fontWeight="700" color="gray.500" mb={2} textTransform="uppercase">Smart Syntax</Text>
                        <VStack align="stretch" gap={2} fontSize="xs" color="gray.600">
                          <Text><Text as="span" fontWeight="bold" color="gray.900">[field]: [value]</Text> — Search specific attributes</Text>
                          <Text><Text as="span" fontWeight="bold" color="gray.900">[field] {'>'} [number]</Text> — Use math for bpm, duration, year</Text>
                          <Box bg="gray.50" p={2} borderRadius="md" fontFamily="monospace" fontSize="2xs">
                            Try: bpm &gt; 125<br/>
                            Try: duration &lt; 300<br/>
                            Try: style != House
                          </Box>
                        </VStack>
                      </Box>

                    </VStack>
                  </Popover.Body>
                </Popover.Content>
              </Popover.Positioner>
            </Popover.Root>
          </HStack>
        }
      >
        <Input
          ref={inputRef}
          value={globalSearch || ''}
          onChange={(e) => {
            setGlobalSearch(e.target.value);
            // ⚡️ Only show preview if NOT on library page
            if (!isLibraryPage && !showPreview) setShowPreview(true);
          }}
          onFocus={() => {
            // ⚡️ Only show preview if NOT on library page
            if (!isLibraryPage && globalSearch) setShowPreview(true);
          }}
          placeholder="Search tracks, or type 'bpm > 120'..." 
          bg="gray.50"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="full"
          pl={10} 
          _focus={{ bg: "white", borderColor: "blue.500", boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)" }}
        />
      </InputGroup>

      {/* Preview Dropdown */}
      {showPreview && globalSearch && !isLibraryPage && (
        <Box
          position="absolute"
          top="calc(100% + 8px)"
          left={0}
          right={0}
          bg="white"
          shadow="xl"
          borderRadius="xl"
          border="1px solid"
          borderColor="gray.100"
          zIndex={100}
          overflow="hidden"
          py={2}
        >
          {isSearching ? (
            <VStack py={6} justify="center">
              <Spinner size="sm" color="blue.500" />
            </VStack>
          ) : previewTracks.length === 0 ? (
            <Box py={4} px={4}>
              <Text fontSize="sm" color="gray.500" textAlign="center">No tracks found</Text>
            </Box>
          ) : (
            <VStack gap={0} align="stretch">
              {previewTracks.map((track) => {
                const displayTitle = track.title || 'Unknown Track';
                const displayArtist = Array.isArray(track.artists_names)
                  ? track.artists_names.join(', ')
                  : (track.artist || 'Unknown Artist');
                const displayKey = track.musical_key ? `${track.musical_key} ${track.scale || ''}`.trim() : '';

                // ⚡️ ADDED: Extract and deduplicate up to 2 tags for the preview
                const rawTags = [...ensureArray(track.genre), ...ensureArray(track.style)];
                const displayTags = Array.from(new Set(rawTags.map(t => t.trim()))).filter(Boolean).slice(0, 2);

                return (
                  <HStack
                    key={track.id}
                    px={4}
                    py={2}
                    _hover={{ bg: "gray.50" }}
                    cursor="pointer"
                    onClick={() => handleResultClick(displayTitle)}
                    gap={4}
                  >
                    <Flex
                      w="40px"
                      h="40px"
                      bg="gray.100"
                      borderRadius="md"
                      justify="center"
                      align="center"
                      overflow="hidden"
                      flexShrink={0}
                    >
                      {track.cover_url ? (
                        <img src={track.cover_url} alt={displayTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Music size={20} color="var(--chakra-colors-gray-400)" />
                      )}
                    </Flex>

                    <VStack align="start" gap={0} flex={1} overflow="hidden">
                      <Text fontSize="sm" fontWeight="600" color="gray.900" truncate w="full">
                        {displayTitle}
                      </Text>
                      <HStack gap={2} w="full" overflow="hidden">
                        <Text fontSize="xs" color="gray.500" truncate maxW="120px">
                          {displayArtist}
                        </Text>
                        {/* ⚡️ ADDED: Render tags horizontally next to the artist name */}
                        {displayTags.length > 0 && (
                          <HStack gap={1} flexShrink={0}>
                            {displayTags.map((tag, idx) => (
                              <Badge 
                                key={idx} 
                                size="sm" 
                                colorPalette={getColorForGenre(tag)} 
                                variant="subtle" 
                                borderRadius="sm" 
                                px={1.5} 
                                py={0}
                                fontSize="2xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </HStack>
                        )}
                      </HStack>
                    </VStack>

                    <HStack gap={2}>
                      {displayKey && (
                        <Badge variant="outline" color="gray.700" borderColor="gray.300" fontSize="xs" px={2} py={0.5} borderRadius="md" textTransform="none">
                          {displayKey}
                        </Badge>
                      )}
                      {track.bpm && (
                        <Badge bg="gray.100" color="gray.700" fontSize="xs" px={2} py={0.5} borderRadius="md" border="none">
                          {Math.round(track.bpm)}
                        </Badge>
                      )}
                      <Text fontSize="xs" color="gray.400" minW="32px" textAlign="right">
                        {formatDuration(track.duration)}
                      </Text>
                    </HStack>
                  </HStack>
                );
              })}
            </VStack>
          )}
        </Box>
      )}
    </Box>
  );
};