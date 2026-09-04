import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, Heading, Text, VStack, HStack, Input, Button, Select, createListCollection, Icon 
} from '@chakra-ui/react';
import { DatabaseZap } from 'lucide-react';
import { useSettings } from '../hook/useSettings';
import { toaster } from '../../../components/ui/toaster';

const timezoneOptions = createListCollection({
  items: [
    { label: "UTC (Coordinated Universal Time)", value: "UTC" },
    { label: "Europe/Paris", value: "Europe/Paris" },
    { label: "America/New_York", value: "America/New_York" },
    { label: "Asia/Tokyo", value: "Asia/Tokyo" },
  ],
});

export const GeneralSettings: React.FC = () => {
  const { settings, updateSettings, isSaving, triggerReindex, isReindexing } = useSettings();
  
  // Local state for the form so we don't trigger global renders on every keystroke
  const [formData, setFormData] = useState({
    station_name: '',
    timezone: 'UTC',
  });

  // Sync local state when global settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        station_name: settings.station_name || '',
        timezone: settings.timezone || 'UTC',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings(formData);
      toaster.create({ title: "Settings saved successfully", type: "success" });
    } catch (error) {
      console.error("Save failed");
      toaster.create({ title: "Failed to save settings", type: "error" });
    }
  };

  // ⚡️ Added the handler for the reindex button
  const handleReindexClick = async () => {
    try {
      await triggerReindex();
      toaster.create({ 
        title: "Reindex Started", 
        description: "Your catalog is being synchronized in the background.",
        type: "success" 
      });
    } catch (error) {
      toaster.create({ 
        title: "Failed to start reindex", 
        type: "error" 
      });
    }
  };

  return (
    <Box>
      <Heading size="lg" color="gray.900" mb={2}>Workspace Information</Heading>
      <Text fontSize="sm" color="gray.500" mb={8}>
        Manage your station's identity and global localization settings.
      </Text>

      {/* Card 1: Station Identity */}
      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="gray.200" shadow="sm" mb={6}>
        <Heading size="sm" color="gray.800" mb={4}>Station Details</Heading>
        
        <VStack align="stretch" gap={4}>
          <Box>
            <Text fontSize="xs" fontWeight="600" color="gray.700" mb={1}>Station Name</Text>
            <Input 
              value={formData.station_name}
              onChange={(e) => setFormData({ ...formData, station_name: e.target.value })}
              placeholder="e.g. Momo's Basement Radio"
              bg="gray.50"
            />
            <Text fontSize="11px" color="gray.500" mt={1}>This name will be displayed in emails and on your public dashboard.</Text>
          </Box>
        </VStack>
      </Box>

      {/* Card 2: Localization */}
      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="gray.200" shadow="sm" mb={6}>
        <Heading size="sm" color="gray.800" mb={4}>Localization</Heading>
        
        <VStack align="stretch" gap={4}>
          <Box>
            <Text fontSize="xs" fontWeight="600" color="gray.700" mb={1}>Default Timezone</Text>
            <Select.Root 
              collection={timezoneOptions} 
              value={[formData.timezone]} 
              onValueChange={(e) => setFormData({ ...formData, timezone: e.value[0] })}
            >
              <Select.Trigger bg="gray.50">
                <Select.ValueText />
              </Select.Trigger>
              <Select.Content bg="white" zIndex={10}>
                {timezoneOptions.items.map(item => (
                  <Select.Item item={item} key={item.value}>{item.label}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <Text fontSize="11px" color="gray.500" mt={1}>Used for playlist scheduling and analytics tracking.</Text>
          </Box>
        </VStack>
      </Box>

      {/* Card 3: Maintenance */}
      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="gray.200" shadow="sm" mb={6}>
        <Heading size="sm" color="gray.800" mb={4}>Maintenance</Heading>

        <HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
          <HStack gap={4} align="flex-start">
            <Box p={2} bg="blue.50" borderRadius="lg" color="blue.600">
              <Icon as={DatabaseZap} boxSize={5} />
            </Box>
            <VStack align="stretch" gap={0}>
              <Text fontWeight="600" fontSize="sm" color="gray.900">Reindex Search Catalog</Text>
              <Text fontSize="xs" color="gray.500" maxW="400px">
                Manually resynchronize your entire track library with the search engine.
                Run this if search results are missing tracks or filters behave unexpectedly.
              </Text>
            </VStack>
          </HStack>

          <Button
            variant="outline"
            borderColor="blue.200"
            color="blue.600"
            _hover={{ bg: "blue.50" }}
            size="sm"
            onClick={handleReindexClick}
            loading={isReindexing}
            loadingText="Starting..."
          >
            Reindex Catalog
          </Button>
        </HStack>
      </Box>

      {/* Action Footer */}
      <Flex justify="flex-end">
        <Button 
          bg="blue.600" color="white" _hover={{ bg: "blue.700" }}
          onClick={handleSave}
          loading={isSaving}
          loadingText="Saving..."
        >
          Save Changes
        </Button>
      </Flex>
    </Box>
  );
};