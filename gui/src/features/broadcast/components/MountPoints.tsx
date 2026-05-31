import React, { useState, useEffect } from 'react';
import { 
  Box, Flex, Heading, Text, Table, Badge, Button, Icon, VStack, HStack, Spinner, Center 
} from '@chakra-ui/react';
import { Copy, Check, Plus, Settings, Trash2 } from 'lucide-react';

// ⚡️ FIXED: Import 'api' instead of 'broadcastApi', and updated the path based on your error
import { api } from '../../../services/api'; 
import type { MountPoint} from '../../../services/api'; 

export const MountPoints: React.FC = () => {
  const [mounts, setMounts] = useState<MountPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMounts = async () => {
      try {
        setLoading(true);
        const data = await api.getMountPoints();
        setMounts(data);
      } catch (err) {
        console.error("Failed to load mount points:", err);
        setError("Failed to load transmission configurations.");
      } finally {
        setLoading(false);
      }
    };

    fetchMounts();
  }, []);

  const copyToClipboard = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
      
      {/* Table Header Section */}
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Heading size="sm" fontWeight="bold" color="gray.800" mb={1}>HLS Mount Points</Heading>
          <Text fontSize="xs" color="gray.500">Each profile generates a distinct adaptive live manifest stream for your target public players.</Text>
        </Box>
        <Button size="sm" bg="gray.900" color="white" _hover={{ bg: "black" }}>
          <Icon as={Plus} mr={1} boxSize={3.5} /> Add Mount Point
        </Button>
      </Flex>

      {/* Mount Table */}
      <Box overflowX="auto" border="1px solid" borderColor="gray.50" borderRadius="xl">
        <Table.Root variant="line" size="md">
          <Table.Header bg="gray.50">
            <Table.Row>
              {/* ⚡️ FIXED: Replaced Table.Th with Table.ColumnHeader for Chakra v3 */}
              <Table.ColumnHeader color="gray.600" fontWeight="bold" fontSize="xs">Stream Profile</Table.ColumnHeader>
              <Table.ColumnHeader color="gray.600" fontWeight="bold" fontSize="xs">Target Bitrate</Table.ColumnHeader>
              <Table.ColumnHeader color="gray.600" fontWeight="bold" fontSize="xs">Public HLS Master Endpoint</Table.ColumnHeader>
              <Table.ColumnHeader color="gray.600" fontWeight="bold" fontSize="xs" textAlign="right">Actions</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {mounts.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={4} textAlign="center" py={8} color="gray.400">
                  No mount points configured.
                </Table.Cell>
              </Table.Row>
            ) : (
              mounts.map((mount) => (
                <Table.Row key={mount.id} _hover={{ bg: "gray.50/50" }}>
                  
                  {/* Profile Name & Badge */}
                  <Table.Cell maxW="240px">
                    <VStack align="flex-start" gap={1}>
                      <Text fontSize="sm" fontWeight="semibold" color="gray.800">{mount.name}</Text>
                      <HStack gap={1.5}>
                        <Text fontSize="11px" fontFamily="mono" color="gray.400">/hls/{mount.slug}</Text>
                        {mount.is_default && (
                          <Badge color="blue.600" bg="blue.50" fontSize="10px" px={2} py={0.5} borderRadius="md">
                            Default Output
                          </Badge>
                        )}
                      </HStack>
                    </VStack>
                  </Table.Cell>

                  {/* Bitrate */}
                  <Table.Cell>
                    <Badge color="gray.700" bg="gray.100" fontSize="11px" px={2} py={1} borderRadius="md">
                      {mount.bitrate} kbps
                    </Badge>
                  </Table.Cell>

                  {/* Live URL String */}
                  <Table.Cell maxW="380px">
                    <Text fontSize="xs" fontFamily="mono" color="gray.600" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                      {mount.hls_url}
                    </Text>
                  </Table.Cell>

                  {/* Interactive Action Suite */}
                  <Table.Cell textAlign="right">
                    <HStack gap={2} justify="flex-end">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        borderColor="gray.200"
                        _hover={{ bg: "gray.50" }}
                        onClick={() => copyToClipboard(mount.hls_url, mount.id)}
                        minW="90px"
                      >
                        <Icon as={copiedId === mount.id ? Check : Copy} boxSize={3.5} mr={1.5} color={copiedId === mount.id ? "green.500" : "inherit"} />
                        <Text fontSize="xs" color="gray.700">{copiedId === mount.id ? "Copied" : "Copy URL"}</Text>
                      </Button>
                      <Button size="sm" variant="ghost" color="gray.500" _hover={{ bg: "gray.100", color: "gray.800" }}>
                        <Icon as={Settings} boxSize={4} />
                      </Button>
                      <Button size="sm" variant="ghost" color="red.400" _hover={{ bg: "red.50", color: "red.600" }} disabled={mount.is_default}>
                        <Icon as={Trash2} boxSize={4} />
                      </Button>
                    </HStack>
                  </Table.Cell>

                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table.Root>
      </Box>

    </Box>
  );
};