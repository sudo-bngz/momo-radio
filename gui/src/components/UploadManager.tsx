import React, { useState, useCallback, type ChangeEvent } from 'react';
import { useDropzone, type FileRejection, type DropzoneOptions } from 'react-dropzone';
import { 
  Box, Button, Input, VStack, HStack, Text, 
  Icon, Spinner, Heading, Container, SimpleGrid, Badge, Field 
} from '@chakra-ui/react';
import { Upload, Music, CheckCircle, AlertCircle, X } from 'lucide-react';
import { api } from '../services/api';
import type { TrackMetadata, UploadStatus } from '../types';

const INITIAL_META: TrackMetadata = {
  title: '', artist: '', album: '', genre: '', year: '', bpm: '', key: ''
};

const UploadManager: React.FC = () => {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<TrackMetadata>(INITIAL_META);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // --- Handlers ---

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
    if (fileRejections.length > 0) {
      setErrorMsg("Invalid file type. Please upload MP3, FLAC, or WAV.");
      return;
    }

    const selectedFile = acceptedFiles[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setStatus('analyzing');
    setErrorMsg('');

    const analyze = async () => {
      try {
        const data = await api.analyzeFile(selectedFile);
        setMeta({
          title: data.title || '',
          artist: data.artist || '',
          album: data.album || '',
          genre: data.genre || '',
          year: data.year || '',
          bpm: data.bpm || '',     
          key: data.key || ''
        });
        setStatus('review');
      } catch (err) {
        console.error(err);
        setStatus('idle');
        setFile(null);
        setErrorMsg("Analysis failed. Could not read metadata.");
      }
    };
    analyze();
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMeta((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    setErrorMsg('');

    try {
      await api.uploadTrack(file, meta);
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('review');
      setErrorMsg("Upload failed. Server might be down.");
    }
  };

  const reset = () => {
    setFile(null);
    setMeta(INITIAL_META);
    setStatus('idle');
    setErrorMsg('');
  };

  const dropzoneOptions: DropzoneOptions = {
    onDrop,
    accept: { 'audio/mpeg': ['.mp3'], 'audio/flac': ['.flac'], 'audio/wav': ['.wav'] },
    maxFiles: 1,
    disabled: status === 'analyzing'
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions);

  return (
    <Container maxW="container.lg" h="100%">
      
      {/* HEADER */}
      <Heading size="lg" mb={6} display="flex" alignItems="center" gap={2} color="gray.700">
        <Icon as={Music} color="blue.500" />
        Ingest Manager
      </Heading>

      {/* ERROR BANNER */}
      {errorMsg && (
        <HStack bg="red.50" p={4} borderRadius="md" mb={6} justify="space-between" borderWidth="1px" borderColor="red.100">
          <HStack color="red.600" gap={2}>
            <Icon as={AlertCircle} boxSize={5} />
            <Text fontSize="sm" fontWeight="medium">{errorMsg}</Text>
          </HStack>
          <Icon as={X} cursor="pointer" onClick={() => setErrorMsg('')} color="red.400" />
        </HStack>
      )}

      {/* MAIN CONTENT CARD */}
      <Box bg="white" p={8} borderRadius="xl" boxShadow="sm" borderWidth="1px" borderColor="gray.100">
        
        {/* STEP 1: DROPZONE */}
        {(status === 'idle' || status === 'analyzing') && (
          <Box
            {...getRootProps()}
            borderWidth="2px"
            borderStyle="dashed"
            borderColor={isDragActive ? "blue.400" : "gray.300"}
            bg={isDragActive ? "blue.50" : "gray.50"}
            borderRadius="xl"
            p={12}
            textAlign="center"
            cursor={status === 'analyzing' ? 'not-allowed' : 'pointer'}
            transition="all 0.2s"
            _hover={{ borderColor: "blue.400", bg: "gray.100" }}
          >
            <input {...getInputProps()} />
            
            {status === 'analyzing' ? (
              <VStack gap={4}>
                <Spinner size="xl" color="blue.500" borderWidth="4px" />
                <Text color="gray.600" fontWeight="medium">Analyzing audio metadata...</Text>
              </VStack>
            ) : (
              <VStack gap={3}>
                <Box p={4} bg="white" borderRadius="full" boxShadow="sm">
                  <Icon as={Upload} boxSize={8} color="blue.500" />
                </Box>
                <Text fontSize="lg" fontWeight="semibold" color="gray.700">Click or drag file here</Text>
                <Text fontSize="sm" color="gray.500">MP3, FLAC, or WAV (Max 50MB)</Text>
              </VStack>
            )}
          </Box>
        )}

        {/* STEP 2: METADATA FORM */}
        {(status === 'review' || status === 'uploading') && (
          <Box as="form" animation="fadeIn 0.5s">
            <HStack justify="space-between" bg="gray.50" p={4} borderRadius="md" mb={6} borderWidth="1px" borderColor="gray.200">
              <HStack gap={3}>
                  <Badge colorPalette="blue" variant="solid">FILE</Badge>
                  <Text fontSize="sm" fontFamily="mono" color="gray.700" lineClamp={1}>{file?.name}</Text>
              </HStack>
              <Button onClick={reset}>Cancel</Button>
            </HStack>

            <SimpleGrid columns={2} gap={5} mb={8}>
              
              {/* V3 FIELD REPLACEMENT START */}
              <Field.Root gridColumn="span 2" required>
                <Field.Label color="gray.700" fontWeight="medium">Title</Field.Label>
                <Input name="title" value={meta.title} onChange={handleChange} placeholder="Track Title" bg="white" color="gray.800" />
              </Field.Root>
              
              <Field.Root required>
                <Field.Label color="gray.700" fontWeight="medium">Artist</Field.Label>
                <Input name="artist" value={meta.artist} onChange={handleChange} placeholder="Artist Name" bg="white" color="gray.800" />
              </Field.Root>

              <Field.Root>
                <Field.Label color="gray.700" fontWeight="medium">Album</Field.Label>
                <Input name="album" value={meta.album} onChange={handleChange} placeholder="Album" bg="white" color="gray.800" />
              </Field.Root>

              <Field.Root>
                <Field.Label color="gray.700" fontWeight="medium">Genre</Field.Label>
                <Input name="genre" value={meta.genre} onChange={handleChange} placeholder="House, Techno..." bg="white" color="gray.800" />
              </Field.Root>

              <Field.Root>
                <Field.Label color="gray.700" fontWeight="medium">Year</Field.Label>
                <Input name="year" value={meta.year} onChange={handleChange} placeholder="2024" bg="white" color="gray.800" />
              </Field.Root>

              <Field.Root>
                <Field.Label color="gray.700" fontWeight="medium">BPM</Field.Label>
                <Input name="bpm" type="number" value={meta.bpm} onChange={handleChange} placeholder="124.00" bg="white" color="gray.800" />
              </Field.Root>

              <Field.Root>
                <Field.Label color="gray.700" fontWeight="medium">Key</Field.Label>
                <Input name="key" value={meta.key} onChange={handleChange} placeholder="Am, 4A..." bg="white" color="gray.800" />
              </Field.Root>
              {/* V3 FIELD REPLACEMENT END */}

            </SimpleGrid>

            <Button 
              w="full" 
              colorPalette="blue" 
              size="lg" 
              onClick={handleUpload}
              loading={status === 'uploading'}
              loadingText="Uploading..."
            >
              <HStack gap={2}>
                <CheckCircle size={20} />
                <Text>Confirm & Upload</Text>
              </HStack>
            </Button>
          </Box>
        )}

        {/* STEP 3: SUCCESS */}
        {status === 'success' && (
          <VStack py={10} gap={4}>
            <Box p={4} bg="green.50" borderRadius="full">
              <Icon as={CheckCircle} boxSize={10} color="green.500" />
            </Box>
            <Heading size="md" color="gray.700">Upload Complete!</Heading>
            <Text color="gray.500">The track has been sent to the ingestion queue.</Text>
           <Button onClick={reset}>
              Upload another file
            </Button>
          </VStack>
        )}
      </Box>
    </Container>
  );
};

export default UploadManager;