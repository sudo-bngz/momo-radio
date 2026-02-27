import React from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Box, Button, Input, VStack, HStack, Text, 
  Icon, Spinner, Heading, SimpleGrid, Badge, Field, Separator 
} from '@chakra-ui/react';
import { Upload, Tag, Building2, CheckCircle, XCircle } from 'lucide-react';
import { useIngest } from '../hook/useIngest';

export const IngestView: React.FC = () => {
  const {
    status, file, meta,
    onDrop, handleMetaChange, handleUpload, reset
  } = useIngest();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/mpeg': ['.mp3'], 'audio/flac': ['.flac'], 'audio/wav': ['.wav'] },
    maxFiles: 1,
    disabled: status === 'analyzing'
  });

  // --- STEP 1: IDLE / ANALYZING ---
  if (status === 'idle' || status === 'analyzing') {
    return (
      <Box
        {...getRootProps()}
        borderWidth="2px"
        borderStyle="dashed"
        borderColor={isDragActive ? "blue.400" : "gray.200"}
        bg={isDragActive ? "blue.50" : "gray.50"}
        borderRadius="2xl"
        p={20}
        textAlign="center"
        cursor={status === 'analyzing' ? 'not-allowed' : 'pointer'}
        transition="all 0.2s"
        _hover={{ borderColor: "blue.400", bg: "white" }}
      >
        <input {...getInputProps()} />
        {status === 'analyzing' ? (
          <VStack gap={4}>
            <Spinner size="xl" color="blue.500" />
            <Text color="gray.600" fontWeight="medium">Extracting ID3 Metadata...</Text>
          </VStack>
        ) : (
          <VStack gap={4}>
            <Box p={5} bg="white" borderRadius="full" boxShadow="sm">
              <Icon as={Upload} boxSize="32px" color="blue.500" />
            </Box>
            <VStack gap={1}>
              <Text fontSize="xl" fontWeight="semibold" color="gray.800">Click or drag audio file here</Text>
              <Text fontSize="sm" color="gray.500">Supports High-Quality MP3, FLAC, and WAV</Text>
            </VStack>
          </VStack>
        )}
      </Box>
    );
  }

  // --- STEP 2: REVIEW / UPLOADING (The Form) ---
  return (
    <Box as="form" animation="slide-up 0.4s ease-out">
      <VStack align="stretch" gap={10}>
        
        {/* Header Metadata Ribbon */}
        <HStack justify="space-between" bg="blue.50" p={4} borderRadius="xl" borderWidth="1px" borderColor="blue.100">
          <HStack gap={3}>
            <Badge colorPalette="blue" variant="solid">PRE-ANALYSIS COMPLETE</Badge>
            <Text fontSize="sm" fontWeight="mono" color="blue.800">{file?.name}</Text>
          </HStack>
          <Button 
            size="sm" 
            variant="ghost" 
            color="blue.600"
            bg="transparent"
            _hover={{ bg: "blue.100", color: "blue.700" }}
            onClick={reset}
          >
            <XCircle size={16} style={{ marginRight: '6px' }} /> 
            Cancel Ingest
          </Button>
        </HStack>

        {/* Section 1: Editorial Basics */}
        <Box>
          <Heading size="md" mb={6} display="flex" alignItems="center" gap={2} color="gray.800">
            <Icon as={Tag} boxSize="18px" color="blue.500" /> Main Information
          </Heading>
          <SimpleGrid columns={2} gap={8}>
            <Field.Root gridColumn="span 2">
              <Field.Label fontWeight="bold" color="gray.700">Track Title</Field.Label>
              <Input 
                size="lg" 
                value={meta.title} 
                onChange={(e) => handleMetaChange('title', e.target.value)}
                placeholder="Title extracted from file..."
                color="gray.800"
              />
            </Field.Root>

            <Field.Root>
              <Field.Label fontWeight="bold" color="gray.700">Artist</Field.Label>
              <Input 
                value={meta.artist} 
                onChange={(e) => handleMetaChange('artist', e.target.value)}
                placeholder="Artist Name"
                color="gray.800"
              />
            </Field.Root>

            <Field.Root>
              <Field.Label fontWeight="bold" color="gray.700">Album</Field.Label>
              <Input 
                value={meta.album} 
                onChange={(e) => handleMetaChange('album', e.target.value)}
                placeholder="Album Name"
                color="gray.800"
              />
            </Field.Root>
          </SimpleGrid>
        </Box>

        <Separator borderColor="gray.100" />

        {/* Section 2: Release Details */}
        <Box>
          <Heading size="md" mb={6} display="flex" alignItems="center" gap={2} color="gray.800">
            <Icon as={Building2} boxSize="18px" color="blue.500" /> Release & Label Info
          </Heading>
          <SimpleGrid columns={3} gap={8}>
            <Field.Root>
              <Field.Label fontSize="sm" color="gray.500">Record Label</Field.Label>
              <Input 
                variant="subtle"
                value={meta.label} 
                onChange={(e) => handleMetaChange('label', e.target.value)}
                placeholder="e.g. Warp Records"
                color="gray.800"
              />
            </Field.Root>

            <Field.Root>
              <Field.Label fontSize="sm" color="gray.500">Catalog Number</Field.Label>
              <Input 
                variant="subtle"
                value={meta.catalog_number} 
                onChange={(e) => handleMetaChange('catalog_number', e.target.value)}
                placeholder="e.g. WARP123"
                color="gray.800"
              />
            </Field.Root>

            <Field.Root>
              <Field.Label fontSize="sm" color="gray.500">Origin Country</Field.Label>
              <Input 
                variant="subtle"
                value={meta.country} 
                onChange={(e) => handleMetaChange('country', e.target.value)}
                placeholder="e.g. UK"
                color="gray.800"
              />
            </Field.Root>

            <Field.Root>
              <Field.Label fontSize="sm" color="gray.500">Genre</Field.Label>
              <Input 
                variant="subtle"
                value={meta.genre} 
                onChange={(e) => handleMetaChange('genre', e.target.value)}
                placeholder="Electronic"
                color="gray.800"
              />
            </Field.Root>

            <Field.Root>
              <Field.Label fontSize="sm" color="gray.500">Year</Field.Label>
              <Input 
                variant="subtle"
                value={meta.year} 
                onChange={(e) => handleMetaChange('year', e.target.value)}
                placeholder="2024"
                color="gray.800"
              />
            </Field.Root>
          </SimpleGrid>
        </Box>

        {/* Final Submission */}
        <Button 
          size="xl" 
          colorPalette="blue" 
          h="64px" 
          fontSize="lg" 
          borderRadius="2xl"
          onClick={handleUpload}
          loading={status === 'uploading'}
          _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
          transition="all 0.2s"
        >
          <CheckCircle size={24} style={{ marginRight: '12px' }} />
          Confirm & Add to Library
        </Button>
      </VStack>
    </Box>
  );
};