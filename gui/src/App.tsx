import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { LoginView } from "./views/LoginView";
import { OnboardingView } from "./components/OnboardingView";
import { SignupView } from "./components/SignUpView";
import { ProtectedRoute } from "./components/ProtectedRoute";

//  GLOBAL OVERLAYS
import { Toaster } from "./components/ui/toaster";
import { SessionExpiredModal } from "./components/SessionExpiredModal";

// AUTH & STATE
import { supabase } from './services/client';
import { useAuthStore } from './store/useAuthStore';

// FEATURE IMPORTS
import { DashboardFeature } from "./features/dashboard";
import { PlaylistsFeature } from "./features/playlists";
import { PlaylistList } from "./features/playlists/components/PlaylistList";
import { PlaylistBuilder } from "./features/playlists/components/PlaylistBuilder";
import { LibraryFeature } from "./features/library";
import { IngestFeature } from './features/ingest';
import { ScheduleFeature } from './features/schedule';
import { SettingsFeature } from './features/settings';
import { ArtistView } from './features/library/components/ArtistView';
import { LibraryView } from './features/library/components/LibraryView';
import { useNetworkStore } from './store/useNetworkStore';
import { ApiDownScreen } from './layouts/ApiDownScreen';

export const App = () => {

  // 1. CALL ALL HOOKS FIRST
  const isApiDown = useNetworkStore((state) => state.isApiDown);
  
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          useAuthStore.getState().setSession(session);
        } else if (event === 'SIGNED_OUT') {
          useAuthStore.getState().clearState(); 
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2. RENDER (Safely handle the API Down state inside the Provider)
  return (
    <ChakraProvider value={defaultSystem}>
      {isApiDown ? (
        // IF API IS DOWN: Completely block the router and show the error screen
        <ApiDownScreen />
      ) : (
        // IF API IS UP: Render the normal application router
        <BrowserRouter>
          <Routes>
            {/* Public Path */}
            <Route path="/login" element={<LoginView />} />
            <Route path="/signup" element={<SignupView />} />

            {/* Private Paths: Protected by Auth Guard */}
            <Route element={<ProtectedRoute />}>
              
              {/* ONBOARDING: No sidebar, pure focus mode */}
              <Route path="/onboarding" element={<OnboardingView />} />

              {/* DASHBOARD: Wrapped in Sidebar/TopNav Layout */}
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<DashboardFeature />} />
                
                <Route path="/playlists" element={<PlaylistsFeature />}>
                  <Route index element={<PlaylistList />} />
                  <Route path="new" element={<PlaylistBuilder />} />
                  <Route path="edit/:id" element={<PlaylistBuilder />} />
                </Route>
                
                <Route path="/library" element={<LibraryFeature />} />
                <Route path="/library/*" element={<LibraryView />} />
                <Route path="/artists/:artistName" element={<ArtistView />} />
                <Route path="/ingest" element={<IngestFeature />} />
                <Route path="/schedule" element={<ScheduleFeature />} />
              </Route>
              
              {/* Keeping settings outside DashboardLayout if intended, or move it inside! */}
              <Route path="/settings" element={<SettingsFeature />} />
            </Route>

            {/* Catch-all Redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      )}
      
      {/* GLOBAL OVERLAYS GO HERE (Always rendered so Modals/Toasts still work) */}
      <Toaster />
      <SessionExpiredModal />
      
    </ChakraProvider>
  );
};