import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Flex, Heading, Text, Table, Badge, Button, Icon, HStack, Spinner, Center 
} from '@chakra-ui/react';
import { Copy, Check, Plus, Settings, Trash2, Play, Square } from 'lucide-react';

import { api } from '../../../services/api'; 
import type { MountPoint } from '../../../services/api'; 
import { StreamSettingsPanel } from './StreamSettingsView';
import { useBroadcastStore } from '../../../store/useBroadcast'; // ⚡️ IMPORT STORE

export const MountPoints: React.FC = () => {
  const [mounts, setMounts] = useState<MountPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI States
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editingMount, setEditingMount] = useState<MountPoint | null>(null);
  
  // ⚡️ USE GLOBAL STATE INSTEAD OF LOCAL STATE
  const isLive = useBroadcastStore((state) => state.isLive);
  const setLive = useBroadcastStore((state) => state.setLive);
  
  const [isToggling, setIsToggling] = useState(false);
  
  // Modal State
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  // Hidden audio element for pre-listening
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchMountsAndState = async () => {
    try {
      setLoading(true);
      const [mountsData, stateData] = await Promise.all([
        api.getMountPoints(),
        api.getBroadcastState() 
      ]);
      
      setMounts(mountsData);
      setLive(stateData.state === 'online'); // ⚡️ Update global store

    } catch (err) {
      console.error("Failed to load stream data:", err);
      setError("Failed to load transmission configurations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMountsAndState();
  }, []);

  const copyToClipboard = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleBroadcastToggle = async () => {
    try {
      setIsToggling(true);
      const action = isLive ? 'stop' : 'start';
      const response = await api.toggleBroadcast(action);
      
      setLive(response.state === 'online'); // ⚡️ Instantly syncs global store and TopNav
      
      if (isLive && playingId) {
        handlePlayStop(playingId, ""); 
      }
    } catch (error) {
      console.error("Failed to toggle broadcast state:", error);
    } finally {
      setIsToggling(false);
    }
  };

  const handlePlayStop = (id: string, url: string) => {
    if (!audioRef.current) return;

    if (playingId === id) {
      audioRef.current.pause();
      audioRef.current.src = "";
      setPlayingId(null);
    } else {
      audioRef.current.src = url;
      audioRef.current.play().catch(e => console.warn("Browser blocked autoplay or format unsupported:", e));
      setPlayingId(id);
    }
  };

  if (loading) {
    return (
      <Center h="300px" bg="white" borderRadius="2xl" border="1px solid" borderColor="gray.100" shadow="sm">
        <Spinner size="xl" color="gray.400" />
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="300px" bg="white" borderRadius="2xl" border="1px solid" borderColor="red.100" shadow="sm">
        <Text color="red.500" fontWeight="500">{error}</Text>
      </Center>
    );
  }

  return (
    <Box w="100%" bg="white" p={6} borderRadius="2xl" border="1px solid" borderColor="gray.100" shadow="sm">
      <style>
        {`
          @keyframes pulseRed {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.85); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}
      </style>

      <audio ref={audioRef} style={{ display: 'none' }} />

      {showStopConfirm && (
        <Box position="fixed" top={0} left={0} right={0} bottom={0} zIndex={9999} display="flex" alignItems="center" justifyContent="center" bg="blackAlpha.400" backdropFilter="blur(2px)">
          <Box bg="white" p={6} borderRadius="2xl" shadow="2xl" maxW="400px" w="90%" border="1px solid" borderColor="gray.100">
            <Heading size="md" color="gray.900" mb={3}>Stop Broadcast?</Heading>
            <Text color="gray.600" fontSize="sm" mb={6}>
              This will immediately disconnect your live transmission. Listeners will hear silence until the fallback sequence resumes.
            </Text>
            <HStack justify="flex-end" gap={3}>
              <Button variant="ghost" onClick={() => setShowStopConfirm(false)} size="sm">
                Cancel
              </Button>
              <Button 
                bg="red.500" color="white" _hover={{ bg: "red.600" }} size="sm" 
                onClick={() => {
                  setShowStopConfirm(false);
                  handleBroadcastToggle();
                }}
              >
                Yes, Stop Broadcast
              </Button>
            </HStack>
          </Box>
        </Box>
      )}

      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Heading size="sm" fontWeight="bold" color="gray.800" mb={1}>Audio Streams</Heading>
          <Text fontSize="xs" color="gray.500">Manage your transmission endpoints and control the live broadcast engine.</Text>
        </Box>
        <Button size="sm" bg="gray.900" color="white" _hover={{ bg: "black" }}>
          <Icon as={Plus} mr={1} boxSize={3.5} /> Add Stream
        </Button>
      </Flex>

      <Box overflowX="auto" border="1px solid" borderColor="gray.50" borderRadius="xl">
        <Table.Root variant="line" size="md">
          <Table.Header bg="gray.50">
            <Table.Row>
              <Table.ColumnHeader color="gray.600" fontWeight="bold" fontSize="xs">Stream Name</Table.ColumnHeader>
              <Table.ColumnHeader color="gray.600" fontWeight="bold" fontSize="xs">Quality</Table.ColumnHeader>
              <Table.ColumnHeader color="gray.600" fontWeight="bold" fontSize="xs">Status</Table.ColumnHeader>
              <Table.ColumnHeader color="gray.600" fontWeight="bold" fontSize="xs">Direct URL</Table.ColumnHeader>
              <Table.ColumnHeader color="gray.600" fontWeight="bold" fontSize="xs" textAlign="right">Controls & Actions</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {mounts.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={5} textAlign="center" py={8} color="gray.400">
                  No streams configured.
                </Table.Cell>
              </Table.Row>
            ) : (
              mounts.map((mount) => {
                const isRowLive = isLive && mount.is_default;

                return (
                  <Table.Row 
                    key={mount.id} 
                    bg={isRowLive ? "red.50/40" : "transparent"} 
                    _hover={{ bg: isRowLive ? "red.50/80" : "gray.50/50" }}
                    transition="background 0.2s"
                  >
                    <Table.Cell maxW="280px">
                      <HStack gap={3}>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          color={playingId === mount.id ? "red.600" : "gray.400"}
                          bg={playingId === mount.id ? "red.50" : "transparent"}
                          _hover={isRowLive ? { bg: playingId === mount.id ? "red.100" : "gray.100", color: "red.500" } : {}}
                          onClick={() => handlePlayStop(mount.id, mount.hls_url)}
                          borderRadius="full"
                          w="32px" h="32px" p={0}
                          disabled={!isRowLive}
                          cursor={isRowLive ? "pointer" : "not-allowed"}
                          opacity={isRowLive ? 1 : 0.5}
                        >
                          <Icon as={playingId === mount.id ? Square : Play} boxSize={4} fill={playingId === mount.id ? "currentColor" : "none"} />
                        </Button>

                        <HStack gap={2}>
                          <Text fontSize="sm" fontFamily="mono" fontWeight="600" color="gray.800">{mount.slug}</Text>
                          {mount.is_default && (
                            <Badge color="blue.600" bg="blue.50" fontSize="10px" px={2} py={0.5} borderRadius="md">
                              Default
                            </Badge>
                          )}
                        </HStack>
                      </HStack>
                    </Table.Cell>

                    <Table.Cell>
                      <Badge color="gray.700" bg="gray.100" fontSize="11px" px={2} py={1} borderRadius="md">
                        {mount.bitrate} kbps
                      </Badge>
                    </Table.Cell>

                    <Table.Cell>
                      {mount.is_default ? (
                        <HStack gap={2}>
                          <Box 
                            w="8px" h="8px" 
                            borderRadius="full" 
                            bg={isLive ? "red.500" : "gray.300"} 
                            boxShadow={isLive ? "0 0 8px rgba(229, 62, 62, 0.6)" : "none"}
                            animation={isLive ? "pulseRed 2s ease-in-out infinite" : "none"}
                          />
                          <Text fontSize="xs" fontWeight="700" letterSpacing="wide" color={isLive ? "red.500" : "gray.500"}>
                            {isLive ? "LIVE" : "STANDBY"}
                          </Text>
                        </HStack>
                      ) : (
                        <Text fontSize="xs" color="gray.400">-</Text>
                      )}
                    </Table.Cell>

                    <Table.Cell maxW="320px">
                      <Text fontSize="xs" fontFamily="mono" color="gray.600" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                        {mount.hls_url}
                      </Text>
                    </Table.Cell>

                    <Table.Cell textAlign="right">
                      <HStack gap={2} justify="flex-end" align="center">
                        {mount.is_default && (
                          <>
                            <Button
                              size="sm"
                              bg={isLive ? "red.50" : "gray.900"}
                              color={isLive ? "red.600" : "white"}
                              border={isLive ? "1px solid" : "none"}
                              borderColor="red.200"
                              _hover={isLive ? { bg: "red.100" } : { bg: "black" }}
                              onClick={() => isLive ? setShowStopConfirm(true) : handleBroadcastToggle()}
                              disabled={isToggling}
                              minW="70px"
                            >
                              {isToggling ? <Spinner size="xs" mr={2} /> : null}
                              {isLive ? "Stop" : "Start"}
                            </Button>
                            <Box w="1px" h="16px" bg="gray.200" mx={1} />
                          </>
                        )}

                        <Button size="sm" variant="ghost" color="gray.500" _hover={{ bg: "gray.100", color: "gray.800" }} onClick={() => copyToClipboard(mount.hls_url, mount.id)}>
                          <Icon as={copiedId === mount.id ? Check : Copy} boxSize={4} color={copiedId === mount.id ? "green.500" : "inherit"} />
                        </Button>
                        <Button 
                          size="sm" variant="ghost" color="gray.500" 
                          _hover={{ bg: "gray.100", color: "gray.800" }} 
                          onClick={() => setEditingMount(mount)} 
                        >
                          <Icon as={Settings} boxSize={4} />
                        </Button>
                        <Button 
                          size="sm" variant="ghost" color="red.400" 
                          _hover={{ bg: "red.50", color: "red.600" }} 
                          disabled={mount.is_default}
                          onClick={() => setEditingMount(mount)} 
                        >
                          <Icon as={Trash2} boxSize={4} />
                        </Button>
                      </HStack>
                    </Table.Cell>

                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table.Root>
      </Box>

      <StreamSettingsPanel 
        isOpen={!!editingMount}
        mount={editingMount}
        onClose={() => setEditingMount(null)}
        onUpdateSuccess={() => {
          setEditingMount(null);
          fetchMountsAndState(); 
        }}
      />
    </Box>
  );
};