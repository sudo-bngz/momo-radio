import React, { useState, useEffect } from 'react';
import { Box, Flex, Heading, Text, VStack, Input, Button } from '@chakra-ui/react';
import { Switch } from "../../../components/ui/switch"
import { useSettings } from '../hook/useSettings';

export const StorageSettings: React.FC = () => {
  const { settings, updateSettings, isSaving } = useSettings();
  
  const [formData, setFormData] = useState({
    custom_storage_enabled: false,
    storage_bucket: '',
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        custom_storage_enabled: settings.custom_storage_enabled || false,
        storage_bucket: settings.storage_bucket || '',
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
      <Heading size="lg" color="gray.900" mb={2}>Storage & Assets</Heading>
      <Text fontSize="sm" color="gray.500" mb={8}>
        Manage where your audio files and images are stored.
      </Text>

      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="gray.200" shadow="sm" mb={6}>
        <Flex justify="space-between" align="center" mb={4}>
          <Box>
            <Heading size="sm" color="gray.800">Custom S3 Storage</Heading>
            <Text fontSize="xs" color="gray.500">Bring your own bucket for media storage.</Text>
          </Box>
          <Switch 
            checked={formData.custom_storage_enabled}
            onCheckedChange={(e) => setFormData({ ...formData, custom_storage_enabled: e.checked })}
          />
        </Flex>
        
        {formData.custom_storage_enabled && (
          <VStack align="stretch" gap={4} mt={4} pt={4} borderTop="1px solid" borderColor="gray.100">
            <Box>
              <Text fontSize="xs" fontWeight="600" color="gray.700" mb={1}>Bucket Name</Text>
              <Input 
                value={formData.storage_bucket}
                onChange={(e) => setFormData({ ...formData, storage_bucket: e.target.value })}
                placeholder="my-radio-assets"
                bg="gray.50"
              />
            </Box>
          </VStack>
        )}
      </Box>

      <Flex justify="flex-end">
        <Button bg="blue.600" color="white" _hover={{ bg: "blue.700" }} onClick={handleSave} loading={isSaving}>
          Save Changes
        </Button>
      </Flex>
    </Box>
  );
};