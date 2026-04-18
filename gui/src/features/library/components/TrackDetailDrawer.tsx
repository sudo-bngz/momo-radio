import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

// Human-readable time formatting
const formatTimeAgo = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return 'Never played';
  
  const date = new Date(dateInput);
  const now = new Date();
  const secondsPast = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (secondsPast < 60) return 'Just now';
  if (secondsPast < 3600) return `${Math.floor(secondsPast / 60)} minutes ago`;
  if (secondsPast < 86400) {
    const hours = Math.floor(secondsPast / 3600);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  if (secondsPast < 604800) { // Less than 7 days
    const days = Math.floor(secondsPast / 86400);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
  
  return date.toLocaleDateString(undefined, { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

export const TrackDetailDrawer: React.FC<TrackDetailDrawerProps> = ({ isOpen, onClose, track, onTrackUpdated }) => {
  const [activeTab, setActiveTab] = useState('Details');
  
  const [fullTrack, setFullTrack] = useState<any>(null); // Temporarily using any to handle the nested backend objects
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Live state for visual tags
  const [genreInput, setGenreInput] = useState('');
  const [styleInput, setStyleInput] = useState('');
  const [moodInput, setMoodInput] = useState('');

  const navigate = useNavigate();

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen && track?.id) {
      let isMounted = true;
      setIsLoading(true);
      setMessage(null); 
      setActiveTab('Details'); 
      setIsEditing(false);

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
    
    const updates: Partial<Track> = {
      title: formData.get('title') as string,
      genre: formData.get('genre') as string,
      style: formData.get('style') as string,
      mood: formData.get('mood') as string,
      // Note: Updating artist and album names via string here will require 
      // specific handling on your Go backend later if you want to allow edits.
      publisher: formData.get('publisher') as string,
      catalog_number: formData.get('catalog_number') as string,
      release_country: formData.get('release_country') as string,
    };

    try {
      await api.updateTrack(fullTrack.id, updates);
      const newTrackData = { ...fullTrack, ...updates };
      setFullTrack(newTrackData);
      
      setIsEditing(false);
      setMessage({ text: "Saved successfully!", type: "success" });

      if (onTrackUpdated) {
        onTrackUpdated(newTrackData as Track);
      }
      
      setTimeout(() => setMessage(null), 3000);

    } catch (error) {
      setMessage({ text: "Failed to save updates", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen && !track) return null;

  // ⚡️ SAFELY RESOLVE RELATIONAL DATA
  // Check if it's an object (from GetTrack) or a string (from the LibraryList)
  const artistName = fullTrack?.artist?.name || (typeof fullTrack?.artist === 'string' ? fullTrack.artist : track?.artist) || '';
  const albumTitle = fullTrack?.album?.title || (typeof fullTrack?.album === 'string' ? fullTrack.album : track?.album) || '';
  const coverURL = fullTrack?.cover_url || fullTrack?.album?.cover_url || track?.cover_url;

  // Formatters
  const displayBPM = fullTrack?.bpm ? Math.round(fullTrack.bpm) : '-';
  const displayKey = fullTrack?.musical_key ? `${fullTrack.musical_key} ${fullTrack.scale || ''}`.trim() : '-';
  const displayDuration = fullTrack?.duration 
    ? `${Math.floor(fullTrack.duration / 60)}:${Math.floor(fullTrack.duration % 60).toString().padStart(2, '0')}` 
    : '0:00';
    
  const lastPlayedDate = formatTimeAgo(fullTrack?.last_played);

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
              <Flex 
                align="center" 
                justify="center" 
                w="56px" 
                h="56px" 
                bg="gray.100" 
                borderRadius="md" 
                overflow="hidden" 
                border="1px solid" 
                borderColor="gray.200"
                flexShrink={0}
              >
                {coverURL ? (
                  <img 
                    src={coverURL} 
                    alt="Cover" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  <Icon as={Music} boxSize={6} color="gray.400" />
                )}
              </Flex>
              <VStack align="start" gap={0}>
                <Text fontSize="lg" fontWeight="bold" color="gray.900">{fullTrack?.title || track?.title}</Text>
                <Text 
                  fontSize="sm" 
                  color="blue.600" 
                  cursor="pointer" 
                  _hover={{ textDecoration: "underline" }}
                  onClick={() => {
                    if (artistName) {
                      onClose(); 
                      navigate(`/artists/${encodeURIComponent(artistName)}`); 
                    }
                  }}
                >
                  {artistName /* ⚡️ Using resolved string */}
              </Text>
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
              {/* DETAILS TAB */}
              <Box display={activeTab === 'Details' ? 'block' : 'none'}>
                <VStack align="stretch" gap={6}>
                  <EditableField label="Title" name="title" value={fullTrack?.title} isEditing={isEditing} />
                  {/* ⚡️ Using resolved string */}
                  <EditableField label="Artist(s)" name="artist" value={artistName} isEditing={isEditing} />
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

              {/* ALBUM TAB */}
              <Box display={activeTab === 'Album' ? 'block' : 'none'}>
                <VStack align="stretch" gap={6}>
                  {/* ⚡️ Using resolved string */}
                  <EditableField label="Album Name" name="album" value={albumTitle} isEditing={isEditing} placeholder="Original Mix / EP Name" />
                  <EditableField label="Publisher/Label" name="publisher" value={fullTrack?.publisher} isEditing={isEditing} placeholder="e.g. Warp Records" />
                  <EditableField label="Catalog No." name="catalog_number" value={fullTrack?.catalog_number} isEditing={isEditing} placeholder="e.g. WAP62" />
                  <EditableField label="Country" name="release_country" value={fullTrack?.release_country} isEditing={isEditing} placeholder="e.g. UK, US, FR" />
                </VStack>
              </Box>

              {/* TAGS TAB */}
              <Box display={activeTab === 'Tags' ? 'block' : 'none'}>
                <VStack align="stretch" gap={6}>
                  <FormRow label="Genre(s)">
                    <Box>
                      {isEditing && (
                        <StyledInput name="genre" value={genreInput} onChange={(e: any) => setGenreInput(e.target.value)} placeholder="Comma separated genres" />
                      )}
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

              {/* RADIO TAB */}
              <Box display={activeTab === 'Radio' ? 'block' : 'none'}>
                <VStack align="stretch" gap={6}>
                  <HStack bg="gray.50" p={4} borderRadius="lg" gap={4}>
                    <Flex bg="blue.100" p={3} borderRadius="full">
                      <Icon as={Radio} boxSize={5} color="blue.600" />
                    </Flex>
                    <VStack align="start" gap={0}>
                      <Text fontSize="sm" fontWeight="600" color="gray.900">Broadcasting Stats</Text>
                      <Text fontSize="xs" color="gray.500">Auto-generated by the radio engine.</Text>
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

        {/* FOOTER */}
        <Flex px={6} py={4} borderTop="1px solid" borderColor="gray.100" bg="gray.50" justify="space-between" align="center">
          <Box>
            {message && <Text fontSize="sm" fontWeight="500" color={message.type === 'success' ? 'green.600' : 'red.500'}>{message.text}</Text>}
          </Box>
          
          <HStack gap={3}>
            {!isEditing ? (
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
                  <Icon as={Edit2} boxSize={4} mr={2} />
                  Edit Metadata
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" color="gray.600" onClick={handleCancelEdit} disabled={isSaving}>Cancel</Button>
                <Button type="submit" bg="blue.600" color="white" _hover={{ bg: "blue.700" }} loading={isSaving}>
                  Save Changes
                </Button>
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

const isInputMode = (children: any) => {
  return typeof children === 'object' && children !== null && 'props' in children;
};

const EditableField = ({ label, name, value, isEditing, placeholder = '' }: any) => {
  return (
    <FormRow label={label}>
      {isEditing ? (
        <StyledInput name={name} defaultValue={value || ''} placeholder={placeholder} />
      ) : (
        <Text fontSize="sm" fontWeight="600" color={value ? "gray.900" : "gray.400"} minH="24px" pt={0.5}>
          {value || '-'}
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