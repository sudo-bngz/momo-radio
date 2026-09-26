import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, VStack, HStack, Heading, Text, Button, Icon, Select, createListCollection, Flex 
} from '@chakra-ui/react';
import { Plus, Music, ChevronDown } from 'lucide-react';
import { useNavigate, useMatch, useLocation } from 'react-router-dom'; 
import axios from 'axios';

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
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setActiveTab('tracks');
    navigate('/library', { state: { activeTab: 'tracks' } });

    const toastId = toaster.create({
      title: `Preparing ${files.length} tracks...`,
      description: "Requesting secure upload links.",
      type: "loading",
    });

    try {
      const filePayload = files.map(f => ({ 
        filename: f.name, 
        content_type: f.type || 'application/octet-stream' 
      }));
      const presignRes = await api.bulkPresign(filePayload); 

      const CONCURRENCY_LIMIT = 5;
      let completedCount = 0;

      for (let i = 0; i < presignRes.tickets.length; i += CONCURRENCY_LIMIT) {
        const batch = presignRes.tickets.slice(i, i + CONCURRENCY_LIMIT);
        
        const batchPromises = batch.map(async (ticket: any) => {
          const file = files.find(f => f.name === ticket.filename);
          if (!file) return null;
          
          await axios.put(ticket.url, file, {
            headers: { 'Content-Type': file.type || 'application/octet-stream' }
          });
          
          return { filename: ticket.filename, file_key: ticket.key };
        });

        const results = await Promise.all(batchPromises);
        const validResults = results.filter(res => res !== null) as { filename: string, file_key: string }[];
        
        if (validResults.length > 0) {
          const confirmRes = await api.bulkConfirm(validResults);
          
          confirmRes.ids.forEach((id: number) => {
            window.dispatchEvent(new CustomEvent('track_uploaded', { 
              detail: { track_id: id } 
            }));
          });

          completedCount += validResults.length;
          toaster.update(toastId, {
            title: `Uploading tracks (${completedCount}/${files.length})`,
            type: "loading",
          });
        }
      }

      toaster.update(toastId, {
        title: "Bulk Upload Complete",
        description: `Successfully queued ${files.length} tracks for processing.`,
        type: "success",
        duration: 5000,
      });

    } catch (error) {
      console.error("Bulk upload failed:", error);
      toaster.update(toastId, {
        title: "Upload Failed",
        description: "There was an error transferring your files.",
        type: "error",
        duration: 5000,
      });
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  const isDetailViewActive = !!albumDetailMatch;

  return (
    // ⚡️ Removed hardcoded bg="white" and data-theme="light" to inherit the parent layout's background
    <VStack align="stretch" h="100%" gap={8} bg="transparent">
      <input 
        type="file" 
        multiple 
        accept=".mp3,.flac,.wav" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        style={{ display: 'none' }} 
      />
      
      <VStack align="start" gap={1}>
        <HStack gap={2} fontSize="sm" color="fg.muted" mb={1}>
          <Box 
            w="24px" h="24px" bg="blue.500" _dark={{ bg: "blue.400" }} color="white" 
            borderRadius="md" display="flex" alignItems="center" justifyContent="center"
          >
            <Icon as={Music} boxSize={3} strokeWidth={3} />
          </Box>
          <Text cursor="pointer" _hover={{ textDecoration: "underline", color: "fg" }} onClick={() => navigate('/library', { state: { activeTab: 'tracks' } })}>Library</Text>
          <Text color="border">/</Text>
          
          {albumDetailMatch ? (
            <>
              <Text cursor="pointer" _hover={{ textDecoration: "underline", color: "fg" }} onClick={() => { setActiveTab('albums'); navigate('/library', { state: { activeTab: 'albums' } }); }}>Albums</Text>
              <Text color="border">/</Text>
              <Text color="fg" fontWeight="600">{dynamicTitle || 'Loading...'}</Text>
            </>
          ) : (
            <Text color="fg" fontWeight="500">{currentTabLabel}</Text>
          )}
        </HStack>
        {!isDetailViewActive && <Heading size="3xl" fontWeight="normal" color="fg" letterSpacing="tight">Music Library</Heading>}
      </VStack>

      {!isDetailViewActive && (
        <Flex justify="space-between" align="center" pb={2}>
          <HStack gap={4} overflowX="auto" css={{ '&::-webkit-scrollbar': { display: 'none' } }}>
            
            {/* ⚡️ Upload button dynamically swaps colors based on active mode */}
            <Button 
              title="Upload at least 5 tracks to unlock autonomous broadcasting."
              bg="fg" 
              color="bg" 
              borderRadius="full" 
              w="48px" 
              h="48px" 
              p={0} 
              _hover={{ opacity: 0.8 }} 
              onClick={handleAddClick} 
              flexShrink={0}
            >
              <Icon as={Plus} boxSize={6} />
            </Button>

            <HStack gap={2}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <Button 
                    key={tab.id} 
                    onClick={() => setActiveTab(tab.id)} 
                    size="sm" 
                    borderRadius="full" 
                    px={5} 
                    h="36px" 
                    bg={isActive ? 'fg' : 'transparent'} 
                    color={isActive ? 'bg' : 'fg.muted'} 
                    fontWeight={isActive ? '600' : '500'} 
                    _hover={isActive ? {} : { bg: 'gray.100', color: 'fg', _dark: { bg: 'whiteAlpha.200' } }} 
                    transition="all 0.2s"
                  >
                    {tab.label}
                  </Button>
                );
              })}
            </HStack>
          </HStack>

          {/* ⚡️ Select component completely mapped to semantic tokens */}
          <Select.Root collection={sortOptions} value={[sortBy]} onValueChange={(details) => setSortBy(details.value[0])} width="180px">
            <Select.Trigger 
              height="36px" bg="bg.panel" color="fg" fontSize="sm" 
              border="1px solid" borderColor="border" borderRadius="full" px={4} 
              _hover={{ borderColor: "fg.muted", bg: "gray.50", _dark: { bg: "whiteAlpha.50" } }}
            >
              <Select.ValueText placeholder="Sort by" fontWeight="600" />
              <Icon as={ChevronDown} color="fg.muted" boxSize={4} />
            </Select.Trigger>
            <Select.Positioner zIndex={100}>
              <Select.Content bg="bg.panel" borderRadius="xl" shadow="md" border="1px solid" borderColor="border" p={1}>
                {sortOptions.items.map((item) => (
                  <Select.Item 
                    item={item} key={item.value} p={2} borderRadius="md" cursor="pointer"
                    _hover={{ bg: "gray.50", _dark: { bg: "whiteAlpha.100" } }} 
                  >
                    <Select.ItemText color="fg" fontSize="sm" fontWeight="500">{item.label}</Select.ItemText>
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