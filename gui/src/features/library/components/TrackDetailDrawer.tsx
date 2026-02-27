import React, { useState } from 'react';
import { 
  Box, Flex, HStack, VStack, Text, Icon, IconButton, 
  Input, Grid, Button 
} from '@chakra-ui/react';
import { Music, ArrowLeft, ArrowRight, X, Star } from 'lucide-react';
import type { Track } from '../../../types'; // Adjust path if needed

interface TrackDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
}

const TABS = ['Details', 'Album', 'Tags', 'Credits', 'File', 'Hubs'];

export const TrackDetailDrawer: React.FC<TrackDetailDrawerProps> = ({ isOpen, onClose, track }) => {
  const [activeTab, setActiveTab] = useState('Details');

  // Prevent rendering content if closed to save performance
  if (!isOpen && !track) return null;

  return (
    <>
      {/* 1. BACKDROP (Darkens the background and closes on click) */}
      <Box 
        position="fixed" top={0} left={0} right={0} bottom={0} 
        bg="rgba(0, 0, 0, 0.4)" 
        opacity={isOpen ? 1 : 0} 
        pointerEvents={isOpen ? "auto" : "none"}
        transition="opacity 0.3s ease-in-out" 
        zIndex={10000}
        onClick={onClose}
      />

      {/* 2. SLIDING DRAWER PANEL */}
      <Flex 
        position="fixed" top={0} right={0} bottom={0} 
        w="500px" maxW="100vw" bg="white"
        direction="column"
        transform={isOpen ? "translateX(0)" : "translateX(100%)"}
        transition="transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        zIndex={10001}
        boxShadow="-4px 0 24px rgba(0,0,0,0.1)"
      >
        {/* --- HEADER --- */}
        <Box px={6} pt={6} pb={2}>
          <Flex justify="space-between" align="start" mb={6}>
            <HStack gap={4}>
              <Flex 
                align="center" justify="center" 
                w="56px" h="56px" bg="gray.900" color="white" 
                borderRadius="md"
              >
                <Icon as={Music} boxSize={6} />
              </Flex>
              <VStack align="start" gap={0}>
                <Text fontSize="lg" fontWeight="bold" color="gray.900">
                  {track?.title || "Unknown Title"}
                </Text>
                <Text fontSize="sm" color="gray.500">
                  {track?.artist || "Unknown Artist"}
                </Text>
              </VStack>
            </HStack>

            <HStack gap={1}>
              <IconButton aria-label="Prev" variant="ghost" size="sm" color="gray.500">
                <Icon as={ArrowLeft} boxSize={4} />
              </IconButton>
              <IconButton aria-label="Next" variant="ghost" size="sm" color="gray.500">
                <Icon as={ArrowRight} boxSize={4} />
              </IconButton>
              <Box w="1px" h="16px" bg="gray.200" mx={1} />
              <IconButton aria-label="Close" variant="ghost" size="sm" color="gray.500" onClick={onClose}>
                <Icon as={X} boxSize={5} />
              </IconButton>
            </HStack>
          </Flex>

          {/* --- TABS --- */}
          <HStack gap={6} borderBottom="1px solid" borderColor="gray.100">
            {TABS.map(tab => (
              <Box 
                key={tab}
                px={1} pb={3} 
                cursor="pointer"
                borderBottom="2px solid"
                borderColor={activeTab === tab ? "blue.600" : "transparent"}
                color={activeTab === tab ? "blue.600" : "gray.500"}
                fontWeight={activeTab === tab ? "600" : "500"}
                onClick={() => setActiveTab(tab)}
                _hover={{ color: "blue.600" }}
                transition="all 0.2s"
              >
                <Text fontSize="sm">{tab}</Text>
              </Box>
            ))}
          </HStack>
        </Box>

        {/* --- BODY (Scrollable Form) --- */}
        <Box flex="1" overflowY="auto" px={6} py={6}>
          <Text fontWeight="bold" fontSize="sm" color="gray.900" mb={6}>
            Sound recording
          </Text>

          <VStack align="stretch" gap={5}>
            <FormRow label="Title">
              <StyledInput defaultValue={track?.title} />
            </FormRow>

            <FormRow label="Artist(s)">
              <StyledInput defaultValue={track?.artist} />
            </FormRow>

            <FormRow label="Album">
              <StyledInput placeholder="Album name" />
            </FormRow>

            <FormRow label="Track number">
              <HStack gap={3}>
                <StyledInput defaultValue="5" w="80px" textAlign="center" />
                <Text fontSize="sm" color="gray.500">of</Text>
                <StyledInput defaultValue="5" w="80px" textAlign="center" />
              </HStack>
            </FormRow>

            <FormRow label="Genre(s)">
              <StyledInput placeholder="House" />
            </FormRow>

            <FormRow label="ISRC">
              <StyledInput placeholder="CC-XXX-YY-NNNNN" />
            </FormRow>

            <FormRow label="BPM">
              <StyledInput />
            </FormRow>

            <FormRow label="Rating">
              <HStack gap={1}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Icon key={i} as={Star} boxSize={4} color="blue.500" cursor="pointer" />
                ))}
              </HStack>
            </FormRow>

            <FormRow label="Recording date">
              <StyledInput />
            </FormRow>
          </VStack>
        </Box>

        {/* --- FOOTER --- */}
        <Flex 
          px={6} py={4} 
          borderTop="1px solid" borderColor="gray.100" 
          bg="gray.50" justify="flex-start" gap={3}
        >
          <Button variant="ghost" color="gray.600" _hover={{ bg: "gray.200" }} onClick={onClose}>
            Cancel
          </Button>
          <Button bg="gray.600" color="white" _hover={{ bg: "gray.700" }}>
            Save
          </Button>
        </Flex>
      </Flex>
    </>
  );
};

// --- HELPER COMPONENTS FOR THE FORM ---

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
    border="1px solid" borderColor="gray.200"
    borderRadius="md"
    px={3}
    _focus={{ borderColor: "blue.500", ring: "1px", ringColor: "blue.500" }}
  />
);