import { useEffect, useMemo, useState } from 'react';
import type { CardSet } from '../model/card';
import type { CardSummary, Store } from '../data/store';
import { go } from '../lib/router';

interface Props {
  store: Store;
  sets: CardSet[];
  onDuplicate: (id: string) => Promise<void>;
}

export default function Library({ store, sets, onDuplicate }: Props) {
  const [cards, setCards] = useState<CardSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [menu, setMenu] = useState<string | null>(null);

  const load = () => store.listCards().then(setCards).catch((e: Error) => setError(e.message));
  useEffect(() => { load(); }, [store]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    if (!cards) return [];
    const q = query.trim().toLowerCase();
    const shown = cards.filter((c) => (!q || c.name.toLowerCase().includes(q)) && (filter === 'all' || (filter === 'none' ? !c.setId : c.setId === filter)));
    const bySet = new Map<string, CardSummary[]>();
    for (const c of shown) {
      const key = c.setId && sets.some((s) => s.id === c.setId) ? c.setId : 'none';
      bySet.set(key, [...(bySet.get(key) ?? []), c]);
    }
    const ordered = [...sets.filter((s) => bySet.has(s.id)).map((s) => ({ key: s.id, title: `${s.code}${s.name ? ' · ' + s.name : ''}`, cards: bySet.get(s.id)! }))];
    if (bySet.has('none')) ordered.push({ key: 'none', title: 'Ungrouped', cards: bySet.get('none')! });
    return ordered;
  }, [cards, sets, query, filter]);

  const remove = async (id: string, name: string) => {
    setMenu(null);
    if (!confirm(`Delete “${name || 'Untitled'}”? This can’t be undone.`)) return;
    await store.deleteCard(id).catch((e: Error) => alert(e.message));
    load();
  };
  const duplicate = async (id: string) => {
    setMenu(null);
    await onDuplicate(id).catch((e: Error) => alert(e.message));
    load();
  };

  return (
    <main className="library">
      <div className="library-head">
        <h2>Cards</h2>
        <button type="button" className="primary new-card" onClick={() => go('new')}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 V14 M2 8 H14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          New Card
        </button>
      </div>
      <label className="search">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M11 11 L14.5 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        <input placeholder={`Search ${cards?.length ?? ''} cards`} aria-label="Search cards" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {sets.length > 0 && (
        <div className="chips" role="group" aria-label="Filter by set">
          {[{ id: 'all', label: 'All' }, ...sets.map((s) => ({ id: s.id, label: s.code })), { id: 'none', label: 'Ungrouped' }].map((c) => (
            <button key={c.id} type="button" aria-pressed={filter === c.id} className={filter === c.id ? 'chip on' : 'chip'} onClick={() => setFilter(c.id)}>{c.label}</button>
          ))}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      {cards === null && !error && <p className="muted">Loading your cards…</p>}
      {cards && cards.length === 0 && (
        <div className="empty">
          <p>No cards yet.</p>
          <button type="button" className="primary wide" onClick={() => go('new')}>Make your first card</button>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="set-group">
          <h3>{g.title} <span className="muted">{g.cards.length}</span></h3>
          <div className="card-grid">
            {g.cards.map((c) => (
              <div key={c.id} className="card-tile">
                <a href={`#/card/${c.id}`} className="thumb-link" aria-label={`Edit ${c.name || 'Untitled'}`}>
                  {c.thumb ? <img src={c.thumb} alt="" className="thumb" /> : <div className="thumb placeholder" />}
                </a>
                <div className="tile-row">
                  <span className="tile-name">{c.name || 'Untitled'}</span>
                  <button type="button" className="tile-menu" aria-label={`More for ${c.name || 'Untitled'}`} aria-expanded={menu === c.id} onClick={() => setMenu(menu === c.id ? null : c.id)}>⋯</button>
                </div>
                {menu === c.id && (
                  <div className="tile-actions">
                    <button type="button" onClick={() => duplicate(c.id)}>Duplicate</button>
                    <button type="button" className="danger-text" onClick={() => remove(c.id, c.name)}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
