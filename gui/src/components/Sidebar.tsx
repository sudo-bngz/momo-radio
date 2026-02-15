import { useState } from 'react';
import { VStack, Text, Icon, HStack, Flex } from '@chakra-ui/react';
import { NavLink } from 'react-router-dom'; // FIX: Use NavLink for routing
import { 
  Upload, Radio, Activity, Library, ListMusic, 
  Calendar, Settings, PanelLeftClose, PanelLeftOpen 
} from 'lucide-react';

// FIX: SidebarProps no longer needs currentView/onChangeView
const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // FIX: Added 'path' to match your Route definitions in App.tsx
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity, path: '/dashboard' },
    { id: 'ingest', label: 'Upload Track', icon: Upload, path: '/ingest' },
    { id: 'library', label: 'Music Library', icon: Library, path: '/library' },
    { id: 'playlists', label: 'Playlists', icon: ListMusic, path: '/playlists' },
    { id: 'schedule', label: 'Timetable', icon: Calendar, path: '/schedule' },
  ];

  return (
    <Flex 
      direction="column"
      w={isCollapsed ? "72px" : "250px"} 
      bg="gray.900" 
      borderRightWidth="1px" 
      borderColor="gray.800" 
      py={6} 
      color="gray.400"
      transition="width 0.3s ease-in-out" 
      flexShrink={0}
      h="100%"
    >
      <HStack mb={8} px={isCollapsed ? 0 : 6} justify={isCollapsed ? "center" : "flex-start"} h="32px">
        <Icon as={Radio} boxSize={7} color="blue.400" flexShrink={0} />
        {!isCollapsed && (
          <Text fontSize="xl" fontWeight="bold" color="white" whiteSpace="nowrap">
            Momo Radio
          </Text>
        )}
      </HStack>
      
      <VStack align="stretch" gap={2} px={3} flex="1">
        {navItems.map((item) => (
          /* FIX: Wrap NavItem in NavLink to handle the URL change */
          <NavLink 
            key={item.id} 
            to={item.path} 
            style={{ textDecoration: 'none' }}
          >
            {({ isActive }) => (
              <NavItem 
                icon={item.icon} 
                label={item.label} 
                isActive={isActive} // NavLink automatically determines isActive
                isCollapsed={isCollapsed}
              />
            )}
          </NavLink>
        ))}
      </VStack>

      <VStack align="stretch" gap={2} px={3} mt="auto" pt={4} borderTop="1px solid" borderColor="gray.800">
        <NavItem 
          icon={Settings} 
          label="Settings" 
          isCollapsed={isCollapsed}
          onClick={() => console.log("Open settings")} 
        />
        <NavItem 
          icon={isCollapsed ? PanelLeftOpen : PanelLeftClose} 
          label="Collapse Menu" 
          isCollapsed={isCollapsed}
          onClick={() => setIsCollapsed(!isCollapsed)}
        />
      </VStack>
    </Flex>
  );
};

interface NavItemProps {
  icon: any;
  label: string;
  isActive?: boolean;
  isCollapsed: boolean;
  onClick?: () => void; // Made optional since NavLink handles most clicks
}

const NavItem = ({ icon, label, isActive = false, isCollapsed, onClick }: NavItemProps) => (
  <HStack 
    onClick={onClick}
    py={3} 
    px={isCollapsed ? 0 : 3} 
    justify={isCollapsed ? "center" : "flex-start"}
    rounded="md" 
    cursor="pointer" 
    bg={isActive ? 'whiteAlpha.200' : 'transparent'} 
    color={isActive ? 'white' : 'gray.400'} 
    _hover={{ bg: 'whiteAlpha.200', color: 'white' }}
    gap={3} 
    transition="all 0.2s"
    title={isCollapsed ? label : undefined}
  >
    <Icon as={icon} boxSize={5} flexShrink={0} />
    {!isCollapsed && (
      <Text fontWeight="medium" fontSize="sm" whiteSpace="nowrap" overflow="hidden">
        {label}
      </Text>
    )}
  </HStack>
);

export default Sidebar;