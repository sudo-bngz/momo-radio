// src/views/LoginView.tsx
import React, { useState } from 'react';
import { Box, Button, Input, VStack, Heading, Text, Icon } from '@chakra-ui/react';
import { Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginView: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // FIX: Local error state
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null); // Clear previous errors
    
    try {
      await login(username, password);
      // App.tsx handles the redirect automatically when state updates
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

 return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.50">
      <Box p={8} maxW="md" w="full" bg="white" boxShadow="xl" borderRadius="2xl">
        {/* FIX: Add color="gray.900" to the VStack form to cascade dark text to all children */}
        <VStack gap={6} as="form" onSubmit={handleLogin} color="gray.900">
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

          {/* FIX: Explicitly set the text and border color for the inputs */}
          <Input 
            placeholder="Username" 
            size="lg" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            color="gray.900" 
            borderColor="gray.300"
            _placeholder={{ color: "gray.400" }}
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
            _placeholder={{ color: "gray.400" }}
            required 
          />

          <Button 
            type="submit" 
            colorPalette="blue" 
            size="lg" 
            w="full" 
            loading={isLoading}
          >
            Sign In
          </Button>
        </VStack>
      </Box>
    </Box>
  );
};