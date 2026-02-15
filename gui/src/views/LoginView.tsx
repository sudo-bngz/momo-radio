import React, { useState } from 'react';
import { Box, Button, Input, VStack, Heading, Text, Icon } from '@chakra-ui/react';
import { Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export const LoginView: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const navigate = useNavigate();
  
  // This line will no longer throw an error once the store interface is updated
  const login = useAuthStore((state) => state.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    
    try {
      // 1. Authenticate via Zustand Store
      await login(username, password);
      
      // 2. On success, navigate to the dashboard layout
      // This works now because App.tsx wraps this in <BrowserRouter>
      navigate('/dashboard'); 
    } catch (err: any) {
      // Handle various error formats from Axios/Go
      const message = err.response?.data?.error || err.message || 'Invalid credentials.';
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

 return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.50">
      <Box p={8} maxW="md" w="full" bg="white" boxShadow="xl" borderRadius="2xl">
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

          <VStack w="full" gap={3}>
            <Input 
              placeholder="Username" 
              size="lg" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              color="gray.900" 
              borderColor="gray.300"
              _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
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
              _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
              _placeholder={{ color: "gray.400" }}
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
            fontSize="md"
            fontWeight="bold"
          >
            SIGN IN
          </Button>
        </VStack>
      </Box>
    </Box>
  );
};