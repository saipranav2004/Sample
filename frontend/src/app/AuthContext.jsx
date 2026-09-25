import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchProfile, login as loginRequest } from '../lib/api/endpoints';
import { onSessionExpired, default as client } from '../lib/api/client';
import {
  adoptSession,
  clearSession,
  readStoredUser,
  readToken,
  subscribeSignOut,
  writeSession,
  writeStoredUser,
} from '../lib/api/session';
import { subscribeOverlay, OVERLAY_KEYS } from '../lib/demo/runtime';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    adoptSession();
    return readToken();
  });
  // Seeded from storage so a refresh renders the shell immediately and the
  // profile request only corrects it.
  const [user, setUser] = useState(readStoredUser);
  const [status, setStatus] = useState(() => (readToken() ? 'verifying' : 'anonymous'));
  const [expired, setExpired] = useState(false);
  /* Bumped when the console's users change, so a role changed or an account
     deactivated by an administrator reaches this session without a reload. */
  const [profileRevision, setProfileRevision] = useState(0);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  /* Signing out in another tab of the same session signs this one out too. */
  useEffect(
    () =>
      subscribeSignOut(() => {
        setToken(null);
        setUser(null);
        setStatus('anonymous');
      }),
    [],
  );

  useEffect(
    () =>
      subscribeOverlay((key) => {
        if (key === OVERLAY_KEYS.users || key === null) setProfileRevision((value) => value + 1);
      }),
    [],
  );

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
        writeStoredUser(profile);
        setStatus('authenticated');
      } catch (error) {
        if (controller.signal.aborted) return;
        // A 401 ends the session: the account was deactivated or the token is
        // no longer valid. (The HTTP client's interceptor does the same for
        // API calls; the profile check has to as well, or a deactivated
        // account would keep a working shell until its next API request.)
        // Anything else means the service is unreachable, and signing the
        // operator out would be wrong.
        if (error?.status === 401) {
          clearSession();
          setExpired(true);
          setToken(null);
          setUser(null);
          setStatus('anonymous');
          return;
        }
        setStatus('authenticated');
      }
    })();

    return () => controller.abort();
  }, [token, profileRevision]);

  const signIn = useCallback(async ({ email, password }) => {
    const result = await loginRequest({ email, password });
    const nextToken = result?.token;
    if (!nextToken) throw new Error('The service did not return a session token.');

    writeSession(nextToken, result.user);
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
