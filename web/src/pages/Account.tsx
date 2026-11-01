import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { applyTheme, getTheme, type Theme } from '../lib/theme';

export default function Account({ session, onShowDisclaimer }: { session: Session | null; onShowDisclaimer: () => void }) {
  const [displayName, setDisplayName] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [theme, setTheme] = useState<Theme>(getTheme());

  useEffect(() => {
    if (!supabase || !session) return;
    supabase.from('profiles').select('display_name').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name ?? ''));
  }, [session]);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !session) return;
    const { error } = await supabase.from('profiles').update({ display_name: displayName.trim() }).eq('id', session.user.id);
    setSaved(error ? error.message : 'Saved.');
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < 8) { setSaved('Use at least 8 characters.'); return; }
    const { error } = await supabase.auth.updateUser({ password });
    setSaved(error ? error.message : 'Password changed.');
    if (!error) setPassword('');
  };

  const pickTheme = (t: Theme) => { setTheme(t); applyTheme(t); };

  return (
    <main className="page narrow">
      <h1>Account</h1>
      {session ? <p className="lead">Signed in as {session.user.email}</p> : <p className="lead">Running without accounts (local development).</p>}

      {session ? (
        <>
          <form className="group" onSubmit={saveName}>
            <label className="field">
              <span>Designer name (shown on your cards)</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
            <button type="submit" className="secondary wide">Save name</button>
          </form>
          <form className="group" onSubmit={changePassword}>
            <label className="field">
              <span>New password</span>
              <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <button type="submit" className="secondary wide">Change password</button>
          </form>
        </>
      ) : null}
      {saved ? <p className="form-info" role="status">{saved}</p> : null}

      <div className="group">
        <span className="field-label">Appearance</span>
        <div className="segmented" role="radiogroup" aria-label="Appearance">
          {(['system', 'light', 'dark'] as Theme[]).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={theme === t} className={theme === t ? 'on' : ''} onClick={() => pickTheme(t)}>
              {t === 'system' ? 'System' : t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </div>

      <div className="group">
        <button type="button" className="secondary wide" onClick={onShowDisclaimer}>About this site</button>
        {session && supabase ? (
          <button type="button" className="danger wide" onClick={() => supabase!.auth.signOut()}>Sign out</button>
        ) : null}
      </div>
    </main>
  );
}
