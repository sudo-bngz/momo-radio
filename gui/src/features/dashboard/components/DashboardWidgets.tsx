import React, { useState, useEffect } from 'react';
import { Box, Flex, HStack, VStack, Text, Icon, Input, IconButton } from '@chakra-ui/react';
import { Copy, Check } from 'lucide-react';

// --- Reusable Card Wrapper ---
export const DashboardCard = ({ title, icon, rightElement, children }: { title: string, icon: any, rightElement?: React.ReactNode, children: React.ReactNode }) => (
  <Box bg="white" borderRadius="xl" borderWidth="1px" borderColor="gray.200" overflow="hidden" boxShadow="sm">
    <Flex px={4} py={3} borderBottomWidth="1px" borderColor="gray.100" align="center" justify="space-between" bg="gray.50">
      <HStack gap={2}>
        <Icon as={icon} color="gray.500" boxSize="16px" />
        <Text fontWeight="600" color="gray.700" fontSize="sm">{title}</Text>
      </HStack>
      {rightElement}
    </Flex>
    <Box p={4}>
      {children}
    </Box>
  </Box>
);

// --- Compact Stat Block ---
export const CompactStat = ({ icon, label, value, color }: { icon: any, label: string, value: string, color: string }) => (
  <HStack p={3} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100" gap={3}>
    <Box p={2} bg={`${color}.50`} color={`${color}.500`} borderRadius="md">
      <Icon as={icon} boxSize="16px" />
    </Box>
    <VStack align="start" gap={0}>
      <Text fontSize="2xs" color="gray.500" fontWeight="600" textTransform="uppercase" letterSpacing="wider">{label}</Text>
      <Text fontSize="md" fontWeight="bold" color="gray.800" lineHeight="1.2">{value}</Text>
    </VStack>
  </HStack>
);

// --- Copyable Endpoint Row ---
export const EndpointRow = ({ label, url }: { label: string, url: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <Box>
      <Text fontSize="xs" fontWeight="600" color="gray.600" mb={1}>{label}</Text>
      <Box position="relative" w="full">
        <Input 
          value={url} 
          readOnly 
          bg="gray.50" 
          color="gray.600"
          fontFamily="mono" 
          fontSize="xs"
          borderRadius="md"
          borderColor="gray.200"
          pr="2.5rem" 
          size="sm"
          _focus={{ borderColor: "blue.400", boxShadow: "none" }}
        />
        <Box position="absolute" right="4px" top="50%" transform="translateY(-50%)" zIndex={2}>
          <IconButton aria-label="Copy" size="xs" variant="ghost" onClick={handleCopy} _hover={{ bg: "gray.200" }}>
            <Icon as={copied ? Check : Copy} color={copied ? "green.500" : "gray.500"} boxSize="14px" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

// --- Helpers ---
export const getArtistName = (artistData: any): string => {
  if (!artistData) return "Unknown Artist";
  if (typeof artistData === 'string') return artistData;
  if (typeof artistData === 'object' && 'name' in artistData) return artistData.name || "Unknown Artist";
  return "Unknown Artist";
};

export const timeAgo = (dateString: string) => {
  if (!dateString) return "Just now";
  const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
};

export const LiveCountdown = ({ endsAt }: { endsAt?: string }) => {
  const [timeLeft, setTimeLeft] = useState("0:00");

  useEffect(() => {
    if (!endsAt) return setTimeLeft("0:00");
    const calc = () => {
      const diff = Math.floor((new Date(endsAt).getTime() - new Date().getTime()) / 1000);
      if (diff <= 0) return setTimeLeft("0:00");
      setTimeLeft(`${Math.floor(diff / 60)}:${(diff % 60).toString().padStart(2, '0')}`);
    };
    calc();
    const int = setInterval(calc, 1000);
    return () => clearInterval(int);
  }, [endsAt]);

  return <Text fontWeight="500">{timeLeft} remaining</Text>;
};