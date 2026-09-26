import React from 'react';
import { Box, HStack, Text, Table, Badge, Icon, Button, Spinner } from '@chakra-ui/react';
import { Play, Pause, Music, RefreshCw, Share2, Trash2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- Formatting Helpers ---
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
  if (!bpm) return { bg: 'gray.100', color: 'gray.400', _dark: { bg: 'whiteAlpha.100', color: 'whiteAlpha.400' } }; 
  if (bpm < 105) return { bg: 'gray.100', color: 'gray.500', _dark: { bg: 'whiteAlpha.200', color: 'whiteAlpha.600' } }; 
  if (bpm < 120) return { bg: 'gray.200', color: 'gray.700', _dark: { bg: 'whiteAlpha.300', color: 'whiteAlpha.800' } }; 
  if (bpm <= 128) return { bg: 'gray.300', color: 'gray.900', _dark: { bg: 'whiteAlpha.400', color: 'whiteAlpha.900' } }; 
  if (bpm <= 140) return { bg: 'gray.600', color: 'white', _dark: { bg: 'whiteAlpha.600', color: 'white' } }; 
  return { bg: 'gray.900', color: 'white', _dark: { bg: 'white', color: 'gray.900' } }; 
};

// --- Component Interface ---
interface Props {
  track: any;
  tracks: any[];
  currentTrack: any;
  isPlaying: boolean;
  playTrack: (track: any, list: any[]) => void;
  togglePlayPause: () => void;
  setSelectedTrack: (track: any) => void;
  setShareTrack: (track: any) => void;
  handleRetry: (e: React.MouseEvent, id: number | string) => void;
  handleDelete: (e: React.MouseEvent, track: any) => void; 
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
  const safeId = track.id ?? track.ID ?? track.track_id ?? track.key;

  const rawAlbum = track.album as any;
  const albumName = typeof rawAlbum === 'object' ? rawAlbum?.title : rawAlbum;
  const albumId = track.album_id || (typeof rawAlbum === 'object' ? rawAlbum?.id : null);

  const bpmStyle = getBpmStyle(track.bpm ? Math.round(track.bpm) : 0);

  return (
    <Table.Row 
      className="group" 
      bg={isFailed ? "red.50" : (isPending ? "gray.50" : (isThisTrackPlaying ? "blue.50" : "transparent"))}
      _dark={{ bg: isFailed ? "red.900" : (isPending ? "whiteAlpha.50" : (isThisTrackPlaying ? "whiteAlpha.100" : "transparent")) }}
      opacity={isPending ? 0.6 : 1} 
      cursor={isPending ? "not-allowed" : "default"}
      _hover={isPending ? {} : { 
        bg: isFailed ? "red.100" : "gray.50",
        _dark: { bg: isFailed ? "red.800" : "whiteAlpha.50" }
      }}
      onDoubleClick={() => { if (isPlayable) playTrack(track, tracks); }}
    >
      <Table.Cell px={0}>
        {isPending ? (
            <Box w="36px" h="36px" display="flex" alignItems="center" justifyContent="center">
              <Spinner size="sm" color="blue.500" _dark={{ color: "blue.400" }} borderWidth="2px" />
            </Box>
        ) : isFailed ? (
            <Box w="36px" h="36px" display="flex" alignItems="center" justifyContent="center">
              <Icon as={AlertCircle} boxSize={5} color="red.500" _dark={{ color: "red.400" }} />
            </Box>
        ) : (
          <Box 
            w="36px" h="36px" 
            borderRadius="md" display="flex" alignItems="center" justifyContent="center" 
            bg={isThisTrackPlaying ? "blue.500" : "gray.100"} 
            color={isThisTrackPlaying ? "white" : "gray.400"} 
            _dark={{ 
              bg: isThisTrackPlaying ? "blue.500" : "whiteAlpha.200",
              color: isThisTrackPlaying ? "white" : "whiteAlpha.600"
            }}
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
        <Box 
          w="36px" h="36px" borderRadius="md" overflow="hidden" flexShrink={0}
          bg="gray.50" 
          border="1px solid" 
          borderColor={isFailed ? "red.200" : "border"} 
          // ⚡️ FIXED: Merged bg and borderColor into a single _dark object
          _dark={{ 
            bg: "whiteAlpha.100",
            borderColor: isFailed ? "red.800" : "whiteAlpha.200" 
          }}
          display="flex" alignItems="center" justifyContent="center" 
        >
          {track.cover_url ? (
            <img src={track.cover_url} alt={track.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Icon as={Music} color={isFailed ? "red.300" : "fg.muted"} _dark={{ color: isFailed ? "red.500" : "whiteAlpha.400" }} boxSize={4} />
          )}
        </Box>
      </Table.Cell>

      <Table.Cell 
        fontWeight={isThisTrackPlaying ? "bold" : "500"} 
        color={isFailed ? "red.600" : (isPending ? "blue.500" : (isThisTrackPlaying ? "blue.600" : "fg"))} 
        _dark={{ color: isFailed ? "red.400" : (isPending ? "blue.400" : (isThisTrackPlaying ? "blue.300" : "fg")) }}
        fontStyle={isPending ? "italic" : "normal"}
      >
        <HStack gap={2}>
          <Text
            cursor={isPending ? "not-allowed" : "pointer"}
            transition="color 0.2s"
            _hover={isPending ? {} : { 
              textDecoration: "underline", 
              color: isFailed ? "red.700" : "blue.600",
              _dark: { color: isFailed ? "red.300" : "blue.400" }
            }}
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
              <Button size="xs" variant="ghost" borderRadius="full" h="24px" w="24px" p={0} color="red.600" _dark={{ color: "red.400", _hover: { bg: "whiteAlpha.200" } }} onClick={(e) => handleRetry(e, safeId)} _hover={{ bg: "red.200" }} title="Retry Analysis">
                <Icon as={RefreshCw} boxSize={3.5} />
              </Button>
              <Button size="xs" variant="ghost" borderRadius="full" h="24px" w="24px" p={0} color="fg.muted" _dark={{ _hover: { bg: "whiteAlpha.200" } }} onClick={(e) => handleDelete(e, track)} _hover={{ bg: "gray.200" }} title="Delete Track">
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
                    as="span" 
                    color={isFailed ? "red.500" : (isThisTrackPlaying ? "blue.500" : "fg.muted")} 
                    _dark={{ color: isFailed ? "red.400" : (isThisTrackPlaying ? "blue.400" : "fg.muted") }}
                    cursor={isPending ? "not-allowed" : "pointer"}
                    _hover={isPending ? {} : { 
                      textDecoration: "underline", 
                      color: isFailed ? "red.700" : "blue.600",
                      _dark: { color: isFailed ? "red.300" : "blue.300" }
                    }} 
                    onClick={(e) => { 
                      if(!isPending) { e.stopPropagation(); navigate(`/artists/${encodeURIComponent(cleanArtist)}`); } 
                    }}
                  >
                    {cleanArtist}
                  </Text>
                  {index < arr.length - 1 && <Text as="span" color="fg.muted">, </Text>}
                </React.Fragment>
              );
            })
          ) : (
            <Text color="fg.muted">-</Text>
          )}
        </HStack>
      </Table.Cell>

      <Table.Cell>
        {albumName && albumId ? (
          <Text
            color={isFailed ? "red.500" : "fg.muted"}
            _dark={{ color: isFailed ? "red.400" : "fg.muted" }}
            cursor={isPending ? "not-allowed" : "pointer"}
            transition="color 0.2s"
            _hover={isPending ? {} : { 
              textDecoration: "underline", 
              color: isFailed ? "red.700" : "blue.600",
              _dark: { color: isFailed ? "red.300" : "blue.300" }
            }}
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
          <Text color="fg.muted">{albumName || '-'}</Text>
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
              title="Genre"
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
              title="Style"
            >
              {cleanTag.trim()}
            </Badge>
          ))}
          
          {ensureArray(track.genre).length === 0 && ensureArray(track.style).length === 0 && (
            <Badge 
              size="sm" variant="subtle" borderRadius="md" px={2}
              bg={isFailed ? "red.100" : "gray.100"} 
              color={isFailed ? "red.400" : "gray.400"} 
              _dark={{ 
                bg: isFailed ? "red.900" : "whiteAlpha.200", 
                color: isFailed ? "red.300" : "whiteAlpha.600" 
              }}
            >
              -
            </Badge>
          )}
        </HStack>
      </Table.Cell>
      
      <Table.Cell>
        <Badge 
          size="sm" 
          bg={isFailed ? "red.100" : bpmStyle.bg} 
          color={isFailed ? "red.600" : bpmStyle.color} 
          _dark={isFailed ? { bg: "red.900", color: "red.300" } : bpmStyle._dark}
          border="none" borderRadius="md" px={2.5} py={0.5} fontWeight="700"
        >
          {track.bpm ? Math.round(track.bpm) : '-'}
        </Badge>
      </Table.Cell>

      <Table.Cell textAlign="right" color={isFailed ? "red.400" : "fg.muted"}>
        {formatDuration(track.duration)}
      </Table.Cell>

      <Table.Cell px={2}>
        {!isPending && !isFailed && (
          <HStack gap={1} justify="flex-end">
            <Button
              size="xs" variant="ghost" borderRadius="md" color="fg.muted" opacity={0}
              _groupHover={{ opacity: 1, bg: "pink.50", color: "pink.600", _dark: { bg: "pink.900", color: "pink.300" } }} transition="all 0.2s" cursor="pointer"
              onClick={(e) => { e.stopPropagation(); setShareTrack(track); }} title="Share Track"
            >
              <Icon as={Share2} boxSize={4} />
            </Button>
            
            <Button
              size="xs" variant="ghost" borderRadius="md" color="fg.muted" opacity={0}
              _groupHover={{ opacity: 1, bg: "red.50", color: "red.600", _dark: { bg: "red.900", color: "red.300" } }} transition="all 0.2s" cursor="pointer"
              onClick={(e) => handleDelete(e, track)} title="Delete Track"
            >
              <Icon as={Trash2} boxSize={4} />
            </Button>
          </HStack>
        )}
      </Table.Cell>
    </Table.Row>
  );
};