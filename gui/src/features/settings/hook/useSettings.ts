import { create } from 'zustand';
import { api } from '../../../services/api';
import type { OrganizationSettings } from '../../../services/api';

interface SettingsStore {
  settings: OrganizationSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (data: Partial<OrganizationSettings>) => Promise<void>;
}

export const useSettings = create<SettingsStore>((set) => ({
  settings: null,
  isLoading: true,
  isSaving: false,

  fetchSettings: async () => {
    set({ isLoading: true });
    try {
      const data = await api.getSettings();
      set({ settings: data });
    } catch (error) {
      console.error("Failed to load settings", error);
    } finally {
      set({ isLoading: false });
    }
  },

  updateSettings: async (data) => {
    set({ isSaving: true });
    try {
      const updated = await api.updateSettings(data);
      set((state) => ({ 
        settings: state.settings ? { ...state.settings, ...updated } : updated 
      }));
    } catch (error) {
      console.error("Failed to save settings", error);
      throw error;
    } finally {
      set({ isSaving: false });
    }
  }
}));
