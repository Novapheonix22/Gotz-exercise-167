// Puts a mana cost into the order printed on real cards:
//   {X}/{Y}/{Z} → generic number → {C} → {S} → colored symbols
// Colored symbols follow the official color order for that exact color combination
// (e.g. Mardu is R-W-B, Temur is G-U-R, four colors start after the missing one).

import { symbolFile, type Color } from './symbols';

const ORDERS: string[] = [
  'W', 'U', 'B', 'R', 'G',
  // allied and enemy pairs
  'WU', 'UB', 'BR', 'RG', 'GW', 'WB', 'UR', 'BG', 'RW', 'GU',
  // shards and wedges
  'GWU', 'WUB', 'UBR', 'BRG', 'RGW', 'WBG', 'URW', 'BGU', 'RWB', 'GUR',
  // four colors (start after the missing color)
  'WUBR', 'UBRG', 'BRGW', 'RGWU', 'GWUB',
  'WUBRG',
];

const key = (colors: Iterable<string>) => [...new Set(colors)].sort().join('');
const ORDER_BY_SET = new Map(ORDERS.map((o) => [key(o), o]));

/** The official order for a set of colors. */
export function colorOrder(colors: Iterable<Color>): Color[] {
  const k = key(colors);
  return (ORDER_BY_SET.get(k) ?? 'WUBRG'.split('').filter((c) => k.includes(c)).join('')).split('') as Color[];
}

function colorsOf(file: string): Color[] {
  return file.replace(/p$/, '').toUpperCase().split('').filter((c) => 'WUBRG'.includes(c)) as Color[];
}

/**
 * Reorder a mana cost. Multiple generic numbers are added together ({2}{3} → {5}).
 * Unknown codes are kept at the end, unchanged.
 */
export function normalizeManaCost(cost: string): string {
  const tokens = [...cost.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  if (!tokens.length) return cost;

  const variables: string[] = [];
  let generic: number | null = null;
  const colorless: string[] = [];
  const snow: string[] = [];
  const colored: { code: string; colors: Color[] }[] = [];
  const unknown: string[] = [];

  for (const code of tokens) {
    const file = symbolFile(code);
    if (!file) { unknown.push(code); continue; }
    if (/^\d+$/.test(file)) generic = (generic ?? 0) + Number(file);
    else if (file === 'x' || file === 'y' || file === 'z') variables.push(code.toUpperCase());
    else if (file === 'c') colorless.push('C');
    else if (file === 's') snow.push('S');
    else {
      const cs = colorsOf(file);
      if (cs.length) colored.push({ code: code.toUpperCase(), colors: cs });
      else unknown.push(code);
    }
  }

  const order = colorOrder(colored.flatMap((c) => c.colors));
  const rank = (c: { colors: Color[] }) => Math.min(...c.colors.map((x) => order.indexOf(x)));
  // Within the same leading color: plain symbols first, then hybrids/Phyrexian.
  const sorted = colored
    .map((c, i) => ({ ...c, i }))
    .sort((a, b) => rank(a) - rank(b) || a.colors.length - b.colors.length || a.i - b.i);

  const parts = [
    ...variables.sort(),
    ...(generic !== null && (generic > 0 || (!colored.length && !colorless.length && !snow.length && !variables.length)) ? [String(generic)] : []),
    ...colorless,
    ...snow,
    ...sorted.map((c) => c.code),
    ...unknown,
  ];
  return parts.map((p) => `{${p}}`).join('');
}

/** Set the generic part of a cost to `n`, replacing any existing number. */
export function setGeneric(cost: string, n: number): string {
  const without = cost.replace(/\{\d+\}/g, '');
  return normalizeManaCost(`{${n}}${without}`);
}
