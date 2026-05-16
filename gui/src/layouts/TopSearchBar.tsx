import React from 'react';
import { Flex, HStack, Box, Input, Icon, Button } from '@chakra-ui/react';
import { Search, Bell, Settings } from 'lucide-react';
import { useSearchStore } from '../store/useSearchStore';

export const TopSearchBar: React.FC = () => {
  const { globalSearch, setGlobalSearch } = useSearchStore();

  return (
    <Flex 
      w="100%" h="72px" px={8} align="center" justify="space-between" 
      bg="white" borderBottom="1px solid" borderColor="gray.100"
      position="sticky" top={0} zIndex={100}
    >
      {/* 1. Global Search */}
      <Box position="relative" w="100%" maxW="480px">
        <Icon as={Search} position="absolute" left={4} top="50%" transform="translateY(-50%)" color="gray.400" boxSize={4} zIndex={2} />
        <Input 
          pl={10} h="40px" fontSize="sm" placeholder="Search songs, albums, artists..."
          value={globalSearch} 
          onChange={(e) => setGlobalSearch(e.target.value)}
          borderRadius="full" bg="gray.50" border="none" color="gray.900"
          _focus={{ bg: "white", shadow: "sm", ring: "1px", ringColor: "gray.200" }} 
        />
      </Box>

      {/* 2. Right Side Icons & Profile */}
      <HStack gap={4}>
        <Button variant="ghost" size="sm" color="gray.500" borderRadius="full" w="40px" h="40px" p={0}>
          <Icon as={Bell} boxSize={5} />
        </Button>
        <Button variant="ghost" size="sm" color="gray.500" borderRadius="full" w="40px" h="40px" p={0}>
          <Icon as={Settings} boxSize={5} />
        </Button>
        
        {/* Placeholder for Auth Avatar */}
        <Flex 
          w="36px" h="36px" borderRadius="full" bg="blue.600" color="white" 
          align="center" justify="center" fontWeight="bold" fontSize="sm" cursor="pointer"
        >
          M
        </Flex>
      </HStack>
    </Flex>
  );
};