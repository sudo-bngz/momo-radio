// src/App.tsx
import { useState } from "react";
import { ChakraProvider, defaultSystem, Box, Flex } from "@chakra-ui/react";

// --- Import your layout and feature components ---
import Sidebar from "./components/Sidebar";
import UploadManager from "./components/UploadManager";
// I'm importing the Playlists feature we just built!
import { PlaylistsFeature } from "./features/playlists"; 
import { ScheduleFeature } from "./features/schedule";

export const App = () => {
  // 1. State to track the active screen (defaulting to the Ingest Manager)
  const [currentView, setCurrentView] = useState("ingest");

  return (
    <ChakraProvider value={defaultSystem}> 
      <Flex h="100vh" w="100vw" bg="gray.50" overflow="hidden" data-theme="light">
        
        {/* 2. Pass the state and the setter to the Sidebar to fix the TS2739 error */}
        <Sidebar currentView={currentView} onChangeView={setCurrentView} />
        
        <Box flex="1" p={8} overflowY="auto">
          {/* 3. Conditionally render the correct component based on the active view */}
          {currentView === "ingest" && <UploadManager />}
          {currentView === "playlists" && <PlaylistsFeature />}
          
          {/* Placeholders for the other screens we will build */}
          {currentView === "dashboard" && <Box p={4}>Dashboard View (Coming Soon)</Box>}
          {currentView === "library" && <Box p={4}>Library View (Coming Soon)</Box>}
          {currentView === "schedule" && <ScheduleFeature />}
        </Box>
        
      </Flex>
    </ChakraProvider>
  );
};