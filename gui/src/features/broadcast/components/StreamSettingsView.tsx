import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, Heading, Text, VStack, HStack, Button, Icon, Input, IconButton, Spinner 
} from '@chakra-ui/react';
import { X, Save, Trash2, Radio } from 'lucide-react';
import { api, type MountPoint } from '../../../services/api';

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
      {isOpen && (
        <Box 
          position="fixed" top={0} left={0} right={0} bottom={0} 
          bg="blackAlpha.600" backdropFilter="blur(2px)" 
          zIndex={1000} onClick={onClose} 
        />
      )}

      <Box
        position="fixed" top={0} right={isOpen ? 0 : "-450px"} 
        w={{ base: "100%", md: "450px" }} h="100vh" 
        bg="bg.panel" shadow="2xl" zIndex={1001} 
        transition="right 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        display="flex" flexDirection="column"
        borderLeft="1px solid" borderColor="border"
      >
        <Flex justify="space-between" align="center" p={6} borderBottom="1px solid" borderColor="border">
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
          >
            <Icon as={X} boxSize={5} />
          </IconButton>
        </Flex>

        <Box flex="1" overflowY="auto" p={6}>
          <VStack align="stretch" gap={6}>
            <Box>
              <Text fontSize="sm" fontWeight="600" color="fg" mb={1.5}>Stream Name</Text>
              <Input 
                value={name} onChange={(e) => setName(e.target.value)} 
                placeholder="e.g. High Quality AAC" size="md" borderRadius="md"
                bg="bg" color="fg" borderColor="border"
                _placeholder={{ color: "fg.muted" }}
                _focus={{ borderColor: "blue.500", ring: "1px", ringColor: "blue.500", _dark: { borderColor: "blue.400", ringColor: "blue.400" } }}
              />
            </Box>

            <Box>
              <Text fontSize="sm" fontWeight="600" color="fg" mb={1.5}>URL Slug</Text>
              <Input 
                value={slug} onChange={(e) => setSlug(e.target.value)} 
                placeholder="e.g. hq-stream" size="md" borderRadius="md" fontFamily="mono"
                bg="bg" color="fg" borderColor="border"
                _placeholder={{ color: "fg.muted" }}
                _focus={{ borderColor: "blue.500", ring: "1px", ringColor: "blue.500", _dark: { borderColor: "blue.400", ringColor: "blue.400" } }}
              />
              <Text fontSize="xs" color="fg.muted" mt={1}>This affects the direct HLS .m3u8 path.</Text>
            </Box>

            <Box>
              <Text fontSize="sm" fontWeight="600" color="fg" mb={1.5}>Audio Bitrate (kbps)</Text>
              <HStack gap={2}>
                {[64, 128, 192, 320].map(rate => (
                  <Button 
                    key={rate} flex={1} size="sm" variant={bitrate === rate ? "solid" : "outline"}
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
                <Box>
                  <Text fontSize="sm" fontWeight="600" color="fg">Primary Default</Text>
                  <Text fontSize="xs" color="fg.muted">Use this stream as the master broadcast output.</Text>
                </Box>
                <Button 
                  size="sm" variant={isDefault ? "solid" : "outline"}
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

        <Flex p={6} borderTop="1px solid" borderColor="border" justify="space-between" bg="gray.50" _dark={{ bg: "whiteAlpha.50" }}>
          <Button 
            variant="ghost" 
            color="red.500" _dark={{ color: "red.400" }}
            _hover={{ bg: "red.50", _dark: { bg: "red.900/40" } }} 
            onClick={handleDelete} disabled={isDeleting || mount.is_default}
          >
            {isDeleting ? <Spinner size="sm" mr={2} /> : <Icon as={Trash2} boxSize={4} mr={2} />}
            Delete
          </Button>
          
          <HStack gap={3}>
            <Button 
              variant="outline" onClick={onClose} 
              bg="bg" color="fg" borderColor="border"
              _hover={{ bg: "gray.100", _dark: { bg: "whiteAlpha.100" } }}
            >
              Cancel
            </Button>
            <Button 
              bg="blue.600" color="white" _dark={{ bg: "blue.500" }}
              _hover={{ bg: "blue.700", _dark: { bg: "blue.400" } }} 
              onClick={handleSave} disabled={isSaving}
            >
              {isSaving ? <Spinner size="sm" mr={2} color="white" /> : <Icon as={Save} boxSize={4} mr={2} />}
              Save Changes
            </Button>
          </HStack>
        </Flex>
      </Box>
    </>
  );
};