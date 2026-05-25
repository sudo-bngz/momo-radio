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
  isInitialized: boolean;
  isSessionExpired: boolean;

  // ⚡️ ADDED: The initialize function
  initialize: () => Promise<void>;
  
  setSession: (session: Session | null) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setActiveOrganization: (id: string) => void;
  logout: () => Promise<void>;
  setSessionExpired: (expired: boolean) => void;
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
      isInitialized: false, // ⚡️ Starts false to block the router
      isSessionExpired: false,

      // ⚡️ ADDED: Fetches the session on boot and marks init as true
      initialize: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          set({ 
            session, 
            user: session?.user || null,
            isAuthenticated: !!session,
            isInitialized: true 
          });

          // Listen for token refreshes or logins in other tabs
          supabase.auth.onAuthStateChange((_event, session) => {
            set({ 
              session, 
              user: session?.user || null,
              isAuthenticated: !!session,
              isInitialized: true 
            });
          });
        } catch (error) {
          console.error("Failed to initialize auth", error);
          set({ isInitialized: true }); // Prevent app from freezing if offline
        }
      },

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
        // We only persist the org data, we let Supabase handle the token persistence!
        activeOrganizationId: state.activeOrganizationId,
        organizations: state.organizations
      })
    }
  )
);