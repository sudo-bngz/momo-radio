import { useState, useCallback } from 'react';
import type { FileRejection } from 'react-dropzone';
import { api } from '../../../services/api';
import type { TrackMetadata } from '../../../types';
import { useAuthStore } from '../../../store/useAuthStore';

export type UploadStatus = 'idle' | 'analyzing' | 'review' | 'uploading' | 'processing' | 'success' | 'error';


const INITIAL_META: TrackMetadata = {
  title: '', 
  artists: [], // ⚡️ Changed from artist string to artists array
  album: '', 
  genre: '', 
  year: '', 
  label: '', 
  catalog_number: '', 
  country: '', 
  style: '', 
  cover_base64: '' 
};

export interface UseIngestReturn {
  status: UploadStatus;
  file: File | null;
  meta: TrackMetadata;
  errorMsg: string;
  uploadProgress: number;
  processStep: string;
  setErrorMsg: React.Dispatch<React.SetStateAction<string>>;
  onDrop: (acceptedFiles: File[], fileRejections: FileRejection[]) => void;
  handleMetaChange: (name: string, value: any) => void; // ⚡️ Changed to any to accept string[]
  handleUpload: () => Promise<void>;
  reset: () => void;
}

export const useIngest = (): UseIngestReturn => {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<TrackMetadata>(INITIAL_META);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [processStep, setProcessStep] = useState<string>('');

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
    if (fileRejections.length > 0) {
      setErrorMsg("Invalid file type. Please upload MP3, FLAC, or WAV.");
      return;
    }

    const selectedFile = acceptedFiles[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setStatus('analyzing');
    setErrorMsg('');

    const analyze = async () => {
      try {
        const data = await api.analyzeFile(selectedFile);

        setMeta({
          title: data.title || '',
          artists: data.artists || [],
          album: data.album || '',
          genre: data.genre || '',
          year: data.year || '',
          label: '', 
          catalog_number: '', 
          country: '', 
          style: '',
          cover_base64: data.cover_base64 || '',
        });
        
        setStatus('review');
      } catch (err) {
        console.error("Analysis Error:", err);
        setStatus('idle');
        setFile(null);
        setErrorMsg("Analysis failed. Could not read metadata from this file.");
      }
    };
    
    analyze();
  }, []);

  const handleMetaChange = (name: string, value: any) => {
    setMeta((prev) => ({ 
      ...prev, 
      [name]: value 
    }));
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    setUploadProgress(0);
    setErrorMsg('');

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 15, 90));
      }, 300);

      // ⚡️ Convert the artists array into a comma-separated string for the Go API
      const uploadPayload = {
        ...meta,
        artist: (meta.artists || []).join(', ')
      };

      const response = await api.uploadTrack(file, uploadPayload) as any; 
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response && response.track_id) {
        setStatus('processing');
        setProcessStep('Awaiting worker assignment...');
        const state = useAuthStore.getState();
        const token = state.session?.access_token;
        const orgId = state.activeOrganizationId;

        const eventSource = new EventSource(
          `/api/v1/tracks/${response.track_id}/status-stream?token=${token}&org_id=${orgId}`
        );

        eventSource.addEventListener('status', (e) => {
          const msg = e.data;
          
          if (msg === 'completed') {
            setStatus('success');
            eventSource.close();
          } else if (msg === 'failed') {
            setStatus('error');
            setErrorMsg('Deep acoustic analysis failed on the server.');
            eventSource.close();
          } else {
            setProcessStep(msg);
          }
        });

        eventSource.onerror = () => {
          console.error("SSE Connection Lost");
          setStatus('error');
          setErrorMsg('Lost connection to processing server.');
          eventSource.close();
        };
      } else {
        setStatus('success');
      }

    } catch (err) {
      console.error("Upload Error:", err);
      setStatus('review');
      setErrorMsg("Upload failed. The server might be unreachable.");
    }
  };

  const reset = () => {
    setFile(null);
    setMeta(INITIAL_META);
    setStatus('idle');
    setErrorMsg('');
    setUploadProgress(0);
    setProcessStep('');
  };

  return {
    status,
    file,
    meta,
    errorMsg,
    uploadProgress,
    processStep,
    setErrorMsg,
    onDrop,
    handleMetaChange,
    handleUpload,
    reset
  };
};