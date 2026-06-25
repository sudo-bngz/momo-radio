import React, { useState, useEffect } from 'react';
import { Box, Flex, Heading, Text, VStack, Input, Button } from '@chakra-ui/react';
import { useSettings } from '../hook/useSettings';

export const AdvancedFfmpegSettings: React.FC = () => {
  const { settings, updateSettings, isSaving } = useSettings();
  
  const [formData, setFormData] = useState({
    ffmpeg_bitrate: '128k',
    ffmpeg_sample_rate: '44100',
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        ffmpeg_bitrate: settings.ffmpeg_bitrate || '128k',
        ffmpeg_sample_rate: settings.ffmpeg_sample_rate || '44100',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings(formData);
    } catch (error) {
      console.error("Save failed");
    }
  };

  return (
    <Box>
      <Heading size="lg" color="gray.900" mb={2}>Broadcast Engine</Heading>
      <Text fontSize="sm" color="gray.500" mb={8}>
        Fine-tune your audio encoding parameters.
      </Text>

      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="gray.200" shadow="sm" mb={6}>
        <Heading size="sm" color="gray.800" mb={4}>FFmpeg Configuration</Heading>
        
        <VStack align="stretch" gap={4}>
          <Box>
            <Text fontSize="xs" fontWeight="600" color="gray.700" mb={1}>Target Bitrate</Text>
            <Input 
              value={formData.ffmpeg_bitrate}
              onChange={(e) => setFormData({ ...formData, ffmpeg_bitrate: e.target.value })}
              placeholder="128k"
              bg="gray.50"
            />
          </Box>
          <Box>
            <Text fontSize="xs" fontWeight="600" color="gray.700" mb={1}>Sample Rate</Text>
            <Input 
              value={formData.ffmpeg_sample_rate}
              onChange={(e) => setFormData({ ...formData, ffmpeg_sample_rate: e.target.value })}
              placeholder="44100"
              bg="gray.50"
            />
          </Box>
        </VStack>
      </Box>

      <Flex justify="flex-end">
        <Button bg="blue.600" color="white" _hover={{ bg: "blue.700" }} onClick={handleSave} loading={isSaving}>
          Save Changes
        </Button>
      </Flex>
    </Box>
  );
};
