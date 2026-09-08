import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Box } from '@chakra-ui/react';

interface WaveSurferPlayerProps {
  trackId: number | string; // ⚡️ Updated to accept string for live track IDs
  audioRef?: React.RefObject<HTMLAudioElement | null> | null; // ⚡️ Made optional for live broadcasts
  isPlaying: boolean;
  waveformUrl?: string; 
  waveformKey?: string;
  orgId: string; 
  liveProgress?: number; // ⚡️ New prop to manually drive the playhead
}

export const WaveSurferPlayer = ({ 
  audioRef, 
  waveformUrl, 
  waveformKey,
  orgId,
  liveProgress
}: WaveSurferPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const targetWaveformUrl = waveformUrl || waveformKey;

  const isLiveMode = liveProgress !== undefined;

  useEffect(() => {
    // 1. Guard check (We only strictly need the container now, audioRef is optional!)
    if (!containerRef.current) return;

    // 2. React Cleanup Flag
    let isMounted = true;

    // 3. Create Canvas Gradients for the "Rekordbox" aesthetic
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    let waveColor: string | CanvasGradient = '#A0AEC0';
    let progressColor: string | CanvasGradient = '#3182CE';

    if (ctx) {
      // The "unplayed" wave (Darker, sleek)
      const waveGradient = ctx.createLinearGradient(0, 0, 0, 40); 
      waveGradient.addColorStop(0, '#4A5568'); 
      waveGradient.addColorStop(1, '#A0AEC0'); 
      waveColor = waveGradient;

      // The "played" wave (Bright, glowing blue)
      const progGradient = ctx.createLinearGradient(0, 0, 0, 40);
      progGradient.addColorStop(0, '#63B3ED'); 
      progGradient.addColorStop(0.5, '#3182CE'); 
      progGradient.addColorStop(1, '#2B6CB0'); 
      progressColor = progGradient;
    }

    // 4. Initialize Wavesurfer
    wavesurfer.current = WaveSurfer.create({
      container: containerRef.current,
      media: audioRef?.current || undefined, // ⚡️ If null, runs in purely visual mode
      waveColor: waveColor,    
      progressColor: progressColor,
      cursorColor: '#E2E8F0',
      cursorWidth: 1,
      height: 40,
      normalize: true, 
      interact: !isLiveMode, // 🚨 Prevent clicking to seek during a live broadcast!
    });

    // 5. Fetch and Load the Pre-calculated JSON Peaks
    const loadWaveform = async () => {
      // Safely grab the URL if it exists, otherwise use an empty string for visual-only mode
      const audioUrl = audioRef?.current?.src || '';

      if (targetWaveformUrl) {
        try {
          const response = await fetch(targetWaveformUrl, {
            headers: {
              'X-Organization-Id': orgId
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const bbcData = await response.json();

          if (!isMounted) return;

          // Convert BBC 8-bit INT to WAVESURFER FLOATS (-1.0 to 1.0)
          const maxPeak = bbcData.data.reduce(
            (max: number, val: number) => Math.max(max, Math.abs(val)), 
            0
          ) || 128;
          
          const normalizedPeaks = bbcData.data.map((val: number) => val / maxPeak);

          try {
            // ⚡️ If in live mode (no audioUrl), we provide a dummy duration (e.g., 100s) 
            // so wavesurfer calculates the internal timeline, allowing us to seek visually.
            await wavesurfer.current?.load(audioUrl, [normalizedPeaks], audioUrl ? undefined : 100);
          } catch (e: any) {
            if (e.name !== 'AbortError') console.error("Wavesurfer load error:", e);
          }

        } catch (error) {
          if (!isMounted) return;
          console.error("Failed to load pre-calculated waveform:", error);
          
          // Fallback native calculation (Only works if we have an actual audio file)
          if (audioUrl) {
            try {
              await wavesurfer.current?.load(audioUrl);
            } catch (e: any) {
              if (e.name !== 'AbortError') console.error("Wavesurfer fallback error:", e);
            }
          }
        }
      } else if (audioUrl) {
        // No waveform URL? Let wavesurfer calculate it natively from the library MP3
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
  }, [audioRef, targetWaveformUrl, orgId, isLiveMode]);

  // --------------------------------------------------------
  // ⚡️ 7. EXTERNALLY DRIVE THE VISUAL PLAYHEAD FOR LIVE STREAMS
  // --------------------------------------------------------
  useEffect(() => {
    if (wavesurfer.current && liveProgress !== undefined) {
      // Convert 0-100 percentage to a 0.0-1.0 float required by Wavesurfer
      const floatProgress = liveProgress / 100;
      
      // seekTo safely moves the cursor without interacting with any audio elements
      wavesurfer.current.seekTo(floatProgress); 
    }
  }, [liveProgress]);

  return (
    <Box 
      ref={containerRef} 
      w="100%" 
      h="100%" 
      onClick={(e) => e.stopPropagation()} 
    />
  );
};