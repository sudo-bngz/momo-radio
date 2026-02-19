import { Flex, Box } from "@chakra-ui/react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { TopNav } from "../components/TopNavbar";
import { GlobalPlayer } from "../components/GlobalPlayer";
import { usePlayer } from "../context/PlayerContext";

export const DashboardLayout = () => {
  const { isPlayerVisible } = usePlayer();

  return (
    <Flex h="100vh" w="100vw" bg="white" overflow="hidden">
      <Sidebar /> 
      <Flex direction="column" flex="1" overflow="hidden" position="relative">
        <TopNav />
        <Box 
          flex="1" 
          p={8} 
          overflowY="auto"
          pb={isPlayerVisible ? "96px" : 8}
          transition="padding 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
        >
          <Outlet />
        </Box>
        <GlobalPlayer />
      </Flex>
    </Flex>
  );
};