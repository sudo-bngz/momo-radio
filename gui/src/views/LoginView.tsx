import React, { useState, useEffect } from 'react';
import { Box, Button, Input, VStack, Heading, Text, Icon, Separator, Spinner, Flex, AbsoluteCenter } from '@chakra-ui/react';
import { Radio } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

import { supabase } from '../services/client';
import { apiClient } from '../services/api'; 
import { useAuthStore } from '../store/useAuthStore';
import { toaster } from '../components/ui/toaster'; 
import { useColorMode } from '../components/ui/color-mode';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export const LoginView: React.FC = () => {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isParsingOAuth, setIsParsingOAuth] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const navigate = useNavigate();
  
  const setSession = useAuthStore((state) => state.setSession);
  const setOrganizations = useAuthStore((state) => state.setOrganizations);

  const handlePostLoginSetup = async (session: any) => {
    try {
      setSession(session);
      const res = await apiClient.get('/auth/me', {
        headers: { 'X-Organization-Id': DEFAULT_ORG_ID }
      });
      setOrganizations(res.data.organizations);
      navigate('/dashboard'); 
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to sync with Momo Radio server.';
      setErrorMsg(message);
      setSession(null); 
      setIsLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Session fetch error:", error.message);
      }
      if (session) {
        handlePostLoginSetup(session);
      } else {
        setIsParsingOAuth(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth Event:", event); 
      if (event === 'SIGNED_IN' && session) {
        setIsLoading(true);
        handlePostLoginSetup(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email, password,
      });

      if (authError) throw new Error(authError.message);
      if (!authData.session) throw new Error("No session returned.");

      await handlePostLoginSetup(authData.session);
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid credentials.');
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/login', 
        }
      });
      if (error) throw error;
    } catch (err: any) {
      toaster.create({ title: "Login Failed", description: err.message, type: "error" });
    }
  };

  if (isParsingOAuth) {
    return (
      <Flex minH="100dvh" align="center" justify="center" bg="bg">
        <VStack gap={4}>
          <Spinner size="xl" color={isDark ? "blue.400" : "blue.500"} />
          <Text color="fg.muted">Authenticating with Google...</Text>
        </VStack>
      </Flex>
    );
  }

  return (
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
        <VStack gap={6} align="stretch" as="form" onSubmit={handleManualLogin}>
          
          <Box textAlign="center" mt={{ base: 8, sm: 0 }} mb={2}>
            <Icon as={Radio} boxSize={10} color={isDark ? "blue.400" : "blue.600"} mb={2} />
            <Heading size="xl" mb={2} color="fg" letterSpacing="tight">
              Momo Radio
            </Heading>
            <Text color="fg.muted" fontSize="sm">
              Sign in to manage the station
            </Text>
          </Box>

          {errorMsg && (
            <Box p={3} bg={isDark ? "red.900" : "red.50"} borderRadius="md" border="1px solid" borderColor={isDark ? "red.800" : "red.200"}>
              <Text color={isDark ? "red.400" : "red.600"} fontSize="sm" textAlign="center">
                {errorMsg}
              </Text>
            </Box>
          )}

          <VStack gap={5}>
            <Box w="full">
              <Text fontSize="sm" fontWeight="600" mb={2} color="fg" ml={1}>Email</Text>
              <Input 
                placeholder="name@company.com" 
                type="email"
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
                placeholder="Enter your password" 
                type="password" 
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
            SIGN IN
          </Button>

          <Box position="relative" padding="5">
            <Separator borderColor="border" _dark={{ borderColor: "whiteAlpha.200" }} />
            <AbsoluteCenter bg={{ base: "bg", sm: "bg.panel" }} px="4">
              <Text color="fg.muted" fontSize="sm" fontWeight="500">or</Text>
            </AbsoluteCenter>
          </Box>

          <Box>
            <Button 
              variant="outline" 
              w="full" 
              h="56px" 
              borderRadius="xl"
              onClick={handleOAuthLogin}
              bg={isDark ? "whiteAlpha.50" : "white"}
              borderColor="border"
              color="fg"
              _hover={{ bg: isDark ? 'whiteAlpha.100' : 'gray.50' }}
              _active={{ transform: "scale(0.98)" }}
              transition="all 0.2s"
              fontSize="16px"
              disabled={isLoading}
            >
              <GoogleIcon />
              <Box as="span" ml={3}>Sign in with Google</Box>
            </Button>
          </Box>

          <Text textAlign="center" fontSize="sm" color="fg.muted" mt={2}>
            Don't have an account?{' '}
            <Link to="/signup">
              <Text as="span" color={isDark ? "blue.400" : "blue.600"} fontWeight="600" _hover={{ textDecoration: 'underline' }}>
                Sign up
              </Text>
            </Link>
          </Text>

        </VStack>
      </Box>
    </Flex>
  );
};