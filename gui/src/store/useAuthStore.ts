import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../services/api'; // Ensure this points to your axios instance
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  // Define the login method in the interface
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      // Logic moved into the store for a "Best Pattern" approach
      login: async (username: string, password: string) => {
        const res = await apiClient.post('/auth/login', { username, password });
        const { token, user } = res.data;

        set({ 
          token, 
          user, 
          isAuthenticated: true 
        });
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        localStorage.removeItem('momo-auth-storage');
        window.location.href = '/login';
      },
    }),
    { name: 'momo-auth-storage' }
  )
);