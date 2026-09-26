import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Spinner,
  Table,
  Badge,
  Icon,
  Button,
} from '@chakra-ui/react';
import { Share2, Music, Copy, Trash2, ExternalLink } from 'lucide-react';
import { api, CDN_BASE_URL, type ShareItem } from '../../../services/api';
import { toaster } from '../../../components/ui/toaster';

const buildCdnUrl = (key?: string) => {
  if (!key) return '';
  if (key.startsWith('http')) return key;
  const base = CDN_BASE_URL.startsWith('http') ? CDN_BASE_URL : `https://${CDN_BASE_URL}`;
  return `${base}/${key.replace(/^\//, '')}`;
};

export const SharedListView: React.FC = () => {
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchShares = async () => {
    try {
      setIsLoading(true);
      const data = await api.getShares();
      setShares(data);
    } catch (err) {
      console.error('Failed to load shared links', err);
      toaster.create({ title: 'Failed to load shared tracks', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
  }, []);

  const handleCopyLink = (token: string) => {
    const shareUrl = `${window.location.origin}/s/${token}`;
    navigator.clipboard.writeText(shareUrl);
    toaster.create({
      title: 'Link Copied',
      description: 'Public share URL copied to clipboard.',
      type: 'success',
      duration: 3000,
    });
  };

  const handleDeleteShare = async (id: number) => {
    try {
      await api.deleteShare(id);
      setShares((prev) => prev.filter((s) => s.id !== id));
      toaster.create({ title: 'Share link revoked', type: 'info' });
    } catch (err) {
      toaster.create({ title: 'Failed to revoke link', type: 'error' });
    }
  };

  return (
    // ⚡️ Removed bg="white" and data-theme="light" to inherit layout's active theme natively
    <VStack align="stretch" h="100%" gap={8} bg="transparent">
      
      {/* 1. Header & Breadcrumb (Matches LibraryView) */}
      <VStack align="start" gap={1}>
        <HStack gap={2} fontSize="sm" color="fg.muted" mb={1}>
          <Box 
            w="24px" h="24px" bg="pink.500" _dark={{ bg: "pink.400" }} color="white" 
            borderRadius="md" display="flex" alignItems="center" justifyContent="center"
          >
            <Icon as={Share2} boxSize={3} strokeWidth={3} />
          </Box>
          <Text color="fg" fontWeight="500">Shared</Text>
        </HStack>
        <Heading size="3xl" fontWeight="normal" color="fg" letterSpacing="tight">
          Shared Links
        </Heading>
      </VStack>

      {/* 2. Content Area */}
      <Box flex="1" overflow="hidden" display="flex" flexDirection="column">
        <Box flex="1" overflowY="auto" css={{
          '&::-webkit-scrollbar': { width: '8px' },
          '&::-webkit-scrollbar-thumb': { background: 'var(--chakra-colors-border)', borderRadius: '4px' },
        }}>
          {isLoading ? (
            <VStack justify="center" h="100%">
              <Spinner size="xl" color="pink.500" _dark={{ color: "pink.400" }} />
            </VStack>
          ) : shares.length === 0 ? (
            <VStack justify="center" h="100%" gap={3} color="fg.muted" py={12}>
              <Icon as={Share2} boxSize={10} />
              <Text fontSize="lg" fontWeight="500" color="fg">No shared tracks yet</Text>
              <Text fontSize="sm">Share a track from your library drawer to see it here.</Text>
            </VStack>
          ) : (
            <Table.Root
              css={{
                '& th': {
                  borderBottom: '1px solid var(--chakra-colors-border)',
                  py: 4,
                  fontWeight: '500',
                  color: 'var(--chakra-colors-fg-muted)',
                },
                '& td': {
                  py: 3,
                  borderBottom: '1px solid var(--chakra-colors-border)',
                  color: 'var(--chakra-colors-fg)',
                },
              }}
            >
              <Table.Header position="sticky" top={0} bg="bg" zIndex={1}>
                <Table.Row>
                  <Table.ColumnHeader w="64px">Artwork</Table.ColumnHeader>
                  <Table.ColumnHeader>Name ({shares.length})</Table.ColumnHeader>
                  <Table.ColumnHeader>Artist</Table.ColumnHeader>
                  <Table.ColumnHeader>Plays</Table.ColumnHeader>
                  <Table.ColumnHeader>Downloads</Table.ColumnHeader>
                  <Table.ColumnHeader>Expires</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">Actions</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>

              <Table.Body>
                {shares.map((share) => {
                  const track = share.track;
                  const coverUrl = track?.album?.cover_key ? buildCdnUrl(track.album.cover_key) : '';
                  const artistName = track?.artists?.map((a) => a.name).join(', ') || 'Unknown Artist';
                  const isExpired = share.expires_at ? new Date(share.expires_at) < new Date() : false;

                  return (
                    <Table.Row key={share.id} className="group" _hover={{ bg: 'gray.50', _dark: { bg: 'whiteAlpha.50' } }}>
                      {/* Artwork */}
                      <Table.Cell px={2}>
                        <Box
                          w="36px"
                          h="36px"
                          borderRadius="md"
                          overflow="hidden"
                          bg="gray.50"
                          _dark={{ bg: "whiteAlpha.100" }}
                          border="1px solid"
                          borderColor="border"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          flexShrink={0}
                        >
                          {coverUrl ? (
                            <img src={coverUrl} alt={track?.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Icon as={Music} color="var(--chakra-colors-fg-muted)" boxSize={4} />
                          )}
                        </Box>
                      </Table.Cell>

                      {/* Track Title */}
                      <Table.Cell fontWeight="500" color="fg">
                        <HStack gap={2}>
                          <Text>{track?.title || 'Unknown Track'}</Text>
                          {share.allow_download && (
                            <Badge size="sm" colorPalette="teal" variant="subtle" borderRadius="md" px={2}>
                              Downloadable
                            </Badge>
                          )}
                        </HStack>
                      </Table.Cell>

                      {/* Artist */}
                      <Table.Cell color="fg.muted">{artistName}</Table.Cell>

                      {/* Play Count */}
                      <Table.Cell color="fg.muted">{share.play_count}</Table.Cell>

                      {/* Download Count */}
                      <Table.Cell color="fg.muted">{share.allow_download ? share.download_count : '-'}</Table.Cell>

                      {/* Expiration */}
                      <Table.Cell>
                        {share.expires_at ? (
                          <Badge size="sm" colorPalette={isExpired ? 'red' : 'gray'} variant="subtle" borderRadius="md" px={2}>
                            {isExpired ? 'Expired' : new Date(share.expires_at).toLocaleDateString()}
                          </Badge>
                        ) : (
                          <Text fontSize="sm" color="fg.muted">Never</Text>
                        )}
                      </Table.Cell>

                      {/* Actions */}
                      <Table.Cell textAlign="right">
                        <HStack justify="flex-end" gap={1}>
                          <Button
                            size="xs"
                            variant="ghost"
                            color="fg.muted"
                            borderRadius="md"
                            _hover={{ bg: "gray.100", color: "fg", _dark: { bg: "whiteAlpha.200" } }}
                            onClick={() => handleCopyLink(share.token)}
                            title="Copy Share Link"
                          >
                            <Icon as={Copy} boxSize={3.5} mr={1} />
                            Copy
                          </Button>

                          <Button
                            size="xs"
                            variant="ghost"
                            color="fg.muted"
                            borderRadius="md"
                            _hover={{ bg: "gray.100", color: "fg", _dark: { bg: "whiteAlpha.200" } }}
                            onClick={() => window.open(`/s/${share.token}`, '_blank')}
                            title="Open Public Page"
                          >
                            <Icon as={ExternalLink} boxSize={3.5} />
                          </Button>

                          <Button
                            size="xs"
                            variant="ghost"
                            color="red.500"
                            _dark={{ color: "red.400" }}
                            borderRadius="md"
                            _hover={{ bg: "red.50", _dark: { bg: "whiteAlpha.200" } }}
                            onClick={() => handleDeleteShare(share.id)}
                            title="Revoke Share Link"
                          >
                            <Icon as={Trash2} boxSize={3.5} />
                          </Button>
                        </HStack>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          )}
        </Box>
      </Box>
    </VStack>
  );
};