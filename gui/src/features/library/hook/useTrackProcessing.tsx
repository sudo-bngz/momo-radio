import { useEffect, useRef, useMemo } from 'react';
import { api } from '../../../services/api';
import { toaster } from '../../../components/ui/toaster';

export const useTrackProcessing = (
  tracks: any[], 
  setTracks: (tracks: any[]) => void
) => {
  // Use a ref to access the latest tracks state inside our interval without re-triggering it
  const tracksRef = useRef(tracks);
  
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  // Listen for new uploads from other parts of the app
  useEffect(() => {
    const handleNewUpload = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { track_id } = customEvent.detail;
      
      if (tracksRef.current.some(t => t.id === track_id)) return;

      const newTrack = {
        id: track_id,
        title: "Analyzing Audio...",
        artist: "Processing...",
        album: "-",
        processing_status: "pending",
        status: "pending",
        duration: 0,
      };

      setTracks([newTrack, ...tracksRef.current]);
    };

    window.addEventListener('track_uploaded', handleNewUpload);
    return () => window.removeEventListener('track_uploaded', handleNewUpload);
  }, [setTracks]);

  // Extract pending IDs to watch
  const pendingIdsStr = useMemo(() => {
    return tracks
      .filter(t => ['pending', 'processing'].includes(t.processing_status || '') || ['pending', 'processing'].includes(t.status || ''))
      .map(t => t.id)
      .sort()
      .join(',');
  }, [tracks]);

  // Poll the API every 3 seconds for pending tracks
  useEffect(() => {
    if (!pendingIdsStr) return;

    const pendingIds = pendingIdsStr.split(',').map(Number);

    const interval = setInterval(() => {
      pendingIds.forEach(async (id) => {
        try {
          const updated = await api.getTrack(id) as any; 
          
          if (updated.processing_status === 'completed') {
            const res = await api.getTracks({ search: updated.title });
            const formattedTrack = res.data?.find((t: any) => t.id === updated.id);

            if (formattedTrack) {
              setTracks(tracksRef.current.map(track => track.id === updated.id ? formattedTrack : track));
            } else {
              setTracks(tracksRef.current.map(track => track.id === updated.id ? { ...track, title: updated.title, processing_status: 'completed', status: 'completed' } : track));
            }

            toaster.create({ title: `Analysis complete: ${updated.title}`, type: "success" });
            
          } else if (updated.processing_status === 'failed') {
            setTracks(tracksRef.current.map(track => track.id === updated.id ? { ...track, processing_status: 'failed', status: 'failed' } : track));
            toaster.create({ title: `Analysis failed for track.`, type: "error" });
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      });
    }, 3000); 

    return () => clearInterval(interval);
  }, [pendingIdsStr, setTracks]);
};
