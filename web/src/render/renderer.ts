// Draws a card onto a canvas. The same code makes the live preview and the export.

import type { Card } from '../model/card';
import { typeLine } from '../model/card';
import { buildLayers, layoutPack, type Bounds, type FrameLayer, type Packs } from './frameResolver';
import { styleById } from '../flow/styles';
import type { TextBoxSpec } from './packs';
import { parseManaCost, symbolFile } from './symbols';
import { ASCENT, layoutText, tokenize, type Layout } from './textLayout';

export const CARD_W = 2010;
export const CARD_H = 2814;
/** Canvas size of the card being drawn (battles are landscape). Renders run one at a time, so this is safe. */
let W = CARD_W;
let H = CARD_H;

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
  ['matrix', '/cc/fonts/matrix.ttf'],
  ['matrixb', '/cc/fonts/matrix-b.ttf'],
  ['matrixbsc', '/cc/fonts/Matrix%20Bold%20Small%20Caps.ttf'],
  ['plantinsemibold', '/cc/fonts/plantin-semibold.otf'],
  ['goudymedieval', '/cc/fonts/goudy-medieval.ttf'],
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
  const key = JSON.stringify([layer.src, layer.masks, layer.bounds, W, H]);
  if (!layerCache.has(key)) {
    layerCache.set(key, (async () => {
      const img = await loadImage(layer.src);
      if (!layer.masks.length) return img;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d')!;
      drawInBounds(ctx, img, layer.bounds);
      ctx.globalCompositeOperation = 'destination-in';
      for (const m of layer.masks) ctx.drawImage(await loadImage(m), 0, 0, W, H);
      return c;
    })());
  }
  return layerCache.get(key)!;
}

function drawInBounds(ctx: CanvasRenderingContext2D, img: CanvasImageSource, b?: Bounds) {
  if (!b) ctx.drawImage(img, 0, 0, W, H);
  else ctx.drawImage(img, b.x * W, b.y * H, b.width * W, b.height * H);
}

// ---------- art ----------

function drawPlaceholderArt(ctx: CanvasRenderingContext2D, b: Bounds) {
  const x = b.x * W, y = b.y * H, w = b.width * W, h = b.height * H;
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
  const bx = b.x * W, by = b.y * H, bw = b.width * W, bh = b.height * H;
  const cover = Math.max(bw / img.naturalWidth, bh / img.naturalHeight) * card.art.zoom;
  const w = img.naturalWidth * cover, h = img.naturalHeight * cover;
  const cx = bx + bw / 2 + card.art.x * W, cy = by + bh / 2 + card.art.y * H;
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.clip();
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

// ---------- text ----------

const FAMILY: Record<string, string> = {
  belerenb: 'belerenb', belerenbsc: 'belerenbsc', mplantin: 'mplantin', mplantini: 'mplantini', gothammedium: 'gothammedium',
  matrix: 'matrix', matrixb: 'matrixb', matrixbsc: 'matrixbsc', plantinsemibold: 'plantinsemibold', goudymedieval: 'goudymedieval',
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
  // Rotated boxes (split cards, rooms, flip cards) draw around their anchor point, like Card Conjurer.
  const rotation = (spec as { rotation?: number }).rotation ?? 0;
  const anchorX = (spec.x ?? 0) * W;
  const anchorY = (spec.y ?? 0) * H;
  const x = rotation ? 0 : anchorX;
  const y = (rotation ? 0 : anchorY) + (o.padTop ?? 0) * H;
  const width = o.width ?? (spec.width ?? 1) * W;
  const height = ((spec.height ?? 1) - (o.padTop ?? 0) - (o.padBottom ?? 0)) * H;
  const size = (spec.size ?? 0.038) * H;

  const tokens = tokenize(text, { cardName: o.cardName, autoItalicReminder: o.autoItalic, italic: o.italic });
  const measure = (t: string, italic: boolean, s: number) => { ctx.font = fontFor(spec, italic, s); return ctx.measureText(t).width; };
  const layout = layoutText(tokens, measure, {
    width, height, size, oneLine: spec.oneLine, align: spec.align, centerVertically: o.centerVertically,
  });

  ctx.save();
  if (rotation) {
    ctx.translate(anchorX, anchorY);
    ctx.rotate((rotation * Math.PI) / 180);
  }
  ctx.fillStyle = o.color ?? (spec as { color?: string }).color ?? '#000';
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
  const size = (spec.size ?? 0.043) * H;
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
  const h = b.height * H;
  const maxW = b.width * W;
  let w = h * (img.naturalWidth / img.naturalHeight);
  let dh = h;
  if (w > maxW) { dh = h * (maxW / w); w = maxW; }
  const right = b.x * W;
  const x = right - w;
  const y = b.y * H - dh / 2;

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

let renderQueue: Promise<unknown> = Promise.resolve();

export function renderCard(canvas: HTMLCanvasElement, card: Card, packs: Packs, opts: RenderOptions = {}): Promise<void> {
  // One render at a time: the canvas size (W/H) is shared module state.
  const run = renderQueue.then(() => renderCardNow(canvas, card, packs, opts));
  renderQueue = run.catch(() => undefined);
  return run;
}

/** Canvas size for a style: battles are landscape. */
export function cardSize(card: Card): [number, number] {
  return card.style === 'battle' ? [CARD_H, CARD_W] : [CARD_W, CARD_H];
}

const STANDARD_KEYS = new Set(['mana', 'title', 'type', 'pt', 'mana2', 'title2', 'type2', 'rules2']);

async function renderCardNow(canvas: HTMLCanvasElement, card: Card, packs: Packs, opts: RenderOptions) {
  [W, H] = cardSize(card);
  const def = styleById(card.style);
  const symbolRef = card.setSymbol || opts.setSymbol;
  await loadFonts();
  const version = layoutPack(card, packs).version ?? packs.regular.version!;
  const layers = buildLayers(card, packs);
  // Load everything before touching the canvas so the preview never flickers.
  const composed = await Promise.all(layers.map(composeLayer));
  const symbolFiles = new Set<string>(parseManaCost(card.manaCost).map((t) => t.file));
  for (const t of parseManaCost(card.face2?.manaCost ?? '')) symbolFiles.add(t.file);
  const allText = `${card.rulesText} ${card.flavorText} ${card.face2?.rulesText ?? ''} ${Object.values(card.extra ?? {}).join(' ')}`;
  for (const m of allText.matchAll(/\{([^}]+)\}/g)) {
    const f = symbolFile(m[1]);
    if (f) symbolFiles.add(f);
  }
  await Promise.all([...symbolFiles].map((f) => loadImage(symbolSrc(f)).catch(() => null)));
  if (card.art) await loadImage(card.art.src).catch(() => null);
  if (symbolRef) await loadImage(symbolRef).catch(() => null);

  const scale = opts.scale ?? 1;
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const ctx = off.getContext('2d')!;

  // Text boxes, adjusted by style-specific layouts (planeswalker abilities, saga chapters, class levels).
  const t: Record<string, TextBoxSpec> = { ...version.text };
  const special = def?.special ?? null;
  const pw = special?.startsWith('planeswalker') ? planeswalkerLayout(card, t, special) : null;
  const saga = special === 'saga' ? sagaLayout(card, t) : null;
  const cls = card.style === 'class' ? classLayout(card, t) : null;

  // Masked layers are pre-composed at full card size; plain layers are drawn at their bounds.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (version.artBounds) await drawArt(ctx, card, version.artBounds);
  if (version.artBounds && def?.art2Offset) await drawArt(ctx, card, { ...version.artBounds, y: version.artBounds.y + def.art2Offset });
  if (pw) await drawPlaneswalkerBackground(ctx, pw);
  for (let i = 0; i < layers.length; i++) {
    const l = layers[i];
    if (l.masks.length) ctx.drawImage(composed[i], 0, 0, W, H);
    else drawInBounds(ctx, composed[i], l.bounds);
  }
  if (pw) await drawPlaneswalkerBadges(ctx, pw);
  if (saga) await drawSagaChapters(ctx, saga);
  if (cls) await drawClassHeaders(ctx, cls);

  // Mana cost (right-aligned, with symbol shadows)
  if (t.mana) {
    await drawTextBox(ctx, t.mana, parseManaCost(card.manaCost).map((s) => `{${s.file}}`).join(''), {
      shadow: { x: (t.mana.shadowX ?? 0) * W, y: (t.mana.shadowY ?? 0) * H },
    });
  }
  if (t.title) {
    const rotated = (t.title as { rotation?: number }).rotation;
    const manaLeft = (t.mana?.width ?? 0.93) * W - manaCostWidth(card.manaCost, t.mana ?? {});
    const titleX = rotated ? 0 : (t.title.x ?? 0) * W;
    const width = rotated ? undefined : Math.min((t.title.width ?? 1) * W, manaLeft - titleX - W * 0.01);
    // With a nickname, the big title shows the nickname and the true name goes underneath (Card Conjurer's layout).
    const nick = card.toggles.nickname && card.nickname.trim();
    // Godzilla-style showcase packs have their own big nickname box; the title box holds the true name.
    const titleText = t.nickname ? (card.nickname.trim() ? card.name : '') : nick ? card.nickname : card.name;
    await drawTextBox(ctx, t.title, titleText, { width });
    if (nick && card.name.trim() && !t.nickname) {
      await drawTextBox(ctx, NICKNAME_TRUE_NAME, card.name, {
        color: '#fff', shadow: undefined, textShadow: { x: 0.0014 * W, y: 0.001 * H },
      });
    }
  }
  const symbolWidth = await drawSetSymbol(ctx, card, symbolRef, version.setSymbolBounds);
  if (t.type) {
    const full = (t.type.width ?? 1) * W;
    const rotated = (t.type as { rotation?: number }).rotation;
    await drawTextBox(ctx, t.type, typeLine(card), { width: rotated ? undefined : full - (symbolWidth ? symbolWidth + W * 0.012 : 0) });
  }
  const rulesKey = def?.mainRules ?? 'rules';
  if (t[rulesKey]) {
    const body = card.flavorText.trim() ? `${card.rulesText}{flavor}${card.flavorText}` : card.rulesText;
    const hasPT = !!(card.power.trim() || card.toughness.trim());
    const plain = !def || def.pack === 'M15Regular-1';
    await drawTextBox(ctx, t[rulesKey], body, {
      centerVertically: true, autoItalic: true, cardName: card.name,
      padTop: plain ? 0.008 : 0, padBottom: plain ? (hasPT ? 0.03 : 0.012) : 0,
    });
  }
  if (t.pt && (card.power.trim() || card.toughness.trim())) {
    const vehicle = typeLine(card).includes('Vehicle');
    await drawTextBox(ctx, t.pt, `${card.power}/${card.toughness}`, { color: vehicle ? '#fff' : undefined });
  }
  await drawSecondFace(ctx, card, t);

  // Every other box the pack defines: abilities, chapters, levels, loyalty, defense, reminders…
  for (const [key, spec] of Object.entries(t)) {
    if (STANDARD_KEYS.has(key) || key === rulesKey || key === 'rules') continue;
    if (key === 'nickname') {
      // Godzilla-style showcase: the big bar shows the nickname, the true name sits in the title box.
      continue;
    }
    const text = extraText(card, key, spec);
    if (!text.trim()) continue;
    await drawTextBox(ctx, spec, text, { centerVertically: !spec.oneLine, autoItalic: true, cardName: card.name });
  }
  if (t.nickname) await drawTextBox(ctx, t.nickname, card.nickname.trim() || card.name, {});
  await drawCollectorInfo(ctx, card);

  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const out = canvas.getContext('2d')!;
  out.imageSmoothingQuality = 'high';
  out.drawImage(off, 0, 0, canvas.width, canvas.height);
}

/** Text for a style-specific box: what the user typed, a value filled in from the back face, or the pack's default. */
export function extraText(card: Card, key: string, spec?: TextBoxSpec): string {
  const typed = card.extra?.[key];
  if (typed !== undefined && typed !== '') return typed;
  const back = card.back;
  if (back) {
    if (key === 'flipsideType') return typeLine(back).split(' — ')[0];
    if (key === 'flipSideReminder') return parseManaCost(back.manaCost).map((s) => `{${s.file}}`).join('') || (back.rulesText.split('\n')[0] ?? '');
    if (key === 'reminder' && card.style === 'transform' && (back.power || back.toughness)) return `${back.power}/${back.toughness}`;
  }
  if (key.startsWith('ability') || key.startsWith('cost') || key === 'loyalty' || key === 'defense') return typed ?? '';
  return typed ?? ((spec as { text?: string })?.text ?? '');
}

// ---------- planeswalkers ----------

interface PwLayout {
  boxes: { y: number; height: number; cost: string }[];
  x: number; width: number;
  badgeY: number[];
  mask: string;
}

const PW_BADGE_Y = [
  [[0.7467], [0.6953, 0.822], [0.6639, 0.7467, 0.8362], [0.6505, 0.72, 0.7905, 0.861]],
  [[0.72], [0.6391, 0.801], [0.5986, 0.72, 0.8415], [0.5986, 0.6796, 0.7605, 0.8415]],
];

/** Lay out planeswalker abilities the way Card Conjurer does; adjusts the ability text boxes in `t`. */
function planeswalkerLayout(card: Card, t: Record<string, TextBoxSpec>, special: string): PwLayout | null {
  if (!t.ability0) return null;
  const tall = special === 'planeswalkerTall' ? 1 : 0;
  // Abilities show in order; the count runs to the last one with any text or cost (3 when empty).
  const filled = [0, 1, 2, 3].filter((i) => (card.extra[`ability${i}`] ?? '').trim() || (card.extra[`cost${i}`] ?? '').trim());
  const count = filled.length ? filled[filled.length - 1] + 1 : 3;
  // Each ability box runs halfway to its neighbours' loyalty badges, so text and badges line up.
  const badges = PW_BADGE_Y[tall][count - 1];
  const startY = t.ability0.y ?? 0.62;
  const bottom = (t.loyalty?.y ?? 0.9) - 0.005;
  const edges = [startY, ...badges.slice(1).map((b, i) => (badges[i] + b) / 2), bottom];
  const boxes: PwLayout['boxes'] = [];
  for (let n = 0; n < 4; n++) {
    const key = `ability${n}`;
    const base = t[key] ?? t.ability0;
    if (n < count) {
      const cost = (card.extra[`cost${n}`] ?? '').trim();
      const y = edges[n];
      const height = edges[n + 1] - edges[n];
      t[key] = {
        ...base,
        y, height,
        x: cost ? base.x : (base.x ?? 0) - 0.044,
        width: cost ? base.width : (base.width ?? 0) + 0.044,
      };
      boxes.push({ y, height, cost });
    } else {
      t[key] = { ...base, height: 0, y: 2 };
    }
  }
  return {
    boxes,
    x: 0.1167,
    width: special === 'planeswalkerTransform' ? 0.8334 : 0.8094,
    badgeY: PW_BADGE_Y[tall][count - 1],
    mask: tall ? '/cc/img/frames/planeswalker/tall/planeswalkerTallMaskRules.webp'
      : special === 'planeswalkerTransform' ? '/cc/img/frames/planeswalker/transform/textFront.webp'
        : '/cc/img/frames/planeswalker/text.webp',
  };
}

async function drawPlaneswalkerBackground(ctx: CanvasRenderingContext2D, pw: PwLayout) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const odd = await loadImage('/cc/img/frames/planeswalker/abilityLineOdd.webp').catch(() => null);
  const even = await loadImage('/cc/img/frames/planeswalker/abilityLineEven.webp').catch(() => null);
  const tr = 0.0048 * H;
  pw.boxes.forEach((b, i) => {
    const x = pw.x * W, w = pw.width * W;
    let y = b.y * H, h = b.height * H;
    if (i === 0) { y -= 0.1 * H; h += 0.1 * H; } else if (i === pw.boxes.length - 1) h += 0.5 * H;
    g.globalAlpha = i % 2 === 0 ? 0.608 : 0.706;
    g.fillStyle = i % 2 === 0 ? '#ffffff' : '#a4a4a4';
    g.fillRect(x, y + tr, w, h - 2 * tr);
    g.globalAlpha = 1;
    const line = i % 2 === 0 ? odd : even;
    if (line) g.drawImage(line, x, y + h - tr, w, 2 * tr);
  });
  const mask = await loadImage(pw.mask).catch(() => null);
  if (mask) {
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(mask, 0, 0, W, H);
  }
  ctx.drawImage(c, 0, 0);
}

async function drawPlaneswalkerBadges(ctx: CanvasRenderingContext2D, pw: PwLayout) {
  const [plus, minus, neutral] = await Promise.all(['Plus', 'Minus', 'Neutral'].map((n) => loadImage(`/cc/img/frames/planeswalker/planeswalker${n}.webp`).catch(() => null)));
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `${0.0286 * H}px belerenbsc`;
  ctx.textAlign = 'center';
  pw.boxes.forEach((b, i) => {
    const v = b.cost;
    if (!v) return;
    const y = (pw.badgeY[i] ?? b.y + b.height / 2) * H;
    if (v.includes('+')) {
      if (plus) ctx.drawImage(plus, 0.0294 * W, y - 0.0258 * H, 0.14 * W, 0.0724 * H);
      ctx.fillText(v, 0.1027 * W, y + 0.0172 * H);
    } else if (v.includes('-') || v.includes('−')) {
      if (minus) ctx.drawImage(minus, 0.028 * W, y - 0.0153 * H, 0.1414 * W, 0.0705 * H);
      ctx.fillText(v.replace('-', '−'), 0.1027 * W, y + 0.0181 * H);
    } else {
      if (neutral) ctx.drawImage(neutral, 0.028 * W, y - 0.0153 * H, 0.1414 * W, 0.061 * H);
      ctx.fillText(v, 0.1027 * W, y + 0.0191 * H);
    }
  });
  ctx.restore();
}

// ---------- sagas ----------

interface SagaLayout { boxes: { y: number; height: number; chapters: number }[]; x: number; width: number }

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function sagaLayout(card: Card, t: Record<string, TextBoxSpec>): SagaLayout | null {
  if (!t.ability0 || !t.type) return null;
  const filled = [0, 1, 2, 3].filter((i) => (card.extra[`ability${i}`] ?? '').trim());
  const count = Math.max(1, filled.length || 3);
  const top = t.ability0.y ?? 0.29;
  const bottom = t.type.y ?? 0.85;
  const max = bottom - top;
  // Card Conjurer sizes chapters by how much text they have, with a 15% minimum each.
  const words = [0, 1, 2, 3].slice(0, count).map((i) => Math.max(1, (card.extra[`ability${i}`] ?? '').replace(/\([^)]*\)/g, '').trim().split(/\s+/).filter(Boolean).length));
  const totalWords = words.reduce((a, b) => a + b, 0);
  const minH = max * 0.15;
  const avail = max - minH * count;
  let y = top;
  const boxes: SagaLayout['boxes'] = [];
  for (let i = 0; i < 4; i++) {
    const key = `ability${i}`;
    const base = t[key] ?? t.ability0;
    if (i < count) {
      const h = minH + (words[i] / totalWords) * avail;
      t[key] = { ...base, y, height: h };
      boxes.push({ y, height: h, chapters: Math.max(1, parseInt(card.extra[`chapters${i}`] ?? '1', 10) || 1) });
      y += h;
    } else t[key] = { ...base, y: 2, height: 0 };
  }
  return { boxes, x: 0.1, width: 0.3947 };
}

async function drawSagaChapters(ctx: CanvasRenderingContext2D, saga: SagaLayout) {
  const chapter = await loadImage('/cc/img/frames/saga/sagaChapter.webp').catch(() => null);
  const divider = await loadImage('/cc/img/frames/saga/sagaDivider.webp').catch(() => null);
  ctx.save();
  ctx.font = `${0.0324 * H}px plantinsemibold`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000';
  let n = 1;
  for (const b of saga.boxes) {
    const x = saga.x * W, y = b.y * H, w = saga.width * W, h = b.height * H;
    if (divider) ctx.drawImage(divider, x, y - (0.0029 * H) / 2, w, 0.0029 * H);
    const nx = x - 0.0614 * W, nw = 0.0787 * W, nh = 0.0629 * H;
    const ny = y + (h - nh) / 2;
    const center = (b.chapters - 1) / 2;
    for (let j = 0; j < b.chapters; j++) {
      const off = (j - center) * 0.0358 * H * 2;
      if (chapter) ctx.drawImage(chapter, nx, ny + off, nw, nh);
      ctx.fillText(ROMAN[n + j - 1] ?? String(n + j), nx + 0.0394 * W, ny + 0.0429 * H + off);
    }
    n += b.chapters;
  }
  ctx.restore();
}

// ---------- classes ----------

interface ClassLayout { headers: number[]; x: number; width: number }

function classLayout(card: Card, t: Record<string, TextBoxSpec>): ClassLayout | null {
  if (!t.level0c) return null;
  const levels = [1, 2, 3].filter((i) => (card.extra[`level${i}c`] ?? '').trim());
  const shown = levels.length ? levels : [1, 2];
  const top = t.level0c.y ?? 0.11;
  const bottom = 0.8368;
  const firstH = 0.2;
  const rest = (bottom - top - firstH - 0.0481 * shown.length) / shown.length;
  t.level0c = { ...t.level0c, height: firstH };
  let y = top + firstH + 0.0481;
  const headers: number[] = [];
  for (let i = 1; i <= 3; i++) {
    const idx = shown.indexOf(i);
    if (idx >= 0) {
      t[`level${i}a`] = { ...t[`level${i}a`], y: y - 0.0361 };
      t[`level${i}b`] = { ...t[`level${i}b`], y: y - 0.0361 };
      t[`level${i}c`] = { ...t[`level${i}c`], y, height: Math.max(0.05, rest) };
      headers.push(y);
      y += rest + 0.0481;
    } else {
      for (const k of ['a', 'b', 'c']) t[`level${i}${k}`] = { ...t[`level${i}${k}`], y: 2, height: 0 };
    }
  }
  return { headers, x: 0.5093, width: 0.404 };
}

async function drawClassHeaders(ctx: CanvasRenderingContext2D, cls: ClassLayout) {
  const bar = await loadImage('/cc/mana/bar.png').catch(() => null);
  for (const y of cls.headers) {
    if (bar) ctx.drawImage(bar, cls.x * W, (y - 0.0481) * H, cls.width * W, 0.006 * H);
  }
}

/** Adventure / Omen / Prepare: the second spell's name, cost, type and text. */
async function drawSecondFace(ctx: CanvasRenderingContext2D, card: Card, t: Record<string, TextBoxSpec>) {
  if (!t.title2 || !t.rules2) return;
  const f = card.face2;
  const cost = parseManaCost(f.manaCost).map((s) => `{${s.file}}`).join('');
  if (t.mana2 && cost) {
    await drawTextBox(ctx, t.mana2, cost, { shadow: { x: -0.001 * W, y: 0.0029 * H } });
  }
  if (f.name.trim()) {
    const manaRight = ((t.mana2?.x ?? 0) + (t.mana2?.width ?? 0)) * W;
    const used = cost ? manaCostWidth(f.manaCost, t.mana2 ?? {}) : 0;
    const titleX = (t.title2.x ?? 0) * W;
    const width = Math.min((t.title2.width ?? 1) * W, cost ? manaRight - used - titleX - W * 0.008 : Infinity);
    await drawTextBox(ctx, t.title2, f.name, { color: '#fff', width });
  }
  if (t.type2 && f.typeLine.trim()) await drawTextBox(ctx, t.type2, f.typeLine, { color: '#fff' });
  if (f.rulesText.trim()) {
    await drawTextBox(ctx, t.rules2, f.rulesText, { centerVertically: true, autoItalic: true, cardName: f.name || card.name });
  }
}

async function drawCollectorInfo(ctx: CanvasRenderingContext2D, card: Card) {
  const size = 0.0171 * H;
  const x = 0.0647 * W;
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `${size}px gothammedium`;
  const number = [card.collectorNumber, card.setTotal].filter(Boolean).join('/');
  ctx.fillText(`${number} ${card.rarity}`.trim(), x, 0.9377 * H + size * 0.85);
  const line2 = [card.setCode.trim(), card.language.trim()].filter(Boolean).join(" • ");
  const y2 = 0.9548 * H + size * 0.85;
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
    ctx.fillText(card.designer, W - x, 0.9377 * H + size * 0.85);
  }
  ctx.restore();
}
