import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, VStack, HStack, Text, Icon, Button, Spinner, Badge // ⚡️ FIXED: Imported Badge
} from '@chakra-ui/react';
import { X, Link as LinkIcon, Copy, Trash2, Check, Music, Download, Clock } from 'lucide-react';
import { api, type ShareItem } from '../../../services/api';
import { toaster } from '../../../components/ui/toaster';

interface ShareDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  track: any | null;
}

export const ShareDrawer: React.FC<ShareDrawerProps> = ({ isOpen, onClose, track }) => {
  const [existingShares, setExistingShares] = useState<ShareItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // New Link State
  const [allowDownload, setAllowDownload] = useState(false);
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Fetch existing shares when the drawer opens for a specific track
  useEffect(() => {
    if (isOpen && track) {
      loadExistingShares();
      // Reset form
      setAllowDownload(false);
      setExpiresIn(0);
    }
  }, [isOpen, track]);

  const loadExistingShares = async () => {
    setIsLoading(true);
    try {
      const allShares = await api.getShares();
      // Filter shares to only show ones belonging to the currently selected track
      setExistingShares(allShares.filter(s => s.track_id === track.id));
    } catch (error) {
      console.error("Failed to load existing shares", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!track) return;
    setIsGenerating(true);
    try {
      const payload = {
        track_id: track.id,
        allow_download: allowDownload,
        ...(expiresIn > 0 ? { expires_in_days: expiresIn } : {})
      };
      
      await api.createShare(payload);
      toaster.create({ title: "Public link generated!", type: "success" });
      
      // Reload the list so the new link appears at the top
      await loadExistingShares();
      
      // Reset form
      setAllowDownload(false);
      setExpiresIn(0);
    } catch (error) {
      toaster.create({ title: "Failed to generate link", type: "error" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (shareId: number) => {
    try {
      await api.deleteShare(shareId);
      setExistingShares(prev => prev.filter(s => s.id !== shareId));
      toaster.create({ title: "Link revoked", type: "info" });
    } catch (error) {
      toaster.create({ title: "Failed to revoke link", type: "error" });
    }
  };

  const handleCopy = (token: string) => {
    const url = `${window.location.origin}/s/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  // Prevent scrolling on the body when drawer is open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen || !track) return null;

  return (
    <>
      {/* Backdrop */}
      <Box 
        position="fixed" top={0} left={0} w="100vw" h="100vh" 
        bg="blackAlpha.400" zIndex={1300} 
        opacity={isOpen ? 1 : 0} transition="opacity 0.3s"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <Flex 
        position="fixed" top={0} right={0} h="100vh" w={{ base: "100%", md: "440px" }} 
        bg="white" zIndex={1400} shadow="2xl" direction="column"
        transform={isOpen ? "translateX(0)" : "translateX(100%)"}
        transition="transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
      >
        {/* Header */}
        <Flex justify="space-between" align="center" p={6} borderBottom="1px solid" borderColor="gray.100">
          <Text fontSize="lg" fontWeight="600" color="gray.900">Share track(s)</Text>
          <Button size="sm" variant="ghost" borderRadius="full" p={0} onClick={onClose} color="gray.500" _hover={{ bg: "gray.100" }}>
            <Icon as={X} boxSize={5} />
          </Button>
        </Flex>

        <Box flex="1" overflowY="auto" p={6}>
          {/* Track Context */}
          <HStack gap={4} p={3} bg="gray.50" borderRadius="xl" border="1px solid" borderColor="gray.100" mb={8}>
            <Box w="48px" h="48px" borderRadius="md" overflow="hidden" bg="gray.200" flexShrink={0} display="flex" alignItems="center" justifyContent="center">
              {track.cover_url ? (
                <img src={track.cover_url} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Icon as={Music} boxSize={5} color="gray.400" />
              )}
            </Box>
            <VStack align="start" gap={0} flex={1} overflow="hidden">
              {/* ⚡️ FIXED: Changed noOfLines to lineClamp for Chakra v3 */}
              <Text fontWeight="600" color="gray.900" lineClamp={1}>{track.title}</Text>
              <Text fontSize="sm" color="gray.500" lineClamp={1}>{track.artist}</Text>
            </VStack>
          </HStack>

          {/* Create New Link Section */}
          <Box border="1px solid" borderColor="gray.200" borderRadius="xl" overflow="hidden" mb={8}>
            <Flex p={4} bg="gray.50" borderBottom="1px solid" borderColor="gray.200" align="center" gap={3}>
              <Box p={2} bg="blue.100" color="blue.600" borderRadius="lg">
                <Icon as={LinkIcon} boxSize={4} />
              </Box>
              <VStack align="start" gap={0}>
                <Text fontWeight="600" fontSize="sm" color="gray.900">Share by link</Text>
                <Text fontSize="xs" color="gray.500">Generate custom links, use them freely</Text>
              </VStack>
            </Flex>
            
            <VStack p={4} gap={5} bg="white" align="stretch">
              {/* Allow Downloads Toggle */}
              <Flex justify="space-between" align="center">
                <HStack gap={2} color="gray.700">
                  <Icon as={Download} boxSize={4} />
                  <Text fontSize="sm" fontWeight="500">Allow Downloads</Text>
                </HStack>
                <Box 
                  w="40px" h="22px" bg={allowDownload ? "blue.500" : "gray.200"} 
                  borderRadius="full" position="relative" cursor="pointer" transition="all 0.2s"
                  onClick={() => setAllowDownload(!allowDownload)}
                >
                  <Box w="18px" h="18px" bg="white" borderRadius="full" shadow="sm" position="absolute" top="2px" left={allowDownload ? "20px" : "2px"} transition="all 0.2s" />
                </Box>
              </Flex>

              {/* Expiration Select */}
              <Flex justify="space-between" align="center">
                <HStack gap={2} color="gray.700">
                  <Icon as={Clock} boxSize={4} />
                  <Text fontSize="sm" fontWeight="500">Link Expiration</Text>
                </HStack>
                <select 
                  value={expiresIn} 
                  onChange={(e) => setExpiresIn(Number(e.target.value))}
                  style={{
                    padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--chakra-colors-gray-200)',
                    fontSize: '13px', outline: 'none', background: 'white', cursor: 'pointer'
                  }}
                >
                  <option value={0}>Never expire</option>
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days</option>
                </select>
              </Flex>

              <Button 
                w="100%" size="sm" bg="gray.900" color="white" _hover={{ bg: "gray.800" }} 
                borderRadius="lg" onClick={handleGenerateLink} disabled={isGenerating}
              >
                {isGenerating ? <Spinner size="xs" /> : "Generate Link"}
              </Button>
            </VStack>
          </Box>

          {/* Existing Links Section */}
          <HStack justify="space-between" mb={4}>
            <Text fontWeight="600" fontSize="sm" color="gray.900">Existing links</Text>
            <Badge size="sm" colorPalette="gray" borderRadius="full" px={2}>{existingShares.length}</Badge>
          </HStack>

          {isLoading ? (
            <Flex justify="center" py={8}><Spinner color="gray.400" /></Flex>
          ) : existingShares.length === 0 ? (
            <Text fontSize="sm" color="gray.500" textAlign="center" py={4} bg="gray.50" borderRadius="lg" border="1px dashed" borderColor="gray.200">
              No active links for this track.
            </Text>
          ) : (
            <VStack align="stretch" gap={3}>
              {existingShares.map(share => {
                const isCopied = copiedToken === share.token;
                const urlPreview = `${window.location.origin}/s/${share.token.substring(0, 6)}...`;
                
                return (
                  <Flex key={share.id} p={3} border="1px solid" borderColor="gray.200" borderRadius="lg" justify="space-between" align="center" bg="white" _hover={{ borderColor: "gray.300" }}>
                    <HStack gap={3}>
                      <Icon as={LinkIcon} boxSize={4} color="gray.400" />
                      <VStack align="start" gap={0}>
                        <Text fontSize="sm" fontWeight="500" color="gray.700" fontFamily="monospace">
                          {urlPreview}
                        </Text>
                        <HStack gap={2} fontSize="xs" color="gray.500">
                          <Text>{share.play_count} plays</Text>
                          <Text>•</Text>
                          <Text>{share.allow_download ? "Downloadable" : "Stream only"}</Text>
                        </HStack>
                      </VStack>
                    </HStack>
                    
                    <HStack gap={1}>
                      <Button size="xs" variant="ghost" onClick={() => handleCopy(share.token)} color={isCopied ? "green.500" : "gray.600"}>
                        <Icon as={isCopied ? Check : Copy} boxSize={3.5} mr={1} />
                        {isCopied ? "Copied" : "Copy"}
                      </Button>
                      <Button size="xs" variant="ghost" color="gray.400" _hover={{ color: "red.500", bg: "red.50" }} onClick={() => handleRevoke(share.id)}>
                        <Icon as={Trash2} boxSize={3.5} />
                      </Button>
                    </HStack>
                  </Flex>
                );
              })}
            </VStack>
          )}
        </Box>
      </Flex>
    </>
  );
};