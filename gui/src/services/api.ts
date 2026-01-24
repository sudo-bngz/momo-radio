// src/services/api.ts
import axios from 'axios';
import type { AnalyzeResponse, TrackMetadata } from '../types';

const API_URL = 'http://localhost:8081/api/v1';

export const api = {
  /**
   * Sends the file to the server for ID3 tag extraction.
   * Does not save the file to DB/S3 yet.
   */
  analyzeFile: async (file: File): Promise<AnalyzeResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post<AnalyzeResponse>(`${API_URL}/upload/analyze`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  /**
   * Uploads the file and the user-confirmed metadata to the server.
   * Triggers the DB insert and S3 upload.
   */
  uploadTrack: async (file: File, metadata: TrackMetadata): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);
    
    // Append all metadata fields dynamically
    (Object.keys(metadata) as Array<keyof TrackMetadata>).forEach((key) => {
      formData.append(key, metadata[key]);
    });

    await axios.post(`${API_URL}/upload/confirm`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};