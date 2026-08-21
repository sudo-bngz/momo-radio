import { createClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: {
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
    };
  }
}

const supabaseUrl = window.__RUNTIME_CONFIG__?.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = window.__RUNTIME_CONFIG__?.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Supabase URL is required. Check env.js injection or .env file.");
if (!supabaseAnonKey) throw new Error("Supabase Anon Key is required. Check env.js injection or .env file.");

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: false,
    detectSessionInUrl: true
  }
});