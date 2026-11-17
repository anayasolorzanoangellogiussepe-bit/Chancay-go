import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { clearPushToken, registerForPush } from './push';
import type { Driver, Profile } from './types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  driver: Driver | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  session: null, profile: null, driver: null, loading: true,
  refresh: async () => {}, signOut: async () => {},
});

export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); setDriver(null); return; }
    const { data: p } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile((p as Profile) ?? null);
    if (p) registerForPush(s.user.id).catch(() => {});
    if (p?.role === 'driver') {
      const { data: d } = await supabase.from('drivers').select('*').eq('id', s.user.id).maybeSingle();
      setDriver((d as Driver) ?? null);
    } else setDriver(null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session); await load(data.session); setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s); await load(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  return (
    <Ctx.Provider value={{
      session, profile, driver, loading,
      refresh: () => load(session),
      signOut: async () => {
        if (session) await clearPushToken(session.user.id).catch(() => {});
        await supabase.auth.signOut();
      },
    }}>
      {children}
    </Ctx.Provider>
  );
}
