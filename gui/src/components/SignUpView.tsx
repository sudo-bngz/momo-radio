import { useState } from 'react';
import { Box, Button, Flex, Input, Text, VStack, Heading, Separator, AbsoluteCenter, Image } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/client';
import { useColorMode } from '../components/ui/color-mode';

// SVG Assets for the Social Buttons
import googleLogo from '../assets/google-logo.svg';

export const SignupView = () => {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Form Submission
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;

    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  // Social Login Handler
  const handleSocialLogin = async (provider: 'google') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard` 
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(`Failed to sign in with ${provider}: ${err.message}`);
    }
  };

  return (
    // ⚡️ Automatically resolves to your _light or _dark token
    <Flex minH="100dvh" align="center" justify="center" bg="bg">
      <Box 
        w="full" 
        maxW="md" 
        p={{ base: 6, sm: 8 }} 
        bg={{ base: "transparent", sm: "bg.panel" }} 
        rounded={{ base: "none", sm: "2xl" }} 
        shadow={{ base: "none", sm: "xl" }} 
        border={{ base: "none", sm: "1px solid" }} 
        borderColor="border"
      >
        <VStack gap={6} align="stretch" as="form" onSubmit={handleSignUp}>
          <Box textAlign="center" mt={{ base: 8, sm: 0 }} mb={2}>
            <Text fontWeight="bold" color={isDark ? "blue.400" : "blue.600"} mb={2} letterSpacing="wide">
              🌈 Momo Radio
            </Text>
            <Heading size="xl" mb={2} color="fg" letterSpacing="tight">
              Create an account
            </Heading>
            <Text color="fg.muted" fontSize="sm">
              Get started with Momo Radio
            </Text>
          </Box>

          {error && (
            <Box p={3} bg={isDark ? "red.900" : "red.50"} borderRadius="md" border="1px solid" borderColor={isDark ? "red.800" : "red.200"}>
              <Text color={isDark ? "red.400" : "red.600"} fontSize="sm" textAlign="center">
                {error}
              </Text>
            </Box>
          )}

          <Box>
            <Button 
              variant="outline" 
              w="full" 
              h="56px" 
              borderRadius="xl"
              onClick={() => handleSocialLogin('google')}
              bg={isDark ? "whiteAlpha.50" : "white"}
              borderColor="border"
              color="fg"
              _hover={{ bg: isDark ? 'whiteAlpha.100' : 'gray.50' }}
              _active={{ transform: "scale(0.98)" }}
              transition="all 0.2s"
              fontSize="16px"
            >
              <Image src={googleLogo} alt="Google" boxSize="20px" mr={3} />
              Sign up with Google
            </Button>
          </Box>

          <Box position="relative" padding="5">
            <Separator borderColor="border" />
            <AbsoluteCenter bg={{ base: "bg", sm: "bg.panel" }} px="4">
              <Text color="fg.muted" fontSize="sm" fontWeight="500">or</Text>
            </AbsoluteCenter>
          </Box>

          <VStack gap={5}>
            <Box w="full">
              <Text fontSize="sm" fontWeight="600" mb={2} color="fg" ml={1}>Email</Text>
              <Input 
                type="email" 
                placeholder="name@company.com"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                h="56px" 
                fontSize="16px" 
                borderRadius="xl"
                bg={isDark ? "whiteAlpha.50" : "bg"}
                color="fg"
                borderColor={isDark ? "whiteAlpha.200" : "border"}
                _placeholder={{ color: "fg.muted" }}
                _focus={{ 
                  borderColor: isDark ? "blue.400" : "blue.500", 
                  ring: "1px", 
                  ringColor: isDark ? "blue.400" : "blue.500", 
                  bg: isDark ? "whiteAlpha.100" : "bg.panel" 
                }}
              />
            </Box>

            <Box w="full">
              <Text fontSize="sm" fontWeight="600" mb={2} color="fg" ml={1}>Password</Text>
              <Input 
                type="password" 
                placeholder="Minimum 8 characters"
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                h="56px"
                fontSize="16px"
                borderRadius="xl"
                bg={isDark ? "whiteAlpha.50" : "bg"}
                color="fg"
                borderColor={isDark ? "whiteAlpha.200" : "border"}
                _placeholder={{ color: "fg.muted" }}
                _focus={{ 
                  borderColor: isDark ? "blue.400" : "blue.500", 
                  ring: "1px", 
                  ringColor: isDark ? "blue.400" : "blue.500", 
                  bg: isDark ? "whiteAlpha.100" : "bg.panel" 
                }}
              />
            </Box>
          </VStack>

          <Button 
            type="submit" 
            w="full"
            h="56px"
            borderRadius="xl"
            fontSize="16px"
            fontWeight="600"
            bg={isDark ? "blue.500" : "blue.600"} 
            color="white" 
            _hover={{ bg: isDark ? "blue.400" : "blue.700" }}
            _active={{ transform: "scale(0.98)" }}
            transition="all 0.2s"
            loading={isLoading} 
            mt={2}
          >
            Create my free account
          </Button>

          <Text textAlign="center" fontSize="sm" color="fg.muted" mt={2}>
            Already have an account?{' '}
            <Link to="/login">
              <Text as="span" color={isDark ? "blue.400" : "blue.600"} fontWeight="600" _hover={{ textDecoration: 'underline' }}>
                Log in
              </Text>
            </Link>
          </Text>
        </VStack>
      </Box>
    </Flex>
  );
};