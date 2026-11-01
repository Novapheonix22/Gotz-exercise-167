import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { SITE_NAME } from '../site';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMessage({ kind: 'error', text: error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message });
  };

  const resetPassword = async () => {
    if (!supabase) return;
    if (!email.trim()) { setMessage({ kind: 'error', text: 'Type your email first.' }); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setBusy(false);
    setMessage(error ? { kind: 'error', text: error.message } : { kind: 'info', text: 'If that email has an account, a reset link is on its way.' });
  };

  return (
    <main className="page narrow">
      <h1>Sign in</h1>
      <p className="lead">Accounts on {SITE_NAME} are invitation only.</p>
      <form className="group" onSubmit={signIn}>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {message ? <p className={message.kind === 'error' ? 'form-error' : 'form-info'} role="status">{message.text}</p> : null}
        <button type="submit" className="primary wide" disabled={busy}>Sign in</button>
        <button type="button" className="link" onClick={resetPassword} disabled={busy}>Forgot password?</button>
      </form>
    </main>
  );
}
