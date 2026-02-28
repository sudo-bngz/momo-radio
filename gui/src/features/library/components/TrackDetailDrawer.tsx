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
  // This 'track' prop is just the lightweight version from the table
  track: Partial<Track> | null; 
}

const TABS = ['Details', 'Album', 'Tags', 'Credits', 'File', 'Hubs'];

export const TrackDetailDrawer: React.FC<TrackDetailDrawerProps> = ({ isOpen, onClose, track }) => {
  const [activeTab, setActiveTab] = useState('Details');
  
  const [fullTrack, setFullTrack] = useState<Track | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 2. FETCH FULL DATA WHEN OPENED
  useEffect(() => {
    if (isOpen && track?.id) {
      let isMounted = true;
      setIsLoading(true);

      api.getTrack(track.id)
        .then(data => {
          if (isMounted) setFullTrack(data);
        })
        .catch(err => console.error("Failed to load track details", err))
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });

      return () => { isMounted = false; };
    } else {
      // Clear data when closed
      setFullTrack(null);
    }
  }, [isOpen, track?.id]);

  if (!isOpen && !track) return null;

  return (
    <>
      {/* BACKDROP */}
      <Box 
        position="fixed" top={0} left={0} right={0} bottom={0} 
        bg="rgba(0, 0, 0, 0.4)" opacity={isOpen ? 1 : 0} 
        pointerEvents={isOpen ? "auto" : "none"} transition="opacity 0.3s" 
        zIndex={10000} onClick={onClose}
      />

      {/* DRAWER PANEL */}
      <Flex 
        position="fixed" top={0} right={0} bottom={0} 
        w="500px" maxW="100vw" bg="white" direction="column"
        transform={isOpen ? "translateX(0)" : "translateX(100%)"}
        transition="transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        zIndex={10001} boxShadow="-4px 0 24px rgba(0,0,0,0.1)"
      >
        {/* --- HEADER --- */}
        <Box px={6} pt={6} pb={2}>
          <Flex justify="space-between" align="start" mb={6}>
            <HStack gap={4}>
              <Flex align="center" justify="center" w="56px" h="56px" bg="gray.900" color="white" borderRadius="md">
                <Icon as={Music} boxSize={6} />
              </Flex>
              <VStack align="start" gap={0}>
                {/* We use the lightweight 'track' here so the title appears instantly while loading */}
                <Text fontSize="lg" fontWeight="bold" color="gray.900">{track?.title}</Text>
                <Text fontSize="sm" color="gray.500">{track?.artist}</Text>
              </VStack>
            </HStack>

            <HStack gap={1}>
              <IconButton aria-label="Close" variant="ghost" size="sm" color="gray.500" onClick={onClose}>
                <Icon as={X} boxSize={5} />
              </IconButton>
            </HStack>
          </Flex>

          {/* TABS */}
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

        {/* --- BODY (Scrollable Form) --- */}
        <Box flex="1" overflowY="auto" px={6} py={6}>
          {isLoading ? (
            <Flex justify="center" align="center" h="100%">
              <Spinner color="blue.500" />
            </Flex>
          ) : (
            <>
              <Text fontWeight="bold" fontSize="sm" color="gray.900" mb={6}>Sound recording</Text>
              
              <VStack align="stretch" gap={5}>
                {/* 3. POPULATE FORM WITH FULL DATA */}
                <FormRow label="Title">
                  <StyledInput defaultValue={fullTrack?.title || track?.title} />
                </FormRow>

                <FormRow label="Artist(s)">
                  <StyledInput defaultValue={fullTrack?.artist || track?.artist} />
                </FormRow>

                <FormRow label="Album">
                  <StyledInput defaultValue={fullTrack?.album || ''} placeholder="Album name" />
                </FormRow>

                <FormRow label="Genre(s)">
                  <StyledInput defaultValue={fullTrack?.genre || ''} placeholder="House" />
                </FormRow>

                <FormRow label="BPM">
                  <StyledInput defaultValue={fullTrack?.bpm || ''} placeholder="120" type="number" />
                </FormRow>
                
                <FormRow label="Musical Key">
                  <StyledInput defaultValue={fullTrack?.musical_key || ''} placeholder="8A" />
                </FormRow>

                <FormRow label="Recording date">
                  <StyledInput defaultValue={fullTrack?.year || ''} placeholder="YYYY" />
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
        <Flex px={6} py={4} borderTop="1px solid" borderColor="gray.100" bg="gray.50" justify="flex-start" gap={3}>
          <Button variant="ghost" color="gray.600" _hover={{ bg: "gray.200" }} onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button bg="gray.600" color="white" _hover={{ bg: "gray.700" }} disabled={isLoading}>
            Save
          </Button>
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
    h="38px" fontSize="sm" bg="white" color="gray.900"
    border="1px solid" borderColor="gray.200" borderRadius="md" px={3}
    _focus={{ borderColor: "blue.500", ring: "1px", ringColor: "blue.500" }}
  />
);