import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Read before the client consumes the auth link: was this page opened from an invite or password-reset email? */
export const arrivedToSetPassword =
  typeof window !== 'undefined' && /type=(invite|recovery)/.test(window.location.hash + window.location.search);

/** Null when the site runs without Supabase settings (local development only). */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, detectSessionInUrl: true } }) : null;

export const authConfigured = supabase !== null;
