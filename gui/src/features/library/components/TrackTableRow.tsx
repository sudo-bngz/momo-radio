import React from 'react';
import { Box, HStack, Text, Table, Badge, Icon, Button, Spinner } from '@chakra-ui/react';
import { Play, Pause, Music, RefreshCw, Share2, Trash2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Formatting Helpers
const ensureArray = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return val.split(',');
  return [];
};

const formatDuration = (s: number) => {
  if (!s) return '-';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const getColorForGenre = (genre: string) => {
  const colors = ['red', 'orange', 'green', 'teal', 'blue', 'cyan', 'purple', 'pink'];
  let hash = 0;
  for (let i = 0; i < genre.length; i++) hash = genre.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getBpmStyle = (bpm: number) => {
  if (!bpm) return { bg: 'gray.100', color: 'gray.400' }; 
  if (bpm < 105) return { bg: 'gray.100', color: 'gray.500' }; 
  if (bpm < 120) return { bg: 'gray.200', color: 'gray.700' }; 
  if (bpm <= 128) return { bg: 'gray.300', color: 'gray.900' }; 
  if (bpm <= 140) return { bg: 'gray.600', color: 'white' }; 
  return { bg: 'gray.900', color: 'white' }; 
};

interface Props {
  track: any;
  tracks: any[];
  currentTrack: any;
  isPlaying: boolean;
  playTrack: (track: any, list: any[]) => void;
  togglePlayPause: () => void;
  setSelectedTrack: (track: any) => void;
  setShareTrack: (track: any) => void;
  handleRetry: (e: React.MouseEvent, id: number) => void;
  handleDelete: (e: React.MouseEvent, id: number) => void;
  handleAttributeClick: (e: React.MouseEvent, type: 'genre' | 'style', val: string) => void;
}

export const TrackTableRow: React.FC<Props> = ({
  track, tracks, currentTrack, isPlaying, playTrack, togglePlayPause,
  setSelectedTrack, setShareTrack, handleRetry, handleDelete, handleAttributeClick
}) => {
  const navigate = useNavigate();

  const isThisTrackPlaying = currentTrack?.id === track.id;
  const isThisTrackActiveAndPlaying = isThisTrackPlaying && isPlaying;
  
  const isFailed = track.processing_status === 'failed' || track.status === 'failed';
  const isPending = !isFailed && (['pending', 'processing'].includes(track.status || '') || ['pending', 'processing'].includes(track.processing_status || ''));
  const isPlayable = !isPending && !isFailed;

  const rawAlbum = track.album as any;
  const albumName = typeof rawAlbum === 'object' ? rawAlbum?.title : rawAlbum;
  const albumId = track.album_id || (typeof rawAlbum === 'object' ? rawAlbum?.id : null);

  return (
    <Table.Row 
      className="group" 
      bg={isFailed ? "red.50" : (isPending ? "gray.50" : (isThisTrackPlaying ? "blue.50" : "transparent"))}
      opacity={isPending ? 0.6 : 1} 
      cursor={isPending ? "not-allowed" : "default"}
      _hover={isPending ? {} : { bg: isFailed ? "red.100" : "gray.50" }}
      onDoubleClick={() => { if (isPlayable) playTrack(track, tracks); }}
    >
      <Table.Cell px={0}>
        {isPending ? (
            <Box w="36px" h="36px" display="flex" alignItems="center" justifyContent="center">
              <Spinner size="sm" color="blue.500" borderWidth="2px" />
            </Box>
        ) : isFailed ? (
            <Box w="36px" h="36px" display="flex" alignItems="center" justifyContent="center">
              <Icon as={AlertCircle} boxSize={5} color="red.500" />
            </Box>
        ) : (
          <Box 
            w="36px" h="36px" bg={isThisTrackPlaying ? "blue.500" : "gray.100"} 
            borderRadius="md" display="flex" alignItems="center" justifyContent="center" 
            color={isThisTrackPlaying ? "white" : "gray.400"} 
            cursor="pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (isPlayable) isThisTrackPlaying ? togglePlayPause() : playTrack(track, tracks);
            }}
          >
            {isThisTrackActiveAndPlaying ? <Icon as={Pause} boxSize={5} fill="currentColor" /> : <Icon as={Play} boxSize={5} fill="currentColor" ml="2px" />}
          </Box>
        )}
      </Table.Cell>

      <Table.Cell px={2}>
        <Box w="36px" h="36px" borderRadius="md" overflow="hidden" bg="gray.50" border="1px solid" borderColor={isFailed ? "red.200" : "gray.200"} display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
          {track.cover_url ? (
            <img src={track.cover_url} alt={track.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Icon as={Music} color={isFailed ? "red.300" : "gray.300"} boxSize={4} />
          )}
        </Box>
      </Table.Cell>

      <Table.Cell 
        fontWeight={isThisTrackPlaying ? "bold" : "500"} 
        color={isFailed ? "red.600" : (isPending ? "blue.500" : (isThisTrackPlaying ? "blue.600" : "gray.900"))} 
        fontStyle={isPending ? "italic" : "normal"}
      >
        <HStack gap={2}>
          <Text
            cursor={isPending ? "not-allowed" : "pointer"}
            transition="color 0.2s"
            _hover={isPending ? {} : { textDecoration: "underline", color: isFailed ? "red.700" : "blue.600" }}
            onClick={(e) => {
              if (!isPending) {
                e.stopPropagation();
                setSelectedTrack(track); 
              }
            }}
          >
            {track.title}
          </Text>
          {isFailed && (
            <HStack gap={1}>
              <Button size="xs" variant="ghost" borderRadius="full" h="24px" w="24px" p={0} color="red.600" onClick={(e) => handleRetry(e, track.id)} _hover={{ bg: "red.200" }} title="Retry Analysis">
                <Icon as={RefreshCw} boxSize={3.5} />
              </Button>
              <Button size="xs" variant="ghost" borderRadius="full" h="24px" w="24px" p={0} color="gray.500" onClick={(e) => handleDelete(e, track.id)} _hover={{ bg: "gray.200" }} title="Delete Track">
                <Icon as={Trash2} boxSize={3.5} />
              </Button>
            </HStack>
          )}
        </HStack>
      </Table.Cell>
      
      <Table.Cell>
        <HStack gap={1} flexWrap="wrap">
          {track.artist ? (
            ensureArray(track.artist).map((artistName: string, index: number, arr: string[]) => {
              const cleanArtist = artistName.trim();
              return (
                <React.Fragment key={index}>
                  <Text 
                    as="span" color={isFailed ? "red.500" : (isThisTrackPlaying ? "blue.500" : "gray.600")} 
                    cursor={isPending ? "not-allowed" : "pointer"}
                    _hover={isPending ? {} : { textDecoration: "underline", color: isFailed ? "red.700" : "blue.600" }} 
                    onClick={(e) => { 
                      if(!isPending) { e.stopPropagation(); navigate(`/artists/${encodeURIComponent(cleanArtist)}`); } 
                    }}
                  >
                    {cleanArtist}
                  </Text>
                  {index < arr.length - 1 && <Text as="span" color="gray.500">, </Text>}
                </React.Fragment>
              );
            })
          ) : (
            <Text color="gray.500">-</Text>
          )}
        </HStack>
      </Table.Cell>

      <Table.Cell>
        {albumName && albumId ? (
          <Text
            color={isFailed ? "red.500" : "gray.600"}
            cursor={isPending ? "not-allowed" : "pointer"}
            transition="color 0.2s"
            _hover={isPending ? {} : { textDecoration: "underline", color: isFailed ? "red.700" : "blue.600" }}
            onClick={(e) => {
              if (!isPending) {
                e.stopPropagation();
                navigate(`/library/albums/${albumId}`); 
              }
            }}
          >
            {albumName}
          </Text>
        ) : (
          <Text color="gray.500">{albumName || '-'}</Text>
        )}
      </Table.Cell>
      
      <Table.Cell>
        <HStack gap={1} flexWrap="wrap">
          {ensureArray(track.genre).map((cleanTag, index) => (
            <Badge 
              key={`g-${index}`} size="sm" colorPalette={isFailed ? "red" : getColorForGenre(cleanTag)} variant="subtle" borderRadius="md" px={2} 
              cursor={isPending ? "not-allowed" : "pointer"}
              _hover={isPending ? {} : { opacity: 0.8, transform: "scale(1.05)" }}
              onClick={(e) => { 
                if (!isPending) handleAttributeClick(e, 'genre', cleanTag.trim()); 
              }}
            >
              {cleanTag.trim()}
            </Badge>
          ))}
          
          {ensureArray(track.style).map((cleanTag, index) => (
            <Badge 
              key={`s-${index}`} size="sm" colorPalette={isFailed ? "red" : getColorForGenre(cleanTag)} variant="outline" borderRadius="md" px={2} 
              cursor={isPending ? "not-allowed" : "pointer"}
              _hover={isPending ? {} : { opacity: 0.8, transform: "scale(1.05)" }}
              onClick={(e) => { 
                if (!isPending) handleAttributeClick(e, 'style', cleanTag.trim()); 
              }}
            >
              {cleanTag.trim()}
            </Badge>
          ))}
          
          {ensureArray(track.genre).length === 0 && ensureArray(track.style).length === 0 && (
            <Badge size="sm" bg={isFailed ? "red.100" : "gray.100"} color={isFailed ? "red.400" : "gray.400"} variant="subtle" borderRadius="md" px={2}>-</Badge>
          )}
        </HStack>
      </Table.Cell>
      
      <Table.Cell>
        <Badge size="sm" bg={isFailed ? "red.100" : getBpmStyle(track.bpm ? Math.round(track.bpm) : 0).bg} color={isFailed ? "red.600" : getBpmStyle(track.bpm ? Math.round(track.bpm) : 0).color} border="none" borderRadius="md" px={2.5} py={0.5} fontWeight="700">
          {track.bpm ? Math.round(track.bpm) : '-'}
        </Badge>
      </Table.Cell>

      <Table.Cell textAlign="right" color={isFailed ? "red.400" : "gray.500"}>{formatDuration(track.duration)}</Table.Cell>

      <Table.Cell px={2}>
        {!isPending && !isFailed && (
          <Button
            size="xs" variant="ghost" borderRadius="md" color="gray.400" opacity={0}
            _groupHover={{ opacity: 1, bg: "pink.50", color: "pink.600" }} transition="all 0.2s" cursor="pointer"
            onClick={(e) => { e.stopPropagation(); setShareTrack(track); }} title="Share Track"
          >
            <Icon as={Share2} boxSize={4} />
          </Button>
        )}
      </Table.Cell>
    </Table.Row>
  );
};
