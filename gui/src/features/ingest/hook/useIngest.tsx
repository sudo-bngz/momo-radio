import { useState, useCallback } from 'react';
import type { FileRejection } from 'react-dropzone';
import { api } from '../../../services/api';
import type { TrackMetadata, UploadStatus } from '../../../types';

// The editorial fields you want in your DB, 
// even if they aren't always in the ID3 tag.
const INITIAL_META: TrackMetadata = {
  title: '',
  artist: '',
  album: '',
  genre: '',
  year: '',
  label: '',          
  catalog_number: '', 
  country: '',        
  style: ''           
};

export const useIngest = () => {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<TrackMetadata>(INITIAL_META);
  const [errorMsg, setErrorMsg] = useState<string>('');

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
          artist: data.artist || '',
          album: data.album || '',
          genre: data.genre || '',
          year: data.year || '',
          label: '', // ID3 'TPUB' tag (Publisher)
          catalog_number: '',          // Not standard in ID3
          country: '',                 // Not standard in ID3
          style: ''                    // Not standard in ID3
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

  const handleMetaChange = (name: string, value: string) => {
    setMeta((prev) => ({ 
      ...prev, 
      [name]: value 
    }));
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    setErrorMsg('');

    try {
      await api.uploadTrack(file, meta);
      setStatus('success');
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
  };

  return {
    status,
    file,
    meta,
    errorMsg,
    setErrorMsg,
    onDrop,
    handleMetaChange,
    handleUpload,
    reset
  };
};