import { useRef } from 'react';
import { 
  Input, IconButton, VStack, HStack, Text, Badge, Box, Popover 
} from '@chakra-ui/react';
import { InputGroup } from './ui/input-group';
import { Search, SlidersHorizontal, Zap, X } from 'lucide-react'; // ⚡️ ADDED: X icon
import { useSearchStore } from '../store/useSearchStore';

export const SearchBar = () => {
  const globalSearch = useSearchStore((state: any) => state.globalSearch);
  const setGlobalSearch = useSearchStore((state: any) => state.setGlobalSearch || state.setSearch);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSuggestionClick = (query: string) => {
    setGlobalSearch(query);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleClear = () => {
    setGlobalSearch('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <Box position="relative" w="full" maxW="600px">
      <InputGroup 
        w="full"
        startElement={<Search size={18} color="var(--chakra-colors-gray-400)" />}
        endElement={
          <HStack gap={1}>
            {/* ⚡️ ADDED: Conditional Clear Button */}
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
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Search tracks, or type 'bpm > 120'..." 
          bg="gray.50"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="full"
          pl={10} 
          _focus={{ bg: "white", borderColor: "blue.500", boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)" }}
        />
      </InputGroup>
    </Box>
  );
};