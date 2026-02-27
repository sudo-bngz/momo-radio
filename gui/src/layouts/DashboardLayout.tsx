import { Flex, Box } from "@chakra-ui/react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { TopNav } from "../components/TopNavbar";
import { GlobalPlayer } from "../features/player/GlobalPlayer";

export const DashboardLayout = () => {
  return (
    <Flex h="100vh" w="100vw" direction="column" bg="white" overflow="hidden" gap={0}>
      {/* 2. WORKSPACE (Sidebar + Content) */}
      <Flex flex="1" w="100%" overflow="hidden">
        <Sidebar /> 
        
        <Flex direction="column" flex="1" overflow="hidden" position="relative">
          <TopNav />
          <Box flex="1" px={8} pt={8} pb={0} overflowY="auto">
            <Outlet />
          </Box>
        </Flex>
      </Flex>
      <GlobalPlayer />
    </Flex>
  );
};