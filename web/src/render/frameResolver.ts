// Builds the frame layer stack for a regular (M15) card from its mana cost,
// type line and toggles. Follows Card Conjurer's auto-frame rules.

import type { Card, FrameColor } from '../model/card';
import { typeLine } from '../model/card';
import { costColors, type Color } from './symbols';
import type { Pack, PackFrame } from './packs';
import { styleById } from '../flow/styles';
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
    return { colors: costColors(card.manaCost.trim() ? card.manaCost : card.colorCost ?? ''), type };
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
  transformCrowns?: Pack;
  modalCrowns?: Pack;
  transformIcons?: Pack;
  transformIconsBack?: Pack;
  /** Style packs by Card Conjurer pack id (Adventure, PlaneswalkerRegular, …). */
  styles: Record<string, Pack>;
}

/** Add-on pack ids by key (also read by scripts/fetch-assets.mjs). */
export const ADDON_PACK_IDS: Record<string, string> = packIds;

/** The style's own pack, or undefined for styles drawn with the classic regular-frame builder. */
export function stylePack(card: Card, packs: Packs): Pack | undefined {
  const def = styleById(card.style);
  if (!def || def.pack === 'M15Regular-1') return undefined;
  return packs.styles[def.pack];
}

/** The pack whose text box positions the card uses. */
export function layoutPack(card: Card, packs: Packs): Pack {
  return stylePack(card, packs) ?? packs.regular;
}

/** Find the frame image for a color letter in the card's frame style. */
function frameImage(letter: string, card: Card, packs: Packs): PackFrame | undefined {
  const land = letter.length > 1 && letter.endsWith('L');
  const color = base(letter);
  const own = stylePack(card, packs);
  if (own) {
    const sfx = styleById(card.style)?.suffix ?? '';
    const n = letterName(land ? color : letter);
    const names = [
      ...(card.toggles.nyx && !land && letter !== 'L' ? [`${n} Enchantment Frame${sfx}`, `${n} Nyx Frame${sfx}`] : []),
      ...(land ? [`${n} Land Frame${sfx}`, `Land Frame${sfx}`] : []),
      `${n} Frame${sfx}`, `Artifact Frame${sfx}`, `Land Frame${sfx}`,
    ];
    for (const name of names) {
      const f = find(own, name);
      if (f) return f;
    }
    return own.frames.find((f) => / Frame/.test(f.name) && f.name.endsWith(sfx || 'Frame')) ?? own.frames.find((f) => !f.bounds);
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

/** Back-face icon that goes with each front-face transform icon. */
export const TRANSFORM_ICON_PAIRS: Record<string, string> = {
  'Sun': 'Crescent Moon', 'Compass': 'Land', 'Planeswalker Spark': 'Planeswalker Ember', 'Up Arrow': 'Down Arrow',
  'Closed Fan': 'Open Fan', 'Lesson': 'Lesson', 'Emrakul': 'Emrakul', 'Full Moon': 'Full Moon', 'Meld': 'Meld',
};

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
  const def = styleById(card.style);
  const own = stylePack(card, packs);

  const masked = (letter: string, role: string, maskName: string | null, right = false) => {
    const f = frameImage(letter, card, packs);
    if (!f) return;
    const masks: string[] = [];
    if (maskName) {
      // Style packs only use their own masks; a part the pack has no mask for is simply not drawn.
      const m = f.masks?.find((x) => x.name === maskName) ?? (own ? undefined : regularMasks.find((x) => x.name === maskName));
      if (!m) return;
      masks.push(m.src);
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
  if (def?.halfMask && card.face2.manaCost.trim()) {
    const c2 = costColors(card.face2.manaCost);
    masked(c2.length > 1 ? 'M' : c2[0] ?? 'A', 'Second half', def.halfMask);
  }
  masked(p.typeTitle, 'Title', 'Title');
  masked(p.typeTitle, 'Type', 'Type');
  masked(p.pinline, 'Pinline', 'Pinline');
  if (p.pinlineRight) masked(p.pinlineRight, 'Pinline', 'Pinline', true);

  if (p.pt) {
    if (!(card.toggles.devoid && add(packs.devoid, 'Devoid Power/Toughness', 'PT'))) {
      const n = letterName(p.pt);
      const sfx = def?.suffix ?? '';
      // Styles laid out like regular cards borrow the regular P/T box when their pack has none.
      const found = own
        ? add(own, `${n} Power/Toughness${sfx}`, 'PT') || add(own, `${n} Power/Toughness`, 'PT') || add(own, `${n} PT`, 'PT')
          || (!!def?.stamp && add(packs.regular, `${n} Power/Toughness`, 'PT'))
        : add(packs.regular, `${n} Power/Toughness`, 'PT');
      void found;
    }
  }

  const accent = base(p.pinline);
  const accentRight = p.pinlineRight ? base(p.pinlineRight) : undefined;
  const stampLetter = accent === 'L' && colors.length === 0 ? 'L' : accent;
  if (card.holoStamp && def?.stamp) {
    add(packs.stamps, `${letterName(stampLetter)} Holo Stamp`, 'Stamp');
    if (accentRight) add(packs.stamps, `${letterName(accentRight)} Holo Stamp`, 'Stamp', [RIGHT_HALF]);
  }

  if (card.toggles.nickname && def?.nickname) {
    add(packs.nickname, `${letterName(accent)} Nickname`, 'Nickname');
    if (accentRight) add(packs.nickname, `${letterName(accentRight)} Nickname`, 'Nickname', [RIGHT_HALF]);
  }

  const crownKind = def?.crown ?? 'none';
  if (card.legendary !== 'none' && crownKind !== 'none') {
    if (crownKind === 'm15' || crownKind === 'floating') {
      const pack = crownKind === 'floating' || card.legendary === 'floating' ? packs.floatingCrowns : packs.crowns;
      if (card.toggles.nyx && crownKind === 'm15') {
        add(packs.nyx, `${letterName(accent)} Inner Crown (Nyx)`, 'Inner Crown');
        if (accentRight) add(packs.nyx, `${letterName(accentRight)} Inner Crown (Nyx)`, 'Inner Crown', [RIGHT_HALF]);
      }
      add(pack, 'Legend Crown Border Cover', 'Crown Border Cover');
      add(pack, `${letterName(accent)} Legend Crown`, 'Crown');
      if (accentRight) add(pack, `${letterName(accentRight)} Legend Crown`, 'Crown', [RIGHT_HALF]);
    } else {
      const pack = crownKind === 'modal' ? packs.modalCrowns : packs.transformCrowns;
      const sfx = crownKind === 'transformBack' ? ' (Back)' : '';
      add(pack, 'Legend Crown Border Cover', 'Crown Border Cover');
      add(pack, `${letterName(accent)} Legend Crown${sfx}`, 'Crown');
      if (accentRight) add(pack, `${letterName(accentRight)} Legend Crown${sfx}`, 'Crown', [RIGHT_HALF]);
    }
  }

  // Some planeswalker packs keep the loyalty box as a separate piece.
  if (def?.special?.startsWith('planeswalker') && (card.extra.loyalty ?? '').trim()) add(own, 'Loyalty Box', 'Loyalty');

  // Transform icon in the title bar (Sun/Moon, Compass/Land, …)
  if (card.style === 'transform') add(packs.transformIcons, card.transformIcon || 'Sun', 'Transform Icon');
  if (card.style === 'transform-back') add(packs.transformIconsBack, card.transformIcon || 'Crescent Moon', 'Transform Icon');

  if (card.border !== 'black' && !own) {
    const name = `${card.border[0].toUpperCase()}${card.border.slice(1)} Border`;
    const f = find(packs.borders, name);
    const mask = f?.masks?.find((m) => m.name === (card.legendary !== 'none' ? 'Border (With Crown)' : 'Border'));
    if (f) layers.push({ role: 'Border Color', name, src: f.src, masks: mask ? [mask.src] : [] });
  }

  return layers;
}
