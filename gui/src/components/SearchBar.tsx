import { useRef } from 'react';
import { 
  Input, IconButton, VStack, HStack, Text, Badge, Box, Popover 
} from '@chakra-ui/react';
import { InputGroup } from './ui/input-group';
import { Search, SlidersHorizontal, Zap } from 'lucide-react';
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

  return (
    <Box position="relative" w="full" maxW="600px">
      <InputGroup 
        w="full"
        startElement={<Search size={18} color="var(--chakra-colors-gray-400)" />}
        endElement={
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
            
            {/* ⚡️ FIXED: Added required Positioner wrapper for v3 */}
            <Popover.Positioner zIndex={50}>
              <Popover.Content w="320px" shadow="xl" border="1px solid" borderColor="gray.200" borderRadius="xl" bg="white">
                <Popover.Arrow />
                <Popover.Body p={4}>
                  <VStack align="stretch" gap={4}>
                    
                    <Box>
                      <HStack mb={2} color="blue.600">
                        <Zap size={14} />
                        <Text fontSize="xs" fontWeight="700" textTransform="uppercase">Quick Filters</Text>
                      </HStack>
                      <HStack flexWrap="wrap" gap={2}>
                        <Badge cursor="pointer" onClick={() => handleSuggestionClick("tag: Electronic")} _hover={{ opacity: 0.8 }} colorPalette="blue">Tag: Electronic</Badge>
                        <Badge cursor="pointer" onClick={() => handleSuggestionClick("filter: bpm > 120")} _hover={{ opacity: 0.8 }} colorPalette="green">BPM {'>'} 120</Badge>
                        <Badge cursor="pointer" onClick={() => handleSuggestionClick("filter: year >= 2020")} _hover={{ opacity: 0.8 }} colorPalette="purple">New Releases</Badge>
                        <Badge cursor="pointer" onClick={() => handleSuggestionClick('filter: genre = "Dub"')} _hover={{ opacity: 0.8 }} colorPalette="orange">Genre: Dub</Badge>
                      </HStack>
                    </Box>

                    <Box borderTop="1px solid" borderColor="gray.100" pt={3}>
                      <Text fontSize="xs" fontWeight="700" color="gray.500" mb={2} textTransform="uppercase">Advanced Syntax</Text>
                      <VStack align="stretch" gap={2} fontSize="xs" color="gray.600">
                        <Text><Text as="span" fontWeight="bold" color="gray.900">tag: [name]</Text> — Broad search across all tags</Text>
                        <Text><Text as="span" fontWeight="bold" color="gray.900">filter: [expr]</Text> — Use AND/OR logic</Text>
                        <Box bg="gray.50" p={2} borderRadius="md" fontFamily="monospace" fontSize="2xs">
                          filter: bpm &gt; 120 AND style = "Techno"
                        </Box>
                      </VStack>
                    </Box>

                  </VStack>
                </Popover.Body>
              </Popover.Content>
            </Popover.Positioner>
          </Popover.Root>
        }
      >
        <Input
          ref={inputRef}
          value={globalSearch || ''}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Search tracks, artists, or type filter:"
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