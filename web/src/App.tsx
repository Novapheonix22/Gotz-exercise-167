import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Editor, { type SaveState } from './Editor';
import Account from './pages/Account';
import Disclaimer from './pages/Disclaimer';
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';
import Library from './pages/Library';
import KindPicker from './pages/KindPicker';
import StyleFrame from './pages/StyleFrame';
import { arrivedToSetPassword, authConfigured, supabase } from './lib/supabase';
import { applyTheme, getTheme } from './lib/theme';
import { go, useRoute } from './lib/router';
import { createStore } from './data/store';
import { blankCard, type Card, type CardSet } from './model/card';
import { familyById } from './flow/families';
import { makeThumbnail, usePacks } from './components/CardCanvas';
import { setImageResolver } from './render/renderer';
import { DISCLAIMER_VERSION, SITE_NAME } from './site';

const DISCLAIMER_KEY = 'disclaimer-accepted';

function readAccepted() {
  try { return localStorage.getItem(DISCLAIMER_KEY) === DISCLAIMER_VERSION; } catch { return false; }
}

export default function App() {
  const [accepted, setAccepted] = useState(readAccepted);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!authConfigured);
  const [needsPassword, setNeedsPassword] = useState(arrivedToSetPassword);

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
  return <SignedIn session={session} />;
}

function SignedIn({ session }: { session: Session | null }) {
  const route = useRoute();
  const userId = session?.user.id ?? null;
  const store = useMemo(() => createStore(userId), [userId]);
  useEffect(() => { setImageResolver((ref) => store.resolveImage(ref)); }, [store]);
  const { packs, error: packError } = usePacks();
  const [sets, setSets] = useState<CardSet[]>([]);
  const [designer, setDesigner] = useState('');
  const loadSets = useCallback(() => store.listSets().then(setSets).catch(() => undefined), [store]);
  useEffect(() => { loadSets(); }, [loadSets]);
  useEffect(() => {
    if (!supabase || !userId) return;
    supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle().then(({ data }) => setDesigner(data?.display_name ?? ''));
  }, [userId]);

  // The card being created or edited.
  const [card, setCardState] = useState<Card | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [loadError, setLoadError] = useState<string | null>(null);
  const dirty = useRef(false);

  const setCard = useCallback((updater: (c: Card) => Card) => {
    dirty.current = true;
    setCardState((c) => (c ? updater(c) : c));
  }, []);

  const [section, id, sub] = route;

  // Start a draft when entering the flow for a family.
  useEffect(() => {
    if (section !== 'new' || !id) return;
    const family = familyById(id);
    if (!family?.ready) { go('new', true); return; }
    setCardState((c) => {
      if (c && isNew && c.family === id && !c.updatedAt) return c;
      const firstStyle = family.styles.find((s) => s.ready)?.id ?? 'regular';
      return { ...blankCard(id, firstStyle), designer };
    });
    setIsNew(true);
    dirty.current = false;
  }, [section, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load a saved card when opening it.
  useEffect(() => {
    if (section !== 'card' || !id) return;
    if (card?.id === id) return;
    setLoadError(null);
    store.getCard(id).then((c) => {
      if (!c) { setLoadError('This card could not be found.'); return; }
      dirty.current = false;
      setIsNew(false);
      setSaveState('saved');
      setCardState(c);
    }).catch((e: Error) => setLoadError(e.message));
  }, [section, id, store]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSymbolFor = (c: Card) => sets.find((s) => s.id === c.setId)?.symbol;

  const save = useCallback(async (c: Card) => {
    if (!packs) return;
    setSaveState('saving');
    try {
      const thumb = await makeThumbnail(c, packs, sets.find((s) => s.id === c.setId)?.symbol);
      await store.saveCard({ ...c, updatedAt: new Date().toISOString() }, thumb);
      setSaveState('saved');
    } catch (e) {
      console.error(e);
      setSaveState('error');
    }
  }, [packs, sets, store]);

  // Autosave edits to saved cards.
  useEffect(() => {
    if (!card || section !== 'card' || card.id !== id || !dirty.current) return;
    setSaveState('unsaved');
    const t = setTimeout(() => { dirty.current = false; save(card); }, 900);
    return () => clearTimeout(t);
  }, [card]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishSetup = async () => {
    if (!card) return;
    await save(card);
    go(`card/${card.id}`);
  };

  const duplicate = async (cardId: string) => {
    const original = await store.getCard(cardId);
    if (!original || !packs) return;
    const copy = { ...original, id: crypto.randomUUID(), name: `${original.name} (copy)`, updatedAt: new Date().toISOString() };
    await store.saveCard(copy, await makeThumbnail(copy, packs, setSymbolFor(copy)));
  };

  const leaveEditor = async () => {
    if (card && dirty.current) { dirty.current = false; await save(card); }
    setCardState(null);
    setIsNew(false);
    go('');
  };

  let body: React.ReactNode;
  if (packError) body = <main className="page narrow"><p className="form-error">{packError}</p></main>;
  else if (!packs) body = <main className="page narrow"><p className="lead">Loading frames…</p></main>;
  else if (section === 'account') body = <Account session={session} onShowDisclaimer={() => go('about')} />;
  else if (section === 'about') body = <Disclaimer />;
  else if (section === 'new' && !id) body = <KindPicker />;
  else if (section === 'new' && id && card) {
    body = (
      <StyleFrame card={card} setCard={(c) => setCardState(c)} packs={packs} store={store} sets={sets} onSetsChanged={loadSets}
        onBack={() => go('new')} onContinue={finishSetup} />
    );
  } else if (section === 'card' && id) {
    if (loadError) body = <main className="page narrow"><p className="form-error">{loadError}</p><button type="button" className="secondary wide" onClick={() => go('')}>Back to cards</button></main>;
    else if (!card || card.id !== id) body = <main className="page narrow"><p className="lead">Opening card…</p></main>;
    else if (sub === 'style') {
      body = (
        <StyleFrame card={card} setCard={(c) => setCard(() => c)} packs={packs} store={store} sets={sets} onSetsChanged={loadSets}
          onBack={() => history.back()} onContinue={() => go(`card/${card.id}`)} editing />
      );
    } else {
      body = (
        <Editor card={card} setCard={setCard} packs={packs} store={store} sets={sets} onSetsChanged={loadSets}
          saveState={saveState} isNew={isNew} onDone={leaveEditor} onChangeStyle={() => go(`card/${card.id}/style`)} />
      );
    }
  } else body = <Library store={store} sets={sets} onDuplicate={duplicate} />;

  const tab = section === 'account' || section === 'about' ? 'account' : 'cards';
  return (
    <Shell nav={
      <nav className="nav" aria-label="Main">
        <button type="button" className={tab === 'cards' ? 'on' : ''} onClick={() => (section === 'card' ? leaveEditor() : go(''))}>Cards</button>
        <button type="button" className={tab === 'account' ? 'on' : ''} onClick={() => go('account')}>Account</button>
      </nav>
    }>
      {body}
    </Shell>
  );
}

function Shell({ children, nav }: { children: React.ReactNode; nav?: React.ReactNode }) {
  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="#/">{SITE_NAME}</a>
        <span className="tag">Private preview</span>
        {nav}
      </header>
      {children}
      <footer className="foot">
        Unofficial fan project. Not affiliated with, endorsed, sponsored or approved by Wizards of the Coast. <a href="#/about">About</a>
      </footer>
    </div>
  );
}
