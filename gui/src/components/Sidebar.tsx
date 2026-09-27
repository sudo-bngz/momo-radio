import { useState } from 'react';
import { VStack, Text, Icon, HStack, Flex, Box, Image } from '@chakra-ui/react';
import { NavLink } from 'react-router-dom';
import { 
  Activity, Library, Radio,
  Settings, PanelLeftClose, PanelLeftOpen,
  Share2, Globe, Sun, Moon 
} from 'lucide-react';
import { SectionColors } from '../theme'; 
import { useColorMode } from '../components/ui/color-mode';


interface SidebarProps {
  onCloseMobile?: () => void;
}

const Sidebar = ({ onCloseMobile }: SidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
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
      direction="column" w={{ base: "100%", md: isCollapsed ? "76px" : "240px" }} 
      bg="bg.panel" // ⚡️ Perfectly matches the #1A1A1A panel background 
      borderRight="1px solid" borderColor="border" pt={8} pb={7} color="fg.muted"
      transition="width 0.3s cubic-bezier(0.4, 0, 0.2, 1)" flexShrink={0} h="100%" position="relative"
    >
      <HStack mb={10} px={isCollapsed ? 0 : 8} justify={{ base: "flex-start", md: isCollapsed ? "center" : "flex-start" }} h="32px" gap={isCollapsed ? 0 : 3}>
        <Flex align="center" justify="center" w="32px" h="32px" flexShrink={0} ml={{ base: 8, md: 0 }}>
          <Image src="/logo.png" alt="Momo Radio Logo" h="100%" w="auto" maxW="100%" objectFit="contain" />
        </Flex>
        {(!isCollapsed || window.innerWidth < 768) && <Text fontSize="lg" fontWeight="bold" color="fg" letterSpacing="tight" truncate>Momo.Radio</Text>}
      </HStack>
      
      <VStack align="stretch" gap={1} px={4} flex="1">
        {navItems.map((item) => (
          <NavLink key={item.id} to={item.path} style={{ textDecoration: 'none' }} onClick={onCloseMobile}>
            {({ isActive }) => (
              <NavItem 
                icon={item.icon} label={item.label} isActive={isActive} 
                isCollapsed={isCollapsed} palette={item.palette} 
              />
            )}
          </NavLink>
        ))}
      </VStack>

      <VStack align="stretch" gap={1} px={4} mt="auto" pt={6} borderTop="1px solid" borderColor="border">
        
        <NavItem 
          icon={isDark ? Sun : Moon} label={isDark ? "Light Mode" : "Dark Mode"} 
          isCollapsed={isCollapsed} onClick={toggleColorMode} palette="yellow"
        />
        
        <NavLink to="/settings" style={{ textDecoration: 'none' }} onClick={onCloseMobile}>
          {({ isActive }) => <NavItem icon={Settings} label="Settings" isActive={isActive} isCollapsed={isCollapsed} palette="gray" />}
        </NavLink>
        
        {/* ⚡️ The collapse button is hidden on mobile screens because it's replaced by the slide-out drawer */}
        <Box display={{ base: "none", md: "block" }}>
          <NavItem 
            icon={isCollapsed ? PanelLeftOpen : PanelLeftClose} label="Collapse" 
            isCollapsed={isCollapsed} onClick={() => setIsCollapsed(!isCollapsed)} palette="gray"
          />
        </Box>
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
    onClick={onClick} py={2.5} px={{ base: 4, md: isCollapsed ? 0 : 4 }} justify={{ base: "flex-start", md: isCollapsed ? "center" : "flex-start" }}
    borderRadius="xl" cursor="pointer" 
    bg={isActive ? 'blackAlpha.50' : 'transparent'} 
    _dark={{ bg: isActive ? 'whiteAlpha.100' : 'transparent' }}
    color={isActive ? (palette === 'gray' ? 'fg' : `${palette}.500`) : 'fg.muted'} 
    _hover={{ 
      bg: 'blackAlpha.100', 
      color: isActive ? (palette === 'gray' ? 'fg' : `${palette}.600`) : 'fg',
      _dark: {
        bg: 'whiteAlpha.200',
        color: isActive ? (palette === 'gray' ? 'white' : `${palette}.400`) : 'white'
      }
    }}
    gap={4} transition="all 0.2s" title={isCollapsed ? label : undefined} position="relative" 
  >
    <Icon as={icon} boxSize={5} flexShrink={0} />
    {(!isCollapsed || window.innerWidth < 768) && <Text fontWeight="bold" fontSize="sm" truncate color={isActive ? 'fg' : 'inherit'}>{label}</Text>}
    {isActive && (!isCollapsed || window.innerWidth < 768) && palette !== 'gray' && (
      <Box position="absolute" left="0" w="3px" h="16px" bg={`${palette}.500`} _dark={{ bg: `${palette}.400` }} borderRadius="full" />
    )}
  </HStack>
);

export default Sidebar;