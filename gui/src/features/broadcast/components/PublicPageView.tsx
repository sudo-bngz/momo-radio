import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Flex, Heading, Text, VStack, HStack, Button, Input, 
  Spinner, Center, Icon, Grid, Group, InputAddon, Image as ChakraImage
} from '@chakra-ui/react';
import { Save, Palette, Globe, Image as ImageIcon, UploadCloud } from 'lucide-react';
import { api, type PublicPageConfig } from '../../../services/api';

export const PublicPageView: React.FC = () => {
  const [config, setConfig] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Refs for hidden file inputs
  const bgInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await api.getPublicPageSettings();
        setConfig(data);
      } catch (err) {
        console.error("Failed to load public page config", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    const safeSlug = config.slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    try {
      setSaving(true);
      await api.updatePublicPageSettings({ ...config, slug: safeSlug });
    } catch (error) {
      console.error("Failed to save", error);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'background' | 'logo') => {
    const file = e.target.files?.[0];
    if (!file || !config) return;

    if (type === 'background') setUploadingBg(true);
    else setUploadingLogo(true);

    try {
      // The API now returns BOTH the preview URL and the storage key
      const response = await api.uploadPublicImage(file, type);
      
      // Update the config state with BOTH properties
      if (type === 'background') {
        setConfig({ 
          ...config, 
          background_image_url: response.url, 
          background_image_key: response.key // ⚡️ Store the key for the DB
        });
      } else {
        setConfig({ 
          ...config, 
          logo_url: response.url, 
          logo_key: response.key             // ⚡️ Store the key for the DB
        });
      }
    } catch (error) {
      console.error(`Failed to upload ${type}`, error);
      alert("Image upload failed. Please try again.");
    } finally {
      if (type === 'background') setUploadingBg(false);
      else setUploadingLogo(false);
      
      // Reset input so the same file can be selected again if needed
      e.target.value = ''; 
    }
  };

  if (loading || !config) {
    return (
      <Center h="400px" bg="white" borderRadius="2xl" border="1px solid" borderColor="gray.100">
        <Spinner size="xl" color="gray.400" />
      </Center>
    );
  }

  return (
    <Box w="100%" bg="white" p={8} borderRadius="2xl" border="1px solid" borderColor="gray.100" shadow="sm">
      
      <Flex justify="space-between" align="center" mb={8}>
        <Box>
          <Heading size="md" fontWeight="bold" color="gray.800" mb={1}>Public Listener Page</Heading>
          <Text fontSize="sm" color="gray.500">Customize the visual identity and public URL for your broadcast.</Text>
        </Box>
        <Button 
          bg="blue.500" color="white" _hover={{ bg: "blue.600" }} 
          onClick={handleSave} disabled={saving}
        >
          {saving ? <Spinner size="sm" mr={2} /> : <Icon as={Save} boxSize={4} mr={2} />}
          Publish Changes
        </Button>
      </Flex>

      <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={10}>
        
        {/* Left Column: Visuals & Aesthetics */}
        <VStack align="stretch" gap={8}>
          <Box>
            <HStack mb={4} color="gray.700">
              <Icon as={ImageIcon} boxSize={5} />
              <Heading size="sm">Imagery</Heading>
            </HStack>
            
            <VStack align="stretch" gap={6} p={5} bg="gray.50" borderRadius="xl" border="1px solid" borderColor="gray.100">
              
              {/* Background Image Upload */}
              <Box>
                <Text fontSize="xs" fontWeight="600" color="gray.600" mb={2}>Background Image</Text>
                {config.background_image_url && (
                  <Box mb={3} borderRadius="md" overflow="hidden" h="100px" border="1px solid" borderColor="gray.200">
                    <ChakraImage src={config.background_image_url} alt="Background Preview" objectFit="cover" w="100%" h="100%" />
                  </Box>
                )}
                <input 
                  type="file" accept="image/*" ref={bgInputRef} style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload(e, 'background')} 
                />
                <Button 
                  w="100%" variant="outline" bg="white" size="sm"
                  onClick={() => bgInputRef.current?.click()} disabled={uploadingBg}
                >
                  {uploadingBg ? <Spinner size="sm" mr={2} /> : <Icon as={UploadCloud} boxSize={4} mr={2} />}
                  {config.background_image_url ? "Replace Background" : "Upload Background"}
                </Button>
              </Box>

              {/* Logo Upload */}
              <Box>
                <Text fontSize="xs" fontWeight="600" color="gray.600" mb={2}>Station Logo</Text>
                {config.logo_url && (
                  <Box mb={3} p={2} bg="gray.800" borderRadius="md" maxW="150px">
                    <ChakraImage src={config.logo_url} alt="Logo Preview" maxH="50px" objectFit="contain" />
                  </Box>
                )}
                <input 
                  type="file" accept="image/png, image/jpeg, image/svg+xml" ref={logoInputRef} style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload(e, 'logo')} 
                />
                <Button 
                  w="100%" variant="outline" bg="white" size="sm"
                  onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
                >
                  {uploadingLogo ? <Spinner size="sm" mr={2} /> : <Icon as={UploadCloud} boxSize={4} mr={2} />}
                  {config.logo_url ? "Replace Logo" : "Upload Logo"}
                </Button>
              </Box>

            </VStack>
          </Box>

          <Box>
            <HStack mb={4} color="gray.700">
              <Icon as={Palette} boxSize={5} />
              <Heading size="sm">Brand Color</Heading>
            </HStack>
            <Box p={5} bg="gray.50" borderRadius="xl" border="1px solid" borderColor="gray.100">
              <Text fontSize="xs" fontWeight="600" color="gray.600" mb={2}>Accent Color</Text>
              <HStack>
                <Input 
                  type="color" 
                  value={config.accent_color}
                  onChange={(e) => setConfig({ ...config, accent_color: e.target.value })}
                  h="40px" w="60px" p={1} cursor="pointer"
                  bg="white"
                />
                <Input 
                  bg="white"
                  value={config.accent_color}
                  onChange={(e) => setConfig({ ...config, accent_color: e.target.value })}
                  fontFamily="mono" fontSize="sm"
                />
              </HStack>
            </Box>
          </Box>
        </VStack>

        {/* Right Column: Routing */}
        <VStack align="stretch" gap={8}>
          <Box>
            <HStack mb={4} color="gray.700">
              <Icon as={Globe} boxSize={5} />
              <Heading size="sm">Station URL</Heading>
            </HStack>
            <Box p={5} bg="blue.50" borderRadius="xl" border="1px solid" borderColor="blue.100">
              <Text fontSize="xs" fontWeight="600" color="blue.800" mb={2}>Custom Subdomain</Text>
              <Group attached w="100%">
                <InputAddon bg="white" color="gray.500" px={3}>https://</InputAddon>
                <Input 
                  bg="white"
                  value={config.slug || ''}
                  onChange={(e) => setConfig({ ...config, slug: e.target.value })}
                  placeholder="my-underground-label"
                />
                <InputAddon bg="white" color="gray.500" px={3}>
                  .{config.base_domain || 'yourdomain.com'}
                </InputAddon>
              </Group>
              <Text fontSize="10px" color="blue.600" mt={2}>
                Changing this will instantly update where listeners find your stream.
              </Text>
            </Box>
          </Box>
        </VStack>
      </Grid>
    </Box>
  );
};