import React, { useState } from 'react';
import { 
  Box, Flex, Heading, Text, Tabs, HStack, VStack, 
  Icon, Input, Button, Textarea, Badge, SimpleGrid 
} from '@chakra-ui/react';
import { Radio, Copy, Eye, Link2, Monitor, Code } from 'lucide-react';

export const BroadcastPage: React.FC = () => {
  const [isLive, setIsLive] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Mock server credentials
  const streamUrl = "rtmp://stream.yourplatform.io/live";
  const streamKey = "live_948201_x9f2ba9e102bc45a";

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <Box w="100%" px={8} py={4}>
      {/* Page Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <VStack align="flex-start" gap={1}>
          <Heading size="lg" fontWeight="bold" color="gray.800">Broadcast Settings</Heading>
          <Text fontSize="sm" color="gray.500">Manage your live stream feeds and public web radio profile.</Text>
        </VStack>
        
        {/* Live Status Indicator */}
        <HStack bg="white" px={4} h="40px" borderRadius="full" border="1px solid" borderColor="gray.100" shadow="sm" gap={3}>
          <Box w={2.5} h={2.5} bg={isLive ? "red.500" : "gray.300"} borderRadius="full" animation={isLive ? "pulse 2s infinite" : undefined} />
          <Badge colorPalette={isLive ? "red" : "gray"} variant="surface" fontSize="xs" px={2} borderRadius="md">
            {isLive ? "ON AIR" : "OFFLINE (AutoDJ)"}
          </Badge>
        </HStack>
      </Flex>

      {/* Tabs Navigation */}
      <Tabs.Root defaultValue="studio" variant="enclosed" maxW="1200px">
        <Tabs.List bg="gray.50" p={1} borderRadius="xl" border="1px solid" borderColor="gray.100" mb={6}>
          <Tabs.Trigger value="studio" borderRadius="lg" px={6} py={2} fontWeight="medium">
            <Icon as={Radio} mr={2} boxSize={4} />
            Live Studio
          </Tabs.Trigger>
          <Tabs.Trigger value="stage" borderRadius="lg" px={6} py={2} fontWeight="medium">
            <Icon as={Monitor} mr={2} boxSize={4} />
            Public Stage
          </Tabs.Trigger>
        </Tabs.List>

        {/* =========================================================================
            TAB 1: LIVE STUDIO (Stream Configuration)
            ========================================================================= */}
        <Tabs.Content value="studio">
          <SimpleGrid columns={{ base: 1, xl: 3 }} gap={6}>
            
            {/* Stream Credentials Card (FIXED: Using gridColumn instead of xlSpan) */}
            <VStack gridColumn={{ base: "span 1", xl: "span 2" }} align="stretch" bg="white" p={6} borderRadius="2xl" border="1px solid" borderColor="gray.100" shadow="sm" gap={5}>
              <Box>
                <Heading size="sm" mb={1} fontWeight="bold" color="gray.800">Encoder Connection Details</Heading>
                <Text fontSize="xs" color="gray.500">Copy these credentials into your broadcasting software (OBS, Traktor, Rekordbox).</Text>
              </Box>

              <VStack align="stretch" gap={4}>
                <Box>
                  <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={1.5}>Server URL (RTMP / Icecast)</Text>
                  <HStack gap={2}>
                    <Input readOnly value={streamUrl} bg="gray.50" h="40px" fontSize="sm" />
                    <Button onClick={() => handleCopy(streamUrl)} variant="outline" h="40px" px={4}>
                      <Icon as={Copy} boxSize={4} />
                    </Button>
                  </HStack>
                </Box>

                <Box>
                  <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={1.5}>Stream Key / Password</Text>
                  <HStack gap={2}>
                    <Input type="password" readOnly value={streamKey} bg="gray.50" h="40px" fontSize="sm" />
                    <Button onClick={() => handleCopy(streamKey)} variant="outline" h="40px" px={4}>
                      <Text fontSize="xs">{copiedKey ? "Copied!" : <Icon as={Copy} boxSize={4} />}</Text>
                    </Button>
                  </HStack>
                </Box>
              </VStack>
            </VStack>

            {/* Live Stream Telemetry & Quick Control */}
            <VStack align="stretch" bg="white" p={6} borderRadius="2xl" border="1px solid" borderColor="gray.100" shadow="sm" gap={5}>
              <Box>
                <Heading size="sm" mb={1} fontWeight="bold" color="gray.800">Stream Telemetry</Heading>
                <Text fontSize="xs" color="gray.500">Real-time status and broadcast ingestion quality.</Text>
              </Box>

              <SimpleGrid columns={2} gap={4}>
                <Box bg="gray.50" p={3} borderRadius="xl" textAlign="center">
                  <Text fontSize="10px" fontWeight="bold" color="gray.500" textTransform="uppercase" letterSpacing="wider">Current Bitrate</Text>
                  <Text fontSize="lg" fontWeight="bold" color="gray.700" mt={1}>{isLive ? "320 kbps" : "0 kbps"}</Text>
                </Box>
                <Box bg="gray.50" p={3} borderRadius="xl" textAlign="center">
                  <Text fontSize="10px" fontWeight="bold" color="gray.500" textTransform="uppercase" letterSpacing="wider">Active Listeners</Text>
                  <Text fontSize="lg" fontWeight="bold" color="gray.700" mt={1}>{isLive ? "42" : "--"}</Text>
                </Box>
              </SimpleGrid>

              {/* Dev Only Simulator Switch */}
              <Box pt={2} borderTop="1px solid" borderColor="gray.50">
                <Flex justify="space-between" align="center">
                  <Text fontSize="xs" fontWeight="medium" color="gray.600">Simulate Live Signal Input</Text>
                  
                  <Flex 
                    as="button" w="40px" h="22px" bg={isLive ? "red.500" : "gray.200"} 
                    borderRadius="full" p="2px" align="center" justify={isLive ? "flex-end" : "flex-start"} 
                    onClick={() => setIsLive(!isLive)} transition="all 0.2s" cursor="pointer"
                  >
                    <Box w="18px" h="18px" bg="white" borderRadius="full" shadow="sm" />
                  </Flex>

                </Flex>
              </Box>
            </VStack>

          </SimpleGrid>
        </Tabs.Content>

        {/* =========================================================================
            TAB 2: PUBLIC STAGE (Public Station Page Configuration)
            ========================================================================= */}
        <Tabs.Content value="stage">
          <SimpleGrid columns={{ base: 1, xl: 3 }} gap={6}>
            
            {/* Customization Details (FIXED: Using gridColumn instead of xlSpan) */}
            <VStack gridColumn={{ base: "span 1", xl: "span 2" }} align="stretch" bg="white" p={6} borderRadius="2xl" border="1px solid" borderColor="gray.100" shadow="sm" gap={5}>
              <Flex justify="space-between" align="center">
                <Box>
                  <Heading size="sm" mb={1} fontWeight="bold" color="gray.800">Station Identity</Heading>
                  <Text fontSize="xs" color="gray.500">Configure what the public scene looks at when listening to your stream.</Text>
                </Box>
                <Button size="sm" variant="outline">
                  <Icon as={Eye} mr={1} boxSize={3.5} /> View Page
                </Button>
              </Flex>

              <VStack align="stretch" gap={4}>
                <Box>
                  <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={1.5}>Radio Station Name</Text>
                  <Input placeholder="e.g., Concrete Collective Radio" h="40px" fontSize="sm" />
                </Box>

                <Box>
                  <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={1.5}>About / Description</Text>
                  <Textarea placeholder="Describe your radio station, resident artists, and broadcast schedules..." fontSize="sm" rows={4} />
                </Box>

                <Box>
                  <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={1.5}>SoundCloud / Resident Advisor Link</Text>
                  <Flex position="relative" align="center">
                    <Icon as={Link2} color="gray.400" boxSize={4} ml={3} position="absolute" />
                    <Input pl={10} placeholder="https://soundcloud.com/your-collective" h="40px" fontSize="sm" w="100%" />
                  </Flex>
                </Box>
              </VStack>
            </VStack>

            {/* Embed & Distribution Panel */}
            <VStack align="stretch" bg="white" p={6} borderRadius="2xl" border="1px solid" borderColor="gray.100" shadow="sm" gap={5}>
              <Box>
                <Heading size="sm" mb={1} fontWeight="bold" color="gray.800">Web Player Embed</Heading>
                <Text fontSize="xs" color="gray.500">Inject your stream's audio engine straight onto your external custom web designs.</Text>
              </Box>

              <Box bg="gray.50" p={3} borderRadius="xl" position="relative">
                <Icon as={Code} boxSize={4} color="gray.400" position="absolute" right={3} top={3} />
                <Text fontSize="11px" fontFamily="mono" color="gray.600" whiteSpace="pre-wrap" lineHeight="1.5">
                  {`<iframe \n  src="https://play.yourplatform.io/embed/your-collective" \n  width="100%" \n  height="90" \n  frameborder="0"\n/>`}
                </Text>
              </Box>

              <Button size="sm" variant="surface" w="100%" h="38px">
                <Icon as={Copy} boxSize={3.5} mr={2} /> Copy Embed Snippet
              </Button>
            </VStack>

          </SimpleGrid>
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
};