import { useEffect, useState, type FormEvent } from 'react';
import type { CardSet } from '../model/card';
import { prepareImage, type Store } from '../data/store';

interface Props {
  store: Store;
  sets: CardSet[];
  value: string | null;
  onChange: (set: CardSet | null) => void;
  onSetsChanged: () => Promise<void>;
}

/** Choose one of your sets, make a new one (with an uploaded symbol), or none. */
export default function SetPicker({ store, sets, value, onChange, onSetsChanged }: Props) {
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { setError('Give the set a code, like MOX.'); return; }
    setBusy(true);
    setError(null);
    try {
      const symbol = file ? await store.uploadImage(await prepareImage(file, 'symbol'), 'symbol') : undefined;
      const set: CardSet = { id: crypto.randomUUID(), code: code.trim().toUpperCase().slice(0, 4), name: name.trim(), symbol };
      await store.saveSet(set);
      await onSetsChanged();
      onChange(set);
      setCreating(false);
      setCode(''); setName(''); setFile(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="set-picker">
      <label className="field">
        <span>Set</span>
        <select value={value ?? ''} onChange={(e) => onChange(sets.find((s) => s.id === e.target.value) ?? null)}>
          <option value="">No set</option>
          {sets.map((s) => <option key={s.id} value={s.id}>{s.code}{s.name ? ` · ${s.name}` : ''}</option>)}
        </select>
      </label>
      {!creating ? (
        <button type="button" className="link left" onClick={() => setCreating(true)}>+ New set</button>
      ) : (
        <form className="new-set" onSubmit={create}>
          <div className="row two">
            <label className="field"><span>Code</span><input value={code} maxLength={4} placeholder="MOX" onChange={(e) => setCode(e.target.value.toUpperCase())} /></label>
            <label className="field"><span>Name</span><input value={name} placeholder="Moxtober" onChange={(e) => setName(e.target.value)} /></label>
          </div>
          <label className="file">
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <span>{file ? `Symbol: ${file.name}` : 'Upload set symbol (optional)'}</span>
          </label>
          <small className="muted">Tip: a plain black shape on a transparent background works best. It gets colored by rarity automatically.</small>
          {error && <p className="form-error">{error}</p>}
          <div className="row two">
            <button type="button" className="secondary wide" onClick={() => setCreating(false)}>Cancel</button>
            <button type="submit" className="primary wide" disabled={busy}>{busy ? 'Saving…' : 'Create set'}</button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Shows an uploaded image reference as a small preview. */
export function StoredImage({ store, src, className, alt = '' }: { store: Store; src?: string; className?: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!src) { setUrl(null); return; }
    store.resolveImage(src).then((u) => live && setUrl(u)).catch(() => live && setUrl(null));
    return () => { live = false; };
  }, [store, src]);
  return url ? <img src={url} alt={alt} className={className} /> : null;
}
