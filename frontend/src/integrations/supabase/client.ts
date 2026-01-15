import { createClient } from '@supabase/supabase-js';

// Your Supabase instance (same as your bot uses)
const SUPABASE_URL = 'https://iibdlazwkossyelyroap.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpYmRsYXp3a29zc3llbHlyb2FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MzQzNDUsImV4cCI6MjA4MzIxMDM0NX0.xZ0VbkoKzrFLYpbKrUjcvTY-qs-n-A3ynHU-SAluOUQ4';

// Singleton pattern to prevent multiple instances
let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _supabase;
}

export const supabase = getSupabaseClient();
export const SUPABASE_PROJECT_URL = SUPABASE_URL;
