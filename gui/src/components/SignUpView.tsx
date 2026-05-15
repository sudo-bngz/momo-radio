import { useState } from 'react';
import { Box, Button, Flex, Input, Text, VStack, Heading, Separator, AbsoluteCenter, Image } from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/client';

// SVG Assets for the Social Buttons
import googleLogo from '../assets/google-logo.svg';

export const SignupView = () => {
  const navigate = useNavigate();
  
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
    <Flex minH="100vh" align="center" justify="center" bg="gray.50">
      <Box w="full" maxW="md" p={8} bg="white" rounded="xl" shadow="sm">
        <VStack gap={6} align="stretch" as="form" onSubmit={handleSignUp}>
          <Box textAlign="center">
            <Text fontWeight="bold" color="blue.600" mb={2}>🌈 Momo Radio</Text>
            <Heading size="lg" mb={2}>Create an account</Heading>
            <Text color="gray.500">Get started with Momo Radio</Text>
          </Box>

          {error && <Text color="red.500" fontSize="sm">{error}</Text>}

          {/* ⚡️ THE GOOGLE SIGNUP BLOCK */}
          <Box>
            <Button 
              variant="outline" 
              w="full" 
              size="lg" 
              onClick={() => handleSocialLogin('google')}
              bg="white"
              borderColor="gray.200"
              color="black"
              _hover={{ bg: 'gray.50' }}
            >
              <Image src={googleLogo} alt="Google" boxSize="20px" mr={3} />
              Sign up with Google
            </Button>
          </Box>

          {/* ⚡️ "or" Separator */}
          <Box position="relative" padding="5">
            <Separator borderColor="gray.200" />
            <AbsoluteCenter bg="white" px="4">
              <Text color="gray.500" fontSize="sm">or</Text>
            </AbsoluteCenter>
          </Box>

          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={2}>Email</Text>
            <Input 
              type="email" 
              placeholder="name@company.com"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              size="lg"
            />
          </Box>

          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={2}>Password</Text>
            <Input 
              type="password" 
              placeholder="Minimum 8 characters"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              size="lg"
            />
          </Box>

          <Button type="submit" colorScheme="blue" loading={isLoading} size="lg">
            Create my free account
          </Button>

          <Text textAlign="center" fontSize="sm" color="gray.600">
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#3182ce', fontWeight: 500 }}>
              Log in
            </Link>
          </Text>
        </VStack>
      </Box>
    </Flex>
  );
};