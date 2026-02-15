// src/App.tsx
import { useState } from "react";
import { ChakraProvider, defaultSystem, Box, Flex } from "@chakra-ui/react";

import Sidebar from "./components/Sidebar";
import { DashboardFeature } from "./features/dashboard";
import { IngestFeature } from "./features/ingest";
import { PlaylistsFeature } from "./features/playlists"; 
import { ScheduleFeature } from "./features/schedule";
import { LibraryFeature } from "./features/library"; 

export const App = () => {
  const [currentView, setCurrentView] = useState("library");

  return (
    <ChakraProvider value={defaultSystem}> 
      {/* FIX 1: Change outer background to white if on the library view */}
      <Flex 
        h="100vh" 
        w="100vw" 
        bg={currentView === "library" ? "white" : "gray.50"} 
        overflow="hidden" 
        data-theme="light"
      >
        <Sidebar currentView={currentView} onChangeView={setCurrentView} />
        
        {/* FIX 2: Remove the default padding (p={8} -> p={0}) if on the library view */}
        <Box 
          flex="1" 
          p={currentView === "library" ? 0 : 8} 
          overflowY="auto"
        >
          {currentView === "ingest" && <IngestFeature />}
          {currentView === "playlists" && <PlaylistsFeature />}
          {currentView === "schedule" && <ScheduleFeature />}
          {currentView === "library" && <LibraryFeature />}
          
         {currentView === "dashboard" && <DashboardFeature />}
        </Box>
        
      </Flex>
    </ChakraProvider>
  );
};