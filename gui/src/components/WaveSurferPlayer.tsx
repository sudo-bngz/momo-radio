import React, { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Box } from '@chakra-ui/react';
import { keyframes } from '@emotion/react'; // or '@chakra-ui/react' depending on version

// Define keyframes outside component for better performance
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

interface WaveSurferPlayerProps {
  // FIX 2: Allow 'null' in the Ref type
  audioRef: React.RefObject<HTMLAudioElement | null>; 
  trackId: string | number;
  isPlaying: boolean;
  color?: string;
  progressColor?: string;
}

export const WaveSurferPlayer = ({ 
  audioRef, 
  trackId, 
  isPlaying,
  color = "#E2E8F0",
  progressColor = "#3182CE"
}: WaveSurferPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    // Safety check: Ensure both refs exist before running
    if (!containerRef.current || !audioRef.current) return;

    wavesurferRef.current = WaveSurfer.create({
      container: containerRef.current,
      media: audioRef.current, // Now this is safe
      waveColor: color,
      progressColor: progressColor,
      cursorColor: 'transparent',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 48,
      normalize: true,
    });

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, [trackId]); // Re-run when track changes

  return (
    <Box 
      ref={containerRef} 
      w="100%" 
      h="48px"
      position="relative"
      animation={`${fadeIn} 0.5s forwards`}
      opacity={0} // Start hidden
    />
  );
};