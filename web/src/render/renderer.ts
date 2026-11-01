// Draws a card onto a canvas. The same code makes the live preview and the export.

import type { Card } from '../model/card';
import { typeLine } from '../model/card';
import { buildLayers, layoutPack, type Bounds, type FrameLayer, type Packs } from './frameResolver';
import type { TextBoxSpec } from './packs';
import { parseManaCost, symbolFile } from './symbols';
import { ASCENT, layoutText, tokenize, type Layout } from './textLayout';

export const CARD_W = 2010;
export const CARD_H = 2814;

// ---------- assets ----------

const images = new Map<string, Promise<HTMLImageElement>>();

/** Turns "storage:<path>" references into a loadable URL. Set by the app once signed in. */
let resolveRef: (ref: string) => Promise<string> = async (ref) => ref;
export function setImageResolver(fn: (ref: string) => Promise<string>) { resolveRef = fn; }

export function loadImage(src: string): Promise<HTMLImageElement> {
  if (!images.has(src)) {
    images.set(src, (async () => {
      const url = src.startsWith('storage:') ? await resolveRef(src) : src;
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        // Keep the canvas exportable when images come from another site (e.g. Supabase storage).
        if (/^https?:/.test(url)) img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => { images.delete(src); reject(new Error(`Could not load image: ${src.startsWith('data:') ? 'data URL' : src}`)); };
        img.src = url;
      });
    })());
  }
  return images.get(src)!;
}

const FONTS: [string, string, FontFaceDescriptors?][] = [
  ['belerenb', '/cc/fonts/beleren-b.ttf'],
  ['belerenbsc', '/cc/fonts/beleren-bsc.ttf'],
  ['mplantin', '/cc/fonts/mplantin.ttf'],
  ['mplantini', '/cc/fonts/mplantin-i.ttf'],
  ['gothammedium', '/cc/fonts/gotham-medium.ttf'],
];
let fontsReady: Promise<void> | null = null;
export function loadFonts(): Promise<void> {
  fontsReady ??= Promise.all(FONTS.map(async ([family, url, desc]) => {
    const face = new FontFace(family, `url(${url})`, desc);
    document.fonts.add(await face.load());
  })).then(() => undefined);
  return fontsReady;
}

const symbolSrc = (file: string) => `/cc/mana/${file}.svg`;

// ---------- layers ----------

const layerCache = new Map<string, Promise<CanvasImageSource>>();

/** A layer with its masks applied, as a full-card-size image. Cached. */
function composeLayer(layer: FrameLayer): Promise<CanvasImageSource> {
  const key = JSON.stringify([layer.src, layer.masks, layer.bounds]);
  if (!layerCache.has(key)) {
    layerCache.set(key, (async () => {
      const img = await loadImage(layer.src);
      if (!layer.masks.length) return img;
      const c = document.createElement('canvas');
      c.width = CARD_W;
      c.height = CARD_H;
      const ctx = c.getContext('2d')!;
      drawInBounds(ctx, img, layer.bounds);
      ctx.globalCompositeOperation = 'destination-in';
      for (const m of layer.masks) ctx.drawImage(await loadImage(m), 0, 0, CARD_W, CARD_H);
      return c;
    })());
  }
  return layerCache.get(key)!;
}

function drawInBounds(ctx: CanvasRenderingContext2D, img: CanvasImageSource, b?: Bounds) {
  if (!b) ctx.drawImage(img, 0, 0, CARD_W, CARD_H);
  else ctx.drawImage(img, b.x * CARD_W, b.y * CARD_H, b.width * CARD_W, b.height * CARD_H);
}

// ---------- art ----------

function drawPlaceholderArt(ctx: CanvasRenderingContext2D, b: Bounds) {
  const x = b.x * CARD_W, y = b.y * CARD_H, w = b.width * CARD_W, h = b.height * CARD_H;
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, '#2b2a4a');
  sky.addColorStop(1, '#c98a5a');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ffe6b0';
  ctx.beginPath();
  ctx.arc(x + w * 0.7, y + h * 0.3, h * 0.12, 0, Math.PI * 2);
  ctx.fill();
  const ridge = (pts: number[][], color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    for (const [px, py] of pts) ctx.lineTo(x + px * w, y + py * h);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
  };
  ridge([[0, 0.55], [0.13, 0.42], [0.26, 0.56], [0.43, 0.3], [0.59, 0.53], [0.71, 0.38], [0.87, 0.58], [1, 0.45]], '#6b4e5e');
  ridge([[0, 0.7], [0.18, 0.56], [0.34, 0.73], [0.5, 0.59], [0.69, 0.77], [0.84, 0.64], [1, 0.73]], '#4a3446');
  ridge([[0, 0.86], [0.23, 0.76], [0.4, 0.88], [0.63, 0.79], [0.83, 0.9], [1, 0.82]], '#2a1e2c');
}

async function drawArt(ctx: CanvasRenderingContext2D, card: Card, b: Bounds) {
  if (!card.art) return drawPlaceholderArt(ctx, b);
  const img = await loadImage(card.art.src);
  const bx = b.x * CARD_W, by = b.y * CARD_H, bw = b.width * CARD_W, bh = b.height * CARD_H;
  const cover = Math.max(bw / img.naturalWidth, bh / img.naturalHeight) * card.art.zoom;
  const w = img.naturalWidth * cover, h = img.naturalHeight * cover;
  const cx = bx + bw / 2 + card.art.x * CARD_W, cy = by + bh / 2 + card.art.y * CARD_H;
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.clip();
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

// ---------- text ----------

const FAMILY: Record<string, string> = {
  belerenb: 'belerenb', belerenbsc: 'belerenbsc', mplantin: 'mplantin', gothammedium: 'gothammedium',
};

function fontFor(spec: TextBoxSpec, italic: boolean, size: number) {
  const fam = spec.font ? FAMILY[spec.font] ?? spec.font : 'mplantin';
  if (fam === 'mplantin' && italic) return `${size}px mplantini`;
  return `${italic ? 'italic ' : ''}${size}px ${fam}`;
}

interface DrawTextOptions {
  color?: string;
  shadow?: { x: number; y: number };
  centerVertically?: boolean;
  autoItalic?: boolean;
  italic?: boolean;
  cardName?: string;
  /** Override the box width (e.g. to leave room for the mana cost). */
  width?: number;
  /** Soft drop shadow behind text (canvas shadow). */
  textShadow?: { x: number; y: number };
  /** Inner padding as a fraction of card height. */
  padTop?: number;
  padBottom?: number;
}

async function drawTextBox(ctx: CanvasRenderingContext2D, spec: TextBoxSpec, text: string, o: DrawTextOptions = {}): Promise<Layout | null> {
  if (!text.trim()) return null;
  const x = (spec.x ?? 0) * CARD_W;
  const y = ((spec.y ?? 0) + (o.padTop ?? 0)) * CARD_H;
  const width = o.width ?? (spec.width ?? 1) * CARD_W;
  const height = ((spec.height ?? 1) - (o.padTop ?? 0) - (o.padBottom ?? 0)) * CARD_H;
  const size = (spec.size ?? 0.038) * CARD_H;

  const tokens = tokenize(text, { cardName: o.cardName, autoItalicReminder: o.autoItalic, italic: o.italic });
  const measure = (t: string, italic: boolean, s: number) => { ctx.font = fontFor(spec, italic, s); return ctx.measureText(t).width; };
  const layout = layoutText(tokens, measure, {
    width, height, size, oneLine: spec.oneLine, align: spec.align, centerVertically: o.centerVertically,
  });

  ctx.save();
  ctx.fillStyle = o.color ?? '#000';
  ctx.textBaseline = 'alphabetic';
  if (o.textShadow) {
    ctx.shadowColor = '#000';
    ctx.shadowOffsetX = o.textShadow.x;
    ctx.shadowOffsetY = o.textShadow.y;
  }
  for (const line of layout.lines) {
    for (const item of line.items) {
      if (item.kind === 'text') {
        ctx.font = fontFor(spec, item.italic, layout.size);
        ctx.fillText(item.text, x + item.x, y + line.baseline);
      } else {
        const img = await loadImage(symbolSrc(item.file));
        const top = y + line.baseline - ASCENT * layout.size + 0.34 * layout.size - item.size / 2;
        if (o.shadow) {
          ctx.save();
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.arc(x + item.x + item.size / 2 + o.shadow.x, top + item.size / 2 + o.shadow.y, item.size / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.drawImage(img, x + item.x, top, item.size, item.size);
      }
    }
  }
  if (layout.bars.length) {
    const bar = await loadImage('/cc/mana/bar.png');
    for (const by of layout.bars) {
      const bw = width * 0.9;
      const bh = bw * (bar.naturalHeight / bar.naturalWidth);
      ctx.drawImage(bar, x + (width - bw) / 2, y + by - bh / 2, bw, bh);
    }
  }
  ctx.restore();
  return layout;
}

function manaCostWidth(cost: string, spec: TextBoxSpec) {
  const n = parseManaCost(cost).length;
  const size = (spec.size ?? 0.043) * CARD_H;
  return n * size * 0.86;
}

// ---------- card ----------

export interface RenderOptions {
  scale?: number;
  /** Set symbol image reference to use when the card has none of its own (from its set). */
  setSymbol?: string;
}

const NICKNAME_TRUE_NAME: TextBoxSpec = {
  x: 0.14, y: 0.1129, width: 0.72, height: 0.0243, oneLine: true, font: 'mplantini', size: 0.0229, align: 'center',
};

const RARITY_FILL: Record<string, [string, string] | string> = {
  C: '#111111',
  U: ['#6b7a85', '#d7e0e6'],
  R: ['#8a6a1f', '#f1d68d'],
  M: ['#b33a12', '#f5a04a'],
  S: ['#5a2d7a', '#c89be3'],
  P: ['#5a2d7a', '#c89be3'],
  L: '#111111',
  T: '#111111',
};

/** Draws the set symbol right-aligned on the type line. Returns the width used (0 if none). */
async function drawSetSymbol(ctx: CanvasRenderingContext2D, card: Card, ref: string | undefined, b?: Bounds & { horizontal?: string }) {
  if (!ref || !b) return 0;
  const img = await loadImage(ref).catch(() => null);
  if (!img || !img.naturalWidth) return 0;
  const h = b.height * CARD_H;
  const maxW = b.width * CARD_W;
  let w = h * (img.naturalWidth / img.naturalHeight);
  let dh = h;
  if (w > maxW) { dh = h * (maxW / w); w = maxW; }
  const right = b.x * CARD_W;
  const x = right - w;
  const y = b.y * CARD_H - dh / 2;

  if (!card.tintSymbol) {
    ctx.drawImage(img, x, y, w, dh);
    return w;
  }
  // Color by rarity with an outline, like printed set symbols.
  const pad = Math.ceil(h * 0.12);
  const c = document.createElement('canvas');
  c.width = Math.ceil(w + pad * 2);
  c.height = Math.ceil(dh + pad * 2);
  const g = c.getContext('2d')!;
  const outline = document.createElement('canvas');
  outline.width = c.width;
  outline.height = c.height;
  const o = outline.getContext('2d')!;
  const stroke = Math.max(2, h * 0.06);
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    o.drawImage(img, pad + Math.cos(ang) * stroke, pad + Math.sin(ang) * stroke, w, dh);
  }
  o.globalCompositeOperation = 'source-in';
  o.fillStyle = card.rarity === 'C' || card.rarity === 'L' || card.rarity === 'T' ? '#ffffff' : '#000000';
  o.fillRect(0, 0, outline.width, outline.height);
  g.drawImage(outline, 0, 0);

  const fillCanvas = document.createElement('canvas');
  fillCanvas.width = c.width;
  fillCanvas.height = c.height;
  const f = fillCanvas.getContext('2d')!;
  f.drawImage(img, pad, pad, w, dh);
  f.globalCompositeOperation = 'source-in';
  const fill = RARITY_FILL[card.rarity] ?? '#111111';
  if (typeof fill === 'string') f.fillStyle = fill;
  else {
    const grad = f.createLinearGradient(0, pad, 0, pad + dh);
    grad.addColorStop(0, fill[1]);
    grad.addColorStop(0.5, fill[0]);
    grad.addColorStop(1, fill[1]);
    f.fillStyle = grad;
  }
  f.fillRect(0, 0, fillCanvas.width, fillCanvas.height);
  g.drawImage(fillCanvas, 0, 0);
  ctx.drawImage(c, x - pad, y - pad);
  return w;
}

export async function renderCard(canvas: HTMLCanvasElement, card: Card, packs: Packs, opts: RenderOptions = {}) {
  const symbolRef = card.setSymbol || opts.setSymbol;
  await loadFonts();
  const version = layoutPack(card, packs).version ?? packs.regular.version!;
  const layers = buildLayers(card, packs);
  // Load everything before touching the canvas so the preview never flickers.
  const composed = await Promise.all(layers.map(composeLayer));
  const symbolFiles = new Set<string>(parseManaCost(card.manaCost).map((t) => t.file));
  for (const t of parseManaCost(card.face2?.manaCost ?? '')) symbolFiles.add(t.file);
  for (const m of `${card.rulesText} ${card.flavorText} ${card.face2?.rulesText ?? ''}`.matchAll(/\{([^}]+)\}/g)) {
    const f = symbolFile(m[1]);
    if (f) symbolFiles.add(f);
  }
  await Promise.all([...symbolFiles].map((f) => loadImage(symbolSrc(f)).catch(() => null)));
  if (card.art) await loadImage(card.art.src).catch(() => null);
  if (symbolRef) await loadImage(symbolRef).catch(() => null);

  const scale = opts.scale ?? 1;
  const off = document.createElement('canvas');
  off.width = CARD_W;
  off.height = CARD_H;
  const ctx = off.getContext('2d')!;

  // Masked layers are pre-composed at full card size; plain layers are drawn at their bounds.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  if (version.artBounds) await drawArt(ctx, card, version.artBounds);
  for (let i = 0; i < layers.length; i++) {
    const l = layers[i];
    if (l.masks.length) ctx.drawImage(composed[i], 0, 0, CARD_W, CARD_H);
    else drawInBounds(ctx, composed[i], l.bounds);
  }

  const t = version.text;
  // Mana cost (right-aligned, with symbol shadows)
  if (t.mana) {
    await drawTextBox(ctx, t.mana, parseManaCost(card.manaCost).map((s) => `{${s.file}}`).join(''), {
      shadow: { x: (t.mana.shadowX ?? 0) * CARD_W, y: (t.mana.shadowY ?? 0) * CARD_H },
    });
  }
  if (t.title) {
    const manaLeft = (t.mana?.width ?? 0.93) * CARD_W - manaCostWidth(card.manaCost, t.mana ?? {});
    const titleX = (t.title.x ?? 0) * CARD_W;
    const width = Math.min((t.title.width ?? 1) * CARD_W, manaLeft - titleX - CARD_W * 0.01);
    // With a nickname, the big title shows the nickname and the true name goes underneath (Card Conjurer's layout).
    const nick = card.toggles.nickname && card.nickname.trim();
    await drawTextBox(ctx, t.title, nick ? card.nickname : card.name, { width });
    if (nick && card.name.trim()) {
      await drawTextBox(ctx, NICKNAME_TRUE_NAME, card.name, {
        color: '#fff', shadow: undefined, textShadow: { x: 0.0014 * CARD_W, y: 0.001 * CARD_H },
      });
    }
  }
  const symbolWidth = await drawSetSymbol(ctx, card, symbolRef, version.setSymbolBounds);
  if (t.type) {
    const full = (t.type.width ?? 1) * CARD_W;
    await drawTextBox(ctx, t.type, typeLine(card), { width: full - (symbolWidth ? symbolWidth + CARD_W * 0.012 : 0) });
  }
  if (t.rules) {
    const body = card.flavorText.trim() ? `${card.rulesText}{flavor}${card.flavorText}` : card.rulesText;
    const hasPT = !!(card.power.trim() || card.toughness.trim());
    await drawTextBox(ctx, t.rules, body, {
      centerVertically: true, autoItalic: true, cardName: card.name,
      padTop: 0.008, padBottom: hasPT ? 0.03 : 0.012,
    });
  }
  if (t.pt && (card.power.trim() || card.toughness.trim())) {
    const vehicle = typeLine(card).includes('Vehicle');
    await drawTextBox(ctx, t.pt, `${card.power}/${card.toughness}`, { color: vehicle ? '#fff' : '#000' });
  }
  await drawSecondFace(ctx, card, t);
  await drawCollectorInfo(ctx, card);

  canvas.width = Math.round(CARD_W * scale);
  canvas.height = Math.round(CARD_H * scale);
  const out = canvas.getContext('2d')!;
  out.imageSmoothingQuality = 'high';
  out.drawImage(off, 0, 0, canvas.width, canvas.height);
}

/** Adventure / Omen / Prepare: the second spell's name, cost, type and text. */
async function drawSecondFace(ctx: CanvasRenderingContext2D, card: Card, t: Record<string, TextBoxSpec>) {
  if (!t.title2 || !t.rules2) return;
  const f = card.face2;
  const cost = parseManaCost(f.manaCost).map((s) => `{${s.file}}`).join('');
  if (t.mana2 && cost) {
    await drawTextBox(ctx, t.mana2, cost, { shadow: { x: -0.001 * CARD_W, y: 0.0029 * CARD_H } });
  }
  if (f.name.trim()) {
    const manaRight = ((t.mana2?.x ?? 0) + (t.mana2?.width ?? 0)) * CARD_W;
    const used = cost ? manaCostWidth(f.manaCost, t.mana2 ?? {}) : 0;
    const titleX = (t.title2.x ?? 0) * CARD_W;
    const width = Math.min((t.title2.width ?? 1) * CARD_W, cost ? manaRight - used - titleX - CARD_W * 0.008 : Infinity);
    await drawTextBox(ctx, t.title2, f.name, { color: '#fff', width });
  }
  if (t.type2 && f.typeLine.trim()) await drawTextBox(ctx, t.type2, f.typeLine, { color: '#fff' });
  if (f.rulesText.trim()) {
    await drawTextBox(ctx, t.rules2, f.rulesText, { centerVertically: true, autoItalic: true, cardName: f.name || card.name });
  }
}

async function drawCollectorInfo(ctx: CanvasRenderingContext2D, card: Card) {
  const size = 0.0171 * CARD_H;
  const x = 0.0647 * CARD_W;
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `${size}px gothammedium`;
  const number = [card.collectorNumber, card.setTotal].filter(Boolean).join('/');
  ctx.fillText(`${number} ${card.rarity}`.trim(), x, 0.9377 * CARD_H + size * 0.85);
  const line2 = [card.setCode.trim(), card.language.trim()].filter(Boolean).join(" • ");
  const y2 = 0.9548 * CARD_H + size * 0.85;
  ctx.fillText(line2, x, y2);
  if (card.artist.trim()) {
    let ax = x + ctx.measureText(line2 + '  ').width;
    const brush = await loadImage('/cc/mana/whitebrush.svg').catch(() => null);
    if (brush) {
      const bw = size * 1.6, bh = size * 0.9;
      ctx.drawImage(brush, ax, y2 - bh * 0.9, bw, bh);
      ax += bw + size * 0.3;
    }
    ctx.font = `${size}px belerenbsc`;
    ctx.fillText(card.artist, ax, y2);
  }
  if (card.designer.trim()) {
    ctx.font = `${size}px gothammedium`;
    ctx.textAlign = 'right';
    ctx.fillText(card.designer, CARD_W - x, 0.9377 * CARD_H + size * 0.85);
  }
  ctx.restore();
}
