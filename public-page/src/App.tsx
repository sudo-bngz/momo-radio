import { useState } from 'react';
import { useTenantConfig } from './hooks/useTenantConfig';
import AudioPlayer from './components/AudioPlayer';
import { HydraBackground } from './components/HydraBackground';
import './App.css';

// A safe, cool-looking default animation if the user hasn't written any code yet
const DEFAULT_HYDRA_CODE = `
osc(20, 0.05, 0.9)
  .color(1, 0.3, 0.8)
  .out(o0)
`;

export default function App() {
  const { config, error } = useTenantConfig();
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  if (error) return <div className="error">Error loading station: {error}</div>;
  if (!config) return <div className="loading">Loading station...</div>;

  // Determine which mode to show. Default to hydra if nothing is set.
  const isImageMode = config.visual_mode === 'image' && config.background_image_url;

  return (
    <main style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#000' }}>
      
      {/* 1. The Background Layer (Either Image OR Hydra) */}
      {isImageMode ? (
        <div 
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            backgroundImage: `url(${config.background_image_url})`,
            backgroundSize: 'cover', 
            backgroundPosition: 'center',
            zIndex: 0,
            opacity: 0.85
          }} 
        />
      ) : (
        <HydraBackground 
          code={config.hydra_code || DEFAULT_HYDRA_CODE} 
          audioElement={audioElement} 
        />
      )}
      
      {/* 2. The Branding Layer */}
      {config.logo_url && (
        <img 
          src={config.logo_url} 
          alt="Station Logo" 
          style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, maxHeight: '80px' }} 
        />
      )}

      {/* 3. The Audio Engine */}
      <AudioPlayer 
        streamUrl={config.streamUrl} 
        accentColor={config.accent_color}
        onAudioElementReady={setAudioElement} 
      />

    </main>
  );
}