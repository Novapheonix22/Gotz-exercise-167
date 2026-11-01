import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { newCard, type Card, type Legendary, type Rarity } from './model/card';
import type { Packs } from './render/frameResolver';
import { loadPack } from './render/packs';
import { CARD_H, CARD_W, renderCard } from './render/renderer';

const PREVIEW_SCALE = 0.4;
const MANA_KEYS = ['W', 'U', 'B', 'R', 'G', 'C', 'X', '1', '2', '3', '4'];

function usePacks() {
  const [packs, setPacks] = useState<Packs | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([
      loadPack('M15Regular-1'),
      loadPack('M15LegendCrowns'),
      loadPack('M15LegendCrownsFloating'),
      loadPack('M15HoloStamps'),
    ])
      .then(([regular, crowns, floatingCrowns, stamps]) => setPacks({ regular, crowns, floatingCrowns, stamps }))
      .catch((e: Error) => setError(e.message));
  }, []);
  return { packs, error };
}

function useCardRender(card: Card, packs: Packs | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(0);
  useEffect(() => {
    if (!packs || !canvasRef.current) return;
    const id = ++pending.current;
    const handle = requestAnimationFrame(async () => {
      setBusy(true);
      const off = document.createElement('canvas');
      await renderCard(off, card, packs, { scale: PREVIEW_SCALE });
      if (id !== pending.current || !canvasRef.current) return;
      const c = canvasRef.current;
      c.width = off.width;
      c.height = off.height;
      c.getContext('2d')!.drawImage(off, 0, 0);
      setBusy(false);
    });
    return () => cancelAnimationFrame(handle);
  }, [card, packs]);
  return { canvasRef, busy };
}

async function exportCard(card: Card, packs: Packs, kind: 'png' | 'jpg') {
  const canvas = document.createElement('canvas');
  const scale = kind === 'jpg' ? 744 / CARD_W : 1;
  await renderCard(canvas, card, packs, { scale });
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

export default function App() {
  const { packs, error } = usePacks();
  const [card, setCard] = useState<Card>(newCard);
  const { canvasRef, busy } = useCardRender(card, packs);
  const [exporting, setExporting] = useState(false);
  const drag = useRef<{ x: number; y: number; ax: number; ay: number } | null>(null);

  const set = <K extends keyof Card>(key: K, value: Card[K]) => setCard((c) => ({ ...c, [key]: value }));

  const onArt = (file: File | undefined) => {
    if (!file) return;
    setCard((c) => {
      if (c.art?.src.startsWith('blob:')) URL.revokeObjectURL(c.art.src);
      return { ...c, art: { src: URL.createObjectURL(file), x: 0, y: 0, zoom: 1 } };
    });
  };

  // Drag on the preview to move the art.
  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!card.art) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ax: card.art.x, ay: card.art.y };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drag.current || !card.art) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - drag.current.x) / rect.width;
    const dy = (e.clientY - drag.current.y) / rect.height;
    const start = drag.current;
    setCard((c) => (c.art ? { ...c, art: { ...c.art, x: start.ax + dx, y: start.ay + dy * (CARD_H / CARD_W) * (CARD_W / CARD_H) } } : c));
  };
  const onPointerUp = () => { drag.current = null; };

  const doExport = async (kind: 'png' | 'jpg') => {
    if (!packs) return;
    setExporting(true);
    try { await exportCard(card, packs, kind); } finally { setExporting(false); }
  };

  return (
    <div className="app">
      <header className="top">
        <h1>Card Maker</h1>
        <span className="tag">Phase 1 preview</span>
      </header>

      <main className="layout">
        <section className="preview" aria-label="Card preview">
          {error ? (
            <p className="error">{error}</p>
          ) : (
            <canvas
              ref={canvasRef}
              className={busy ? 'card busy' : 'card'}
              width={Math.round(CARD_W * PREVIEW_SCALE)}
              height={Math.round(CARD_H * PREVIEW_SCALE)}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              aria-label={`Preview of ${card.name}`}
            />
          )}
          <div className="actions">
            <button type="button" className="secondary" disabled={!packs || exporting} onClick={() => doExport('png')}>Full-size PNG</button>
            <button type="button" className="primary" disabled={!packs || exporting} onClick={() => doExport('jpg')}>Save JPG</button>
          </div>
        </section>

        <form className="form" onSubmit={(e) => e.preventDefault()}>
          <fieldset className="group">
            <label className="field">
              <span>Name</span>
              <input value={card.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <div className="field">
              <label htmlFor="cost">Mana cost</label>
              <input id="cost" value={card.manaCost} onChange={(e) => set('manaCost', e.target.value)} placeholder="{2}{W}{U}" />
              <div className="mana-keys" role="group" aria-label="Insert mana symbol">
                {MANA_KEYS.map((k) => (
                  <button key={k} type="button" className="mana-key" onClick={() => set('manaCost', card.manaCost + `{${k}}`)} aria-label={`Add ${k}`}>
                    <img src={`/cc/mana/${k.toLowerCase()}.svg`} alt="" />
                  </button>
                ))}
                <button type="button" className="mana-key text" onClick={() => set('manaCost', card.manaCost.replace(/\{[^}]*\}$/, ''))} aria-label="Remove last symbol">⌫</button>
              </div>
            </div>
          </fieldset>

          <fieldset className="group">
            <legend>Type line</legend>
            <div className="row three">
              <label className="field"><span>Supertype</span><input value={card.supertype} onChange={(e) => set('supertype', e.target.value)} /></label>
              <label className="field"><span>Type</span><input value={card.cardType} onChange={(e) => set('cardType', e.target.value)} /></label>
              <label className="field"><span>Subtype</span><input value={card.subtype} onChange={(e) => set('subtype', e.target.value)} /></label>
            </div>
          </fieldset>

          <fieldset className="group">
            <label className="field">
              <span>Rules text</span>
              <textarea rows={5} value={card.rulesText} onChange={(e) => set('rulesText', e.target.value)} />
              <small>Use {'{T}'}, {'{W}'}, {'{2/U}'}… for symbols and ~ for the card name.</small>
            </label>
            <label className="field">
              <span>Flavor text</span>
              <textarea rows={2} value={card.flavorText} onChange={(e) => set('flavorText', e.target.value)} />
            </label>
            <div className="row two">
              <label className="field"><span>Power</span><input value={card.power} onChange={(e) => set('power', e.target.value)} /></label>
              <label className="field"><span>Toughness</span><input value={card.toughness} onChange={(e) => set('toughness', e.target.value)} /></label>
            </div>
          </fieldset>

          <fieldset className="group">
            <legend>Frame</legend>
            <div className="segmented" role="radiogroup" aria-label="Legendary">
              {(['none', 'crown', 'floating'] as Legendary[]).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={card.legendary === v} className={card.legendary === v ? 'on' : ''} onClick={() => set('legendary', v)}>
                  {v === 'none' ? 'Not legendary' : v === 'crown' ? 'Legend crown' : 'Floating crown'}
                </button>
              ))}
            </div>
            <label className="toggle">
              <span>Holo stamp</span>
              <input type="checkbox" role="switch" checked={card.holoStamp} onChange={(e) => set('holoStamp', e.target.checked)} />
            </label>
          </fieldset>

          <fieldset className="group">
            <legend>Art</legend>
            <label className="file">
              <input type="file" accept="image/*" onChange={(e) => onArt(e.target.files?.[0])} />
              <span>{card.art ? 'Change art' : 'Choose art'}</span>
            </label>
            {card.art && (
              <>
                <label className="field">
                  <span>Zoom</span>
                  <input type="range" min={1} max={3} step={0.01} value={card.art.zoom} onChange={(e) => set('art', { ...card.art!, zoom: Number(e.target.value) })} />
                </label>
                <small>Drag the art on the card to move it.</small>
              </>
            )}
            <label className="field"><span>Artist</span><input value={card.artist} onChange={(e) => set('artist', e.target.value)} /></label>
          </fieldset>

          <fieldset className="group">
            <legend>Set and collector info</legend>
            <div className="row three">
              <label className="field"><span>Set code</span><input value={card.setCode} maxLength={4} onChange={(e) => set('setCode', e.target.value.toUpperCase())} /></label>
              <label className="field"><span>Number</span><input value={card.collectorNumber} onChange={(e) => set('collectorNumber', e.target.value)} /></label>
              <label className="field"><span>Of</span><input value={card.setTotal} onChange={(e) => set('setTotal', e.target.value)} /></label>
            </div>
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
          </fieldset>
        </form>
      </main>
    </div>
  );
}
