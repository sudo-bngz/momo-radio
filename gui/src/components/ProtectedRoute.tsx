import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export const ProtectedRoute = () => {
  const { isAuthenticated, organizations } = useAuthStore();
  const location = useLocation();

  // 1. Not logged in? Go to login.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 2. Logged in, but NO organization? Force them to Onboarding.
  if (organizations.length === 0 && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // 3. Logged in WITH an organization, but trying to hit Onboarding? Send to dashboard.
  if (organizations.length > 0 && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  // 4. All good! Let them through.
  return <Outlet />;
};
