import { create } from 'zustand';
import { api } from '../services/api'; 

interface BroadcastState {
  isLive: boolean;
  isLoading: boolean;
  eventSource: EventSource | null;
  
  // Actions
  setLive: (status: boolean) => void;
  connectStreamState: (orgId: string) => void;
  disconnectStreamState: () => void;
}

export const useBroadcastStore = create<BroadcastState>((set, get) => ({
  isLive: false,
  isLoading: true,
  eventSource: null,

  // Added implementation so MountPoints.tsx can manually override state
  setLive: (status) => set({ isLive: status }), 

  connectStreamState: (orgId: string) => {
    // Prevent duplicate connections
    if (get().eventSource) return; 

    const sseUrl = api.getBroadcastSseUrl(orgId); 
    const source = new EventSource(sseUrl);

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        set({ isLive: data.is_live, isLoading: false });
      } catch (err) {
        console.error("Failed to parse stream state:", err);
      }
    };

    source.onerror = () => {
      console.error("Lost connection to stream state. Reconnecting...");
    };

    set({ eventSource: source });
  },

  disconnectStreamState: () => {
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
      set({ eventSource: null, isLive: false, isLoading: true });
    }
  }
}));