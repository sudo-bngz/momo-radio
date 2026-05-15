import { useState } from 'react';
import { Box, Flex, Heading, Text, Input, Button, VStack, HStack, NativeSelect } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../services/api';

export const OnboardingView = () => {
  const navigate = useNavigate();
  const setOrganizations = useAuthStore((state) => state.setOrganizations);
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [workspaceName, setWorkspaceName] = useState('');
  const [activity, setActivity] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Editor');

  const handleCreateWorkspace = async () => {
    if (!workspaceName) return;
    setIsLoading(true);
    try {
      // ⚡️ 1. Call your Go API to create the org
      // await api.createOrganization({ name: workspaceName, activity });
      
      setStep(2);
    } catch (error) {
      console.error("Failed to create workspace", error);
    } finally {
      setIsLoading(false);
    }
  };

const handleFinish = async () => {
  setIsLoading(true);
  try {
    if (inviteEmail) {
      // await api.inviteUser({ email: inviteEmail, role: inviteRole });
    }
    
    // ⚡️ 2. Fetch from API and update Zustand directly!
    const freshOrgs = await api.getOrganizations();
    setOrganizations(freshOrgs);
    
    navigate('/dashboard');
  } catch (error) {
    console.error("Failed to send invites", error);
  } finally {
    setIsLoading(false);
  }
};

  return (
    <Flex minH="100vh" bg="gray.50">
      {/* LEFT COLUMN: The Form */}
      <Flex flex={1} align="center" justify="center" p={8}>
        <Box w="full" maxW="md">
          <Text fontWeight="bold" fontSize="xl" mb={8} color="blue.600">
            🌈 Momo Radio
          </Text>

          {step === 1 && (
            <VStack align="flex-start" gap={6}>
              <Box>
                <Text color="gray.500" fontSize="sm" mb={1}>1/2</Text>
                <Heading size="lg" mb={2}>Create a new workspace</Heading>
                <Text color="gray.600">Welcome! Tell us a bit about your team.</Text>
              </Box>

              <Box w="full">
                <Text fontSize="sm" fontWeight="medium" mb={1}>Workspace name</Text>
                <Text fontSize="xs" color="gray.500" mb={2}>Hint: Most people use their artist or company name</Text>
                <Input 
                  placeholder="My Workspace" 
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  size="lg"
                  bg="white"
                />
              </Box>

              <Box w="full">
                <Text fontSize="sm" fontWeight="medium" mb={2}>What's your main activity?</Text>
                <NativeSelect.Root size="lg">
                  <NativeSelect.Field 
                    placeholder="Select your activity"
                    value={activity}
                    onChange={(e) => setActivity(e.currentTarget.value)}
                    bg="white"
                  >
                    <option value="radio">Radio Station</option>
                    <option value="label">Record Label</option>
                    <option value="artist">Independent Artist</option>
                    <option value="curator">Curator / DJ</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Box>

              <Button 
                colorScheme="blue" 
                size="lg" 
                w="full" 
                mt={4}
                disabled={!workspaceName}
                loading={isLoading}
                onClick={handleCreateWorkspace}
              >
                Continue
              </Button>
            </VStack>
          )}

          {step === 2 && (
            <VStack align="flex-start" gap={6}>
              <Box>
                <Text color="gray.500" fontSize="sm" mb={1}>2/2</Text>
                <Heading size="lg" mb={2}>Invite your team</Heading>
                <Text color="gray.600">Invite people you work with to join your private workspace.</Text>
              </Box>

              <HStack w="full" gap={4}>
                <Box flex={2}>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>Email</Text>
                  <Input 
                    placeholder="Enter email address" 
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    bg="white"
                  />
                </Box>
                <Box flex={1}>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>Role</Text>
                  <NativeSelect.Root>
                    <NativeSelect.Field 
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.currentTarget.value)}
                      bg="white"
                    >
                      <option value="Editor">Editor</option>
                      <option value="Admin">Admin</option>
                      <option value="Viewer">Viewer</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Box>
              </HStack>

              <HStack w="full" pt={4}>
                <Button variant="outline" w="full" onClick={handleFinish} disabled={isLoading}>
                  Skip for now
                </Button>
                <Button colorScheme="blue" w="full" onClick={handleFinish} loading={isLoading}>
                  Send invites & continue
                </Button>
              </HStack>
            </VStack>
          )}
        </Box>
      </Flex>

      {/* RIGHT COLUMN: Visual Preview (Hidden on mobile) */}
      <Flex 
        flex={1} 
        display={{ base: "none", lg: "flex" }} 
        bg="blue.50" 
        align="center" 
        justify="center"
        borderLeft="1px solid"
        borderColor="gray.200"
      >
         {/* You can drop an SVG illustration or a mockup of the Dashboard here later! */}
         <Box 
           w="300px" 
           h="500px" 
           bg="white" 
           borderRadius="2xl" 
           boxShadow="xl"
           border="8px solid"
           borderColor="gray.800"
           p={4}
         >
           <Text color="gray.300" fontWeight="bold">App Preview...</Text>
         </Box>
      </Flex>
    </Flex>
  );
};