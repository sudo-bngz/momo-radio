import { create } from 'zustand';

interface NetworkState {
  isApiDown: boolean;
  setApiDown: (status: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isApiDown: false,
  setApiDown: (status) => set({ isApiDown: status }),
}));
