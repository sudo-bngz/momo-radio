import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Box } from '@chakra-ui/react';

interface WaveSurferPlayerProps {
  trackId: number;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  waveformUrl?: string; 
  orgId: string; 
}

export const WaveSurferPlayer = ({ 
  audioRef, 
  waveformUrl, 
  orgId 
}: WaveSurferPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    // 1. Guard check to ensure the DOM and Audio element exist
    if (!containerRef.current || !audioRef.current) return;

    // 2. React Cleanup Flag to prevent state updates on unmounted components
    let isMounted = true;

    // 3. Create Canvas Gradients for the "Rekordbox" aesthetic
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    let waveColor: string | CanvasGradient = '#A0AEC0';
    let progressColor: string | CanvasGradient = '#3182CE';

    if (ctx) {
      // The "unplayed" wave (Darker, sleek)
      const waveGradient = ctx.createLinearGradient(0, 0, 0, 40); 
      waveGradient.addColorStop(0, '#4A5568'); // Top color (gray.600)
      waveGradient.addColorStop(1, '#A0AEC0'); // Bottom color (gray.400)
      waveColor = waveGradient;

      // The "played" wave (Bright, glowing blue Rekordbox style)
      const progGradient = ctx.createLinearGradient(0, 0, 0, 40);
      progGradient.addColorStop(0, '#63B3ED'); // Top color (blue.300)
      progGradient.addColorStop(0.5, '#3182CE'); // Mid color (blue.500)
      progGradient.addColorStop(1, '#2B6CB0'); // Bottom color (blue.600)
      progressColor = progGradient;
    }

    // 4. Initialize Wavesurfer
    wavesurfer.current = WaveSurfer.create({
      container: containerRef.current,
      media: audioRef.current, 
      waveColor: waveColor,    
      progressColor: progressColor,
      cursorColor: '#E2E8F0', // Thin white cursor
      cursorWidth: 1,
      height: 40,
      normalize: true,         
    });

    // 5. Fetch and Load the Pre-calculated JSON Peaks
    const loadWaveform = async () => {
      const audioUrl = audioRef.current?.src;
      if (!audioUrl) return;

      // 2. Check for the full URL instead of the key
      if (waveformUrl) {
        try {
          // 3. Fetch directly from the provided URL
          const response = await fetch(waveformUrl, {
            headers: {
              'X-Organization-Id': orgId
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const bbcData = await response.json();

          if (!isMounted) return;

          // CONVERT BBC 8-bit INT to WAVESURFER FLOATS (-1.0 to 1.0)
          const maxPeak = bbcData.data.reduce(
            (max: number, val: number) => Math.max(max, Math.abs(val)), 
            0
          ) || 128;
          
          const normalizedPeaks = bbcData.data.map((val: number) => val / maxPeak);

          try {
            await wavesurfer.current?.load(audioUrl, [normalizedPeaks]);
          } catch (e: any) {
            if (e.name !== 'AbortError') console.error("Wavesurfer load error:", e);
          }

        } catch (error) {
          if (!isMounted) return;
          console.error("Failed to load pre-calculated waveform:", error);
          
          // Fallback native calculation
          try {
            await wavesurfer.current?.load(audioUrl);
          } catch (e: any) {
            if (e.name !== 'AbortError') console.error("Wavesurfer fallback error:", e);
          }
        }
      } else {
        // No waveform URL? Let wavesurfer calculate it natively
        if (!isMounted) return;
        try {
          await wavesurfer.current?.load(audioUrl);
        } catch (e: any) {
          if (e.name !== 'AbortError') console.error("Wavesurfer load error:", e);
        }
      }
    };

    loadWaveform();

    // 6. Cleanup on unmount
    return () => {
      isMounted = false;
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
      }
    };
  }, [audioRef, waveformUrl, orgId]); // Updated dependency array

  return (
    <Box 
      ref={containerRef} 
      w="100%" 
      h="100%" 
      onClick={(e) => e.stopPropagation()} 
    />
  );
};