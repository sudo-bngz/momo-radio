import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Flex, Spinner } from '@chakra-ui/react';

export const ProtectedRoute: React.FC = () => {
  const { session, isInitialized } = useAuthStore();
  const location = useLocation();

  // ⚡️ 1. WAIT: Do absolutely nothing until Supabase is done checking local storage
  if (!isInitialized) {
    return (
      <Flex h="100vh" w="100vw" align="center" justify="center" bg="white">
        <Spinner size="xl" color="blue.500" borderWidth="3px" />
      </Flex>
    );
  }

  // ⚡️ 2. REDIRECT: If no session, go to login...
  // BUT save the URL they were trying to visit (location) in the router state!
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ⚡️ 3. PROCEED: User is logged in, render the requested page (e.g. /library)
  return <Outlet />;
};