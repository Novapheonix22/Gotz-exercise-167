// Card text layout: parses text codes, wraps lines, places inline symbols and
// shrinks the font until everything fits the box. Pure except for `measure`,
// which is passed in (canvas measureText in the app, a stub in tests).
//
// Supported codes (MTG.design + Card Conjurer subset):
//   ~ or {cardname}     card name
//   {i} {/i}, <i> </i>  italics
//   (reminder text)     auto-italic, when enabled
//   *word*              in flavor text: non-italic (de-emphasized) words
//   \\ or {lns}         new line, no paragraph space
//   newline             new paragraph
//   {flavor}            flavor divider bar, then italic text
//   {divider}           divider bar
//   {-}                 em dash; " - " also becomes " — "
//   {W} {2/U} {T} …     inline symbols

import { symbolFile } from './symbols';

export type Token =
  | { kind: 'word'; text: string; italic: boolean }
  | { kind: 'space' }
  | { kind: 'symbol'; file: string }
  | { kind: 'paragraph' }
  | { kind: 'line' }
  | { kind: 'bar' };

export interface TokenizeOptions {
  cardName?: string;
  autoItalicReminder?: boolean;
  /** Text starts in italic (whole box is flavor). */
  italic?: boolean;
}

export function tokenize(raw: string, opts: TokenizeOptions = {}): Token[] {
  let text = raw
    // Card Conjurer shorthands: /// = flavor divider, // = new line
    .replace(/\/\/\//g, '{flavor}')
    .replace(/\/\//g, '{lns}')
    .replace(/\{cardname\}|~/gi, opts.cardName ?? '')
    .replace(/<i>/gi, '{i}')
    .replace(/<\/i>/gi, '{/i}')
    .replace(/\\\\/g, '{lns}')
    .replace(/\r\n?/g, '\n')
    .replace(/ - /g, ' — ')
    .replace(/\{-\}/g, '—')
    // Curly quotes, like printed cards
    .replace(/"([^"{}]*)"/g, '“$1”')
    .replace(/(\w)'/g, '$1’')
    .replace(/'/g, '‘');
  if (opts.autoItalicReminder) {
    // Only before any flavor marker
    const at = text.indexOf('{flavor}');
    const head = at >= 0 ? text.slice(0, at) : text;
    const tail = at >= 0 ? text.slice(at) : '';
    text = head.replace(/\(([^)]*)\)/g, '{i}($1){/i}') + tail;
  }

  const tokens: Token[] = [];
  let italic = !!opts.italic;
  let inFlavor = !!opts.italic;
  let deEmph = false;
  let word = '';
  const flush = () => {
    if (word) tokens.push({ kind: 'word', text: word, italic: deEmph ? !italic : italic });
    word = '';
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      const end = text.indexOf('}', i);
      if (end > i) {
        const code = text.slice(i + 1, end);
        const lower = code.toLowerCase();
        i = end;
        if (lower === 'i') { flush(); italic = true; continue; }
        if (lower === '/i') { flush(); italic = false; continue; }
        if (lower === 'lns' || lower === 'linenospace') { flush(); tokens.push({ kind: 'line' }); continue; }
        if (lower === 'line') { flush(); tokens.push({ kind: 'paragraph' }); continue; }
        if (lower === 'divider' || lower === 'bar') { flush(); tokens.push({ kind: 'bar' }); continue; }
        if (lower === 'flavor') { flush(); tokens.push({ kind: 'bar' }); italic = true; inFlavor = true; continue; }
        const file = symbolFile(code);
        if (file) { flush(); tokens.push({ kind: 'symbol', file }); continue; }
        word += '{' + code + '}';
        continue;
      }
    }
    if (ch === '*' && inFlavor) { flush(); deEmph = !deEmph; continue; }
    if (ch === '\n') { flush(); tokens.push({ kind: 'paragraph' }); continue; }
    if (ch === ' ') { flush(); tokens.push({ kind: 'space' }); continue; }
    word += ch;
  }
  flush();
  return tokens;
}

export type Measure = (text: string, italic: boolean, size: number) => number;

export interface PlacedText { kind: 'text'; x: number; text: string; italic: boolean }
export interface PlacedSymbol { kind: 'symbol'; x: number; file: string; size: number }
export interface Line { baseline: number; width: number; items: (PlacedText | PlacedSymbol)[] }
export interface Layout { size: number; lines: Line[]; bars: number[]; height: number }

export interface LayoutOptions {
  width: number;
  height: number;
  /** Starting font size in px; shrinks from here. */
  size: number;
  oneLine?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Center the block vertically in the box (rules text). */
  centerVertically?: boolean;
  minSize?: number;
}

// Proportions taken from Card Conjurer's text engine.
export const SYMBOL_SCALE = 0.78;
export const SYMBOL_GAP = 0.04;
export const ASCENT = 0.7;
const PARAGRAPH_GAP = 0.35;
const BAR_GAP = 0.45;

function attempt(tokens: Token[], measure: Measure, o: LayoutOptions, size: number) {
  const lines: { items: Line['items']; width: number; gapBefore: number }[] = [];
  const bars: number[] = []; // index of the line the bar sits above
  let cur: { items: Line['items']; width: number; gapBefore: number } = { items: [], width: 0, gapBefore: 0 };
  let pendingSpace = 0;
  let overflowWidth = false;
  const spaceWidth = measure(' ', false, size);
  const symSize = size * SYMBOL_SCALE;
  const symGap = size * SYMBOL_GAP;

  const newLine = (gap: number) => {
    lines.push(cur);
    cur = { items: [], width: 0, gapBefore: gap };
    pendingSpace = 0;
  };
  const place = (w: number, make: (x: number) => Line['items'][number]) => {
    const lead = cur.items.length ? pendingSpace : 0;
    if (!o.oneLine && cur.items.length && cur.width + lead + w > o.width) {
      newLine(0);
      cur.items.push(make(0));
      cur.width = w;
    } else {
      cur.items.push(make(cur.width + lead));
      cur.width += lead + w;
    }
    pendingSpace = 0;
    if (cur.width > o.width + 0.5) overflowWidth = true;
  };

  for (const t of tokens) {
    switch (t.kind) {
      case 'space': pendingSpace += spaceWidth; break;
      case 'word': {
        const w = measure(t.text, t.italic, size);
        place(w, (x) => ({ kind: 'text', x, text: t.text, italic: t.italic }));
        break;
      }
      case 'symbol': {
        const w = symSize + symGap * 2;
        place(w, (x) => ({ kind: 'symbol', x: x + symGap, file: t.file, size: symSize }));
        break;
      }
      case 'line': newLine(0); break;
      case 'paragraph': newLine(size * PARAGRAPH_GAP); break;
      case 'bar': newLine(size * BAR_GAP * 2); bars.push(lines.length); break;
    }
  }
  lines.push(cur);

  const height = lines.reduce((h, l, i) => h + size + (i === 0 ? 0 : l.gapBefore), 0);
  return { lines, bars, height, overflowWidth };
}

export function layoutText(tokens: Token[], measure: Measure, o: LayoutOptions): Layout {
  const min = o.minSize ?? o.size * 0.35;
  let size = o.size;
  let r = attempt(tokens, measure, o, size);
  // One-line text only shrinks to fit its width (like Card Conjurer); boxes shrink to fit their height.
  while (size > min && ((!o.oneLine && r.height > o.height + 0.5) || r.overflowWidth)) {
    size = Math.max(min, size * 0.97);
    r = attempt(tokens, measure, o, size);
  }

  // Card Conjurer's vertical centering: (box height − text height + 0.15 × size) / 2.
  const top = o.oneLine || o.centerVertically ? (o.height - r.height + size * 0.15) / 2 : 0;
  let y = top;
  const barYs: number[] = [];
  const out: Line[] = r.lines.map((l, i) => {
    if (i > 0) y += l.gapBefore;
    if (r.bars.includes(i)) barYs.push(y - l.gapBefore / 2);
    const baseline = y + size * ASCENT;
    y += size;
    const shift = o.align === 'center' ? (o.width - l.width) / 2 : o.align === 'right' ? o.width - l.width : 0;
    return { baseline, width: l.width, items: l.items.map((it) => ({ ...it, x: it.x + shift })) };
  });
  return { size, lines: out, bars: barYs, height: r.height };
}
