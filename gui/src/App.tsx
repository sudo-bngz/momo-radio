import { useState } from "react";
import { ChakraProvider, defaultSystem, Box, Flex } from "@chakra-ui/react";

// Auth & Navigation
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginView } from "./views/LoginView";
import { TopNav } from "./components/TopNavbar";
import Sidebar from "./components/Sidebar";

// Features
import { DashboardFeature } from "./features/dashboard";
import { IngestFeature } from "./features/ingest";
import { PlaylistsFeature } from "./features/playlists"; 
import { ScheduleFeature } from "./features/schedule";
import { LibraryFeature } from "./features/library"; 

// 1. Create a sub-component that consumes the Auth state
const MainApp = () => {
  const { isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState("dashboard"); // Defaulting to dashboard is usually best

  // 2. The Auth Guard: If they don't have a token, render the login page instead!
  if (!isAuthenticated) {
    return <LoginView />;
  }

  // 3. The Authenticated Dashboard Layout
  return (
    <Flex 
      h="100vh" 
      w="100vw" 
      bg={currentView === "library" ? "white" : "gray.50"} 
      overflow="hidden" 
      data-theme="light"
    >
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      
      {/* Main Content Column */}
      <Flex direction="column" flex="1" overflow="hidden">
        {/* Inject the TopNav here so it sits securely above the active feature */}
        <TopNav />
        
        <Box 
          flex="1" 
          p={currentView === "library" ? 0 : 8} 
          overflowY="auto"
        >
          {currentView === "dashboard" && <DashboardFeature />}
          {currentView === "ingest" && <IngestFeature />}
          {currentView === "playlists" && <PlaylistsFeature />}
          {currentView === "schedule" && <ScheduleFeature />}
          {currentView === "library" && <LibraryFeature />}
        </Box>
      </Flex>
      
    </Flex>
  );
};

// 4. Wrap everything in your Providers at the very top level
export const App = () => {
  return (
    <ChakraProvider value={defaultSystem}> 
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ChakraProvider>
  );
};