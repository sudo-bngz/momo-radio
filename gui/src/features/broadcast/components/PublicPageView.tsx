import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, Heading, Text, VStack, HStack, Button, Input, Textarea, 
  Select, createListCollection, Spinner, Center, Icon, Grid
} from '@chakra-ui/react';
import { Save, Code, Palette, Badge } from 'lucide-react';
import { api, type PublicPageConfig } from '../../../services/api';

const visualModeOptions = createListCollection({
  items: [
    { label: "Built-in Presets", value: "preset" },
    { label: "Custom Hydra Code", value: "custom" },
  ],
});

const presetOptions = createListCollection({
  items: [
    { label: "Classic Oscillator", value: "oscillator" },
    { label: "Voronoi Liquid", value: "voronoi" },
    { label: "Audio Reactive Noise", value: "noise" },
    { label: "Kaleidoscope", value: "kaleidoscope" },
  ],
});

export const PublicPageView: React.FC = () => {
  const [config, setConfig] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    try {
      setSaving(true);
      await api.updatePublicPageSettings(config);
      // Optional: Add success toast here
    } catch (error) {
      console.error("Failed to save", error);
    } finally {
      setSaving(false);
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
          <Text fontSize="sm" color="gray.500">Customize the visual identity and audio-reactive background for your station's public URL.</Text>
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
              <Icon as={Code} boxSize={5} />
              <Heading size="sm">Hydra Visualizer Background</Heading>
            </HStack>
            
            <VStack align="stretch" gap={4} p={5} bg="gray.50" borderRadius="xl" border="1px solid" borderColor="gray.100">
              <Box>
                <Text fontSize="xs" fontWeight="600" color="gray.600" mb={2}>Visual Engine Mode</Text>
                <Select.Root 
                  collection={visualModeOptions} 
                  value={[config.visual_mode]} 
                  onValueChange={(e) => setConfig({ ...config, visual_mode: e.value[0] })}
                >
                  <Select.Trigger bg="white">
                    <Select.ValueText />
                  </Select.Trigger>
                  <Select.Content bg="white" zIndex={10}>
                    {visualModeOptions.items.map(item => (
                      <Select.Item item={item} key={item.value}>{item.label}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Box>

              {config.visual_mode === 'preset' ? (
                <Box>
                  <Text fontSize="xs" fontWeight="600" color="gray.600" mb={2}>Select Preset</Text>
                  <Select.Root 
                    collection={presetOptions} 
                    value={[config.hydra_preset]} 
                    onValueChange={(e) => setConfig({ ...config, hydra_preset: e.value[0] })}
                  >
                    <Select.Trigger bg="white">
                      <Select.ValueText />
                    </Select.Trigger>
                    <Select.Content bg="white" zIndex={10}>
                      {presetOptions.items.map(item => (
                        <Select.Item item={item} key={item.value}>{item.label}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Box>
              ) : (
                <Box>
                  <Text fontSize="xs" fontWeight="600" color="gray.600" mb={2}>Raw Hydra JavaScript</Text>
                  <Textarea 
                    value={config.hydra_code}
                    onChange={(e) => setConfig({ ...config, hydra_code: e.target.value })}
                    placeholder="osc().color(0.9, 0.3, 0.1).out()"
                    fontFamily="mono" fontSize="xs" bg="gray.900" color="green.300" 
                    rows={8}
                  />
                </Box>
              )}
            </VStack>
          </Box>
        </VStack>

        {/* Right Column: Identity & CSS */}
        <VStack align="stretch" gap={8}>
          <Box>
            <HStack mb={4} color="gray.700">
              <Icon as={Palette} boxSize={5} />
              <Heading size="sm">Brand Identity</Heading>
            </HStack>
            
            <VStack align="stretch" gap={5}>
              <Box>
                <Text fontSize="xs" fontWeight="600" color="gray.600" mb={2}>Station Bio</Text>
                <Textarea 
                  value={config.bio}
                  onChange={(e) => setConfig({ ...config, bio: e.target.value })}
                  placeholder="Welcome to our underground broadcast..."
                  rows={3}
                />
              </Box>

              <Grid templateColumns="1fr 1fr" gap={4}>
                <Box>
                  <Text fontSize="xs" fontWeight="600" color="gray.600" mb={2}>Theme Mode</Text>
                  <Select.Root 
                    collection={createListCollection({ items: [{label: 'Dark', value: 'dark'}, {label: 'Light', value: 'light'}] })} 
                    value={[config.theme_mode]} 
                    onValueChange={(e) => setConfig({ ...config, theme_mode: e.value[0] })}
                  >
                    <Select.Trigger><Select.ValueText /></Select.Trigger>
                    <Select.Content bg="white" zIndex={10}>
                      <Select.Item item={{value: 'dark'}} key="dark">Dark Theme</Select.Item>
                      <Select.Item item={{value: 'light'}} key="light">Light Theme</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Box>
                <Box>
                  <Text fontSize="xs" fontWeight="600" color="gray.600" mb={2}>Accent Color</Text>
                  <Input 
                    type="color" 
                    value={config.accent_color}
                    onChange={(e) => setConfig({ ...config, accent_color: e.target.value })}
                    h="40px" p={1} cursor="pointer"
                  />
                </Box>
              </Grid>
            </VStack>
          </Box>

          <Box>
            <HStack justify="space-between" mb={2}>
              <Text fontSize="xs" fontWeight="600" color="gray.600">Custom CSS (MySpace Mode)</Text>
              <Badge color="purple.600" fontSize="10px">Advanced</Badge>
            </HStack>
            <Textarea 
              value={config.custom_css}
              onChange={(e) => setConfig({ ...config, custom_css: e.target.value })}
              placeholder="/* Override player styles here */&#10;.player-container {&#10;  border-radius: 0px;&#10;}"
              fontFamily="mono" fontSize="xs" bg="gray.50" rows={6}
            />
          </Box>

        </VStack>
      </Grid>
    </Box>
  );
};