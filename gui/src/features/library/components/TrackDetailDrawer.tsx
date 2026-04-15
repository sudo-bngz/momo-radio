import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, HStack, VStack, Text, Icon, IconButton, 
  Input, Grid, Button, Spinner 
} from '@chakra-ui/react';
import { Music, X, Edit2, Radio } from 'lucide-react';
import { api } from '../../../services/api';
import type { Track } from '../../../types';

interface TrackDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  track: Partial<Track> | null; 
  onTrackUpdated?: (updatedTrack: Partial<Track>) => void;
}

const TABS = ['Details', 'Album', 'Tags', 'Radio'];

export const TrackDetailDrawer: React.FC<TrackDetailDrawerProps> = ({ isOpen, onClose, track, onTrackUpdated }) => {
  const [activeTab, setActiveTab] = useState('Details');
  
  const [fullTrack, setFullTrack] = useState<Track | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ⚡️ NEW: Toggle for Read-Only vs Edit Mode
  const [isEditing, setIsEditing] = useState(false);

  // Live state for visual tags
  const [genreInput, setGenreInput] = useState('');
  const [styleInput, setStyleInput] = useState('');
  const [moodInput, setMoodInput] = useState('');

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen && track?.id) {
      let isMounted = true;
      setIsLoading(true);
      setMessage(null); 
      setActiveTab('Details'); 
      setIsEditing(false); // Always open in Read-Only mode

      api.getTrack(track.id)
        .then(data => {
          if (isMounted) {
            setFullTrack(data);
            setGenreInput(data.genre || '');
            setStyleInput(data.style || '');
            setMoodInput(data.mood || '');
          }
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

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Revert any unsaved tag inputs back to the database state
    if (fullTrack) {
      setGenreInput(fullTrack.genre || '');
      setStyleInput(fullTrack.style || '');
      setMoodInput(fullTrack.mood || '');
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!fullTrack?.id || !isEditing) return;

    setIsSaving(true);
    setMessage(null);
    
    const formElement = e.currentTarget as unknown as HTMLFormElement;
    const formData = new FormData(formElement);
    
    // Extract everything we allow to be edited
    const updates: Partial<Track> = {
      title: formData.get('title') as string,
      artist: formData.get('artist') as string,
      album: formData.get('album') as string,
      year: formData.get('year') as string,
      genre: formData.get('genre') as string,
      style: formData.get('style') as string,
      mood: formData.get('mood') as string,
      publisher: formData.get('publisher') as string,
      catalog_number: formData.get('catalog_number') as string,
      release_country: formData.get('release_country') as string,
    };

    try {
      await api.updateTrack(fullTrack.id, updates);
      const newTrackData = { ...fullTrack, ...updates } as Track;
      setFullTrack(newTrackData);
      
      setIsEditing(false); // Lock it back down after saving!
      setMessage({ text: "Saved successfully!", type: "success" });

      if (onTrackUpdated) {
        onTrackUpdated(newTrackData);
      }
      
      // Clear success message after a few seconds
      setTimeout(() => setMessage(null), 3000);

    } catch (error) {
      setMessage({ text: "Failed to save updates", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen && !track) return null;

  // Formatters
  const displayBPM = fullTrack?.bpm ? Math.round(fullTrack.bpm) : '-';
  const displayKey = fullTrack?.musical_key ? `${fullTrack.musical_key} ${fullTrack.scale || ''}`.trim() : '-';
  const displayDuration = fullTrack?.duration 
    ? `${Math.floor(fullTrack.duration / 60)}:${Math.floor(fullTrack.duration % 60).toString().padStart(2, '0')}` 
    : '0:00';
    
  const lastPlayedDate = fullTrack?.last_played 
    ? new Date(fullTrack.last_played).toLocaleString() 
    : 'Never played';

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
        {/* HEADER */}
        <Box px={6} pt={6} pb={2}>
          <Flex justify="space-between" align="start" mb={6}>
            <HStack gap={4}>
              <Flex align="center" justify="center" w="56px" h="56px" bg="gray.900" color="white" borderRadius="md">
                <Icon as={Music} boxSize={6} />
              </Flex>
              <VStack align="start" gap={0}>
                <Text fontSize="lg" fontWeight="bold" color="gray.900">{fullTrack?.title || track?.title}</Text>
                <Text fontSize="sm" color="gray.500">{fullTrack?.artist || track?.artist}</Text>
              </VStack>
            </HStack>
            <IconButton aria-label="Close" variant="ghost" size="sm" color="gray.500" onClick={onClose}>
              <Icon as={X} boxSize={5} />
            </IconButton>
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

        {/* BODY */}
        <Box flex="1" overflowY="auto" px={6} py={6}>
          {isLoading ? (
            <Flex justify="center" align="center" h="100%"><Spinner color="blue.500" /></Flex>
          ) : (
            <>
              {/* ⚡️ DETAILS TAB */}
              <Box display={activeTab === 'Details' ? 'block' : 'none'}>
                <VStack align="stretch" gap={6}>
                  <EditableField label="Title" name="title" value={fullTrack?.title} isEditing={isEditing} />
                  <EditableField label="Artist(s)" name="artist" value={fullTrack?.artist} isEditing={isEditing} />
                  <EditableField label="Recording Year" name="year" value={fullTrack?.year} isEditing={isEditing} />

                  <Box borderTop="1px dashed" borderColor="gray.200" my={2} />

                  <FormRow label="Acoustics">
                    <HStack gap={4}>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.400">BPM</Text>
                        <Text fontSize="sm" fontWeight="600" color="gray.900">{displayBPM}</Text>
                      </VStack>
                      <Box w="1px" h="30px" bg="gray.200" />
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.400">Key</Text>
                        <Text fontSize="sm" fontWeight="600" color="gray.900">{displayKey}</Text>
                      </VStack>
                      <Box w="1px" h="30px" bg="gray.200" />
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.400">Duration</Text>
                        <Text fontSize="sm" fontWeight="600" color="gray.900">{displayDuration}</Text>
                      </VStack>
                    </HStack>
                  </FormRow>
                </VStack>
              </Box>

              {/* ⚡️ ALBUM TAB */}
              <Box display={activeTab === 'Album' ? 'block' : 'none'}>
                <VStack align="stretch" gap={6}>
                  <EditableField label="Album Name" name="album" value={fullTrack?.album} isEditing={isEditing} placeholder="Original Mix / EP Name" />
                  <EditableField label="Publisher/Label" name="publisher" value={fullTrack?.publisher} isEditing={isEditing} placeholder="e.g. Warp Records" />
                  <EditableField label="Catalog No." name="catalog_number" value={fullTrack?.catalog_number} isEditing={isEditing} placeholder="e.g. WAP62" />
                  <EditableField label="Country" name="release_country" value={fullTrack?.release_country} isEditing={isEditing} placeholder="e.g. UK, US, FR" />
                </VStack>
              </Box>

              {/* ⚡️ TAGS TAB */}
              <Box display={activeTab === 'Tags' ? 'block' : 'none'}>
                <VStack align="stretch" gap={6}>
                  <FormRow label="Genre(s)">
                    <Box>
                      {isEditing && (
                        <StyledInput name="genre" value={genreInput} onChange={(e: any) => setGenreInput(e.target.value)} placeholder="Comma separated genres" />
                      )}
                      {/* Hidden input needed to submit data if we don't edit it but click save */}
                      {!isEditing && <input type="hidden" name="genre" value={genreInput} />}
                      <TagDisplay rawString={genreInput} />
                    </Box>
                  </FormRow>

                  <FormRow label="Style(s)">
                    <Box>
                      {isEditing && (
                        <StyledInput name="style" value={styleInput} onChange={(e: any) => setStyleInput(e.target.value)} placeholder="e.g. Minimal, Deep Tech" />
                      )}
                      {!isEditing && <input type="hidden" name="style" value={styleInput} />}
                      <TagDisplay rawString={styleInput} />
                    </Box>
                  </FormRow>

                  <FormRow label="Mood">
                    <Box>
                      {isEditing && (
                        <StyledInput name="mood" value={moodInput} onChange={(e: any) => setMoodInput(e.target.value)} placeholder="e.g. Uplifting, Dark, Chill" />
                      )}
                      {!isEditing && <input type="hidden" name="mood" value={moodInput} />}
                      <TagDisplay rawString={moodInput} colorScheme="purple" />
                    </Box>
                  </FormRow>
                </VStack>
              </Box>

              {/* ⚡️ RADIO TAB */}
              <Box display={activeTab === 'Radio' ? 'block' : 'none'}>
                <VStack align="stretch" gap={6}>
                  <HStack bg="gray.50" p={4} borderRadius="lg" gap={4}>
                    <Flex bg="blue.100" p={3} borderRadius="full">
                      <Icon as={Radio} boxSize={5} color="blue.600" />
                    </Flex>
                    <VStack align="start" gap={0}>
                      <Text fontSize="sm" fontWeight="600" color="gray.900">Broadcasting Stats</Text>
                      <Text fontSize="xs" color="gray.500">Auto-generated by your radio engine.</Text>
                    </VStack>
                  </HStack>
                  
                  <FormRow label="Play Count">
                    <Text fontSize="sm" fontWeight="600" color="gray.900">{fullTrack?.play_count || 0}</Text>
                  </FormRow>
                  
                  <FormRow label="Last Played">
                    <Text fontSize="sm" fontWeight="600" color="gray.900">{lastPlayedDate}</Text>
                  </FormRow>
                </VStack>
              </Box>
            </>
          )}
        </Box>

        {/* ⚡️ FOOTER - Dynamic based on isEditing */}
        <Flex px={6} py={4} borderTop="1px solid" borderColor="gray.100" bg="gray.50" justify="space-between" align="center">
          <Box>
            {message && <Text fontSize="sm" fontWeight="500" color={message.type === 'success' ? 'green.600' : 'red.500'}>{message.text}</Text>}
          </Box>
          
          <HStack gap={3}>
            {!isEditing ? (
              // READ ONLY MODE BUTTONS
              <>
                <Button variant="ghost" color="gray.600" onClick={onClose}>Close</Button>
              <Button 
                bg="white" 
                color="gray.900" 
                border="1px solid" 
                borderColor="gray.200" 
                _hover={{ bg: "gray.50" }} 
                onClick={(e) => { e.preventDefault(); setIsEditing(true); }} 
              >
                {/* ⚡️ Put the icon inside the button, and add a little right margin (mr={2}) */}
                <Icon as={Edit2} boxSize={4} mr={2} />
                Edit Metadata
              </Button>
              </>
            ) : (
              // EDIT MODE BUTTONS
              <>
                <Button variant="ghost" color="gray.600" onClick={handleCancelEdit} disabled={isSaving}>Cancel</Button>
                <Button type="submit" bg="blue.600" color="white" _hover={{ bg: "blue.700" }} loading={isSaving}>Save Changes</Button>
              </>
            )}
          </HStack>
        </Flex>
      </Flex>
    </>
  );
};

// --- HELPER COMPONENTS ---

const FormRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <Grid templateColumns="120px 1fr" alignItems="start" gap={4}>
    <Text fontSize="sm" color="gray.500" mt={isInputMode(children) ? 2 : 0}>{label}</Text>
    <Box w="100%">{children}</Box>
  </Grid>
);

// Small hack to align labels nicely depending on if it's text or an input box
const isInputMode = (children: any) => {
  return typeof children === 'object' && children !== null && 'props' in children;
};

// ⚡️ Smart Editable Field Component
const EditableField = ({ label, name, value, isEditing, placeholder = '' }: any) => {
  return (
    <FormRow label={label}>
      {isEditing ? (
        <StyledInput name={name} defaultValue={value || ''} placeholder={placeholder} />
      ) : (
        <Text fontSize="sm" fontWeight="600" color={value ? "gray.900" : "gray.400"} minH="24px" pt={0.5}>
          {value || '-'}
          {/* Hidden input to ensure data isn't lost if they save while on another tab */}
          <input type="hidden" name={name} value={value || ''} />
        </Text>
      )}
    </FormRow>
  );
};

const StyledInput = (props: any) => (
  <Input 
    {...props}
    h="38px" fontSize="sm" bg="white" color="gray.900"
    border="1px solid" borderColor="gray.200" borderRadius="md" px={3} w="100%"
    _placeholder={{ color: "gray.400" }}
    _focus={{ borderColor: "blue.500", ring: "1px", ringColor: "blue.500" }}
  />
);

const TagDisplay = ({ rawString, colorScheme = "blue" }: { rawString: string, colorScheme?: string }) => {
  if (!rawString.trim()) return <Text fontSize="sm" color="gray.400" pt={0.5}>-</Text>;
  const tags = rawString.split(',').map(s => s.trim()).filter(Boolean);
  
  const bg = colorScheme === 'purple' ? 'purple.50' : 'blue.50';
  const color = colorScheme === 'purple' ? 'purple.700' : 'blue.700';
  const border = colorScheme === 'purple' ? 'purple.100' : 'blue.100';

  return (
    <HStack flexWrap="wrap" gap={2} mt={2}>
      {tags.map((tag, index) => (
        <Box key={index} px={2.5} py={1} bg={bg} color={color} fontSize="xs" fontWeight="600" borderRadius="md" border="1px solid" borderColor={border}>
          {tag}
        </Box>
      ))}
    </HStack>
  );
};