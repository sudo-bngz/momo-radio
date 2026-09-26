import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Box } from '@chakra-ui/react';

interface WaveSurferPlayerProps {
  trackId: number | string; 
  audioRef?: React.RefObject<HTMLAudioElement | null> | null; 
  isPlaying: boolean;
  waveformUrl?: string; 
  waveformKey?: string;
  orgId: string; 
  liveProgress?: number; 
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
    if (!containerRef.current) return;

    let isMounted = true;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    let waveColor: string | CanvasGradient = '#A0AEC0';
    let progressColor: string | CanvasGradient = '#3182CE';

    if (ctx) {
      // ⚡️ Hex codes retained here because detached canvas gradients cannot evaluate CSS variables natively
      const waveGradient = ctx.createLinearGradient(0, 0, 0, 40); 
      waveGradient.addColorStop(0, '#4A5568'); 
      waveGradient.addColorStop(1, '#A0AEC0'); 
      waveColor = waveGradient;

      const progGradient = ctx.createLinearGradient(0, 0, 0, 40);
      progGradient.addColorStop(0, '#63B3ED'); 
      progGradient.addColorStop(0.5, '#3182CE'); 
      progGradient.addColorStop(1, '#2B6CB0'); 
      progressColor = progGradient;
    }

    wavesurfer.current = WaveSurfer.create({
      container: containerRef.current,
      media: audioRef?.current || undefined, 
      waveColor: waveColor,    
      progressColor: progressColor,
      // ⚡️ Updated cursor to use Chakra's semantic CSS variable
      cursorColor: 'var(--chakra-colors-border)',
      cursorWidth: 1,
      height: 40,
      normalize: true, 
      interact: !isLiveMode, 
    });

    const loadWaveform = async () => {
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

          const maxPeak = bbcData.data.reduce(
            (max: number, val: number) => Math.max(max, Math.abs(val)), 
            0
          ) || 128;
          
          const normalizedPeaks = bbcData.data.map((val: number) => val / maxPeak);

          try {
            await wavesurfer.current?.load(audioUrl, [normalizedPeaks], audioUrl ? undefined : 100);
          } catch (e: any) {
            if (e.name !== 'AbortError') console.error("Wavesurfer load error:", e);
          }

        } catch (error) {
          if (!isMounted) return;
          console.error("Failed to load pre-calculated waveform:", error);
          
          if (audioUrl) {
            try {
              await wavesurfer.current?.load(audioUrl);
            } catch (e: any) {
              if (e.name !== 'AbortError') console.error("Wavesurfer fallback error:", e);
            }
          }
        }
      } else if (audioUrl) {
        if (!isMounted) return;
        try {
          await wavesurfer.current?.load(audioUrl);
        } catch (e: any) {
          if (e.name !== 'AbortError') console.error("Wavesurfer load error:", e);
        }
      }
    };

    loadWaveform();

    return () => {
      isMounted = false;
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
      }
    };
  }, [audioRef, targetWaveformUrl, orgId, isLiveMode]);

  useEffect(() => {
    if (wavesurfer.current && liveProgress !== undefined) {
      const floatProgress = liveProgress / 100;
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