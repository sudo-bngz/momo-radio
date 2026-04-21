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
    setResolution?: (w: number, h: number) => void; // ⚡️ Let TypeScript know this exists
  }
}

interface HydraBackgroundProps {
  script: string;
}

export const HydraBackground: React.FC<HydraBackgroundProps> = ({ script }) => {
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

    // 2. ⚡️ THE HD FIX: Calculate true pixel density
    const updateResolution = () => {
      if (canvasRef.current && window.setResolution) {
        // Grab the screen's pixel ratio (e.g., 2 for Retina MacBooks)
        const dpr = window.devicePixelRatio || 1;
        
        // Grab the actual physical size of the banner
        const rect = canvasRef.current.getBoundingClientRect();
        
        // Force Hydra to render at the exact, ultra-crisp resolution
        window.setResolution(rect.width * dpr, rect.height * dpr);
      }
    };

    // Trigger HD mode immediately
    updateResolution();
    
    // Keep it HD if the user resizes the browser window
    window.addEventListener('resize', updateResolution);

    // 3. Evaluate the script
    try {
      const w = window as any;
      if (w.solid) w.solid(0, 0, 0, 0).out(w.o0); 
      eval(script);
    } catch (err) {
      console.error("Hydra Script Error:", err);
    }

    // Cleanup the resize listener so it doesn't cause memory leaks
    return () => window.removeEventListener('resize', updateResolution);

  }, [script]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        objectFit: 'cover', pointerEvents: 'none',
        zIndex: 0, opacity: 0.85,
      }}
    />
  );
};