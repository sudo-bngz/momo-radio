import { VStack, Box, Text, Progress, Grid, Icon, Heading, HStack, Code } from '@chakra-ui/react';
import { Database, HardDrive } from 'lucide-react';

export const StorageSettings = () => {
  return (
    <VStack align="stretch" gap={8}>
      <Box>
        <Heading size="md" fontWeight="bold">Media Storage</Heading>
        <Text fontSize="sm" color="gray.500">Monitor your library capacity and file paths.</Text>
      </Box>

      <Grid templateColumns="repeat(2, 1fr)" gap={6}>
        <Box p={6} borderRadius="2xl" border="1px solid" borderColor="gray.100" bg="gray.50">
          <HStack mb={4} justify="space-between">
            <Text fontWeight="bold" fontSize="xs" color="gray.500" textTransform="uppercase">Disk Usage</Text>
            <Icon as={HardDrive} color="blue.500" size="sm" />
          </HStack>
          <Text fontSize="2xl" fontWeight="bold" color="gray.900">42.8 GB</Text>
          <Text fontSize="xs" color="gray.400" mb={4}>of 100 GB available</Text>
          
          <Progress.Root value={42.8} colorPalette="blue" size="xs" shape="rounded">
            <Progress.Track bg="gray.200">
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
        </Box>

        <Box p={6} borderRadius="2xl" border="1px solid" borderColor="gray.100" bg="gray.50">
          <HStack mb={4} justify="space-between">
            <Text fontWeight="bold" fontSize="xs" color="gray.500" textTransform="uppercase">Database</Text>
            <Icon as={Database} color="purple.500" size="sm" />
          </HStack>
          <Text fontSize="2xl" fontWeight="bold" color="gray.900">1,248</Text>
          <Text fontSize="xs" color="gray.400">Tracks indexed</Text>
          <Text fontSize="xs" color="gray.400" mt={4}>Healthy connection</Text>
        </Box>
      </Grid>
      
      <Box>
        <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" mb={2}>Root Media Path</Text>
        <Code p={3} borderRadius="xl" w="full" bg="gray.100" color="gray.700" fontSize="xs">
          /var/lib/momo-radio/music
        </Code>
      </Box>
    </VStack>
  );
};