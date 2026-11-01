import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Editor from './Editor';
import Account from './pages/Account';
import Disclaimer from './pages/Disclaimer';
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';
import { arrivedToSetPassword, authConfigured, supabase } from './lib/supabase';
import { applyTheme, getTheme } from './lib/theme';
import { DISCLAIMER_VERSION, SITE_NAME } from './site';

type View = 'editor' | 'account' | 'about';
const DISCLAIMER_KEY = 'disclaimer-accepted';

function readAccepted() {
  try { return localStorage.getItem(DISCLAIMER_KEY) === DISCLAIMER_VERSION; } catch { return false; }
}

export default function App() {
  const [accepted, setAccepted] = useState(readAccepted);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!authConfigured);
  const [needsPassword, setNeedsPassword] = useState(arrivedToSetPassword);
  const [view, setView] = useState<View>('editor');

  useEffect(() => { applyTheme(getTheme()); }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setNeedsPassword(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Record acceptance on the account too, once signed in.
  useEffect(() => {
    if (!supabase || !session || !accepted) return;
    supabase.from('profiles').update({ accepted_disclaimer_at: new Date().toISOString() })
      .eq('id', session.user.id).is('accepted_disclaimer_at', null).then(() => undefined);
  }, [session, accepted]);

  const accept = () => {
    try { localStorage.setItem(DISCLAIMER_KEY, DISCLAIMER_VERSION); } catch { /* storage unavailable */ }
    setAccepted(true);
  };

  if (!accepted) return <Shell><Disclaimer onAccept={accept} /></Shell>;
  if (!authReady) return <Shell><main className="page narrow"><p className="lead">Loading…</p></main></Shell>;
  if (authConfigured && !session) return <Shell><Login /></Shell>;
  if (session && needsPassword) {
    return <Shell><SetPassword onDone={() => { setNeedsPassword(false); history.replaceState(null, '', window.location.pathname); }} /></Shell>;
  }

  return (
    <Shell nav={
      <nav className="nav" aria-label="Main">
        <button type="button" className={view === 'editor' ? 'on' : ''} onClick={() => setView('editor')}>Editor</button>
        <button type="button" className={view === 'account' ? 'on' : ''} onClick={() => setView('account')}>Account</button>
      </nav>
    }>
      {view === 'editor' && <Editor />}
      {view === 'account' && <Account session={session} onShowDisclaimer={() => setView('about')} />}
      {view === 'about' && <Disclaimer />}
    </Shell>
  );
}

function Shell({ children, nav }: { children: React.ReactNode; nav?: React.ReactNode }) {
  return (
    <div className="app">
      <header className="top">
        <h1>{SITE_NAME}</h1>
        <span className="tag">Private preview</span>
        {nav}
      </header>
      {children}
      <footer className="foot">
        Unofficial fan project. Not affiliated with, endorsed, sponsored or approved by Wizards of the Coast.
      </footer>
    </div>
  );
}
