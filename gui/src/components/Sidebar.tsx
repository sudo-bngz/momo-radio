import { Box, VStack, Text, Icon, HStack } from '@chakra-ui/react';
import { Upload, Radio } from 'lucide-react';

const Sidebar = () => {
  return (
    <Box 
      w="250px" 
      bg="white" 
      borderRightWidth="1px" 
      borderColor="gray.200" 
      py={6} 
      px={4}
      color="gray.800" /* <--- FIX: Force dark text on the white background */
    >
      <HStack mb={10} px={2} gap={3}>
        <Icon as={Radio} boxSize={6} color="blue.500" />
        <Text fontSize="xl" fontWeight="bold" color="gray.900">Momo Radio</Text>
      </HStack>
      
      <VStack align="stretch" gap={2}>
        {/* In v3, standard CSS props like alignItems are preferred over shortcuts like align */}
        <NavItem icon={Upload} label="Ingest" isActive />
      </VStack>
    </Box>
  );
};

const NavItem = ({ icon, label, isActive = false }: { icon: any, label: string, isActive?: boolean }) => (
  <HStack 
    py={3} 
    px={4} 
    rounded="md" 
    cursor="pointer" 
    bg={isActive ? 'blue.50' : 'transparent'} 
    color={isActive ? 'blue.600' : 'gray.600'} 
    _hover={{ bg: 'blue.50', color: 'blue.600' }}
    gap={3} 
    transition="all 0.2s"
  >
    <Icon as={icon} boxSize={5} />
    <Text fontWeight="medium">{label}</Text>
  </HStack>
);

export default Sidebar;