import { useState } from 'react';
import { VStack, Text, Icon, HStack, Flex, Box } from '@chakra-ui/react';
import { NavLink } from 'react-router-dom';
import { 
  Upload, Radio, Activity, Library, ListMusic, 
  Calendar, Settings, PanelLeftClose, PanelLeftOpen 
} from 'lucide-react';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
      w={isCollapsed ? "76px" : "260px"} 
      bg="gray.900" 
      borderRight="1px solid" 
      borderColor="whiteAlpha.100" 
      pt={8}          // <--- FIX: Keep top padding at 8
      pb="96px"       // <--- FIX: Add large bottom padding to clear the 72px player
      color="gray.400"
      transition="width 0.3s cubic-bezier(0.4, 0, 0.2, 1)" 
      flexShrink={0}
      h="100%"
      position="relative"
    >
      {/* Brand Logo */}
      <HStack mb={10} px={isCollapsed ? 0 : 8} justify={isCollapsed ? "center" : "flex-start"} h="32px">
        <Icon as={Radio} boxSize={6} color="blue.500" flexShrink={0} />
        {!isCollapsed && (
          <Text fontSize="lg" fontWeight="bold" color="white" letterSpacing="tight" truncate>
            Momo Radio
          </Text>
        )}
      </HStack>
      
      {/* Main Navigation */}
      <VStack align="stretch" gap={1} px={4} flex="1">
        {navItems.map((item) => (
          <NavLink 
            key={item.id} 
            to={item.path} 
            style={{ textDecoration: 'none' }}
          >
            {({ isActive }) => (
              <NavItem 
                icon={item.icon} 
                label={item.label} 
                isActive={isActive} 
                isCollapsed={isCollapsed}
              />
            )}
          </NavLink>
        ))}
      </VStack>

      {/* Bottom Actions */}
      <VStack align="stretch" gap={1} px={4} mt="auto" pt={6} borderTop="1px solid" borderColor="whiteAlpha.100">
        <NavLink to="/settings" style={{ textDecoration: 'none' }}>
          {({ isActive }) => (
            <NavItem icon={Settings} label="Settings" isActive={isActive} isCollapsed={isCollapsed} />
          )}
        </NavLink>
        <NavItem 
          icon={isCollapsed ? PanelLeftOpen : PanelLeftClose} 
          label="Collapse" 
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
  onClick?: () => void;
}

const NavItem = ({ icon, label, isActive = false, isCollapsed, onClick }: NavItemProps) => (
  <HStack 
    onClick={onClick}
    py={2.5} 
    px={isCollapsed ? 0 : 4} 
    justify={isCollapsed ? "center" : "flex-start"}
    borderRadius="xl" 
    cursor="pointer" 
    bg={isActive ? 'whiteAlpha.100' : 'transparent'} 
    color={isActive ? 'white' : 'gray.500'} 
    _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
    gap={4} 
    transition="all 0.2s"
    title={isCollapsed ? label : undefined}
  >
    <Icon as={icon} boxSize={5} flexShrink={0} />
    {!isCollapsed && (
      <Text fontWeight="bold" fontSize="sm" truncate>
        {label}
      </Text>
    )}
    {/* Active Indicator Bar */}
    {isActive && !isCollapsed && (
      <Box position="absolute" left="0" w="3px" h="16px" bg="blue.500" borderRadius="full" />
    )}
  </HStack>
);

export default Sidebar;