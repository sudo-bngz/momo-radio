import { useState } from 'react';
import { VStack, Text, Icon, HStack, Flex, Box, Image } from '@chakra-ui/react';
import { NavLink } from 'react-router-dom';
import { 
  Activity, Library, Radio,
  Settings, PanelLeftClose, PanelLeftOpen,
  Share2, Globe, Sun, Moon 
} from 'lucide-react';
import { SectionColors } from '../theme'; 
import { useColorMode } from '../components/ui/color-mode'; // ⚡️ Import the official hook

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // ⚡️ Use the official hook instead of manual DOM state
  const { colorMode, toggleColorMode } = useColorMode();
  const isDark = colorMode === 'dark';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity, path: '/dashboard', palette: SectionColors.dashboard },
    { id: 'library', label: 'Music Library', icon: Library, path: '/library', palette: SectionColors.library },
    { id: 'shared', label: 'Shared', icon: Share2, path: '/shared', palette: SectionColors.shared },
    { id: 'broadcast', label: 'Broadcast', icon: Radio, path: '/broadcast', palette: SectionColors.broadcast },
    { id: 'public-page', label: 'Public Page', icon: Globe, path: '/public-page', palette: SectionColors.publicPage } 
  ];

  return (
    <Flex 
      direction="column" w={isCollapsed ? "76px" : "240px"} bg="gray.900" 
      borderRight="1px solid" borderColor="whiteAlpha.100" pt={8} pb={7} color="gray.400"
      transition="width 0.3s cubic-bezier(0.4, 0, 0.2, 1)" flexShrink={0} h="100%" position="relative"
    >
      <HStack mb={10} px={isCollapsed ? 0 : 8} justify={isCollapsed ? "center" : "flex-start"} h="32px" gap={isCollapsed ? 0 : 3}>
        <Flex align="center" justify="center" w="32px" h="32px" flexShrink={0}>
          <Image src="/logo.png" alt="Momo Radio Logo" h="100%" w="auto" maxW="100%" objectFit="contain" />
        </Flex>
        {!isCollapsed && <Text fontSize="lg" fontWeight="bold" color="white" letterSpacing="tight" truncate>Momo.Radio</Text>}
      </HStack>
      
      <VStack align="stretch" gap={1} px={4} flex="1">
        {navItems.map((item) => (
          <NavLink key={item.id} to={item.path} style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <NavItem 
                icon={item.icon} label={item.label} isActive={isActive} 
                isCollapsed={isCollapsed} palette={item.palette} 
              />
            )}
          </NavLink>
        ))}
      </VStack>

      <VStack align="stretch" gap={1} px={4} mt="auto" pt={6} borderTop="1px solid" borderColor="whiteAlpha.100">
        
        {/* ⚡️ Directly attach toggleColorMode to the onClick handler */}
        <NavItem 
          icon={isDark ? Sun : Moon} label={isDark ? "Light Mode" : "Dark Mode"} 
          isCollapsed={isCollapsed} onClick={toggleColorMode} palette="yellow"
        />
        
        <NavLink to="/settings" style={{ textDecoration: 'none' }}>
          {({ isActive }) => <NavItem icon={Settings} label="Settings" isActive={isActive} isCollapsed={isCollapsed} palette="gray" />}
        </NavLink>
        <NavItem 
          icon={isCollapsed ? PanelLeftOpen : PanelLeftClose} label="Collapse" 
          isCollapsed={isCollapsed} onClick={() => setIsCollapsed(!isCollapsed)} palette="gray"
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
  palette?: string;
}

const NavItem = ({ icon, label, isActive = false, isCollapsed, onClick, palette = "gray" }: NavItemProps) => (
  <HStack 
    onClick={onClick} py={2.5} px={isCollapsed ? 0 : 4} justify={isCollapsed ? "center" : "flex-start"}
    borderRadius="xl" cursor="pointer" bg={isActive ? 'whiteAlpha.100' : 'transparent'} 
    color={isActive ? (palette === 'gray' ? 'white' : `${palette}.500`) : 'gray.500'} 
    _dark={{ color: isActive ? (palette === 'gray' ? 'white' : `${palette}.400`) : 'gray.400' }}
    _hover={{ bg: 'whiteAlpha.100', color: isActive ? (palette === 'gray' ? 'white' : `${palette}.400`) : 'white' }}
    gap={4} transition="all 0.2s" title={isCollapsed ? label : undefined} position="relative" 
  >
    <Icon as={icon} boxSize={5} flexShrink={0} />
    {!isCollapsed && <Text fontWeight="bold" fontSize="sm" truncate color={isActive ? 'white' : 'inherit'}>{label}</Text>}
    {isActive && !isCollapsed && palette !== 'gray' && (
      <Box position="absolute" left="0" w="3px" h="16px" bg={`${palette}.500`} _dark={{ bg: `${palette}.400` }} borderRadius="full" />
    )}
  </HStack>
);

export default Sidebar;