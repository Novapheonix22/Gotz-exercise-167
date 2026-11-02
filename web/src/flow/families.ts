import { STYLES, styleById } from './styles';
// The new card flow's step 1 tiles and step 2 styles.
// `ready: false` items show as "coming soon" until their frames are built (Phase 3).

export interface Rect { x: number; y: number; w: number; h: number; accent?: boolean }

export interface Style { id: string; name: string; ready: boolean; diagram: Rect[] }

export interface Family {
  id: string;
  name: string;
  meta: string;
  ready: boolean;
  diagram: Rect[];
  styles: Style[];
  /** Which frame toggles this family supports. */
  supports: { legendary: boolean; nickname: boolean; snow: boolean; devoid: boolean; nyx: boolean };
}

const R = (x: number, y: number, w: number, h: number, accent = false): Rect => ({ x, y, w, h, accent });
const card = R(7, 0.7, 34, 46.6);
const regular = [card, R(10, 4, 28, 4), R(10, 10, 28, 16, true), R(10, 28, 28, 3), R(10, 33, 28, 11)];

interface FamilyBase { id: string; name: string; meta: string; diagram: Rect[] }

const BASES: FamilyBase[] = [
  { id: 'normal', name: 'Normal', meta: 'Creature, spell, artifact, land', diagram: regular },
  { id: 'dfc', name: 'Double-faced', meta: 'Transform · Modal DFC', diagram: [R(13, 0.7, 30, 42), R(5, 5.3, 30, 42), R(8, 12, 24, 13, true)] },
  { id: 'adventure', name: 'Adventure · Omen · Prepare', meta: 'A second spell inside the card', diagram: [card, R(10, 4, 28, 4), R(10, 10, 28, 16), R(10, 28, 28, 3), R(10, 33, 13, 11, true), R(25, 33, 13, 11)] },
  { id: 'halves', name: 'Two halves', meta: 'Split · Fuse · Aftermath · Flip · Room', diagram: [card, R(10, 4, 28, 19), R(10, 25, 28, 19, true)] },
  { id: 'planeswalker', name: 'Planeswalker', meta: 'Regular, tall, borderless, transform…', diagram: [card, R(10, 4, 28, 4), R(10, 10, 28, 20), R(10, 32, 28, 3, true), R(10, 36.5, 28, 3, true), R(10, 41, 28, 3, true)] },
  { id: 'saga', name: 'Saga · Class · Case', meta: 'Split down the middle', diagram: [card, R(10, 4, 28, 4), R(10, 10, 13, 34, true), R(25, 10, 13, 34)] },
  { id: 'battle', name: 'Battle', meta: 'Sideways card with defense', diagram: [R(0.7, 7, 46.6, 34), R(4, 10, 30, 4), R(4, 16, 30, 12), R(4, 30, 30, 8), R(37, 28, 8, 10, true)] },
  { id: 'level', name: 'Level up · Station', meta: 'Leveler, Station', diagram: [card, R(10, 4, 28, 4), R(10, 10, 28, 10), R(10, 22, 28, 6), R(10, 30, 28, 6, true), R(10, 38, 28, 6)] },
  { id: 'token', name: 'Token', meta: 'Regular, textless, tall, short, emblem', diagram: [card, R(14, 4, 20, 4), R(10, 10, 28, 24, true), R(10, 36, 28, 8)] },
  { id: 'showcase', name: 'Showcase & full art', meta: 'Borderless, extended art, etched, nickname…', diagram: [card, R(9, 2.6, 30, 42.8, true), R(11, 5, 26, 4), R(11, 32, 26, 11)] },
  { id: 'other', name: 'Other mechanics', meta: 'Mutate, Prototype, Spree, Attraction, Conspiracy', diagram: [card, R(10, 4, 28, 4), R(10, 10, 28, 14), R(10, 26, 28, 8), R(10, 36, 28, 8, true)] },
  { id: 'old', name: 'Old frames', meta: 'Alpha through 8th Edition', diagram: [card, R(10, 4, 28, 4), R(12, 10, 24, 16, true), R(10, 29, 28, 15)] },
];

export const FAMILIES: Family[] = BASES.map((b) => ({
  ...b,
  ready: true,
  styles: STYLES.filter((s) => s.family === b.id && !s.hidden).map((s) => ({ id: s.id, name: s.name, ready: true, diagram: b.diagram })),
  supports: { legendary: true, nickname: true, snow: true, devoid: true, nyx: true },
}));

export const familyById = (id: string) => FAMILIES.find((f) => f.id === id);

/** Which frame toggles a style supports. */
export function styleSupports(styleId: string) {
  const d = styleById(styleId);
  return {
    legendary: !!d && d.crown !== 'none',
    nickname: !!d?.nickname,
    snow: !!d?.snowDevoid,
    devoid: !!d?.snowDevoid,
    nyx: !!d?.nyx,
  };
}
