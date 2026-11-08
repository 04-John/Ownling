// Hash routing, so every screen opens by URL (#/home, #/talk, #/recovery?from=ownership).
// navigate() updates React state in the same tick as other state changes, so a screen never
// renders with a new account but an old route (or the other way round).
import { useEffect, useMemo, useState } from 'react';

export type Route = { path: string; query: URLSearchParams };

type Listener = (hash: string) => void;
const listeners = new Set<Listener>();

const currentHash = () => window.location.hash.replace(/^#/, '') || '/';

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const url = `${window.location.pathname}${window.location.search}#${to}`;
  if (opts.replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
  listeners.forEach((l) => l(to));
}

export function useRoute(): Route {
  const [hash, setHash] = useState(currentHash);
  useEffect(() => {
    const onChange = () => setHash(currentHash());
    listeners.add(setHash);
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      listeners.delete(setHash);
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);
  return useMemo(() => {
    const [path, query = ''] = hash.split('?');
    return { path: path || '/', query: new URLSearchParams(query) };
  }, [hash]);
}

export const href = (to: string) => `#${to}`;
