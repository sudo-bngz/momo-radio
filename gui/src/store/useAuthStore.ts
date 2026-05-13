import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session, User } from '@supabase/supabase-js';

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

  // Actions
  setSession: (session: Session | null) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setActiveOrganization: (id: string) => void;
  logout: () => void;
  setSessionExpired: (expired: boolean) => void;
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
        // Auto-select the first org if one isn't picked yet
        activeOrganizationId: state.activeOrganizationId || (organizations.length > 0 ? organizations[0].id : null)
      })),

      setActiveOrganization: (id) => set({ activeOrganizationId: id }),

      logout: () => {
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
      // Supabase automatically persists the token elsewhere. 
      // We only need Zustand to remember which organization the user was looking at.
      partialize: (state) => ({ 
        activeOrganizationId: state.activeOrganizationId,
        organizations: state.organizations
      })
    }
  )
);