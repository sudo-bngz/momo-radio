import { Flex, Box } from "@chakra-ui/react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { TopNav } from "../components/TopNavbar";

export const DashboardLayout = () => {
  return (
    <Flex h="100vh" w="100vw" bg="white" overflow="hidden">
      <Sidebar /> 
      <Flex direction="column" flex="1" overflow="hidden">
        <TopNav />
        <Box flex="1" p={8} overflowY="auto">
          <Outlet />
        </Box>
      </Flex>
    </Flex>
  );
};
