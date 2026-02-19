import { VStack, Heading, Text, Input, Field, Button, Box, Stack } from '@chakra-ui/react';

export const GeneralSettings = () => {
  return (
    <VStack align="stretch" gap={8}>
      <Box>
        <Heading size="md" mb={1} fontWeight="bold">General Settings</Heading>
        <Text fontSize="sm" color="gray.500">Configure the basic identity of your station.</Text>
      </Box>

      <Stack gap={6}>
        {/* Chakra v3 uses the Field component pattern */}
        <Field.Root>
          <Field.Label fontSize="sm" fontWeight="bold">Station Name</Field.Label>
          <Input 
            defaultValue="Momo Radio" 
            size="md" 
            variant="subtle" 
            bg="gray.50" 
            _focus={{ bg: "white", borderColor: "gray.200" }} 
          />
        </Field.Root>

        <Field.Root>
          <Field.Label fontSize="sm" fontWeight="bold">Station Description</Field.Label>
          <Input 
            defaultValue="The best independent radio station." 
            size="md" 
            variant="subtle" 
            bg="gray.50"
          />
        </Field.Root>

        <Field.Root>
          <Field.Label fontSize="sm" fontWeight="bold">Timezone</Field.Label>
          <Input 
            defaultValue="Europe/Paris" 
            size="md" 
            variant="subtle" 
            bg="gray.50"
            disabled
          />
          <Field.HelperText fontSize="xs">Timezone is locked to the server's local time.</Field.HelperText>
        </Field.Root>
      </Stack>

      <Button 
        bg="gray.900" 
        color="white" 
        alignSelf="flex-end" 
        size="sm" 
        px={8} 
        borderRadius="full" 
        _hover={{ bg: "black" }}
      >
        Update Profile
      </Button>
    </VStack>
  );
};