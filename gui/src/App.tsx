// src/App.tsx
import { ChakraProvider, defaultSystem, Box, Flex } from "@chakra-ui/react" // Import defaultSystem
import Sidebar from "./components/Sidebar"
import UploadManager from "./components/UploadManager"

export const App = () => (
  // Add value={defaultSystem} here
  <ChakraProvider value={defaultSystem}> 
    <Flex h="100vh" w="100vw" bg="gray.50" overflow="hidden" data-theme="light">
      <Sidebar />
      <Box flex="1" p={8} overflowY="auto">
        <UploadManager />
      </Box>
    </Flex>
  </ChakraProvider>
)