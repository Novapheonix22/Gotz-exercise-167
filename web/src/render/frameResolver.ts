// Builds the frame layer stack for a regular (M15) card from its mana cost,
// type line and toggles. Follows Card Conjurer's auto-frame rules.

import type { Card } from '../model/card';
import { typeLine } from '../model/card';
import { costColors, type Color } from './symbols';
import type { Pack, PackFrame } from './packs';

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

export interface FrameProperties {
  frame: string; frameRight?: string;
  rules: string; rulesRight?: string;
  pinline: string; pinlineRight?: string;
  typeTitle: string;
  pt?: string;
}

/** Which color letter each part of the frame uses. */
export function frameProperties(colors: Color[], manaCost: string, type: string, hasPT: boolean): FrameProperties {
  const c = orderedColors(colors);
  const isHybrid = manaCost.includes('/');
  const isLand = type.includes('Land');
  const isArtifact = type.includes('Artifact');
  const isVehicle = type.includes('Vehicle');

  // Colored lands use land-colored frames from the Lands pack, not loaded yet; use plain land for now.
  let rules: string;
  if (isLand) rules = 'L';
  else if (c.length > 2) rules = 'M';
  else if (c.length > 0) rules = c[0];
  else rules = 'A';
  const rulesRight = c.length === 2 && !isLand ? c[1] : undefined;

  let typeTitle: string;
  if (c.length >= 2) typeTitle = (isHybrid || isLand) && c.length === 2 ? 'L' : 'M';
  else if (isLand) typeTitle = 'L';
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
  if (hasPT) pt = isVehicle ? 'V' : typeTitle === 'L' ? 'C' : typeTitle;

  return { frame, frameRight, rules, rulesRight, pinline: rules, pinlineRight: rulesRight, typeTitle, pt };
}

const RIGHT_HALF = '/cc/img/frames/maskRightHalf.webp';

function findFrame(pack: Pack | undefined, name: string): PackFrame | undefined {
  return pack?.frames.find((f) => f.name === name);
}

function letterName(letter: string) { return LETTER_NAMES[letter] ?? 'Artifact'; }

export interface Packs {
  regular: Pack;
  crowns?: Pack;
  floatingCrowns?: Pack;
  stamps?: Pack;
}

/** Layers from bottom to top. */
export function buildLayers(card: Card, packs: Packs): FrameLayer[] {
  const type = typeLine(card);
  const colors = costColors(card.manaCost);
  const hasPT = !!(card.power.trim() || card.toughness.trim());
  const p = frameProperties(colors, card.manaCost, type, hasPT);
  const layers: FrameLayer[] = [];

  const masked = (letter: string, role: string, maskName: string | null, right = false) => {
    const f = findFrame(packs.regular, `${letterName(letter)} Frame`) ?? findFrame(packs.regular, 'Artifact Frame');
    if (!f) return;
    const masks: string[] = [];
    if (maskName) {
      const m = f.masks?.find((x) => x.name === maskName);
      if (m) masks.push(m.src);
    }
    if (right) masks.push(RIGHT_HALF);
    layers.push({ role, name: `${letterName(letter)} ${role}${right ? ' (right)' : ''}`, src: f.src, masks });
  };

  // Bottom to top (Card Conjurer builds top-down, then reverses).
  masked(p.frame, 'Border', 'Border');
  masked(p.frame, 'Frame', null);
  if (p.frameRight) masked(p.frameRight, 'Frame', 'Frame', true);
  masked(p.rules, 'Rules', 'Rules');
  if (p.rulesRight) masked(p.rulesRight, 'Rules', 'Rules', true);
  masked(p.typeTitle, 'Title', 'Title');
  masked(p.typeTitle, 'Type', 'Type');
  masked(p.pinline, 'Pinline', 'Pinline');
  if (p.pinlineRight) masked(p.pinlineRight, 'Pinline', 'Pinline', true);

  if (p.pt) {
    const f = findFrame(packs.regular, `${letterName(p.pt)} Power/Toughness`);
    if (f) layers.push({ role: 'PT', name: f.name, src: f.src, masks: [], bounds: f.bounds });
  }

  const stampLetter = p.pinline === 'L' && colors.length === 0 ? 'L' : p.pinline;
  if (card.holoStamp && packs.stamps) {
    const f = findFrame(packs.stamps, `${letterName(stampLetter)} Holo Stamp`);
    if (f) layers.push({ role: 'Stamp', name: f.name, src: f.src, masks: [], bounds: f.bounds });
    if (p.pinlineRight) {
      const r = findFrame(packs.stamps, `${letterName(p.pinlineRight)} Holo Stamp`);
      if (r) layers.push({ role: 'Stamp', name: r.name + ' (right)', src: r.src, masks: [RIGHT_HALF], bounds: r.bounds });
    }
  }

  if (card.legendary !== 'none') {
    const pack = card.legendary === 'floating' ? packs.floatingCrowns : packs.crowns;
    const cover = findFrame(pack, 'Legend Crown Border Cover');
    if (cover) layers.push({ role: 'Crown Border Cover', name: cover.name, src: cover.src, masks: [], bounds: cover.bounds });
    const crown = findFrame(pack, `${letterName(p.pinline)} Legend Crown`);
    if (crown) layers.push({ role: 'Crown', name: crown.name, src: crown.src, masks: [], bounds: crown.bounds });
    if (p.pinlineRight) {
      const r = findFrame(pack, `${letterName(p.pinlineRight)} Legend Crown`);
      if (r) layers.push({ role: 'Crown', name: r.name + ' (right)', src: r.src, masks: [RIGHT_HALF], bounds: r.bounds });
    }
  }

  return layers;
}
