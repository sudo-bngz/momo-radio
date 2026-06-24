// src/store/useBroadcastStore.ts
import { create } from 'zustand';
import { api } from '../services/api';

interface BroadcastStore {
  isLive: boolean;
  setLive: (status: boolean) => void;
  checkState: () => Promise<void>;
}

export const useBroadcastStore = create<BroadcastStore>((set) => ({
  isLive: false,
  
  setLive: (status) => set({ isLive: status }),
  
  checkState: async () => {
    try {
      const res = await api.getBroadcastState();
      // ⚡️ FIX: Check for the exact string returned by your API
      set({ isLive: res.state === 'online' }); 
    } catch {
      set({ isLive: false });
    }
  }
}));