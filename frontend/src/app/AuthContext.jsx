import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchProfile, login as loginRequest } from '../lib/api/endpoints';
import { onSessionExpired, default as client } from '../lib/api/client';
import { TOKEN_KEY, USER_KEY } from '../lib/api/http';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  // Seeded from storage so a refresh renders the shell immediately and the
  // profile request only corrects it.
  const [user, setUser] = useState(readStoredUser);
  const [status, setStatus] = useState(() => (localStorage.getItem(TOKEN_KEY) ? 'verifying' : 'anonymous'));
  const [expired, setExpired] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      setExpired(true);
      setToken(null);
      setUser(null);
      setStatus('anonymous');
    });
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();

    (async () => {
      try {
        const profile = await fetchProfile(controller.signal);
        if (controller.signal.aborted) return;
        setUser(profile);
        localStorage.setItem(USER_KEY, JSON.stringify(profile));
        setStatus('authenticated');
      } catch (error) {
        if (controller.signal.aborted) return;
        // A 401 is handled by the client interceptor; anything else means the
        // service is unreachable, and signing the operator out would be wrong.
        if (error?.status === 401) return;
        setStatus('authenticated');
      }
    })();

    return () => controller.abort();
  }, [token]);

  const signIn = useCallback(async ({ email, password }) => {
    const result = await loginRequest({ email, password });
    const nextToken = result?.token;
    if (!nextToken) throw new Error('The service did not return a session token.');

    localStorage.setItem(TOKEN_KEY, nextToken);
    if (result.user) localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    client.defaults.headers.Authorization = `Bearer ${nextToken}`;

    setExpired(false);
    setUser(result.user ?? null);
    setToken(nextToken);
    setStatus('authenticated');
    return result;
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      status,
      expired,
      isAuthenticated: Boolean(token),
      signIn,
      logout,
      clearExpired: () => setExpired(false),
    }),
    [user, token, status, expired, signIn, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
