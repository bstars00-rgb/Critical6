import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';

interface AuthState {
  loading: boolean;
  session: boolean;
  profile: User | null;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirm: boolean }>;
  signOut: () => Promise<void>;
}

async function loadProfile(): Promise<User | null> {
  const auth = (await supabase.auth.getUser()).data.user;
  if (!auth) return null;
  const { data } = await supabase.from('users').select('*').eq('id', auth.id).maybeSingle();
  return (data as User) ?? null;
}

export const useAuthStore = create<AuthState>((set) => ({
  loading: true,
  session: false,
  profile: null,

  init: async () => {
    const { data } = await supabase.auth.getSession();
    const profile = data.session ? await loadProfile() : null;
    set({ loading: false, session: !!data.session, profile });
    supabase.auth.onAuthStateChange(async (_e, sess) => {
      set({ session: !!sess, profile: sess ? await loadProfile() : null });
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    set({ session: true, profile: await loadProfile() });
  },

  // Self-service signup. The DB trigger (0006) creates the profile row; the
  // first account becomes admin. If email confirmation is on, no session yet.
  signUp: async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    const hasSession = !!data.session;
    if (hasSession) set({ session: true, profile: await loadProfile() });
    return { needsConfirm: !hasSession };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: false, profile: null });
  },
}));
