import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, VStack, HStack, Heading, Text, Button, Icon, Select, createListCollection, Flex 
} from '@chakra-ui/react';
import { Plus, Music, ChevronDown } from 'lucide-react';
import { useNavigate, useMatch, useLocation } from 'react-router-dom'; 

import { TrackListView } from './TrackListView';
import { PlaylistGridView } from './PlaylistGridView';
import { AlbumGridView } from './AlbumGridView';
import { ArtistGridView } from './ArtistGridView';
import { AlbumDetailView } from './AlbumDetailView';
import { api } from '../../../services/api';
import { toaster } from '../../../components/ui/toaster';

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
  const albumDetailMatch = useMatch('/library/albums/:id');
  
  const [activeTab, setActiveTab] = useState<LibraryTab>(
    (location.state as any)?.activeTab || 'tracks'
  );
  const [sortBy, setSortBy] = useState('newest');
  const [dynamicTitle, setDynamicTitle] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if ((location.state as any)?.activeTab) {
      setActiveTab((location.state as any).activeTab);
    }
  }, [location.state]);

  const currentTabLabel = TABS.find(t => t.id === activeTab)?.label || 'Tracks';

  const handleAddClick = () => {
    if (activeTab === 'playlists') {
      navigate('/playlists/new');
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const toastId = toaster.create({
      title: `Uploading ${file.name}...`,
      type: "loading",
    });

    try {
      const response = await api.uploadTrack(file);

      // 1. Force the UI to switch to the Tracks tab immediately
      setActiveTab('tracks');
      navigate('/library', { state: { activeTab: 'tracks' } });

      // 2. Wait a tiny moment for TrackListView to mount, then broadcast the new track
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('track_uploaded', { 
          detail: { track_id: response.track_id } 
        }));
      }, 150);

      toaster.update(toastId, {
        title: "Upload Complete",
        description: "Background worker has started analysis.",
        type: "success",
        duration: 5000,
      });

    } catch (error) {
      console.error("Upload failed:", error);
      toaster.update(toastId, {
        title: "Upload Failed",
        description: "There was an error transferring your file.",
        type: "error",
        duration: 5000,
      });
    } finally {
      event.target.value = '';
    }
  };

  const isDetailViewActive = !!albumDetailMatch;

  return (
    <VStack align="stretch" h="100%" gap={8} bg="white" data-theme="light">
      <input type="file" accept=".mp3,.flac,.wav" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
      
      <VStack align="start" gap={1}>
        <HStack gap={2} fontSize="sm" color="gray.500" mb={1}>
          <Box w="24px" h="24px" bg="blue.500" color="white" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
            <Icon as={Music} boxSize={3} strokeWidth={3} />
          </Box>
          <Text cursor="pointer" _hover={{ textDecoration: "underline", color: "gray.900" }} onClick={() => navigate('/library', { state: { activeTab: 'tracks' } })}>Library</Text>
          <Text color="gray.300">/</Text>
          
          {albumDetailMatch ? (
            <>
              <Text cursor="pointer" _hover={{ textDecoration: "underline", color: "gray.900" }} onClick={() => { setActiveTab('albums'); navigate('/library', { state: { activeTab: 'albums' } }); }}>Albums</Text>
              <Text color="gray.300">/</Text>
              <Text color="gray.900" fontWeight="600">{dynamicTitle || 'Loading...'}</Text>
            </>
          ) : (
            <Text color="gray.900" fontWeight="500">{currentTabLabel}</Text>
          )}
        </HStack>
        {!isDetailViewActive && <Heading size="3xl" fontWeight="normal" color="gray.900" letterSpacing="tight">Music Library</Heading>}
      </VStack>

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
                  <Button key={tab.id} onClick={() => setActiveTab(tab.id)} size="sm" borderRadius="full" px={5} h="36px" bg={isActive ? 'gray.900' : 'transparent'} color={isActive ? 'white' : 'gray.600'} fontWeight={isActive ? '600' : '500'} _hover={isActive ? {} : { bg: 'gray.100', color: 'gray.900' }} transition="all 0.2s">{tab.label}</Button>
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

      <Box flex="1" overflow="hidden" display="flex" flexDirection="column">
        {albumDetailMatch ? (
          <AlbumDetailView id={albumDetailMatch.params.id} onAlbumLoad={setDynamicTitle} />
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