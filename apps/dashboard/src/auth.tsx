import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { TOKEN_KEY, decodeToken, type DecodedActor } from './api';

interface AuthState {
  actor: DecodedActor | null;
  setToken: (token: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  const value = useMemo<AuthState>(() => {
    const setToken = (t: string | null) => {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
      setTokenState(t);
    };
    return {
      actor: token ? decodeToken(token) : null,
      setToken,
      logout: () => setToken(null),
    };
  }, [token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
