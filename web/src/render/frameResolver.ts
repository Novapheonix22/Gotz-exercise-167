// Builds the frame layer stack for a regular (M15) card from its mana cost,
// type line and toggles. Follows Card Conjurer's auto-frame rules.

import type { Card, FrameColor } from '../model/card';
import { typeLine } from '../model/card';
import { costColors, type Color } from './symbols';
import type { Pack, PackFrame } from './packs';
import packIds from './packIds.json';

export interface Bounds { x: number; y: number; width: number; height: number }

export interface FrameLayer {
  /** What this layer is, e.g. "Frame", "Rules", "Crown". */
  role: string;
  name: string;
  src: string;
  /** Mask images; the layer only shows where every mask is opaque. */
  masks: string[];
  /** Where to draw the image; whole card if absent. */
  bounds?: Bounds;
}

const LETTER_NAMES: Record<string, string> = {
  W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green',
  M: 'Multicolored', A: 'Artifact', L: 'Land', C: 'Colorless', V: 'Vehicle',
};

// Two-color pairs are drawn left/right in this order (Card Conjurer's convention).
const PAIR_ORDER = ['WU', 'WB', 'UB', 'UR', 'BR', 'BG', 'RG', 'RW', 'GW', 'GU'];

export function orderedColors(colors: Color[]): Color[] {
  if (colors.length !== 2) return colors;
  const pair = colors.join('');
  if (PAIR_ORDER.includes(pair)) return colors;
  return [colors[1], colors[0]];
}

/** Each part's color letter. Land variants are written like "WL" (white land). */
export interface FrameProperties {
  frame: string; frameRight?: string;
  rules: string; rulesRight?: string;
  pinline: string; pinlineRight?: string;
  typeTitle: string;
  pt?: string;
}

export function frameProperties(colors: Color[], manaCost: string, type: string, hasPT: boolean): FrameProperties {
  const c = orderedColors(colors);
  const isHybrid = manaCost.includes('/');
  const isLand = type.includes('Land');
  const isArtifact = type.includes('Artifact');
  const isVehicle = type.includes('Vehicle');

  let rules: string;
  if (isLand) rules = c.length === 0 ? 'L' : c.length > 2 ? 'ML' : c[0] + 'L';
  else if (c.length > 2) rules = 'M';
  else if (c.length > 0) rules = c[0];
  else rules = 'A';
  const rulesRight = c.length === 2 ? (isLand ? c[1] + 'L' : c[1]) : undefined;

  let typeTitle: string;
  if (c.length >= 2) typeTitle = (isHybrid || isLand) && c.length === 2 ? 'L' : 'M';
  else if (isLand) typeTitle = c.length === 0 ? 'L' : c[0] + 'L';
  else if (c.length === 1) typeTitle = c[0];
  else typeTitle = 'A';

  let frame: string;
  if (isLand) frame = 'L';
  else if (isVehicle) frame = 'V';
  else if (isArtifact) frame = 'A';
  else if (c.length > 2) frame = 'M';
  else if (c.length === 2) frame = isHybrid ? c[0] : 'M';
  else if (c.length === 1) frame = c[0];
  else frame = 'L';
  const frameRight = !isVehicle && !isArtifact && c.length === 2 && isHybrid ? c[1] : undefined;

  let pt: string | undefined;
  if (hasPT) pt = isVehicle ? 'V' : typeTitle === 'L' ? 'C' : typeTitle.replace('L', '') || 'C';

  return { frame, frameRight, rules, rulesRight, pinline: rules, pinlineRight: rulesRight, typeTitle, pt };
}

/** Lands have no mana cost: read colors from "Add {G}" abilities and basic land types (Card Conjurer's rule). */
export function landColors(rules: string, type: string): Color[] {
  const found = new Set<Color>();
  const body = rules.split(/\{flavor\}/i)[0];
  for (const line of body.split('\n')) {
    const at = line.search(/\badd\b/i);
    if (at < 0) continue;
    for (const m of line.slice(at).matchAll(/\{([wubrg])\}/gi)) found.add(m[1].toUpperCase() as Color);
  }
  const text = `${body} ${type}`.toLowerCase();
  const basics: [string, Color][] = [['plains', 'W'], ['island', 'U'], ['swamp', 'B'], ['mountain', 'R'], ['forest', 'G']];
  for (const [word, c] of basics) if (text.includes(word)) found.add(c);
  return (['W', 'U', 'B', 'R', 'G'] as Color[]).filter((c) => found.has(c));
}

/** Colors and type flags after applying a manual frame color choice. */
export function effectiveColors(card: Card): { colors: Color[]; type: string } {
  const type = typeLine(card);
  const fc: FrameColor = card.frameColor;
  if (fc === 'auto') {
    if (type.includes('Land')) return { colors: landColors(card.rulesText, type), type };
    return { colors: costColors(card.manaCost), type };
  }
  if (fc === 'M') return { colors: ['W', 'U', 'B'], type: type.replace(/Artifact|Land/g, '') };
  if (fc === 'A') return { colors: [], type: type.includes('Artifact') ? type : `${type} Artifact` };
  if (fc === 'L') return { colors: [], type: type.includes('Land') ? type : `${type} Land` };
  return { colors: [fc], type: type.replace(/Artifact|Land/g, '') };
}

const RIGHT_HALF = '/cc/img/frames/maskRightHalf.webp';

function find(pack: Pack | undefined, name: string): PackFrame | undefined {
  return pack?.frames.find((f) => f.name === name);
}

const letterName = (letter: string) => LETTER_NAMES[letter] ?? 'Artifact';
/** Strip the land marker ("WL" → "W") for parts that have no land-colored version. */
const base = (letter: string) => (letter.length > 1 && letter.endsWith('L') ? letter[0] : letter);

export interface Packs {
  regular: Pack;
  crowns?: Pack;
  floatingCrowns?: Pack;
  stamps?: Pack;
  nyx?: Pack;
  snow?: Pack;
  devoid?: Pack;
  nickname?: Pack;
  borders?: Pack;
  lands?: Pack;
  adventure?: Pack;
  omen?: Pack;
  prepare?: Pack;
}

/** Styles that have their own frame pack (layout + frame images). */
export function stylePack(card: Card, packs: Packs): Pack | undefined {
  if (card.style === 'adventure') return packs.adventure;
  if (card.style === 'omen') return packs.omen;
  if (card.style === 'prepare') return packs.prepare;
  return undefined;
}

/** The pack whose text box positions the card uses. */
export function layoutPack(card: Card, packs: Packs): Pack {
  return stylePack(card, packs) ?? packs.regular;
}

/** Pack ids needed to draw regular cards (also read by scripts/fetch-assets.mjs). */
export const REGULAR_PACK_IDS: Record<keyof Packs, string> = packIds;

/** Find the frame image for a color letter in the card's frame style. */
function frameImage(letter: string, card: Card, packs: Packs): PackFrame | undefined {
  const land = letter.length > 1 && letter.endsWith('L');
  const color = base(letter);
  const own = stylePack(card, packs);
  if (own) {
    const name = land ? 'Land' : letterName(letter);
    return (card.toggles.nyx && !land && letter !== 'L' ? find(own, `${name} Enchantment Frame`) : undefined)
      ?? find(own, `${name} Frame`) ?? find(own, 'Artifact Frame') ?? find(own, 'Land Frame');
  }
  if (card.toggles.snow && packs.snow) {
    const f = land ? find(packs.snow, `${letterName(color)} Land Frame`) : find(packs.snow, `${letterName(letter)} Frame`);
    if (f) return f;
  }
  if (card.toggles.devoid && packs.devoid) {
    const f = find(packs.devoid, `${letterName(color)} Frame`);
    if (f) return f;
  }
  if (card.toggles.nyx && packs.nyx && letter !== 'L' && !land) {
    const f = find(packs.nyx, `${letterName(letter)} Frame`);
    if (f) return f;
  }
  if (land && packs.lands) {
    const f = find(packs.lands, `${letterName(color)} Frame`);
    if (f) return f;
  }
  return find(packs.regular, `${letterName(letter)} Frame`) ?? find(packs.regular, 'Artifact Frame');
}

/** Colors of the second spell's cost, following Card Conjurer's rules for each style. */
export function secondFaceColors(style: string, cost: string): { colors: string[]; hybrid: boolean } {
  const text = cost.toUpperCase();
  const hybrid = text.includes('/');
  const found = [...new Set(text.split('').filter((ch) => 'WUBRG'.includes(ch)))];
  const ordered = orderedColors(found as Color[]) as string[];
  if (style === 'adventure') {
    if (hybrid) return { colors: found.length > 2 ? ['M'] : found.length === 1 ? found : ['L'], hybrid };
    return { colors: found.length > 2 ? ['M'] : ordered, hybrid };
  }
  return { colors: ordered.length ? ordered : ['A'], hybrid };
}

type Masked = (letter: string, role: string, maskName: string | null, right?: boolean) => void;

/** The colored box for the second spell (Adventure, Omen, Prepare). */
function secondFaceLayers(card: Card, masked: Masked) {
  const { colors, hybrid } = secondFaceColors(card.style, card.face2.manaCost);
  if (card.style === 'adventure') {
    if (colors.length === 1) masked(colors[0], 'Adventure', 'Rules (Left)');
    else if (colors.length >= 2) {
      masked(colors[0], 'Adventure', 'Rules (Left)');
      masked(colors[1], 'Adventure', 'Rules (Left, Multicolor)');
    }
  } else if (card.style === 'omen' || card.style === 'prepare') {
    const n = card.style === 'omen' ? 'Omen' : 'Prepare Spell';
    if (card.style === 'prepare') masked(colors[0], n, `${n} Pinline`);
    if (colors.length === 1) {
      if (hybrid) masked('L', n, `${n} Type/Title`);
      masked(colors[0], n, n);
    } else {
      masked(colors[0], n, n);
      masked(colors[1], n, `${n} (Right Half)`);
      masked(hybrid && colors.length === 2 ? 'L' : 'M', n, `${n} Type/Title`);
    }
  }
}

/** Layers from bottom to top. */
export function buildLayers(card: Card, packs: Packs): FrameLayer[] {
  const { colors, type } = effectiveColors(card);
  const hasPT = !!(card.power.trim() || card.toughness.trim());
  const p = frameProperties(colors, card.manaCost, type, hasPT);
  const layers: FrameLayer[] = [];
  const regularMasks = find(packs.regular, 'White Frame')?.masks ?? [];

  const masked = (letter: string, role: string, maskName: string | null, right = false) => {
    const f = frameImage(letter, card, packs);
    if (!f) return;
    const masks: string[] = [];
    if (maskName) {
      const m = f.masks?.find((x) => x.name === maskName) ?? regularMasks.find((x) => x.name === maskName);
      if (m) masks.push(m.src);
    }
    if (right) masks.push(RIGHT_HALF);
    layers.push({ role, name: `${f.name} · ${role}${right ? ' (right)' : ''}`, src: f.src, masks });
  };
  const add = (pack: Pack | undefined, name: string, role: string, extraMasks: string[] = []) => {
    const f = find(pack, name);
    if (f) layers.push({ role, name: f.name, src: f.src, masks: extraMasks, bounds: f.bounds });
    return !!f;
  };

  // Bottom to top (Card Conjurer builds top-down, then reverses).
  masked(p.frame, 'Border', 'Border');
  masked(p.frame, 'Frame', null);
  if (p.frameRight) masked(p.frameRight, 'Frame', 'Frame', true);
  masked(p.rules, 'Rules', 'Rules');
  if (p.rulesRight) {
    // Packs with a side-by-side text box have their own right-half mask for the main text box.
    if (stylePack(card, packs)?.frames[0]?.masks?.some((m) => m.name === 'Rules (Right Half)')) masked(p.rulesRight, 'Rules', 'Rules (Right Half)');
    else masked(p.rulesRight, 'Rules', 'Rules', true);
  }
  secondFaceLayers(card, masked);
  masked(p.typeTitle, 'Title', 'Title');
  masked(p.typeTitle, 'Type', 'Type');
  masked(p.pinline, 'Pinline', 'Pinline');
  if (p.pinlineRight) masked(p.pinlineRight, 'Pinline', 'Pinline', true);

  if (p.pt) {
    if (!(card.toggles.devoid && add(packs.devoid, 'Devoid Power/Toughness', 'PT'))) {
      if (!add(stylePack(card, packs), `${letterName(p.pt)} Power/Toughness`, 'PT')) add(packs.regular, `${letterName(p.pt)} Power/Toughness`, 'PT');
    }
  }

  const accent = base(p.pinline);
  const accentRight = p.pinlineRight ? base(p.pinlineRight) : undefined;
  const stampLetter = accent === 'L' && colors.length === 0 ? 'L' : accent;
  if (card.holoStamp) {
    add(packs.stamps, `${letterName(stampLetter)} Holo Stamp`, 'Stamp');
    if (accentRight) add(packs.stamps, `${letterName(accentRight)} Holo Stamp`, 'Stamp', [RIGHT_HALF]);
  }

  if (card.toggles.nickname) {
    add(packs.nickname, `${letterName(accent)} Nickname`, 'Nickname');
    if (accentRight) add(packs.nickname, `${letterName(accentRight)} Nickname`, 'Nickname', [RIGHT_HALF]);
  }

  if (card.legendary !== 'none') {
    const pack = card.legendary === 'floating' ? packs.floatingCrowns : packs.crowns;
    if (card.toggles.nyx) {
      add(packs.nyx, `${letterName(accent)} Inner Crown (Nyx)`, 'Inner Crown');
      if (accentRight) add(packs.nyx, `${letterName(accentRight)} Inner Crown (Nyx)`, 'Inner Crown', [RIGHT_HALF]);
    }
    add(pack, 'Legend Crown Border Cover', 'Crown Border Cover');
    add(pack, `${letterName(accent)} Legend Crown`, 'Crown');
    if (accentRight) add(pack, `${letterName(accentRight)} Legend Crown`, 'Crown', [RIGHT_HALF]);
  }

  if (card.border !== 'black') {
    const name = `${card.border[0].toUpperCase()}${card.border.slice(1)} Border`;
    const f = find(packs.borders, name);
    const mask = f?.masks?.find((m) => m.name === (card.legendary !== 'none' ? 'Border (With Crown)' : 'Border'));
    if (f) layers.push({ role: 'Border Color', name, src: f.src, masks: mask ? [mask.src] : [] });
  }

  return layers;
}
