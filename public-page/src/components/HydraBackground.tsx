import React, { useRef, useEffect } from 'react';
// @ts-ignore
import Hydra from 'hydra-synth';

declare global {
  interface Window {
    solid?: any; 
    o0?: any; 
    o1?: any; 
    o2?: any; 
    o3?: any;
    setResolution?: (w: number, h: number) => void;
  }
}

interface HydraBackgroundProps {
  code: string; 
  audioElement: HTMLAudioElement | null;
}

export const HydraBackground: React.FC<HydraBackgroundProps> = ({ code, audioElement }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hydraInstance = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // 1. Initialize Hydra
    if (!hydraInstance.current) {
      hydraInstance.current = new Hydra({
        canvas: canvasRef.current,
        detectAudio: false, 
        makeGlobal: true,  
      });
    }

    // 2. Bind the AudioPlayer for Audio-Reactive Visuals (Missing in your snippet!)
    if (audioElement && hydraInstance.current.a) {
      audioElement.addEventListener('play', () => {
        hydraInstance.current.a.setSource(audioElement);
      }, { once: true });
    }

    // 3. THE HD FIX: Calculate true pixel density
    const updateResolution = () => {
      if (canvasRef.current && window.setResolution) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvasRef.current.getBoundingClientRect();
        window.setResolution(rect.width * dpr, rect.height * dpr);
      }
    };

    updateResolution();
    window.addEventListener('resize', updateResolution);

    // 4. Evaluate the script
    try {
      const w = window as any;
      if (w.solid) w.solid(0, 0, 0, 0).out(w.o0); 
      
      // FIX 1: Changed eval(script) to eval(code)
      eval(code); 
    } catch (err) {
      console.error("Hydra Script Error:", err);
    }

    return () => {
      window.removeEventListener('resize', updateResolution);
    };

  // FIX 2: Changed [script] to [code, audioElement]
  }, [code, audioElement]); 

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100vw', height: '100vh',
        objectFit: 'cover', pointerEvents: 'none',
        zIndex: 0, opacity: 0.85,
      }}
    />
  );
};

export default HydraBackground;