import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/client'; 

export interface Organization {
  id: string;
  name: string;
  role: string;
  // ⚡️ ADDED: Billing and plan fields from the Go backend
  plan_tier?: string;
  billing_status?: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  organizations: Organization[];
  activeOrganizationId: string | null;
  activeOrganization: Organization | null; // ⚡️ ADDED: The active organization object
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
      activeOrganization: null, // ⚡️ Initial state
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

      setOrganizations: (organizations) => set((state) => {
        const activeId = state.activeOrganizationId || (organizations.length > 0 ? organizations[0].id : null);
        // ⚡️ Automatically compute the active organization object
        const activeOrg = organizations.find(o => o.id === activeId) || null;
        
        return { 
          organizations,
          activeOrganizationId: activeId,
          activeOrganization: activeOrg
        };
      }),

      setActiveOrganization: (id) => set((state) => ({ 
        activeOrganizationId: id,
        // ⚡️ Keep the object in sync when the ID changes
        activeOrganization: state.organizations.find(o => o.id === id) || null
      })),

      clearState: () => {
        set({ 
          session: null, 
          user: null, 
          organizations: [], 
          activeOrganizationId: null,
          activeOrganization: null,
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
          activeOrganization: null,
          isAuthenticated: false,
          isSessionExpired: false 
        });
        
        localStorage.removeItem('momo-auth-storage');
        window.location.href = '/login';
      },

      setSessionExpired: (expired: boolean) => {
        set({ isSessionExpired: expired });
      },

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
        activeOrganization: state.activeOrganization, // ⚡️ Added to persisted state to survive refreshes
        organizations: state.organizations
      })
    }
  )
);