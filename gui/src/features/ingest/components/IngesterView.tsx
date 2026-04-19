import React, { useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Box, Button, Input, VStack, HStack, Text, 
  Icon, Spinner, Heading, SimpleGrid, Badge, Field, Separator,
  ProgressCircle, Flex
} from '@chakra-ui/react';
import { Upload, Tag, Building2, CheckCircle, XCircle, Server, RadioTower, Music } from 'lucide-react';

import { useIngest } from '../hook/useIngest';
import { useQueue } from '../hook/useQueue';
import { ProcessingQueue, type QueueItem } from './ProcessingQueue';

export const IngestView: React.FC = () => {
  // 1. Local Ingestion State
  const {
    status, file, meta, 
    uploadProgress = 0, 
    processStep = '',   
    onDrop, handleMetaChange, handleUpload, reset
  } = useIngest();

  // 2. Live Server Queue State
  const { queue: serverQueue } = useQueue();

  // 3. Combined Queue Logic (Smooth handoff from Local to Server)
  const combinedQueue = useMemo(() => {
    let combined: QueueItem[] = [...serverQueue];

    // If a file is currently uploading to S3, show it at the top of the queue visually
    if (status === 'uploading' && file) {
      combined.unshift({
        id: 'local-upload',
        title: meta.title || file.name,
        status: 'uploading',
        progress: uploadProgress,
        step: 'Transferring to vault...'
      });
    }

    return combined;
  }, [serverQueue, status, file, meta.title, uploadProgress]);

  // 4. Dropzone Config
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/mpeg': ['.mp3'], 'audio/flac': ['.flac'], 'audio/wav': ['.wav'] },
    maxFiles: 1,
    disabled: status !== 'idle'
  });

  return (
    <VStack align="stretch" w="100%" maxW="800px" mx="auto" gap={10} pb={12}>
      
      {/* =========================================
          SECTION A: MAIN INTERACTION AREA
          ========================================= */}
      <Box>
        {/* --- STEP 1: DROPZONE --- */}
        {(status === 'idle' || status === 'analyzing') && (
          <Box
            {...getRootProps()}
            borderWidth="2px"
            borderStyle="dashed"
            borderColor={isDragActive ? "blue.400" : "gray.200"}
            bg={isDragActive ? "blue.50" : "gray.50"}
            borderRadius="2xl"
            p={20}
            textAlign="center"
            cursor={status === 'analyzing' ? 'wait' : 'pointer'}
            transition="all 0.2s"
            _hover={{ borderColor: "blue.400", bg: "white" }}
          >
            <input {...getInputProps()} />
            {status === 'analyzing' ? (
              <VStack gap={4} animation="fade-in 0.3s ease-out">
                <Spinner size="xl" color="blue.500" />
                <Text color="gray.600" fontWeight="medium">Reading ID3 Tags locally...</Text>
              </VStack>
            ) : (
              <VStack gap={4}>
                <Box p={5} bg="white" borderRadius="full" boxShadow="sm">
                  <Icon as={Upload} boxSize="32px" color="blue.500" />
                </Box>
                <VStack gap={1}>
                  <Text fontSize="xl" fontWeight="semibold" color="gray.800">Drop audio file here</Text>
                  <Text fontSize="sm" color="gray.500">MP3, FLAC, or WAV up to 100MB</Text>
                </VStack>
              </VStack>
            )}
          </Box>
        )}

        {/* --- STEP 2: REVIEW METADATA FORM --- */}
        {status === 'review' && (
          <Box as="form" animation="slide-up 0.4s ease-out">
            <VStack align="stretch" gap={10}>
              
              {/* Header Ribbon */}
              <HStack justify="space-between" bg="blue.50" p={4} borderRadius="xl" borderWidth="1px" borderColor="blue.100">
                <HStack gap={3}>
                  <Badge colorPalette="blue" variant="solid">LOCAL PARSE COMPLETE</Badge>
                  <Text fontSize="sm" fontWeight="mono" color="blue.800">{file?.name}</Text>
                </HStack>
                <Button size="sm" variant="ghost" color="blue.600" onClick={reset}>
                  <XCircle size={16} style={{ marginRight: '6px' }} /> Cancel
                </Button>
              </HStack>

              {/* Main Info */}
              <Box>
                <Heading size="md" mb={6} display="flex" alignItems="center" gap={2} color="gray.800">
                  <Icon as={Tag} boxSize="18px" color="blue.500" /> Main Information
                </Heading>
                <SimpleGrid columns={2} gap={8}>
                  <Field.Root gridColumn="span 2">
                    <Field.Label fontWeight="bold" color="gray.700">Track Title</Field.Label>
                    <Input size="lg" value={meta.title} onChange={(e) => handleMetaChange('title', e.target.value)} color="gray.800" />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label fontWeight="bold" color="gray.700">Artist</Field.Label>
                    <Input value={meta.artist} onChange={(e) => handleMetaChange('artist', e.target.value)} color="gray.800" />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label fontWeight="bold" color="gray.700">Album</Field.Label>
                    <Input value={meta.album} onChange={(e) => handleMetaChange('album', e.target.value)} color="gray.800" />
                  </Field.Root>
                </SimpleGrid>
              </Box>

              <Separator borderColor="gray.100" />

              {/* Release Info */}
              <Box>
                <Heading size="md" mb={6} display="flex" alignItems="center" gap={2} color="gray.800">
                  <Icon as={Building2} boxSize="18px" color="blue.500" /> Release & Label Info
                </Heading>
                <SimpleGrid columns={3} gap={8}>
                  <Field.Root>
                    <Field.Label fontSize="sm" color="gray.500">Record Label</Field.Label>
                    <Input variant="subtle" value={meta.label} onChange={(e) => handleMetaChange('label', e.target.value)} color="gray.800" />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label fontSize="sm" color="gray.500">Catalog Number</Field.Label>
                    <Input variant="subtle" value={meta.catalog_number} onChange={(e) => handleMetaChange('catalog_number', e.target.value)} color="gray.800" />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label fontSize="sm" color="gray.500">Country</Field.Label>
                    <Input variant="subtle" value={meta.country} onChange={(e) => handleMetaChange('country', e.target.value)} color="gray.800" />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label fontSize="sm" color="gray.500">Genre</Field.Label>
                    <Input variant="subtle" value={meta.genre} onChange={(e) => handleMetaChange('genre', e.target.value)} color="gray.800" />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label fontSize="sm" color="gray.500">Year</Field.Label>
                    <Input variant="subtle" value={meta.year} onChange={(e) => handleMetaChange('year', e.target.value)} color="gray.800" />
                  </Field.Root>
                </SimpleGrid>
              </Box>

              {/* Upload Action */}
              <Button 
                size="xl" colorPalette="blue" h="64px" fontSize="lg" borderRadius="2xl"
                onClick={handleUpload}
                _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
                transition="all 0.2s"
              >
                <Server size={24} style={{ marginRight: '12px' }} />
                Upload & Queue for Analysis
              </Button>
            </VStack>
          </Box>
        )}

        {/* --- STEP 3 & 4: UPLOADING & PROCESSING --- */}
        {(status === 'uploading' || status === 'processing' || status === 'success') && (
          <VStack 
            align="center" justify="center" h="400px" gap={8} 
            bg="gray.50" borderRadius="2xl" border="1px solid" borderColor="gray.100"
            animation="slide-up 0.4s ease-out"
          >
            {status === 'success' ? (
              <Box p={4} bg="green.100" borderRadius="full" color="green.600" mb={4}>
                <CheckCircle size={48} />
              </Box>
            ) : (
              <Box position="relative">
                <ProgressCircle.Root value={status === 'uploading' ? uploadProgress : null} size="xl" colorPalette="blue">
                  <ProgressCircle.Circle>
                    <ProgressCircle.Track />
                    <ProgressCircle.Range />
                  </ProgressCircle.Circle>
                </ProgressCircle.Root>
                <Flex position="absolute" top={0} left={0} w="100%" h="100%" align="center" justify="center">
                  <Icon as={status === 'uploading' ? Server : RadioTower} boxSize={6} color="blue.500" />
                </Flex>
              </Box>
            )}

            <VStack gap={2} textAlign="center">
              <Heading size="md" color="gray.900">
                {status === 'uploading' && `Uploading to Vault... ${uploadProgress}%`}
                {status === 'processing' && `Asynq Worker Processing...`}
                {status === 'success' && `Track Ingested Successfully!`}
              </Heading>
              <Text color="gray.500" fontSize="sm" maxW="300px">
                {status === 'uploading' && 'Transferring high-fidelity audio data to your storage provider.'}
                {status === 'processing' && (processStep || 'Awaiting deep acoustic analysis and waveform generation...')}
                {status === 'success' && 'Ready to be played in your library.'}
              </Text>
            </VStack>

            {status === 'success' && (
              <Button colorPalette="blue" size="lg" onClick={reset} mt={4}>
                <Music size={18} style={{ marginRight: '8px' }} />
                Ingest Another Track
              </Button>
            )}
          </VStack>
        )}
      </Box>

      {/* =========================================
          SECTION B: REAL-TIME QUEUE
          ========================================= */}
      <ProcessingQueue items={combinedQueue} />

    </VStack>
  );
};