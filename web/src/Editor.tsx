import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Card, CardSet, Rarity } from './model/card';
import { typeLine } from './model/card';
import type { Packs } from './render/frameResolver';
import { CARD_W, renderCard } from './render/renderer';
import { prepareImage, type Store } from './data/store';
import { normalizeManaCost, setGeneric } from './render/manaOrder';
import { CardCanvas } from './components/CardCanvas';
import SetPicker, { StoredImage } from './components/SetPicker';
import { familyById } from './flow/families';
import { Steps } from './pages/KindPicker';

const PREVIEW_SCALE = 0.4;
const COLOR_KEYS = ['W', 'U', 'B', 'R', 'G', 'C', 'X', 'S'];
const RULES_KEYS = ['T', 'Q', 'W', 'U', 'B', 'R', 'G', 'C', 'X', 'E'];
const GENERIC = Array.from({ length: 21 }, (_, i) => i);
const genericOf = (cost: string) => cost.match(/\{(\d+)\}/)?.[1];

export type SaveState = 'saved' | 'saving' | 'error' | 'unsaved';

interface Props {
  card: Card;
  setCard: (updater: (c: Card) => Card) => void;
  packs: Packs;
  store: Store;
  sets: CardSet[];
  onSetsChanged: () => Promise<void>;
  saveState: SaveState;
  isNew: boolean;
  onDone: () => void;
  onChangeStyle: () => void;
}

async function exportCard(card: Card, packs: Packs, kind: 'png' | 'jpg', setSymbol?: string) {
  const canvas = document.createElement('canvas');
  await renderCard(canvas, card, packs, { scale: kind === 'jpg' ? 744 / CARD_W : 1, setSymbol });
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, kind === 'jpg' ? 'image/jpeg' : 'image/png', 0.95));
  if (!blob) return;
  const fileName = `${card.name.trim() || 'card'}.${kind}`;
  const file = new File([blob], fileName, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch { /* fall back to download */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Editor({ card, setCard, packs, store, sets, onSetsChanged, saveState, isNew, onDone, onChangeStyle }: Props) {
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; ax: number; ay: number } | null>(null);
  const set = <K extends keyof Card>(key: K, value: Card[K]) => setCard((c) => ({ ...c, [key]: value }));
  const cardSet = sets.find((s) => s.id === card.setId);
  const setSymbol = cardSet?.symbol;
  const family = familyById(card.family);
  const style = family?.styles.find((s) => s.id === card.style);
  const isLand = typeLine(card).includes('Land');

  const upload = async (file: File | undefined, kind: 'art' | 'symbol') => {
    if (!file) return;
    setUploading(kind);
    try {
      const ref = await store.uploadImage(await prepareImage(file, kind), kind);
      if (kind === 'art') setCard((c) => ({ ...c, art: { src: ref, x: 0, y: 0, zoom: 1 } }));
      else setCard((c) => ({ ...c, setSymbol: ref }));
    } catch (e) {
      alert(`Upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(null);
    }
  };

  // Drag on the preview to move the art.
  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!card.art) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ax: card.art.x, ay: card.art.y };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const start = drag.current;
    if (!start) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - start.x) / rect.width;
    const dy = (e.clientY - start.y) / rect.height;
    setCard((c) => (c.art ? { ...c, art: { ...c.art, x: start.ax + dx, y: start.ay + dy } } : c));
  };
  const onPointerUp = () => { drag.current = null; };

  const doExport = async (kind: 'png' | 'jpg') => {
    setExporting(true);
    try { await exportCard(card, packs, kind, setSymbol); } finally { setExporting(false); }
  };

  const chooseSet = (s: CardSet | null) => setCard((c) => ({ ...c, setId: s?.id ?? null, setCode: s?.code ?? c.setCode }));

  return (
    <>
      <div className="flow-top editor-top">
        {isNew ? <Steps step={3} total={3} /> : <span className="muted">{family?.name} · {style?.name}</span>}
        <span className={`save-state ${saveState}`} role="status">
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Not saved' : ''}
        </span>
        <button type="button" className="primary done" onClick={onDone}>Done</button>
      </div>
      <main className="layout">
        <section className="preview" aria-label="Card preview">
          <CardCanvas
            card={card} packs={packs} scale={PREVIEW_SCALE} setSymbol={setSymbol} className="card"
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            aria-label={`Preview of ${card.name || 'your card'}`}
          />
          <div className="actions">
            <button type="button" className="secondary" disabled={exporting} onClick={() => doExport('png')}>Full-size PNG</button>
            <button type="button" className="primary" disabled={exporting} onClick={() => doExport('jpg')}>Save JPG</button>
          </div>
        </section>

        <form className="form" onSubmit={(e) => e.preventDefault()}>
          <fieldset className="group">
            <label className="field">
              <span>{card.toggles.nickname ? 'True name (small, under the nickname)' : 'Name'}</span>
              <input value={card.name} placeholder="Card name" onChange={(e) => set('name', e.target.value)} />
            </label>
            {card.toggles.nickname && (
              <label className="field">
                <span>Nickname (big, in the title bar)</span>
                <input value={card.nickname} onChange={(e) => set('nickname', e.target.value)} />
              </label>
            )}
            {!isLand && (
              <div className="field">
                <label htmlFor="cost">Mana cost</label>
                <input id="cost" value={card.manaCost} placeholder="{2}{W}{U}"
                  onChange={(e) => set('manaCost', e.target.value)}
                  onBlur={(e) => set('manaCost', normalizeManaCost(e.target.value))} />
                <small>Colors are put in the official order automatically.</small>
                <div className="mana-keys" role="group" aria-label="Add mana symbol">
                  {COLOR_KEYS.map((k) => (
                    <button key={k} type="button" className="mana-key" onClick={() => set('manaCost', normalizeManaCost(card.manaCost + `{${k}}`))} aria-label={`Add ${k}`}>
                      <img src={`/cc/mana/${k.toLowerCase()}.svg`} alt="" />
                    </button>
                  ))}
                  <button type="button" className="mana-key text" onClick={() => set('manaCost', card.manaCost.replace(/\{[^}]*\}$/, ''))} aria-label="Remove last symbol">⌫</button>
                </div>
                <span className="field-label">Generic</span>
                <div className="generic-keys" role="group" aria-label="Set generic mana">
                  {GENERIC.map((n) => (
                    <button key={n} type="button" className={genericOf(card.manaCost) === String(n) ? 'mana-key small on' : 'mana-key small'}
                      aria-pressed={genericOf(card.manaCost) === String(n)} aria-label={`Generic ${n}`}
                      onClick={() => set('manaCost', genericOf(card.manaCost) === String(n) ? normalizeManaCost(card.manaCost.replace(/\{\d+\}/g, '')) : setGeneric(card.manaCost, n))}>
                      <img src={`/cc/mana/${n}.svg`} alt="" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </fieldset>

          <fieldset className="group">
            <legend>Type line</legend>
            <div className="row three">
              <label className="field"><span>Supertype</span><input value={card.supertype} placeholder="Legendary" onChange={(e) => set('supertype', e.target.value)} /></label>
              <label className="field"><span>Type</span><input value={card.cardType} list="card-types" onChange={(e) => set('cardType', e.target.value)} /></label>
              <label className="field"><span>Subtype</span><input value={card.subtype} onChange={(e) => set('subtype', e.target.value)} /></label>
            </div>
            <datalist id="card-types">
              {['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Artifact Creature', 'Enchantment Creature', 'Land', 'Kindred Instant', 'Artifact Land'].map((t) => <option key={t} value={t} />)}
            </datalist>
          </fieldset>

          <fieldset className="group">
            <label className="field">
              <span>Rules text</span>
              <textarea rows={5} value={card.rulesText} onChange={(e) => set('rulesText', e.target.value)} />
              <small>Symbols: {'{T}'}, {'{W}'}, {'{2/U}'}, {'{G/P}'}… · ~ = card name · (reminder text) turns italic</small>
            </label>
            <div className="mana-keys" role="group" aria-label="Insert symbol into rules text">
              {RULES_KEYS.map((k) => (
                <button key={k} type="button" className="mana-key" onClick={() => set('rulesText', card.rulesText + `{${k}}`)} aria-label={`Add ${k} to rules text`}>
                  <img src={`/cc/mana/${k === 'Q' ? 'untap' : k.toLowerCase()}.svg`} alt="" />
                </button>
              ))}
            </div>
            <div className="generic-keys" role="group" aria-label="Insert generic mana into rules text">
              {GENERIC.map((n) => (
                <button key={n} type="button" className="mana-key small" onClick={() => set('rulesText', card.rulesText + `{${n}}`)} aria-label={`Add ${n} to rules text`}>
                  <img src={`/cc/mana/${n}.svg`} alt="" />
                </button>
              ))}
            </div>
            <label className="field">
              <span>Flavor text</span>
              <textarea rows={2} value={card.flavorText} onChange={(e) => set('flavorText', e.target.value)} />
            </label>
            {!isLand && (
              <div className="row two">
                <label className="field"><span>Power</span><input value={card.power} inputMode="numeric" onChange={(e) => set('power', e.target.value)} /></label>
                <label className="field"><span>Toughness</span><input value={card.toughness} inputMode="numeric" onChange={(e) => set('toughness', e.target.value)} /></label>
              </div>
            )}
          </fieldset>

          <fieldset className="group">
            <legend>Art</legend>
            <label className="file">
              <input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0], 'art')} />
              <span>{uploading === 'art' ? 'Uploading…' : card.art ? 'Change art' : 'Choose art'}</span>
            </label>
            {card.art && (
              <>
                <label className="field">
                  <span>Zoom</span>
                  <input type="range" min={1} max={3} step={0.01} value={card.art.zoom} onChange={(e) => set('art', { ...card.art!, zoom: Number(e.target.value) })} />
                </label>
                <div className="row two">
                  <small className="muted">Drag the art on the card to move it.</small>
                  <button type="button" className="link" onClick={() => set('art', { ...card.art!, x: 0, y: 0, zoom: 1 })}>Reset position</button>
                </div>
              </>
            )}
            <label className="field"><span>Artist</span><input value={card.artist} onChange={(e) => set('artist', e.target.value)} /></label>
          </fieldset>

          <fieldset className="group">
            <legend>Set and collector info</legend>
            <SetPicker store={store} sets={sets} value={card.setId} onChange={chooseSet} onSetsChanged={onSetsChanged} />
            <div className="row three">
              <label className="field"><span>Set code</span><input value={card.setCode} maxLength={4} onChange={(e) => set('setCode', e.target.value.toUpperCase())} /></label>
              <label className="field"><span>Number</span><input value={card.collectorNumber} onChange={(e) => set('collectorNumber', e.target.value)} /></label>
              <label className="field"><span>Of</span><input value={card.setTotal} onChange={(e) => set('setTotal', e.target.value)} /></label>
            </div>
            <div className="row two">
              <label className="field">
                <span>Rarity</span>
                <select value={card.rarity} onChange={(e) => set('rarity', e.target.value as Rarity)}>
                  <option value="C">Common</option>
                  <option value="U">Uncommon</option>
                  <option value="R">Rare</option>
                  <option value="M">Mythic</option>
                  <option value="S">Special</option>
                  <option value="P">Promo</option>
                  <option value="L">Land</option>
                  <option value="T">Token</option>
                </select>
              </label>
              <label className="field"><span>Language</span><input value={card.language} maxLength={2} onChange={(e) => set('language', e.target.value.toUpperCase())} /></label>
            </div>
            <div className="symbol-row">
              <StoredImage store={store} src={card.setSymbol ?? setSymbol} className="symbol-preview" alt="Set symbol" />
              <label className="file">
                <input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0], 'symbol')} />
                <span>{uploading === 'symbol' ? 'Uploading…' : card.setSymbol ? 'Change this card’s symbol' : 'Use a different symbol on this card'}</span>
              </label>
            </div>
            {card.setSymbol && <button type="button" className="link left" onClick={() => set('setSymbol', undefined)}>Use the set’s symbol</button>}
            <label className="toggle">
              <span className="toggle-text"><span>Color symbol by rarity</span><small className="muted">Off = use the image exactly as uploaded</small></span>
              <input type="checkbox" role="switch" checked={card.tintSymbol} onChange={(e) => set('tintSymbol', e.target.checked)} />
            </label>
          </fieldset>

          <fieldset className="group">
            <legend>Frame</legend>
            <p className="muted small">{family?.name} · {style?.name}{card.legendary !== 'none' ? ' · Legendary' : ''}{card.toggles.nickname ? ' · Nickname' : ''}{card.toggles.snow ? ' · Snow' : ''}{card.toggles.nyx ? ' · Nyx' : ''}{card.toggles.devoid ? ' · Devoid' : ''}</p>
            <button type="button" className="secondary wide" onClick={onChangeStyle}>Change style and frame</button>
            <label className="toggle">
              <span>Holo stamp</span>
              <input type="checkbox" role="switch" checked={card.holoStamp} onChange={(e) => set('holoStamp', e.target.checked)} />
            </label>
          </fieldset>
        </form>
      </main>
    </>
  );
}
