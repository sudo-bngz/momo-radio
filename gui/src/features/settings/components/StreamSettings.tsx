import { VStack, Text, Input, Box, HStack, Circle, Heading, Field, Stack } from '@chakra-ui/react';

export const StreamSettings = () => {
  return (
    <VStack align="stretch" gap={8}>
      <Box>
        <Heading size="md" fontWeight="bold">Stream Configuration</Heading>
        <Text fontSize="sm" color="gray.500">Outgoing server settings for your broadcast mountpoints.</Text>
      </Box>

      <HStack p={4} bg="green.50" borderRadius="2xl" border="1px solid" borderColor="green.100" gap={4}>
        <Circle size="8px" bg="green.500" />
        <Text fontSize="xs" fontWeight="bold" color="green.700" textTransform="uppercase">Live Status</Text>
        <Text fontSize="xs" color="green.600">Connected to /live.mp3</Text>
      </HStack>

      <Stack gap={5}>
        <Field.Root>
          <Field.Label fontSize="xs" fontWeight="bold" textTransform="uppercase" color="gray.500">Icecast Host</Field.Label>
          <Input defaultValue="localhost" variant="subtle" bg="gray.50" borderRadius="xl" />
        </Field.Root>
        
        <HStack gap={4}>
          <Field.Root flex="2">
            <Field.Label fontSize="xs" fontWeight="bold" textTransform="uppercase" color="gray.500">Mountpoint</Field.Label>
            <Input defaultValue="/radio.mp3" variant="subtle" bg="gray.50" borderRadius="xl" />
          </Field.Root>
          <Field.Root flex="1">
            <Field.Label fontSize="xs" fontWeight="bold" textTransform="uppercase" color="gray.500">Port</Field.Label>
            <Input defaultValue="8000" variant="subtle" bg="gray.50" borderRadius="xl" />
          </Field.Root>
        </HStack>

        <Field.Root>
          <Field.Label fontSize="xs" fontWeight="bold" textTransform="uppercase" color="gray.500">Source Password</Field.Label>
          <Input type="password" value="secret_pass" variant="subtle" bg="gray.50" borderRadius="xl" />
        </Field.Root>
      </Stack>
    </VStack>
  );
};