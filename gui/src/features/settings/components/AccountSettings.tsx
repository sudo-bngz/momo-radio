import React, { useState, useEffect } from 'react';
import { Box, Flex, Heading, Text, VStack, HStack, Button, Input, Icon, Spinner, Center } from '@chakra-ui/react';
import { Avatar } from '@chakra-ui/react';
import { Key, Mail, Info } from 'lucide-react';

import { useAuthStore } from '../../../store/useAuthStore';
import { useProfile } from '../hook/useProfile';

export const AccountSettings: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const updatePassword = useAuthStore((state) => state.updatePassword);
  
  // Custom local profile store hook
  const { profile, fetchProfile, mutateProfile, isLoading, isSaving } = useProfile();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  
  // Security layout editing states
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // Initial Data Load
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Sync profile values to local form fields
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
    }
  }, [profile]);

  if (!user) return null;

  if (isLoading) {
    return (
      <Center p={10}>
        <Spinner size="lg" color="gray.400" />
      </Center>
    );
  }

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "??";

  const handleSaveProfile = async () => {
    try {
      await mutateProfile({ first_name: firstName, last_name: lastName });
    } catch (error) {
      alert("Failed to modify user profile details.");
    }
  };

  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    setIsSavingPassword(true);
    try {
      await updatePassword(newPassword);
      setIsEditingPassword(false);
      setNewPassword('');
      alert("Password updated successfully via Supabase Auth.");
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <Box maxW="800px">
      <Heading size="lg" color="gray.900" mb={2}>Personal Account</Heading>
      <Text fontSize="sm" color="gray.500" mb={8}>
        Manage your platform identity and system credentials.
      </Text>

      {/* SECTION 1: Consolidated Profile Form (RGPD Local Storage Compliant) */}
      <Box bg="white" borderRadius="xl" border="1px solid" borderColor="gray.200" shadow="sm" mb={8} overflow="hidden">
        <Box p={6} borderBottom="1px solid" borderColor="gray.100" bg="gray.50">
          <Heading size="sm" color="gray.800">Profile Information</Heading>
        </Box>
        
        <Flex direction={{ base: "column", md: "row" }} p={6} gap={8}>
          <VStack align="center" gap={4} minW="140px">
            <Avatar.Root size="2xl" width="100px" height="100px" shadow="sm">
              <Avatar.Image src={profile?.avatar_url} />
              <Avatar.Fallback bg="blue.600" color="white" fontSize="3xl" fontWeight="bold">
                {initials}
              </Avatar.Fallback>
            </Avatar.Root>
            <Button size="sm" variant="outline" onClick={() => alert("Avatar asset storage is coming soon.")}>
              Upload New
            </Button>
          </VStack>

          <VStack align="stretch" gap={5} flex="1">
            <Flex gap={4} direction={{ base: "column", sm: "row" }}>
              <Box flex="1">
                <Text fontSize="xs" fontWeight="600" color="gray.700" mb={1}>First Name</Text>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} bg="gray.50" />
              </Box>
              <Box flex="1">
                <Text fontSize="xs" fontWeight="600" color="gray.700" mb={1}>Last Name</Text>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} bg="gray.50" />
              </Box>
            </Flex>
            
            <HStack color="gray.500" gap={1.5}>
              <Icon as={Info} boxSize={3.5} />
              <Text fontSize="11px">Changes here apply exclusively to this radio workspace workspace.</Text>
            </HStack>

            <Flex justify="flex-end" mt={2}>
              <Button bg="blue.600" color="white" _hover={{ bg: "blue.700" }} onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving ? <Spinner size="sm" /> : "Save Profile"}
              </Button>
            </Flex>
          </VStack>
        </Flex>
      </Box>

      {/* SECTION 2: Security & Authentication (Managed directly through Supabase) */}
      <Box bg="white" borderRadius="xl" border="1px solid" borderColor="gray.200" shadow="sm" mb={8} overflow="hidden">
        <Box p={6} borderBottom="1px solid" borderColor="gray.100" bg="gray.50">
          <Heading size="sm" color="gray.800">Security & Credentials</Heading>
        </Box>

        <VStack align="stretch" gap={0}>
          {/* Email Address Row */}
          <Flex justify="space-between" align="center" p={6} borderBottom="1px solid" borderColor="gray.100">
            <HStack gap={4}>
              <Flex align="center" justify="center" w="40px" h="40px" borderRadius="full" bg="blue.50" color="blue.600">
                <Icon as={Mail} boxSize={5} />
              </Flex>
              <Box>
                <Text fontSize="sm" fontWeight="600" color="gray.900">Primary Identity Email</Text>
                <Text fontSize="sm" color="gray.500">{user.email}</Text>
              </Box>
            </HStack>
          </Flex>

          {/* Password Reset Row */}
          <Flex direction="column" p={6}>
            <Flex justify="space-between" align="center" w="100%">
              <HStack gap={4}>
                <Flex align="center" justify="center" w="40px" h="40px" borderRadius="full" bg="gray.100" color="gray.600">
                  <Icon as={Key} boxSize={5} />
                </Flex>
                <Box>
                  <Text fontSize="sm" fontWeight="600" color="gray.900">Security Password</Text>
                  <Text fontSize="sm" color="gray.500">Manage security credentials</Text>
                </Box>
              </HStack>
              <Button size="sm" variant="outline" onClick={() => setIsEditingPassword(!isEditingPassword)}>
                {isEditingPassword ? "Cancel" : "Update Password"}
              </Button>
            </Flex>

            {isEditingPassword && (
              <Flex mt={4} gap={3} pl={14} align="center">
                <Input 
                  size="sm" maxW="250px" placeholder="Enter new password" type="password"
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                />
                <Button size="sm" bg="blue.600" color="white" _hover={{ bg: "blue.700" }} onClick={handleSavePassword} disabled={isSavingPassword}>
                  {isSavingPassword ? <Spinner size="xs" /> : "Save Security"}
                </Button>
              </Flex>
            )}
          </Flex>
        </VStack>
      </Box>
    </Box>
  );
};
