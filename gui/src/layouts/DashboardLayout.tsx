import { Flex, Box } from "@chakra-ui/react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { TopNav } from "../components/TopNavbar";
import { GlobalPlayer } from "../features/player/GlobalPlayer";

export const DashboardLayout = () => {
  return (
    // 1. OUTER CONTAINER
    // gap={0} is CRITICAL. It removes the white line between Sidebar and Player.
    <Flex h="100vh" w="100vw" direction="column" bg="white" overflow="hidden" gap={0}>
      
      {/* 2. WORKSPACE (Sidebar + Content) */}
      <Flex flex="1" w="100%" overflow="hidden">
        <Sidebar /> 
        
        <Flex direction="column" flex="1" overflow="hidden" position="relative">
          <TopNav />
          
          {/* 3. CONTENT AREA */}
          {/* You asked where the margin is set: it's this p={8}.
              p={8} adds 32px padding on ALL sides.
              If you want the content to be closer to the player at the bottom, 
              change it to: px={8} pt={8} pb={0} 
          */}
          <Box flex="1" px={8} pt={8} pb={0} overflowY="auto">
            <Outlet />
          </Box>
        </Flex>
      </Flex>

      {/* 4. PLAYER FOOTER */}
      {/* Placed here to push the whole Workspace up */}
      <GlobalPlayer />

    </Flex>
  );
};