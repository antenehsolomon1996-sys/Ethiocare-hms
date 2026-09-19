import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const PRODUCTION_SUPABASE_URL = 'https://qlodfpwcpjtoaxqrgfsh.supabase.co';
const PRODUCTION_SUPABASE_ANON_KEY = 'sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF';

const supabaseUrl = 
  (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder-project.supabase.co')
    ? import.meta.env.VITE_SUPABASE_URL
    : PRODUCTION_SUPABASE_URL;

const supabaseAnonKey = 
  (import.meta.env.VITE_SUPABASE_ANON_KEY && 
   import.meta.env.VITE_SUPABASE_ANON_KEY !== 'placeholder-anon-key' && 
   import.meta.env.VITE_SUPABASE_ANON_KEY !== 'YOUR_PUBLISHABLE_KEY' &&
   import.meta.env.VITE_SUPABASE_ANON_KEY.length > 20)
    ? import.meta.env.VITE_SUPABASE_ANON_KEY
    : PRODUCTION_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl) && Boolean(supabaseAnonKey) && supabaseAnonKey.length > 20;
};

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
