import { useEffect, useState } from 'react';

/** Tiny hash router: "#/card/123" → ["card", "123"]. Works on any static host. */
export function useRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function go(path: string, replace = false) {
  const hash = '#/' + path.replace(/^\//, '');
  if (replace) history.replaceState(null, '', hash);
  else window.location.hash = hash;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}
