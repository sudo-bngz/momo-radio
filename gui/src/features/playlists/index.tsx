import React, { useState } from 'react';
import { Box, Heading, Icon, Flex, Button } from '@chakra-ui/react';
import { ListMusic, ArrowLeft } from 'lucide-react';
import { PlaylistBuilder } from './components/PlaylistBuilder';
import { PlaylistList } from './components/PlaylistList';

export const PlaylistsFeature: React.FC = () => {
  // Mini-router state: 'list' | 'builder'
  const [currentView, setCurrentView] = useState<'list' | 'builder'>('list');
  const [activePlaylistId, setActivePlaylistId] = useState<number | null>(null);

  // Handlers
  const handleCreateNew = () => {
    setActivePlaylistId(null);
    setCurrentView('builder');
  };

  const handleEdit = (id: number) => {
    setActivePlaylistId(id);
    setCurrentView('builder');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setActivePlaylistId(null);
  };

  return (
    <Box w="full" h="100%" data-theme="light">
      
      {/* Dynamic Header based on the current view */}
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg" display="flex" alignItems="center" gap={2} color="gray.800">
          <Icon as={ListMusic} color="purple.500" />
          {currentView === 'list' ? 'Playlist Directory' : 'Playlist Studio'}
        </Heading>

        {/* Show a Back button if we are inside the builder */}
        {currentView === 'builder' && (
          <Button variant="ghost" colorPalette="gray" onClick={handleBackToList}>
            <ArrowLeft size={16} style={{ marginRight: '8px' }} />
            Back to Playlists
          </Button>
        )}
      </Flex>
      
      {/* Content Switcher */}
      <Box h="calc(100% - 60px)" w="full">
        {currentView === 'list' ? (
          <PlaylistList onCreate={handleCreateNew} onEdit={handleEdit} />
        ) : (
          <PlaylistBuilder playlistId={activePlaylistId} />
        )}
      </Box>
      
    </Box>
  );
};