import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createMockClient } from './demo/mockClient';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Demo mode: explicit flag, or whenever no real backend is configured (e.g. the
// GitHub Pages build). Falls back to an in-memory mock client so the whole
// prototype is usable without Supabase.
const demoFlag = (import.meta.env.VITE_DEMO as string) === 'true';
export const isDemo = demoFlag || !url || !anonKey;

if (isDemo) {
  console.info('[supabase] demo mode — using in-memory mock data (no backend).');
}

// Typed as SupabaseClient so existing call-site inference holds. The mock is
// cast — it implements the subset of the API the app exercises. Swap to
// `createClient<Database>` once you run `supabase gen types typescript`.
export const supabase: SupabaseClient = isDemo
  ? (createMockClient() as unknown as SupabaseClient)
  : createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
