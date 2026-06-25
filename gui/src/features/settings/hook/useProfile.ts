import { create } from 'zustand';
import { api, type UserProfile } from '../../../services/api';

interface ProfileStore {
  profile: UserProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  fetchProfile: () => Promise<void>;
  mutateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

export const useProfile = create<ProfileStore>((set) => ({
  profile: null,
  isLoading: true,
  isSaving: false,

  fetchProfile: async () => {
    set({ isLoading: true });
    try {
      const data = await api.getProfile();
      set({ profile: data });
    } catch (error) {
      console.error("Failed to fetch custom user profile", error);
    } finally {
      set({ isLoading: false });
    }
  },

  mutateProfile: async (data) => {
    set({ isSaving: true });
    try {
      const updated = await api.updateProfile(data);
      set({ profile: updated });
    } catch (error) {
      console.error("Failed to save profile modifications", error);
      throw error;
    } finally {
      set({ isSaving: false });
    }
  }
}));
