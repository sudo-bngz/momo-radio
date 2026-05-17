import React, { useState, useEffect } from 'react';
import { 
  Box, VStack, HStack, Heading, Text, Button, Icon, Select, createListCollection, Flex 
} from '@chakra-ui/react';
import { Plus, Music, ChevronDown } from 'lucide-react';
import { useNavigate, useMatch, useLocation } from 'react-router-dom'; 

// Import all your grid and list views
import { TrackListView } from './TrackListView';
import { PlaylistGridView } from './PlaylistGridView';
import { AlbumGridView } from './AlbumGridView';
import { ArtistGridView } from './ArtistGridView';

// Import your detail views
import { AlbumDetailView } from './AlbumDetailView';
import { ArtistDetailView } from './ArtistDetailView';

type LibraryTab = 'playlists' | 'tracks' | 'albums' | 'artists';

const TABS: { id: LibraryTab; label: string }[] = [
  { id: 'playlists', label: 'Playlists' },
  { id: 'tracks', label: 'Tracks' },
  { id: 'albums', label: 'Albums' },
  { id: 'artists', label: 'Artists' },
];

const sortOptions = createListCollection({
  items: [
    { label: "Newest First", value: "newest" },
    { label: "A-Z", value: "alphabetical" },
    { label: "Duration", value: "duration" },
  ],
});

export const LibraryView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation(); 
  
  // ⚡️ Matchers to detect if we are viewing a specific Album or Artist
  const albumDetailMatch = useMatch('/library/albums/:id');
  const artistDetailMatch = useMatch('/library/artists/:id');
  
  // ⚡️ Initialize active tab from React Router's memory (fallback to 'tracks')
  const [activeTab, setActiveTab] = useState<LibraryTab>(
    (location.state as any)?.activeTab || 'tracks'
  );
  
  const [sortBy, setSortBy] = useState('newest');
  
  // ⚡️ Single state to hold the title of whatever detail view is currently open
  const [dynamicTitle, setDynamicTitle] = useState<string>('');

  // Keep the tab in sync if the user uses browser back/forward buttons
  useEffect(() => {
    if ((location.state as any)?.activeTab) {
      setActiveTab((location.state as any).activeTab);
    }
  }, [location.state]);

  const currentTabLabel = TABS.find(t => t.id === activeTab)?.label || 'Tracks';

  const handleAddClick = () => {
    switch (activeTab) {
      case 'playlists': navigate('/playlists/new'); break;
      case 'albums':
      case 'artists':
      case 'tracks':
      default: navigate('/ingest'); break;
    }
  };

  // Boolean helper to know if ANY detail view is active
  const isDetailViewActive = !!albumDetailMatch || !!artistDetailMatch;

  return (
    <VStack align="stretch" h="100%" gap={8} bg="white" data-theme="light">
      
      {/* =========================================
          1. HEADER & BREADCRUMB
          ========================================= */}
      <VStack align="start" gap={1}>
        <HStack gap={2} fontSize="sm" color="gray.500" mb={1}>
          <Box w="24px" h="24px" bg="blue.500" color="white" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
            <Icon as={Music} boxSize={3} strokeWidth={3} />
          </Box>
          <Text 
            cursor="pointer" 
            _hover={{ textDecoration: "underline", color: "gray.900" }} 
            onClick={() => navigate('/library', { state: { activeTab: 'tracks' } })}
          >
            Library
          </Text>
          <Text color="gray.300">/</Text>
          
          {albumDetailMatch ? (
            <>
              <Text 
                cursor="pointer" 
                _hover={{ textDecoration: "underline", color: "gray.900" }} 
                onClick={() => {
                  setActiveTab('albums');
                  navigate('/library', { state: { activeTab: 'albums' } });
                }}
              >
                Albums
              </Text>
              <Text color="gray.300">/</Text>
              <Text color="gray.900" fontWeight="600">{dynamicTitle || 'Loading...'}</Text>
            </>
          ) : artistDetailMatch ? (
            <>
              <Text 
                cursor="pointer" 
                _hover={{ textDecoration: "underline", color: "gray.900" }} 
                onClick={() => {
                  setActiveTab('artists');
                  navigate('/library', { state: { activeTab: 'artists' } });
                }}
              >
                Artists
              </Text>
              <Text color="gray.300">/</Text>
              <Text color="gray.900" fontWeight="600">{dynamicTitle || 'Loading...'}</Text>
            </>
          ) : (
            <Text color="gray.900" fontWeight="500">{currentTabLabel}</Text>
          )}
        </HStack>

        {/* ⚡️ Hide the giant heading when viewing details */}
        {!isDetailViewActive && (
          <Heading size="3xl" fontWeight="normal" color="gray.900" letterSpacing="tight">
            Music Library
          </Heading>
        )}
      </VStack>

      {/* =========================================
          2. CONTROLS (Hidden during Detail Views)
          ========================================= */}
      {!isDetailViewActive && (
        <Flex justify="space-between" align="center" pb={2}>
          <HStack gap={4} overflowX="auto" css={{ '&::-webkit-scrollbar': { display: 'none' } }}>
            <Button bg="gray.900" color="white" borderRadius="full" w="48px" h="48px" p={0} _hover={{ bg: "black" }} onClick={handleAddClick} flexShrink={0}>
              <Icon as={Plus} boxSize={6} />
            </Button>

            <HStack gap={2}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <Button
                    key={tab.id} onClick={() => setActiveTab(tab.id)} size="sm" borderRadius="full" px={5} h="36px"
                    bg={isActive ? 'gray.900' : 'transparent'} color={isActive ? 'white' : 'gray.600'} fontWeight={isActive ? '600' : '500'}
                    _hover={isActive ? {} : { bg: 'gray.100', color: 'gray.900' }} transition="all 0.2s"
                  >
                    {tab.label}
                  </Button>
                );
              })}
            </HStack>
          </HStack>

          <Select.Root collection={sortOptions} value={[sortBy]} onValueChange={(details) => setSortBy(details.value[0])} width="180px">
            <Select.Trigger height="36px" bg="white" color="gray.700" fontSize="sm" border="1px solid" borderColor="gray.200" borderRadius="full" px={4} _hover={{ borderColor: "gray.300", bg: "gray.50" }}>
              <Select.ValueText placeholder="Sort by" fontWeight="600" />
              <Icon as={ChevronDown} color="gray.500" boxSize={4} />
            </Select.Trigger>
            <Select.Positioner zIndex={100}>
              <Select.Content bg="white" borderRadius="xl" shadow="md" border="1px solid" borderColor="gray.200" p={1}>
                {sortOptions.items.map((item) => (
                  <Select.Item item={item} key={item.value} p={2} borderRadius="md" _hover={{ bg: "gray.50" }} cursor="pointer">
                    <Select.ItemText color="gray.800" fontSize="sm" fontWeight="500">{item.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </Flex>
      )}

      {/* =========================================
          3. CONTENT ROUTER 
          ========================================= */}
      <Box flex="1" overflow="hidden" display="flex" flexDirection="column">
        {albumDetailMatch ? (
          <AlbumDetailView id={albumDetailMatch.params.id} onAlbumLoad={setDynamicTitle} />
        ) : artistDetailMatch ? (
          <ArtistDetailView id={artistDetailMatch.params.id} onArtistLoad={setDynamicTitle} />
        ) : (
          <>
            {activeTab === 'tracks' && <TrackListView sortBy={sortBy} />}
            {activeTab === 'playlists' && <PlaylistGridView />}
            {activeTab === 'albums' && <AlbumGridView />}
            {activeTab === 'artists' && <ArtistGridView />}
          </>
        )}
      </Box>

    </VStack>
  );
};