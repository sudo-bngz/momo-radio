import { VStack, HStack, Text, Button, Box, Badge, Flex, Icon, Heading, Stack } from '@chakra-ui/react';
import { UserPlus, MoreHorizontal, User } from 'lucide-react';

export const UserManagement = () => {
  const users = [
    { id: 1, name: 'Admin User', email: 'admin@station.com', role: 'Owner' },
    { id: 2, name: 'Moderator DJ', email: 'dj@station.com', role: 'Moderator' },
  ];

  return (
    <VStack align="stretch" gap={8}>
      <Flex justify="space-between" align="end">
        <Box>
          <Heading size="md" fontWeight="bold">Team Members</Heading>
          <Text fontSize="sm" color="gray.500">Manage access for your station staff.</Text>
        </Box>
        <Button bg="gray.900" color="white" size="sm" borderRadius="full" px={5} _hover={{ bg: "black" }}>
          <UserPlus size={16} style={{ marginRight: '8px' }} /> Invite
        </Button>
      </Flex>

      <Stack gap={3}>
        {users.map((user) => (
          <Flex 
            key={user.id} p={4} borderRadius="2xl" border="1px solid" borderColor="gray.100" 
            align="center" justify="space-between" _hover={{ bg: "gray.50" }} transition="all 0.2s"
          >
            <HStack gap={4}>
              <Flex align="center" justify="center" w={10} h={10} bg="white" border="1px solid" borderColor="gray.200" borderRadius="full">
                <Icon as={User} color="gray.400" size="sm" />
              </Flex>
              <VStack align="start" gap={0}>
                <Text fontWeight="bold" fontSize="sm" color="gray.900">{user.name}</Text>
                <Text fontSize="xs" color="gray.500" truncate>{user.email}</Text>
              </VStack>
            </HStack>
            
            <HStack gap={4}>
              <Badge variant="subtle" colorPalette={user.role === 'Owner' ? 'purple' : 'blue'} borderRadius="full" px={3}>
                {user.role}
              </Badge>
              <Button size="sm" variant="ghost" color="gray.400" borderRadius="full"><MoreHorizontal size={18} /></Button>
            </HStack>
          </Flex>
        ))}
      </Stack>
    </VStack>
  );
};