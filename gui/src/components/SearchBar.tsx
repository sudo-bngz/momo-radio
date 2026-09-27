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
  const location = useLocation(); 
  
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

        if (globalSearch.toLowerCase().startsWith('filter:')) {
          filterStr = globalSearch.substring(7).trim();
          textQuery = "";
        } else {
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

        let hits: any[] = [];
        
        if (filterStr) {
          const res = await api.searchTracksByFilter(filterStr);
          hits = (res as any).hits || [];
        } else {
          const res = await api.getTracks({ search: textQuery, limit: 10 });
          hits = (res as any).data || [];
        }

        setPreviewTracks(hits.slice(0, 10));

      } catch (error) {
        console.error("Preview search failed", error);
        setPreviewTracks([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [globalSearch, isLibraryPage]);

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
    <Box w="full" maxW="600px" ref={containerRef}>
      
      {/* ⚡️ THE BLURRED BACKDROP - NOW HIDDEN ON DESKTOP */}
      {showPreview && globalSearch && !isLibraryPage && (
        <Box
          display={{ base: "block", md: "none" }} // Only show on mobile
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="blackAlpha.300"
          _dark={{ bg: "blackAlpha.600" }}
          backdropFilter="blur(12px)"
          zIndex={100}
          onClick={() => setShowPreview(false)}
        />
      )}

      {/* RELATIVE WRAPPER */}
      <Box position="relative" zIndex={101} w="full">
        
        <InputGroup 
          w="full"
          startElement={<Search size={18} color="var(--chakra-colors-fg-muted)" />}
          endElement={
            <HStack gap={1} mr={1}>
              {globalSearch && (
                <IconButton 
                  aria-label="Clear search"
                  variant="ghost" 
                  size="xs"
                  h={{ base: "28px", md: "24px" }} 
                  w={{ base: "28px", md: "24px" }}
                  minW={{ base: "28px", md: "24px" }}
                  borderRadius="full"
                  color="fg.muted"
                  _hover={{ bg: "gray.100", color: "fg", _dark: { bg: "whiteAlpha.200" } }}
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
                    h={{ base: "32px", md: "28px" }}
                    w={{ base: "32px", md: "28px" }}
                    minW={{ base: "32px", md: "28px" }}
                    borderRadius="full"
                    color="fg.muted"
                    _hover={{ bg: "gray.100", color: "blue.600", _dark: { bg: "whiteAlpha.200", color: "blue.400" } }}
                  >
                    <SlidersHorizontal size={16} />
                  </IconButton>
                </Popover.Trigger>
                
                <Popover.Positioner zIndex={150}>
                  <Popover.Content 
                    w={{ base: "calc(100vw - 32px)", sm: "340px" }} 
                    maxW="340px" 
                    shadow="xl" 
                    border="1px solid" 
                    borderColor="border" 
                    borderRadius="xl" 
                    bg="bg.panel"
                  >
                    <Popover.Arrow />
                    <Popover.Body p={4}>
                      <VStack align="stretch" gap={4}>
                        <Box>
                          <HStack mb={2} color="blue.600" _dark={{ color: "blue.400" }}>
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

                        <Box borderTop="1px solid" borderColor="border" pt={3}>
                          <Text fontSize="xs" fontWeight="700" color="fg.muted" mb={2} textTransform="uppercase">Smart Syntax</Text>
                          <VStack align="stretch" gap={2} fontSize="xs" color="fg.muted">
                            <Text><Text as="span" fontWeight="bold" color="fg">[field]: [value]</Text> — Search specific attributes</Text>
                            <Text><Text as="span" fontWeight="bold" color="fg">[field] {'>'} [number]</Text> — Use math for bpm, duration, year</Text>
                            <Box bg="gray.50" _dark={{ bg: "whiteAlpha.100" }} p={2} borderRadius="md" fontFamily="monospace" fontSize="2xs">
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
              if (!isLibraryPage && !showPreview) setShowPreview(true);
            }}
            onFocus={() => {
              if (!isLibraryPage && globalSearch) setShowPreview(true);
            }}
            placeholder="Search tracks, or type 'bpm > 120'..." 
            bg="gray.50"
            _dark={{ bg: "whiteAlpha.100" }}
            color="fg"
            border="1px solid"
            borderColor="transparent"
            borderRadius="full"
            pl={10} 
            pr={{ base: 20, md: 24 }} 
            h="42px"
            _placeholder={{ color: "fg.muted" }}
            _focus={{ 
              bg: "bg.panel", 
              borderColor: "blue.500", 
              boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
              _dark: { bg: "bg", borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" } 
            }}
          />
        </InputGroup>

        {/* RESPONSIVE RESULTS DROPDOWN */}
        {showPreview && globalSearch && !isLibraryPage && (
          <Box
            position={{ base: "fixed", md: "absolute" }}
            top={{ base: "76px", md: "calc(100% + 8px)" }}
            left={{ base: 4, md: 0 }}
            w={{ base: "calc(100vw - 32px)", md: "100%" }}
            maxH={{ base: "calc(100dvh - 100px)", md: "400px" }}
            overflowY="auto"
            bg="bg.panel"
            shadow="2xl"
            borderRadius="xl"
            border="1px solid"
            borderColor="border"
            zIndex={150}
            py={2}
          >
            {isSearching ? (
              <VStack py={6} justify="center">
                <Spinner size="sm" color="blue.500" _dark={{ color: "blue.400" }} />
              </VStack>
            ) : previewTracks.length === 0 ? (
              <Box py={4} px={4}>
                <Text fontSize="sm" color="fg.muted" textAlign="center">No tracks found</Text>
              </Box>
            ) : (
              <VStack gap={0} align="stretch">
                {previewTracks.map((track) => {
                  const displayTitle = track.title || 'Unknown Track';
                  const displayArtist = Array.isArray(track.artists_names)
                    ? track.artists_names.join(', ')
                    : (track.artist || 'Unknown Artist');
                  const displayKey = track.musical_key ? `${track.musical_key} ${track.scale || ''}`.trim() : '';

                  const rawTags = [...ensureArray(track.genre), ...ensureArray(track.style)];
                  const displayTags = Array.from(new Set(rawTags.map(t => t.trim()))).filter(Boolean);
                  const primaryTag = displayTags.length > 0 ? displayTags[0] : null;

                  return (
                    <Flex
                      key={track.id}
                      px={4}
                      py={2.5}
                      cursor="pointer"
                      // ⚡️ ADDED: Enhanced hover and active states for better touch feedback
                      transition="background 0.2s"
                      _hover={{ bg: "blackAlpha.50", _dark: { bg: "whiteAlpha.200" } }}
                      _active={{ bg: "blackAlpha.100", _dark: { bg: "whiteAlpha.300" } }}
                      onClick={() => handleResultClick(displayTitle)}
                      gap={3}
                      align="center"
                    >
                      {/* Artwork */}
                      <Flex
                        w="40px" h="40px" bg="gray.100" _dark={{ bg: "whiteAlpha.200" }}
                        borderRadius="md" justify="center" align="center" overflow="hidden" flexShrink={0}
                      >
                        {track.cover_url ? (
                          <img src={track.cover_url} alt={displayTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Music size={20} color="var(--chakra-colors-fg-muted)" />
                        )}
                      </Flex>

                      {/* Stacked Title & Subtitle */}
                      <Flex direction="column" flex="1" minW={0} justify="center">
                        <Text fontSize="sm" fontWeight="600" color="fg" lineClamp={1}>
                          {displayTitle}
                        </Text>
                        <HStack gap={1.5} mt={0.5}>
                          {primaryTag && (
                            <Badge 
                              size="sm" colorPalette={getColorForGenre(primaryTag)} 
                              variant="subtle" borderRadius="sm" px={1.5} py={0} fontSize="10px"
                            >
                              {primaryTag}
                            </Badge>
                          )}
                          <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                            {displayArtist}
                          </Text>
                        </HStack>
                      </Flex>

                      {/* Acoustic Metadata */}
                      <HStack gap={{ base: 1, md: 2 }} flexShrink={0}>
                        {displayKey && (
                          <Box 
                            px={2} py={0.5} 
                            bg="transparent" color="fg.muted" border="1px solid" borderColor="border" 
                            borderRadius="md" fontSize="11px" fontWeight="500"
                          >
                            {displayKey}
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
                        
                        <Text display={{ base: "none", sm: "block" }} fontSize="xs" color="fg.muted" minW="32px" textAlign="right">
                          {formatDuration(track.duration)}
                        </Text>
                      </HStack>
                    </Flex>
                  );
                })}
              </VStack>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};