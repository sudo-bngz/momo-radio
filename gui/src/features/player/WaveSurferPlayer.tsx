import React, { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Box } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

// 1. Define the fade-in animation
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

interface WaveSurferPlayerProps {
  // We allow null here because refs start as null before mounting
  audioRef: React.RefObject<HTMLAudioElement | null>; 
  trackId: number | string;
  isPlaying: boolean;
  color?: string;        // Color of the unplayed part (e.g., Gray)
  progressColor?: string; // Color of the played part (e.g., Blue)
}

export const WaveSurferPlayer = ({ 
  audioRef, 
  trackId, 
  color = "#E2E8F0",       // Default: Chakra gray.200
  progressColor = "#3182CE" // Default: Chakra blue.500
}: WaveSurferPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    // Safety check: Don't run if the DOM nodes aren't ready
    if (!containerRef.current || !audioRef.current) return;

    // 2. Initialize WaveSurfer with "Pro" settings
    wavesurferRef.current = WaveSurfer.create({
      container: containerRef.current,
      media: audioRef.current, // 👈 Connects directly to your <audio> tag
      
      // Colors
      waveColor: color,
      progressColor: progressColor,
      cursorColor: 'transparent', // Hides the vertical line cursor
      
      // 🎨 THE LOOK: Thicker bars, rounded, taller
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      height: 40,        // Matches the container height
      normalize: true,   // Maximizes the height of quiet parts
      barHeight: 0.8,    // Scale factor (0.8 leaves some breathing room at top)
    });

    // Cleanup: Destroy the instance when component unmounts or track changes
    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, [trackId]); // Re-run strictly when the Track ID changes

  // 3. Handle Color Prop Updates (Optional but good for theme switching)
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setOptions({
        waveColor: color,
        progressColor: progressColor,
      });
    }
  }, [color, progressColor]);

  return (
    <Box 
      ref={containerRef} 
      w="100%" 
      h="40px"
      position="relative"
      // Apply the fade-in animation using Chakra's prop
      animation={`${fadeIn} 0.6s ease-in-out forwards`}
      opacity={0} // Start hidden, animate to visible
    />
  );
};