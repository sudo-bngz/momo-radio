import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, Heading, Text, VStack, HStack, Button, Icon, Input, IconButton, Spinner 
} from '@chakra-ui/react';
import { X, Save, Trash2, Radio } from 'lucide-react';
import { api, type MountPoint } from '../../../services/api';
import { usePlayer } from '../../../context/PlayerContext';

interface StreamSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mount: MountPoint | null;
  onUpdateSuccess: () => void;
}

export const StreamSettingsPanel: React.FC<StreamSettingsPanelProps> = ({ 
  isOpen, onClose, mount, onUpdateSuccess 
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [bitrate, setBitrate] = useState<number>(128);
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ⚡️ Bring in the player context to check if the global player is active
  const { currentTrack } = usePlayer();
  const hasActivePlayer = !!currentTrack;

  useEffect(() => {
    if (mount) {
      setName(mount.name);
      setSlug(mount.slug);
      setBitrate(mount.bitrate);
      setIsDefault(mount.is_default);
    }
  }, [mount]);

  if (!mount) return null;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await api.updateMountPoint(mount.id, {
        name,
        slug,
        bitrate,
        is_default: isDefault
      });
      onUpdateSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to update mount point:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (mount.is_default) return; 
    if (!window.confirm("Are you sure you want to delete this stream endpoint?")) return;

    try {
      setIsDeleting(true);
      await api.deleteMountPoint(mount.id);
      onUpdateSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to delete mount point:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* OVERLAY */}
      <Box 
        position="fixed" top={0} left={0} right={0} bottom={0} 
        bg="blackAlpha.600" backdropFilter="blur(2px)" 
        zIndex={2000} onClick={onClose} 
        opacity={isOpen ? 1 : 0}
        pointerEvents={isOpen ? "auto" : "none"}
        transition="opacity 0.3s"
      />

      {/* SLIDE-OUT PANEL */}
      <Box
        position="fixed" top={0} 
        right={{ base: isOpen ? 0 : "-100%", md: isOpen ? 0 : "-450px" }} 
        w={{ base: "100%", md: "450px" }} 
        h="100dvh" 
        bg="bg.panel" shadow="2xl" 
        zIndex={2001} 
        transition="right 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        display="flex" flexDirection="column"
        borderLeft="1px solid" borderColor="border"
      >
        {/* HEADER */}
        <Flex justify="space-between" align="center" p={{ base: 4, md: 6 }} borderBottom="1px solid" borderColor="border">
          <HStack gap={3}>
            <Box 
              w="32px" h="32px" borderRadius="md" display="flex" alignItems="center" justifyContent="center"
              bg="blue.50" color="blue.600" _dark={{ bg: "blue.900", color: "blue.300" }} 
            >
              <Icon as={Radio} boxSize={4} />
            </Box>
            <Box>
              <Heading size="md" color="fg">Stream Settings</Heading>
              <Text fontSize="xs" color="fg.muted" fontFamily="mono">{mount.id}</Text>
            </Box>
          </HStack>
          <IconButton 
            aria-label="Close panel" variant="ghost" size="sm" onClick={onClose}
            color="fg.muted" _hover={{ bg: "gray.100", color: "fg", _dark: { bg: "whiteAlpha.100" } }}
            w={{ base: "40px", md: "32px" }} h={{ base: "40px", md: "32px" }} 
          >
            <Icon as={X} boxSize={5} />
          </IconButton>
        </Flex>

        {/* BODY */}
        <Box flex="1" overflowY="auto" p={{ base: 4, md: 6 }}>
          <VStack align="stretch" gap={6}>
            <Box>
              <Text fontSize="sm" fontWeight="600" color="fg" mb={1.5}>Stream Name</Text>
              <Input 
                value={name} onChange={(e) => setName(e.target.value)} 
                placeholder="e.g. High Quality AAC" 
                h={{ base: "52px", md: "40px" }} 
                fontSize="16px" 
                borderRadius="md"
                bg="bg" color="fg" borderColor="border"
                _placeholder={{ color: "fg.muted" }}
                _focus={{ borderColor: "blue.500", ring: "1px", ringColor: "blue.500", _dark: { borderColor: "blue.400", ringColor: "blue.400" } }}
              />
            </Box>

            <Box>
              <Text fontSize="sm" fontWeight="600" color="fg" mb={1.5}>URL Slug</Text>
              <Input 
                value={slug} onChange={(e) => setSlug(e.target.value)} 
                placeholder="e.g. hq-stream" 
                h={{ base: "52px", md: "40px" }} 
                fontSize="16px" 
                borderRadius="md" fontFamily="mono"
                bg="bg" color="fg" borderColor="border"
                _placeholder={{ color: "fg.muted" }}
                _focus={{ borderColor: "blue.500", ring: "1px", ringColor: "blue.500", _dark: { borderColor: "blue.400", ringColor: "blue.400" } }}
              />
              <Text fontSize="xs" color="fg.muted" mt={2}>This affects the direct HLS .m3u8 path.</Text>
            </Box>

            <Box>
              <Text fontSize="sm" fontWeight="600" color="fg" mb={1.5}>Audio Bitrate (kbps)</Text>
              <HStack gap={2}>
                {[64, 128, 192, 320].map(rate => (
                  <Button 
                    key={rate} flex={1} 
                    h={{ base: "48px", md: "32px" }} 
                    fontSize={{ base: "sm", md: "xs" }}
                    variant={bitrate === rate ? "solid" : "outline"}
                    bg={bitrate === rate ? "fg" : "transparent"}
                    color={bitrate === rate ? "bg" : "fg.muted"}
                    borderColor={bitrate === rate ? "fg" : "border"}
                    _hover={bitrate === rate ? { opacity: 0.9 } : { bg: "gray.50", _dark: { bg: "whiteAlpha.100" } }}
                    onClick={() => setBitrate(rate)}
                  >
                    {rate}
                  </Button>
                ))}
              </HStack>
            </Box>

            <Box p={4} bg="gray.50" _dark={{ bg: "whiteAlpha.50" }} borderRadius="lg" border="1px solid" borderColor="border">
              <Flex justify="space-between" align="center">
                <Box pr={4}>
                  <Text fontSize="sm" fontWeight="600" color="fg">Primary Default</Text>
                  <Text fontSize="xs" color="fg.muted">Use this stream as the master broadcast output.</Text>
                </Box>
                <Button 
                  h={{ base: "40px", md: "32px" }} 
                  px={{ base: 4, md: 3 }}
                  variant={isDefault ? "solid" : "outline"}
                  bg={isDefault ? "blue.600" : "transparent"} 
                  _dark={{ bg: isDefault ? "blue.500" : "transparent" }}
                  color={isDefault ? "white" : "fg.muted"}
                  borderColor={isDefault ? "transparent" : "border"}
                  _hover={isDefault ? { bg: "blue.700", _dark: { bg: "blue.400" } } : { bg: "gray.100", _dark: { bg: "whiteAlpha.100" } }}
                  onClick={() => setIsDefault(!isDefault)}
                >
                  {isDefault ? "Active" : "Enable"}
                </Button>
              </Flex>
            </Box>
          </VStack>
        </Box>

        {/* FOOTER */}
        <Flex 
          p={{ base: 4, md: 6 }} 
          // ⚡️ DYNAMIC PADDING: Adapts to whether the player is currently visible
          pb={{ base: hasActivePlayer ? "100px" : 8, md: 6 }} 
          borderTop="1px solid" borderColor="border" 
          justify="space-between" 
          bg="gray.50" _dark={{ bg: "whiteAlpha.50" }}
        >
          <Button 
            variant="ghost" 
            h={{ base: "48px", md: "40px" }}
            color="red.500" _dark={{ color: "red.400" }}
            _hover={{ bg: "red.50", _dark: { bg: "red.900/40" } }} 
            onClick={handleDelete} disabled={isDeleting || mount.is_default}
            px={{ base: 3, md: 4 }}
          >
            {isDeleting ? <Spinner size="sm" mr={{ base: 0, sm: 2 }} /> : <Icon as={Trash2} boxSize={5} mr={{ base: 0, sm: 2 }} />}
            <Box display={{ base: "none", sm: "block" }}>Delete</Box>
          </Button>
          
          <HStack gap={{ base: 2, md: 3 }}>
            <Button 
              h={{ base: "48px", md: "40px" }}
              variant="outline" onClick={onClose} 
              bg="bg" color="fg" borderColor="border"
              _hover={{ bg: "gray.100", _dark: { bg: "whiteAlpha.100" } }}
            >
              Cancel
            </Button>
            <Button 
              h={{ base: "48px", md: "40px" }}
              bg="blue.600" color="white" _dark={{ bg: "blue.500" }}
              _hover={{ bg: "blue.700", _dark: { bg: "blue.400" } }} 
              onClick={handleSave} disabled={isSaving}
            >
              {isSaving ? <Spinner size="sm" mr={2} color="white" /> : <Icon as={Save} boxSize={4} mr={2} />}
              Save
            </Button>
          </HStack>
        </Flex>
      </Box>
    </>
  );
};