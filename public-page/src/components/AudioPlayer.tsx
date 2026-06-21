import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface AudioPlayerProps {
  streamUrl: string;
  accentColor?: string;
  onAudioElementReady: (el: HTMLAudioElement) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  streamUrl, 
  accentColor = '#ff0055', 
  onAudioElementReady 
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !streamUrl) return; 

    onAudioElementReady(audio);
    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(streamUrl);
      hls.attachMedia(audio);
    } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      // Native fallback for Safari
      audio.src = streamUrl;
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [streamUrl, onAudioElementReady]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div 
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '24px',
        zIndex: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)', // Safari support
        padding: '20px',
        borderRadius: '16px',
        width: '320px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <audio 
        ref={audioRef} 
        crossOrigin="anonymous" 
        onPlay={() => setIsPlaying(true)} 
        onPause={() => setIsPlaying(false)} 
      />
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Play/Pause Button */}
        <button 
          onClick={togglePlay} 
          style={{ 
            backgroundColor: accentColor, 
            border: 'none', 
            borderRadius: '50%', 
            width: '56px', 
            height: '56px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: 'pointer', 
            color: '#fff',
            transition: 'filter 0.2s ease',
          }}
          onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
          onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
        >
          {isPlaying ? (
            // Pause Icon (SVG)
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          ) : (
            // Play Icon (SVG)
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px' }}>
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          )}
        </button>

        {/* Info & Volume */}
        <div style={{ flex: 1, marginLeft: '16px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
            Live Broadcast
          </span>
          
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* Volume Icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
            
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              value={volume} 
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVolume(v);
                if (audioRef.current) audioRef.current.volume = v;
              }}
              style={{ 
                width: '100%', 
                accentColor: accentColor, 
                cursor: 'pointer' 
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;