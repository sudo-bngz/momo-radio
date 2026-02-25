import{ useMemo } from 'react';
import { Flex, Box } from '@chakra-ui/react';

interface WaveformProps {
  trackId: string | number; // Used to seed the random shape so it looks the same every time for the same track
  progress: number;         // 0 to 100
  onSeek: (percentage: number) => void;
}

export const Waveform = ({ trackId, progress, onSeek }: WaveformProps) => {
  // Generate a consistent "fake" waveform based on the track ID
  // In the future, you can replace this with real data from your backend!
  const bars = useMemo(() => {
    const seed = trackId.toString().length; 
    return Array.from({ length: 60 }).map((_, i) => {
      // Math.sin creates a "wave" pattern, Math.random adds noise
      const base = Math.sin(i * 0.2 + seed) * 0.5 + 0.5; 
      return Math.max(0.2, base * Math.random()); // Ensure min height of 20%
    });
  }, [trackId]);

  return (
    <Flex 
      align="center" 
      h="32px" 
      flex="1" 
      gap="2px" 
      cursor="pointer"
      onClick={(e) => {
        // Calculate seek percentage based on click position
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clickedProgress = (x / rect.width) * 100;
        onSeek(clickedProgress);
      }}
      role="group"
    >
      {bars.map((height, index) => {
        // Determine if this specific bar is "played" or "unplayed"
        const barPosition = (index / bars.length) * 100;
        const isPlayed = barPosition < progress;

        return (
          <Box
            key={index}
            w="100%"
            h={`${height * 100}%`} // Height based on data
            bg={isPlayed ? "blue.500" : "gray.300"} // Color change
            borderRadius="full"
            transition="all 0.1s ease"
            _groupHover={{ bg: isPlayed ? "blue.600" : "gray.400" }} // Hover effect
          />
        );
      })}
    </Flex>
  );
};