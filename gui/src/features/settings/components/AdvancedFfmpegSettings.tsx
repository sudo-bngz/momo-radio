import { VStack, Heading, Text, Input, Box, Button, Code, Field, Grid, Switch, HStack } from '@chakra-ui/react';

export const AdvancedFfmpegSettings = () => {
  return (
    <VStack align="stretch" gap={8}>
      <Box>
        <Heading size="md" mb={1} fontWeight="bold">FFMPEG Configuration</Heading>
        <Text fontSize="sm" color="gray.500">Tune the transcoding engine and broadcast parameters.</Text>
      </Box>

      <VStack align="stretch" gap={6}>
        {/* In v3, Switch often requires a Label/Control wrapper if not using a library-specific pattern */}
        <HStack justify="space-between" p={4} borderRadius="xl" border="1px solid" borderColor="gray.100">
          <Box>
            <Text fontSize="sm" fontWeight="bold">Hardware Acceleration</Text>
            <Text fontSize="xs" color="gray.400">Enable VAAPI/NVENC for transcoding.</Text>
          </Box>
          <Switch.Root colorPalette="blue" size="md">
            <Switch.Thumb />
          </Switch.Root>
        </HStack>

        <Grid templateColumns="repeat(2, 1fr)" gap={4}>
          <Field.Root>
            <Field.Label fontSize="sm" fontWeight="bold">Sample Rate</Field.Label>
            <Input defaultValue="44100" size="sm" variant="subtle" bg="gray.50" />
          </Field.Root>
          <Field.Root>
            <Field.Label fontSize="sm" fontWeight="bold">Bitrate</Field.Label>
            <Input defaultValue="320k" size="sm" variant="subtle" bg="gray.50" />
          </Field.Root>
        </Grid>

        <Box bg="gray.900" p={5} borderRadius="2xl">
          <Text color="gray.400" fontSize="xs" mb={3} textTransform="uppercase" fontWeight="bold" letterSpacing="widest">
            Command Preview
          </Text>
          <Code 
            variant="plain" 
            color="green.300" 
            fontSize="xs" 
            display="block" 
            whiteSpace="pre-wrap"
            bg="transparent"
          >
            ffmpeg -re -i input.mp3 -acodec libmp3lame -b:a 320k -ar 44100 -f mp3 icecast://source:password@localhost:8000/stream
          </Code>
        </Box>
      </VStack>

      <Button 
        bg="red.600" 
        color="white" 
        alignSelf="flex-end" 
        size="sm" 
        px={8} 
        borderRadius="full" 
        _hover={{ bg: "red.700" }}
      >
        Restart Broadcast Engine
      </Button>
    </VStack>
  );
};