import { TOKEN_KEY, USER_KEY } from './http';

/**
 * Where the signed-in session is kept: this tab first, then the browser.
 *
 * Signing in writes both. A new tab starts from the browser copy - the last
 * account signed in - and a tab that signs in as somebody else keeps its own
 * copy, so an admin and an analyst can work side by side in two tabs of one
 * browser. That is how the demo shows an alert handed over in one console
 * arriving live in the other; with a real API it is simply "each tab keeps
 * the account it signed in with".
 *
 * Signing out clears both here, and every other tab still holding that same
 * token signs out too (see `subscribeSignOut`): ending a session ends it
 * everywhere it is open, not only in the tab where the button was pressed.
 */
function tabStore() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function read(key) {
  try {
    return tabStore()?.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readToken() {
  return read(TOKEN_KEY);
}

/**
 * Pin the account this tab opened with, so a later sign-in in another tab
 * does not swap it underneath on the next reload.
 */
export function adoptSession() {
  const store = tabStore();
  try {
    if (!store || store.getItem(TOKEN_KEY)) return;
    const token = localStorage.getItem(TOKEN_KEY);
    const user = localStorage.getItem(USER_KEY);
    if (token) store.setItem(TOKEN_KEY, token);
    if (token && user) store.setItem(USER_KEY, user);
  } catch {
    /* see writeSession */
  }
}

export function readStoredUser() {
  try {
    const raw = read(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeSession(token, user) {
  for (const store of [tabStore(), localStorage]) {
    try {
      if (token) store?.setItem(TOKEN_KEY, token);
      if (user) store?.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* A private window refuses storage; the session lasts for this page. */
    }
  }
}

/** Refresh the stored profile without touching the token. */
export function writeStoredUser(user) {
  for (const store of [tabStore(), localStorage]) {
    try {
      /* Only where this tab's session lives: a profile must never overwrite
         the browser copy another account signed in with. */
      if (store?.getItem(TOKEN_KEY) === readToken()) store.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* see writeSession */
    }
  }
}

export function clearSession() {
  const token = readToken();
  try {
    tabStore()?.removeItem(TOKEN_KEY);
    tabStore()?.removeItem(USER_KEY);
  } catch {
    /* see writeSession */
  }
  try {
    /* The browser copy goes only if it is this same session; a newer sign-in
       from another tab is theirs to keep. */
    if (localStorage.getItem(TOKEN_KEY) === token) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    /* Tell the other tabs which session ended. */
    if (token) {
      localStorage.setItem(SIGNED_OUT_KEY, JSON.stringify({ token, at: Date.now() }));
      localStorage.removeItem(SIGNED_OUT_KEY);
    }
  } catch {
    /* see writeSession */
  }
}

const SIGNED_OUT_KEY = 'dna.signedOut';

/** Calls `handler` when another tab signs out of the session this tab holds. */
export function subscribeSignOut(handler) {
  const onStorage = (event) => {
    if (event.key !== SIGNED_OUT_KEY || !event.newValue) return;
    try {
      const { token } = JSON.parse(event.newValue);
      if (token && token === readToken()) {
        tabStore()?.removeItem(TOKEN_KEY);
        tabStore()?.removeItem(USER_KEY);
        handler();
      }
    } catch {
      /* A malformed notice is ignored. */
    }
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
