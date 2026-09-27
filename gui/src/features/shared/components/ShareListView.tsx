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
    <VStack align="stretch" h="100%" gap={8} bg="transparent">
      
      {/* 1. Header & Breadcrumb */}
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
              {/* ⚡️ HIDDEN ON MOBILE: Same breakpoint strategy as the TrackLibrary */}
              <Table.Header position="sticky" top={0} bg="bg" zIndex={1} display={{ base: "none", md: "table-header-group" }}>
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
                      <Table.Cell px={{ base: 0, md: 2 }}>
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

                      {/* Track Title + Mobile Artist Stack */}
                      <Table.Cell fontWeight="500" color="fg">
                        <VStack align="start" gap={0} ml={{ base: 2, md: 0 }}>
                          <HStack gap={2}>
                            <Text lineClamp={1}>{track?.title || 'Unknown Track'}</Text>
                            {share.allow_download && (
                              <Badge size="xs" colorPalette="teal" variant="subtle" borderRadius="md" px={2} display={{ base: "none", sm: "inline-flex" }}>
                                Downloadable
                              </Badge>
                            )}
                          </HStack>
                          
                          {/* ⚡️ ONLY ON MOBILE: Show artist directly under the title */}
                          <Box display={{ base: "block", md: "none" }} mt={0.5}>
                            <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                              {artistName}
                              {/* ⚡️ Inject compact expiration logic here on mobile so they don't lose the info */}
                              {share.expires_at && (
                                <Text as="span" color={isExpired ? 'red.500' : 'inherit'}>
                                  {' • '}{isExpired ? 'Expired' : new Date(share.expires_at).toLocaleDateString()}
                                </Text>
                              )}
                            </Text>
                          </Box>
                        </VStack>
                      </Table.Cell>

                      {/* ⚡️ HIDDEN ON MOBILE: Desktop standard columns */}
                      <Table.Cell display={{ base: "none", md: "table-cell" }} color="fg.muted">
                        <Text lineClamp={1}>{artistName}</Text>
                      </Table.Cell>

                      <Table.Cell display={{ base: "none", md: "table-cell" }} color="fg.muted">{share.play_count}</Table.Cell>

                      <Table.Cell display={{ base: "none", md: "table-cell" }} color="fg.muted">{share.allow_download ? share.download_count : '-'}</Table.Cell>

                      <Table.Cell display={{ base: "none", md: "table-cell" }}>
                        {share.expires_at ? (
                          <Badge size="sm" colorPalette={isExpired ? 'red' : 'gray'} variant="subtle" borderRadius="md" px={2}>
                            {isExpired ? 'Expired' : new Date(share.expires_at).toLocaleDateString()}
                          </Badge>
                        ) : (
                          <Text fontSize="sm" color="fg.muted">Never</Text>
                        )}
                      </Table.Cell>

                      {/* Actions */}
                      <Table.Cell textAlign="right" px={{ base: 0, md: 2 }}>
                        <HStack justify="flex-end" gap={1}>
                          <Button
                            size="sm" // ⚡️ Slightly larger hit targets for mobile
                            variant="ghost"
                            color="fg.muted"
                            borderRadius="md"
                            _hover={{ bg: "gray.100", color: "fg", _dark: { bg: "whiteAlpha.200" } }}
                            onClick={() => handleCopyLink(share.token)}
                            title="Copy Share Link"
                            px={{ base: 2, md: 3 }}
                          >
                            <Icon as={Copy} boxSize={{ base: 4, md: 3.5 }} mr={{ base: 0, md: 1 }} />
                            <Box display={{ base: "none", md: "block" }}>Copy</Box>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            color="fg.muted"
                            borderRadius="md"
                            _hover={{ bg: "gray.100", color: "fg", _dark: { bg: "whiteAlpha.200" } }}
                            onClick={() => window.open(`/s/${share.token}`, '_blank')}
                            title="Open Public Page"
                            px={2}
                          >
                            <Icon as={ExternalLink} boxSize={{ base: 4, md: 3.5 }} />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            color="red.500"
                            _dark={{ color: "red.400" }}
                            borderRadius="md"
                            _hover={{ bg: "red.50", _dark: { bg: "whiteAlpha.200" } }}
                            onClick={() => handleDeleteShare(share.id)}
                            title="Revoke Share Link"
                            px={2}
                          >
                            <Icon as={Trash2} boxSize={{ base: 4, md: 3.5 }} />
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