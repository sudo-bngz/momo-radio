import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/client'; 

export interface Organization {
  id: string;
  name: string;
  role: string;
  plan: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  organizations: Organization[];
  activeOrganizationId: string | null;
  isAuthenticated: boolean;
  isSessionExpired: boolean;

  setSession: (session: Session | null) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setActiveOrganization: (id: string) => void;
  logout: () => Promise<void>;
  setSessionExpired: (expired: boolean) => void;
  
  // ⚡️ NEW: A silent cleanup function for the background listener
  clearState: () => void; 
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      user: null,
      organizations: [],
      activeOrganizationId: null,
      isAuthenticated: false,
      isSessionExpired: false,

      setSession: (session) => set({ 
        session, 
        user: session?.user || null,
        isAuthenticated: !!session,
        isSessionExpired: false
      }),

      setOrganizations: (organizations) => set((state) => ({ 
        organizations,
        activeOrganizationId: state.activeOrganizationId || (organizations.length > 0 ? organizations[0].id : null)
      })),

      setActiveOrganization: (id) => set({ activeOrganizationId: id }),

      clearState: () => {
        set({ 
          session: null, 
          user: null, 
          organizations: [], 
          activeOrganizationId: null,
          isAuthenticated: false,
          isSessionExpired: false 
        });
        localStorage.removeItem('momo-auth-storage');
      },

      // ⚡️ MANUAL LOGOUT: Talks to Supabase, then forces a hard redirect
      logout: async () => {
        try {
          await supabase.auth.signOut();
        } catch (error) {
          console.error("Supabase sign out error:", error);
        }

        set({ 
          session: null, 
          user: null, 
          organizations: [], 
          activeOrganizationId: null,
          isAuthenticated: false,
          isSessionExpired: false 
        });
        
        localStorage.removeItem('momo-auth-storage');
        window.location.href = '/login';
      },

      setSessionExpired: (expired: boolean) => {
        set({ isSessionExpired: expired });
      }
    }),
    { 
      name: 'momo-auth-storage',
      partialize: (state) => ({ 
        activeOrganizationId: state.activeOrganizationId,
        organizations: state.organizations
      })
    }
  )
);