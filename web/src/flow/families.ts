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
const none = { legendary: false, nickname: false, snow: false, devoid: false, nyx: false };
const all = { legendary: true, nickname: true, snow: true, devoid: true, nyx: true };

export const FAMILIES: Family[] = [
  {
    id: 'normal', name: 'Normal', meta: 'Creature, spell, artifact, land', ready: true, diagram: regular, supports: all,
    styles: [
      { id: 'regular', name: 'Regular', ready: true, diagram: regular },
      { id: 'land', name: 'Land', ready: true, diagram: [card, R(10, 4, 28, 4), R(10, 10, 28, 16), R(10, 28, 28, 3), R(10, 33, 28, 11, true)] },
      { id: 'vehicle', name: 'Vehicle', ready: true, diagram: [card, R(10, 4, 28, 4), R(10, 10, 28, 16), R(10, 28, 28, 3), R(10, 33, 28, 11), R(30, 41, 9, 5, true)] },
      { id: 'colorshifted', name: 'Colorshifted', ready: false, diagram: regular },
    ],
  },
  { id: 'dfc', name: 'Double-faced', meta: 'Transform · Modal DFC', ready: false, diagram: [R(13, 0.7, 30, 42), R(5, 5.3, 30, 42), R(8, 12, 24, 13, true)], supports: all, styles: [] },
  {
    id: 'adventure', name: 'Adventure · Omen · Prepare', meta: 'A second spell inside the card', ready: true,
    diagram: [card, R(10, 4, 28, 4), R(10, 10, 28, 16), R(10, 28, 28, 3), R(10, 33, 13, 11, true), R(25, 33, 13, 11)],
    supports: { legendary: true, nickname: true, snow: false, devoid: false, nyx: true },
    styles: [
      { id: 'adventure', name: 'Adventure', ready: true, diagram: [card, R(10, 4, 28, 4), R(10, 10, 28, 16), R(10, 28, 28, 3), R(10, 33, 13, 11, true), R(25, 33, 13, 11)] },
      { id: 'omen', name: 'Omen', ready: true, diagram: [card, R(10, 4, 28, 4), R(10, 10, 28, 16), R(10, 28, 28, 3), R(10, 33, 13, 11, true), R(25, 33, 13, 11)] },
      { id: 'prepare', name: 'Prepare', ready: true, diagram: [card, R(10, 4, 28, 4), R(10, 10, 28, 16), R(10, 28, 28, 3), R(10, 33, 13, 11), R(25, 33, 13, 11, true)] },
    ],
  },
  { id: 'halves', name: 'Two halves', meta: 'Split · Fuse · Aftermath · Flip · Room', ready: false, diagram: [card, R(10, 4, 28, 19), R(10, 25, 28, 19, true)], supports: none, styles: [] },
  { id: 'planeswalker', name: 'Planeswalker', meta: 'Regular, tall, borderless…', ready: false, diagram: [card, R(10, 4, 28, 4), R(10, 10, 28, 20), R(10, 32, 28, 3, true), R(10, 36.5, 28, 3, true), R(10, 41, 28, 3, true)], supports: none, styles: [] },
  { id: 'saga', name: 'Saga · Class · Case', meta: 'Split down the middle', ready: false, diagram: [card, R(10, 4, 28, 4), R(10, 10, 13, 34, true), R(25, 10, 13, 34)], supports: none, styles: [] },
  { id: 'battle', name: 'Battle', meta: 'Sideways card with defense', ready: false, diagram: [R(0.7, 7, 46.6, 34), R(4, 10, 30, 4), R(4, 16, 30, 12), R(4, 30, 30, 8), R(37, 28, 8, 10, true)], supports: none, styles: [] },
  { id: 'level', name: 'Level up · Station', meta: 'Leveler, Station', ready: false, diagram: [card, R(10, 4, 28, 4), R(10, 10, 28, 10), R(10, 22, 28, 6), R(10, 30, 28, 6, true), R(10, 38, 28, 6)], supports: none, styles: [] },
  { id: 'token', name: 'Token', meta: 'Regular, textless, tall, emblem…', ready: false, diagram: [card, R(14, 4, 20, 4), R(10, 10, 28, 24, true), R(10, 36, 28, 8)], supports: none, styles: [] },
  { id: 'showcase', name: 'Showcase & full art', meta: 'Borderless, extended art, nickname…', ready: false, diagram: [card, R(9, 2.6, 30, 42.8, true), R(11, 5, 26, 4), R(11, 32, 26, 11)], supports: none, styles: [] },
  { id: 'other', name: 'Other mechanics', meta: 'Mutate, Prototype, Spree, Attraction, Conspiracy', ready: false, diagram: [card, R(10, 4, 28, 4), R(10, 10, 28, 14), R(10, 26, 28, 8), R(10, 36, 28, 8, true)], supports: none, styles: [] },
  { id: 'old', name: 'Old frames', meta: 'Alpha through 8th Edition', ready: false, diagram: [card, R(10, 4, 28, 4), R(12, 10, 24, 16, true), R(10, 29, 28, 15)], supports: none, styles: [] },
];

export const familyById = (id: string) => FAMILIES.find((f) => f.id === id);
