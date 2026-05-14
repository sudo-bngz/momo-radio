import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { LoginView } from "./views/LoginView";
import { ProtectedRoute } from "./components/ProtectedRoute";

// ⚡️ GLOBAL OVERLAYS
import { Toaster } from "./components/ui/toaster";
import { SessionExpiredModal } from "./components/SessionExpiredModal";

// ⚡️ AUTH & STATE
import { supabase } from './services/client';
import { useAuthStore } from './store/useAuthStore';

// ⚡️ FEATURE IMPORTS
import { DashboardFeature } from "./features/dashboard";
import { PlaylistsFeature } from "./features/playlists";
import { PlaylistList } from "./features/playlists/components/PlaylistList";
import { PlaylistBuilder } from "./features/playlists/components/PlaylistBuilder";
import { LibraryFeature } from "./features/library";
import { IngestFeature } from './features/ingest';
import { ScheduleFeature } from './features/schedule';
import { SettingsFeature } from './features/settings';
import { ArtistView } from './features/library/components/ArtistView';

export const App = () => {
  
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

  return (
    <ChakraProvider value={defaultSystem}>
      <BrowserRouter>
        <Routes>
          {/* Public Path */}
          <Route path="/login" element={<LoginView />} />

          {/* Private Paths: Protected by Auth & Wrapped in Layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardFeature />} />
              
              <Route path="/playlists" element={<PlaylistsFeature />}>
                <Route index element={<PlaylistList />} />
                <Route path="new" element={<PlaylistBuilder />} />
                <Route path="edit/:id" element={<PlaylistBuilder />} />
              </Route>
              
              <Route path="/library" element={<LibraryFeature />} />
              <Route path="/artists/:artistName" element={<ArtistView />} />
              <Route path="/ingest" element={<IngestFeature />} />
              <Route path="/schedule" element={<ScheduleFeature />} />
            </Route>
            
            <Route path="/settings" element={<SettingsFeature />} />
          </Route>

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      
      {/* ⚡️ GLOBAL OVERLAYS GO HERE */}
      <Toaster />
      <SessionExpiredModal />
      
    </ChakraProvider>
  );
};