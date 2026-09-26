import React, { useRef, useState } from 'react';
import { 
  Box, VStack, HStack, Heading, Text, Button, Input, 
  Spinner, Grid, Group, InputAddon, Image as ChakraImage, Icon
} from '@chakra-ui/react';
import { Palette, Globe, Image as ImageIcon, UploadCloud } from 'lucide-react';
import type { PublicPageConfig } from '../../../services/api';

interface PageSettingsProps {
  config: PublicPageConfig;
  slugError: string;
  handleSlugChange: (slug: string) => void;
  updateConfig: (updates: Partial<PublicPageConfig>) => void;
  uploadImage: (file: File, type: 'background' | 'logo') => Promise<void>;
}

export const PageSettings: React.FC<PageSettingsProps> = ({ 
  config, slugError, handleSlugChange, updateConfig, uploadImage 
}) => {
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const bgInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'background' | 'logo') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'background') setUploadingBg(true);
    else setUploadingLogo(true);

    try {
      await uploadImage(file, type);
    } catch (error) {
      alert("Image upload failed. Please try again.");
    } finally {
      if (type === 'background') setUploadingBg(false);
      else setUploadingLogo(false);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={10}>
      {/* Left Column: Visuals & Aesthetics */}
      <VStack align="stretch" gap={8}>
        <Box>
          <HStack mb={4} color="fg">
            <Icon as={ImageIcon} boxSize={5} />
            <Heading size="sm">Imagery</Heading>
          </HStack>
          
          <VStack align="stretch" gap={6} p={5} bg="bg.panel" borderRadius="xl" border="1px solid" borderColor="border">
            
            {/* Background Image Upload */}
            <Box>
              <Text fontSize="xs" fontWeight="600" color="fg.muted" mb={2}>Background Image</Text>
              {config.background_image_url && (
                <Box mb={3} borderRadius="md" overflow="hidden" h="100px" border="1px solid" borderColor="border">
                  <ChakraImage src={config.background_image_url} alt="Background Preview" objectFit="cover" w="100%" h="100%" />
                </Box>
              )}
              <input 
                type="file" accept="image/*" ref={bgInputRef} style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e, 'background')} 
              />
              <Button 
                w="100%" variant="outline" bg="bg" size="sm"
                onClick={() => bgInputRef.current?.click()} disabled={uploadingBg}
              >
                {uploadingBg ? <Spinner size="sm" mr={2} /> : <Icon as={UploadCloud} boxSize={4} mr={2} />}
                {config.background_image_url ? "Replace Background" : "Upload Background"}
              </Button>
            </Box>

            {/* Logo Upload */}
            <Box>
              <Text fontSize="xs" fontWeight="600" color="fg.muted" mb={2}>Station Logo</Text>
              {config.logo_url && (
                <Box mb={3} p={2} bg="gray.800" _dark={{ bg: "blackAlpha.400" }} borderRadius="md" maxW="150px">
                  <ChakraImage src={config.logo_url} alt="Logo Preview" maxH="50px" objectFit="contain" />
                </Box>
              )}
              <input 
                type="file" accept="image/png, image/jpeg, image/svg+xml" ref={logoInputRef} style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e, 'logo')} 
              />
              <Button 
                w="100%" variant="outline" bg="bg" size="sm"
                onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
              >
                {uploadingLogo ? <Spinner size="sm" mr={2} /> : <Icon as={UploadCloud} boxSize={4} mr={2} />}
                {config.logo_url ? "Replace Logo" : "Upload Logo"}
              </Button>
            </Box>

          </VStack>
        </Box>

        <Box>
          <HStack mb={4} color="fg">
            <Icon as={Palette} boxSize={5} />
            <Heading size="sm">Brand Color</Heading>
          </HStack>
          <Box p={5} bg="bg.panel" borderRadius="xl" border="1px solid" borderColor="border">
            <Text fontSize="xs" fontWeight="600" color="fg.muted" mb={2}>Accent Color</Text>
            <HStack>
              <Input 
                type="color" 
                value={config.accent_color}
                onChange={(e) => updateConfig({ accent_color: e.target.value })}
                h="40px" w="60px" p={1} cursor="pointer"
                bg="bg"
              />
              <Input 
                bg="bg"
                value={config.accent_color}
                onChange={(e) => updateConfig({ accent_color: e.target.value })}
                fontFamily="mono" fontSize="sm"
              />
            </HStack>
          </Box>
        </Box>
      </VStack>

      {/* Right Column: Routing */}
      <VStack align="stretch" gap={8}>
        <Box>
          <HStack mb={4} color="fg">
            <Icon as={Globe} boxSize={5} />
            <Heading size="sm">Station URL</Heading>
          </HStack>
          {/* ⚡️ FIXED: Merged duplicate _dark objects into one */}
          <Box 
            p={5} 
            bg={slugError ? "red.50" : "blue.50"} 
            borderRadius="xl" 
            border="1px solid" 
            borderColor={slugError ? "red.200" : "blue.100"}
            _dark={{ 
              bg: slugError ? "red.900" : "blue.900",
              borderColor: slugError ? "red.800" : "blue.800"
            }}
          >
            <Text 
              fontSize="xs" fontWeight="600" 
              color={slugError ? "red.800" : "blue.800"} 
              _dark={{ color: slugError ? "red.200" : "blue.200" }}
              mb={2}
            >
              Custom Subdomain
            </Text>
            
            <Group attached w="100%">
              <InputAddon bg="bg" color="fg.muted" px={3} border="1px solid" borderColor="border" borderRight="none">
                https://
              </InputAddon>
              <Input 
                bg="bg"
                value={config.slug || ''}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="my-underground-label"
                borderColor={slugError ? "red.500" : "border"}
                _dark={{ borderColor: slugError ? "red.400" : "border" }}
              />
              <InputAddon bg="bg" color="fg.muted" px={3} border="1px solid" borderColor="border" borderLeft="none">
                .{config.base_domain || 'momoradio.fm'}
              </InputAddon>
            </Group>
            
            {slugError ? (
              <Text fontSize="xs" color="red.500" _dark={{ color: "red.400" }} mt={2} fontWeight="500">
                {slugError}
              </Text>
            ) : (
              <Text fontSize="10px" color="blue.600" _dark={{ color: "blue.300" }} mt={2}>
                Changing this will instantly update where listeners find your stream.
              </Text>
            )}
          </Box>
        </Box>
      </VStack>
    </Grid>
  );
};