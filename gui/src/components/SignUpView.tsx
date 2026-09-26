import { useState } from 'react';
import { Box, Button, Flex, Input, Text, VStack, Heading, Separator, AbsoluteCenter, Image } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/client';

// SVG Assets for the Social Buttons
import googleLogo from '../assets/google-logo.svg';

export const SignupView = () => {
  
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

      // Supabase auto-logs the user in.
      // Your App.tsx listener will catch this and route them accordingly!
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  // Social Login Handler (Strictly typed to 'google' now)
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
    <Flex minH="100vh" align="center" justify="center" bg="bg">
      <Box w="full" maxW="md" p={8} bg="bg.panel" rounded="xl" shadow="sm" border="1px solid" borderColor="border">
        <VStack gap={6} align="stretch" as="form" onSubmit={handleSignUp}>
          <Box textAlign="center">
            <Text fontWeight="bold" color="blue.600" _dark={{ color: "blue.400" }} mb={2}>🌈 Momo Radio</Text>
            <Heading size="lg" mb={2} color="fg">Create an account</Heading>
            <Text color="fg.muted">Get started with Momo Radio</Text>
          </Box>

          {error && <Text color="red.500" _dark={{ color: "red.400" }} fontSize="sm">{error}</Text>}

          {/* ⚡️ THE GOOGLE SIGNUP BLOCK */}
          <Box>
            <Button 
              variant="outline" 
              w="full" 
              size="lg" 
              onClick={() => handleSocialLogin('google')}
              bg="bg.panel"
              borderColor="border"
              color="fg"
              _hover={{ bg: 'gray.50', _dark: { bg: 'whiteAlpha.100' } }}
            >
              <Image src={googleLogo} alt="Google" boxSize="20px" mr={3} />
              Sign up with Google
            </Button>
          </Box>

          {/* ⚡️ "or" Separator */}
          <Box position="relative" padding="5">
            <Separator borderColor="border" />
            <AbsoluteCenter bg="bg.panel" px="4">
              <Text color="fg.muted" fontSize="sm">or</Text>
            </AbsoluteCenter>
          </Box>

          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={2} color="fg">Email</Text>
            <Input 
              type="email" 
              placeholder="name@company.com"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              size="lg"
              bg="bg"
              color="fg"
              borderColor="border"
              _placeholder={{ color: "fg.muted" }}
              _focus={{ borderColor: "blue.500", ring: "1px", ringColor: "blue.500", _dark: { borderColor: "blue.400", ringColor: "blue.400" } }}
            />
          </Box>

          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={2} color="fg">Password</Text>
            <Input 
              type="password" 
              placeholder="Minimum 8 characters"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              size="lg"
              bg="bg"
              color="fg"
              borderColor="border"
              _placeholder={{ color: "fg.muted" }}
              _focus={{ borderColor: "blue.500", ring: "1px", ringColor: "blue.500", _dark: { borderColor: "blue.400", ringColor: "blue.400" } }}
            />
          </Box>

          <Button 
            type="submit" 
            size="lg"
            bg="blue.600" color="white" _dark={{ bg: "blue.500" }}
            _hover={{ bg: "blue.700", _dark: { bg: "blue.400" } }}
            loading={isLoading} 
          >
            Create my free account
          </Button>

          <Text textAlign="center" fontSize="sm" color="fg.muted">
            Already have an account?{' '}
            <Link to="/login">
              <Text as="span" color="blue.600" _dark={{ color: "blue.400" }} fontWeight="500" _hover={{ textDecoration: 'underline' }}>
                Log in
              </Text>
            </Link>
          </Text>
        </VStack>
      </Box>
    </Flex>
  );
};