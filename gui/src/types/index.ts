// src/types/index.ts

export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: string;
  bpm: string;
  key: string;
}

export interface AnalyzeResponse {
  filename: string;
  format: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: string;
  bpm: string;
  key: string;
}

export type UploadStatus = 
  | 'idle' 
  | 'analyzing' 
  | 'review' 
  | 'uploading' 
  | 'success' 
  | 'error';


