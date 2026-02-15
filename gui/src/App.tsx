import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { LoginView } from "./views/LoginView";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Feature Imports
import { DashboardFeature } from "./features/dashboard";
import { PlaylistsFeature } from "./features/playlists";
import { LibraryFeature } from "./features/library";
import { IngestFeature } from './features/ingest';
import { ScheduleFeature } from './features/schedule';

export const App = () => {
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
              <Route path="/playlists" element={<PlaylistsFeature />} />
              <Route path="/library" element={<LibraryFeature />} />
              <Route path="/ingest" element={<IngestFeature />} />
              <Route path="/schedule" element={<ScheduleFeature />} />
              {/* Add more as needed */}
            </Route>
          </Route>

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ChakraProvider>
  );
};