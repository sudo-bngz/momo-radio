import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, HStack, VStack, Text, Icon, IconButton, 
  Input, Grid, Button, Spinner 
} from '@chakra-ui/react';
import { Music, X } from 'lucide-react';
import { api } from '../../../services/api';
import type { Track } from '../../../types';

interface TrackDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  track: Partial<Track> | null; 
  onTrackUpdated?: (updatedTrack: Partial<Track>) => void;
}

const TABS = ['Details', 'Album', 'Tags', 'Credits', 'File', 'Hubs'];

export const TrackDetailDrawer: React.FC<TrackDetailDrawerProps> = ({ isOpen, onClose, track, onTrackUpdated }) => {
  const [activeTab, setActiveTab] = useState('Details');
  
  const [fullTrack, setFullTrack] = useState<Track | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // NEW: Inline message state since useToast is gone in Chakra v3
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen && track?.id) {
      let isMounted = true;
      setIsLoading(true);
      setMessage(null); // Reset message on open

      api.getTrack(track.id)
        .then(data => {
          if (isMounted) setFullTrack(data);
        })
        .catch(err => {
          console.error("Failed to load track details", err);
          if (isMounted) setMessage({ text: "Error loading details", type: "error" });
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });

      return () => { isMounted = false; };
    } else {
      setFullTrack(null);
    }
  }, [isOpen, track?.id]);

const handleSave = async (e: React.FormEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!fullTrack?.id) return;

    setIsSaving(true);
    setMessage(null);
    
    // 2. FIX: Tell TypeScript "trust me, this is actually a form element"
    const formElement = e.currentTarget as unknown as HTMLFormElement;
    const formData = new FormData(formElement);
    
    const updates = {
      title: formData.get('title') as string,
      artist: formData.get('artist') as string,
      album: formData.get('album') as string,
      genre: formData.get('genre') as string,
      bpm: parseFloat(formData.get('bpm') as string) || 0,
      musical_key: formData.get('musical_key') as string,
      year: formData.get('year') as string,
    };

    try {
      await api.updateTrack(fullTrack.id, updates);
      const newTrackData = { ...fullTrack, ...updates };
      setFullTrack({ ...fullTrack, ...updates });
      setMessage({ text: "Saved successfully!", type: "success" });

      if (onTrackUpdated) {
        onTrackUpdated(newTrackData);
      }
      
      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (error) {
      setMessage({ text: "Failed to save updates", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };
  if (!isOpen && !track) return null;

  return (
    <>
      <Box 
        position="fixed" top={0} left={0} right={0} bottom={0} 
        bg="rgba(0, 0, 0, 0.4)" opacity={isOpen ? 1 : 0} 
        pointerEvents={isOpen ? "auto" : "none"} transition="opacity 0.3s" 
        zIndex={10000} onClick={onClose}
      />

      <Flex 
        as="form" 
        onSubmit={handleSave} 
        position="fixed" top={0} right={0} bottom={0} 
        w="500px" maxW="100vw" bg="white" direction="column"
        transform={isOpen ? "translateX(0)" : "translateX(100%)"}
        transition="transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        zIndex={10001} boxShadow="-4px 0 24px rgba(0,0,0,0.1)"
      >
        <Box px={6} pt={6} pb={2}>
          <Flex justify="space-between" align="start" mb={6}>
            <HStack gap={4}>
              <Flex align="center" justify="center" w="56px" h="56px" bg="gray.900" color="white" borderRadius="md">
                <Icon as={Music} boxSize={6} />
              </Flex>
              <VStack align="start" gap={0}>
                <Text fontSize="lg" fontWeight="bold" color="gray.900">
                  {fullTrack?.title || track?.title}
                </Text>
                <Text fontSize="sm" color="gray.500">
                  {fullTrack?.artist || track?.artist}
                </Text>
              </VStack>
            </HStack>

            <HStack gap={1}>
              <IconButton aria-label="Close" variant="ghost" size="sm" color="gray.500" onClick={onClose}>
                <Icon as={X} boxSize={5} />
              </IconButton>
            </HStack>
          </Flex>

          <HStack gap={6} borderBottom="1px solid" borderColor="gray.100">
            {TABS.map(tab => (
              <Box 
                key={tab} px={1} pb={3} cursor="pointer"
                borderBottom="2px solid" borderColor={activeTab === tab ? "blue.600" : "transparent"}
                color={activeTab === tab ? "blue.600" : "gray.500"} fontWeight={activeTab === tab ? "600" : "500"}
                onClick={() => setActiveTab(tab)} _hover={{ color: "blue.600" }} transition="all 0.2s"
              >
                <Text fontSize="sm">{tab}</Text>
              </Box>
            ))}
          </HStack>
        </Box>

        <Box flex="1" overflowY="auto" px={6} py={6}>
          {isLoading ? (
            <Flex justify="center" align="center" h="100%">
              <Spinner color="blue.500" />
            </Flex>
          ) : (
            <>
              <Text fontWeight="bold" fontSize="sm" color="gray.900" mb={6}>Sound recording</Text>
              
              <VStack align="stretch" gap={5}>
                <FormRow label="Title">
                  <StyledInput name="title" defaultValue={fullTrack?.title || track?.title} />
                </FormRow>

                <FormRow label="Artist(s)">
                  <StyledInput name="artist" defaultValue={fullTrack?.artist || track?.artist} />
                </FormRow>

                <FormRow label="Album">
                  <StyledInput name="album" defaultValue={fullTrack?.album || ''} />
                </FormRow>

                <FormRow label="Genre(s)">
                  <StyledInput name="genre" defaultValue={fullTrack?.genre || ''} />
                </FormRow>

                <FormRow label="BPM">
                  <StyledInput name="bpm" defaultValue={fullTrack?.bpm || ''} type="number" step="0.01" />
                </FormRow>
                
                <FormRow label="Musical Key">
                  <StyledInput name="musical_key" defaultValue={fullTrack?.musical_key || ''} />
                </FormRow>

                <FormRow label="Recording date">
                  <StyledInput name="year" defaultValue={fullTrack?.year || ''} />
                </FormRow>
                
                <FormRow label="Duration">
                  <Text fontSize="sm" color="gray.700">
                    {fullTrack?.duration ? `${Math.floor(fullTrack.duration / 60)}:${Math.floor(fullTrack.duration % 60).toString().padStart(2, '0')}` : '0:00'}
                  </Text>
                </FormRow>
              </VStack>
            </>
          )}
        </Box>

        {/* --- FOOTER --- */}
        <Flex px={6} py={4} borderTop="1px solid" borderColor="gray.100" bg="gray.50" justify="space-between" align="center">
          
          {/* Status Message */}
          <Box>
            {message && (
              <Text fontSize="sm" fontWeight="500" color={message.type === 'success' ? 'green.600' : 'red.500'}>
                {message.text}
              </Text>
            )}
          </Box>

          <HStack gap={3}>
            {/* FIX: disabled instead of isDisabled */}
            <Button variant="ghost" color="gray.600" onClick={onClose} disabled={isLoading || isSaving}>
              Cancel
            </Button>
            {/* FIX: loading instead of isLoading, disabled instead of isDisabled */}
            <Button type="submit" bg="gray.900" color="white" _hover={{ bg: "black" }} loading={isSaving} disabled={isLoading}>
              Save
            </Button>
          </HStack>

        </Flex>
      </Flex>
    </>
  );
};

// --- HELPER COMPONENTS ---

const FormRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <Grid templateColumns="120px 1fr" alignItems="center" gap={4}>
    <Text fontSize="sm" color="gray.500">{label}</Text>
    <Box w="100%">{children}</Box>
  </Grid>
);

const StyledInput = (props: any) => (
  <Input 
    {...props}
    h="38px" 
    fontSize="sm" 
    bg="white"
    color="gray.900"
    border="1px solid" 
    borderColor="gray.200" 
    borderRadius="md" 
    px={3}
    _placeholder={{ color: "gray.400" }}
    _focus={{ borderColor: "blue.500", ring: "1px", ringColor: "blue.500" }}
  />
);