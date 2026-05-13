import React, { useState, useEffect } from 'react';
import { Box, Button, Input, VStack, Heading, Text, Icon, HStack, Separator, Spinner } from '@chakra-ui/react';
import { Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '../services/client';
import { apiClient } from '../services/api'; 
import { useAuthStore } from '../store/useAuthStore';
import { toaster } from '../components/ui/toaster'; 

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

// ... (GoogleIcon SVG remains the same here) ...
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export const LoginView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isParsingOAuth, setIsParsingOAuth] = useState(true); // ⚡️ NEW: Prevents flicker while checking URL
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const navigate = useNavigate();
  
  const setSession = useAuthStore((state) => state.setSession);
  const setOrganizations = useAuthStore((state) => state.setOrganizations);

  // ⚡️ NEW: We pulled the backend logic into a reusable function
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
    // 1. Instantly check if there is an active session or a hash in the URL
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

    // 2. Listen for the OAuth return event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth Event:", event); // This helps with debugging!
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

      // For manual login, we pass it straight to our setup function
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

  // ⚡️ NEW: Show a loading state if we are currently parsing the Google URL redirect
  if (isParsingOAuth) {
    return (
      <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.50">
        <VStack gap={4}>
          <Spinner size="xl" color="blue.500" />
          <Text color="gray.500">Authenticating with Google...</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.50">
      <Box p={8} maxW="md" w="full" bg="white" boxShadow="xl" borderRadius="2xl">
        <VStack gap={6} as="form" onSubmit={handleManualLogin} color="gray.900">
          <Icon as={Radio} boxSize={12} color="blue.500" />
          
          <VStack gap={1}>
            <Heading size="lg">Momo Radio</Heading>
            <Text color="gray.500">Sign in to manage the station</Text>
          </VStack>

          {errorMsg && (
            <Box p={3} bg="red.50" color="red.600" borderRadius="md" w="full" textAlign="center" fontSize="sm" fontWeight="medium">
              {errorMsg}
            </Box>
          )}

          <VStack w="full" gap={3}>
            <Input 
              placeholder="Email" 
              type="email"
              size="lg" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              color="gray.900" 
              borderColor="gray.300"
              _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
              required 
            />
            <Input 
              placeholder="Password" 
              type="password" 
              size="lg" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              color="gray.900"
              borderColor="gray.300"
              _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
              required 
            />
          </VStack>

          <Button 
            type="submit" 
            bg="blue.600" 
            _hover={{ bg: "blue.700" }}
            color="white"
            size="lg" 
            w="full" 
            loading={isLoading}
          >
            SIGN IN
          </Button>

          <HStack w="full" alignItems="center" my={2}>
            <Separator borderColor="gray.300" />
            <Text fontSize="sm" color="gray.400" whiteSpace="nowrap">or continue with</Text>
            <Separator borderColor="gray.300" />
          </HStack>

          <Button 
            w="full" 
            variant="outline" 
            size="lg"
            onClick={handleOAuthLogin}
            borderColor="gray.300"
            _hover={{ bg: "gray.50" }}
            display="flex"
            gap={3}
            disabled={isLoading}
          >
            <GoogleIcon />
            Google
          </Button>
        </VStack>
      </Box>
    </Box>
  );
};