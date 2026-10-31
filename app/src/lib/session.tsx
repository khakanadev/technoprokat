import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setSession, tokenStore, type User } from './api';

interface SessionValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: { email: string; password: string; full_name: string; phone?: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(async () => {
    setSession(null);
    await tokenStore.set(null);
    setUser(null);
  }, []);

  useEffect(() => {
    (async () => {
      const saved = await tokenStore.get();
      if (saved) {
        setSession(saved, () => void signOut());
        try {
          setUser(await api<User>('/auth/me'));
        } catch {
          await signOut();
        }
      }
      setLoading(false);
    })();
  }, [signOut]);

  const accept = useCallback(async (res: { token: string; user: User }) => {
    setSession(res.token, () => void signOut());
    await tokenStore.set(res.token);
    setUser(res.user);
  }, [signOut]);

  const value = useMemo<SessionValue>(() => ({
    user,
    loading,
    signIn: async (email, password) => accept(await api('/auth/login', { method: 'POST', body: { email, password } })),
    signUp: async (data) => accept(await api('/auth/register', { method: 'POST', body: data })),
    signOut,
  }), [user, loading, accept, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession вне SessionProvider');
  return ctx;
}

export const isStaffRole = (user: User | null) => user?.role === 'admin' || user?.role === 'manager';
