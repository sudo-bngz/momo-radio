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

  initialize: () => Promise<void>;
  
  setSession: (session: Session | null) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setActiveOrganization: (id: string) => void;
  logout: () => Promise<void>;
  setSessionExpired: (expired: boolean) => void;
  clearState: () => void; 

  // ⚡️ ADDED: The missing Supabase Auth update methods
  updateProfile: (firstName: string, lastName: string) => Promise<void>;
  updateEmail: (newEmail: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      user: null,
      organizations: [],
      activeOrganizationId: null,
      isAuthenticated: false,
      isInitialized: false, 
      isSessionExpired: false,

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
          set({ isInitialized: true }); 
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
      },

      // ⚡️ ADDED: Implementations for the update methods
      updateProfile: async (firstName: string, lastName: string) => {
        const { data, error } = await supabase.auth.updateUser({
          data: { first_name: firstName, last_name: lastName }
        });
        if (error) throw error;
        set({ user: data.user }); // Update local user state immediately
      },

      updateEmail: async (newEmail: string) => {
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) throw error;
      },

      updatePassword: async (newPassword: string) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
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
