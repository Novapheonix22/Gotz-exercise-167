// Mana and other symbol codes, e.g. "{2}{W}{U/B}{G/P}{T}".
// Accepts both MTG.design spellings ({U/B}, {G/P}, {2/W}) and Card Conjurer
// spellings ({ub}, {pg}/{gp}, {2w}). Returns the symbol image file name.

const HYBRID_ORDER = ['wu', 'wb', 'ub', 'ur', 'br', 'bg', 'rg', 'rw', 'gw', 'gu'];
const COLORS = ['w', 'u', 'b', 'r', 'g'];
const SIMPLE = new Set([
  ...Array.from({ length: 21 }, (_, i) => String(i)),
  'w', 'u', 'b', 'r', 'g', 'c', 'x', 'y', 'z', 't', 'untap', 's', 'e',
]);

/** Map a symbol code (the text between braces) to a file name in /cc/mana, or null if unknown. */
export function symbolFile(code: string): string | null {
  let c = code.trim().toLowerCase().replace(/\//g, '');
  if (c === 'q') c = 'untap';
  if (SIMPLE.has(c)) return c;
  // Phyrexian: "wp" or "pw" (Card Conjurer writes {pw})
  if (c.length === 2 && c.includes('p')) {
    const color = c.replace('p', '');
    if (COLORS.includes(color)) return color + 'p';
  }
  // Two-color hybrid, in either order
  if (c.length === 2 && COLORS.includes(c[0]) && COLORS.includes(c[1])) {
    if (HYBRID_ORDER.includes(c)) return c;
    const rev = c[1] + c[0];
    if (HYBRID_ORDER.includes(rev)) return rev;
  }
  // Two-generic hybrid {2/W}
  if (c.length === 2 && c[0] === '2' && COLORS.includes(c[1])) return c;
  // Hybrid Phyrexian {W/U/P} → wup (either color order)
  if (c.length === 3 && c.endsWith('p')) {
    const pair = c.slice(0, 2);
    if (HYBRID_ORDER.includes(pair)) return pair + 'p';
    const rev = pair[1] + pair[0];
    if (HYBRID_ORDER.includes(rev)) return rev + 'p';
  }
  return null;
}

export interface SymbolToken { kind: 'symbol'; code: string; file: string }

/** Parse a mana cost string into symbol tokens. Unknown codes are skipped. */
export function parseManaCost(cost: string): SymbolToken[] {
  const out: SymbolToken[] = [];
  const re = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cost))) {
    const file = symbolFile(m[1]);
    if (file) out.push({ kind: 'symbol', code: m[1], file });
  }
  // Allow bare shorthand like "2WU" with no braces
  if (out.length === 0 && /^[0-9wubrgcxWUBRGCX]+$/.test(cost.trim())) {
    const s = cost.trim();
    const num = s.match(/^\d+/)?.[0];
    if (num) out.push({ kind: 'symbol', code: num, file: symbolFile(num) ?? num });
    for (const ch of s.slice(num?.length ?? 0)) {
      const file = symbolFile(ch);
      if (file) out.push({ kind: 'symbol', code: ch, file });
    }
  }
  return out;
}

export type Color = 'W' | 'U' | 'B' | 'R' | 'G';

/** Colors that appear in a mana cost (hybrid and Phyrexian count), in WUBRG order. */
export function costColors(cost: string): Color[] {
  const found = new Set<Color>();
  for (const t of parseManaCost(cost)) {
    for (const ch of t.file.replace(/p$/, '')) {
      const up = ch.toUpperCase();
      if ('WUBRG'.includes(up)) found.add(up as Color);
    }
  }
  return (['W', 'U', 'B', 'R', 'G'] as Color[]).filter((c) => found.has(c));
}
