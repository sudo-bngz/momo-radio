import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../services/api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isSessionExpired: boolean; // 👈 Track if the JWT has expired
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setSessionExpired: (expired: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isSessionExpired: false,

      login: async (username: string, password: string) => {
        const res = await apiClient.post('/auth/login', { username, password });
        const { token, user } = res.data;

        set({ 
          token, 
          user, 
          isAuthenticated: true,
          isSessionExpired: false
        });
      },

      logout: () => {
        // Clear all auth state
        set({ 
          user: null, 
          token: null, 
          isAuthenticated: false,
          isSessionExpired: false 
        });
        
        // window.location.href is fine for a hard reset, 
        // but the Modal we built will also handle redirection.
        localStorage.removeItem('momo-auth-storage');
        window.location.href = '/login';
      },

      setSessionExpired: (expired: boolean) => {
        set({ isSessionExpired: expired });
      }
    }),
    { name: 'momo-auth-storage' }
  )
);