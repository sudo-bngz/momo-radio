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
  liveElapsed?: number;
  liveDuration?: number;
}

// Silent 8 kHz / 8-bit mono WAV: ~8 KB per second, generated locally
function createSilentWavUrl(seconds: number, sampleRate = 8000): string {
  const numSamples = Math.ceil(seconds * sampleRate);
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);
  const str = (o: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));

  str(0, 'RIFF');
  view.setUint32(4, 36 + numSamples, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate
  view.setUint16(32, 1, true);          // block align
  view.setUint16(34, 8, true);          // 8-bit
  str(36, 'data');
  view.setUint32(40, numSamples, true);
  new Uint8Array(buffer, 44).fill(128); // 8-bit silence

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

async function fetchPeaks(url: string, orgId: string): Promise<number[] | null> {
  try {
    const res = await fetch(url, { headers: { 'X-Organization-Id': orgId } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bbc = await res.json();
    const max = bbc.data.reduce((m: number, v: number) => Math.max(m, Math.abs(v)), 0) || 128;
    return bbc.data.map((v: number) => v / max);
  } catch (e) {
    console.warn('Waveform peaks unavailable:', e);
    return null;
  }
}

export const WaveSurferPlayer = ({
  trackId,
  audioRef,
  waveformUrl,
  waveformKey,
  orgId,
  isPlaying,
  liveElapsed,
  liveDuration,
}: WaveSurferPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const readyRef = useRef(false);

  const targetWaveformUrl = waveformUrl || waveformKey;
  const isLiveMode = liveElapsed !== undefined && liveDuration !== undefined;

  // Latest props, readable from async code without being dependencies
  const liveRef = useRef({ elapsed: liveElapsed ?? 0, duration: liveDuration ?? 0, isPlaying });
  liveRef.current = { elapsed: liveElapsed ?? 0, duration: liveDuration ?? 0, isPlaying };

  // ---- Create: once per track, like the docs example ----
  useEffect(() => {
    if (!containerRef.current) return;
    let isMounted = true;
    let silentUrl: string | null = null;
    readyRef.current = false;

    const ctx = document.createElement('canvas').getContext('2d');
    let waveColor: string | CanvasGradient = '#A0AEC0';
    let progressColor: string | CanvasGradient = '#3182CE';
    if (ctx) {
      const wg = ctx.createLinearGradient(0, 0, 0, 40);
      wg.addColorStop(0, '#4A5568');
      wg.addColorStop(1, '#A0AEC0');
      waveColor = wg;
      const pg = ctx.createLinearGradient(0, 0, 0, 40);
      pg.addColorStop(0, '#63B3ED');
      pg.addColorStop(0.5, '#3182CE');
      pg.addColorStop(1, '#2B6CB0');
      progressColor = pg;
    }

    // Live: WaveSurfer gets its own muted clock. Library: the real player.
    const media = isLiveMode ? Object.assign(new Audio(), { muted: true }) : audioRef?.current || undefined;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      media,
      waveColor,
      progressColor,
      cursorColor: '#E53E3E',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      minPxPerSec: 100,
      autoCenter: true,
      hideScrollbar: true,
      height: 40,
      normalize: true,
      interact: !isLiveMode,
    });
    wavesurfer.current = ws;

    (async () => {
      const peaks = targetWaveformUrl ? await fetchPeaks(targetWaveformUrl, orgId) : null;
      if (!isMounted) return;

      try {
        if (isLiveMode) {
          const { duration } = liveRef.current;
          if (!peaks || duration <= 0) return;
          silentUrl = createSilentWavUrl(duration);
          await ws.load(silentUrl, [peaks], duration);
          if (!isMounted) return;

          const { elapsed, isPlaying: playing } = liveRef.current;
          ws.setTime(elapsed);
          if (playing) await ws.play();
        } else {
          const audioUrl = audioRef?.current?.src || '';
          if (peaks) await ws.load(audioUrl, [peaks]);
          else if (audioUrl) await ws.load(audioUrl);
        }
        readyRef.current = true;
      } catch (e: any) {
        if (e.name !== 'AbortError') console.error('Wavesurfer load error:', e);
      }
    })();

    return () => {
      isMounted = false;
      readyRef.current = false;
      ws.destroy();
      wavesurfer.current = null;
      if (silentUrl) URL.revokeObjectURL(silentUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, targetWaveformUrl, orgId, isLiveMode]);

  // ---- Live: mirror play/pause onto the silent clock ----
  useEffect(() => {
    const ws = wavesurfer.current;
    if (!isLiveMode || !ws || !readyRef.current) return;
    if (isPlaying) ws.play().catch(() => {});
    else ws.pause();
  }, [isPlaying, isLiveMode]);

  // ---- Live: server events only correct real drift ----
  useEffect(() => {
    const ws = wavesurfer.current;
    if (!isLiveMode || !ws || !readyRef.current || liveElapsed === undefined) return;
    if (Math.abs(ws.getCurrentTime() - liveElapsed) > 1) {
      ws.setTime(liveElapsed);
    }
  }, [liveElapsed, isLiveMode]);

  return (
    <Box
      ref={containerRef}
      w="100%"
      h="100%"
      overflow="hidden"
      touchAction="none"
      onClick={(e) => e.stopPropagation()}
    />
  );
};