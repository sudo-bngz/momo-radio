import { Box, VStack, Text, Icon, HStack } from '@chakra-ui/react';
import { Upload, Radio, Activity, Library, ListMusic, Calendar } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
}

const Sidebar = ({ currentView, onChangeView }: SidebarProps) => {
  // Define all the available routes for the WebRadio admin
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'library', label: 'Music Library', icon: Library },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'ingest', label: 'Ingest Manager', icon: Upload },
  ];

  return (
    <Box 
      w="250px" 
      bg="white" 
      borderRightWidth="1px" 
      borderColor="gray.200" 
      py={6} 
      px={4}
      color="gray.800"
    >
      <HStack mb={10} px={2} gap={3}>
        <Icon as={Radio} boxSize={6} color="blue.500" />
        <Text fontSize="xl" fontWeight="bold" color="gray.900">Momo Radio</Text>
      </HStack>
      
      <VStack alignItems="stretch" gap={2}>
        {navItems.map((item) => (
          <NavItem 
            key={item.id}
            icon={item.icon} 
            label={item.label} 
            isActive={currentView === item.id}
            onClick={() => onChangeView(item.id)}
          />
        ))}
      </VStack>
    </Box>
  );
};

interface NavItemProps {
  icon: any;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

const NavItem = ({ icon, label, isActive = false, onClick }: NavItemProps) => (
  <HStack 
    onClick={onClick}
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