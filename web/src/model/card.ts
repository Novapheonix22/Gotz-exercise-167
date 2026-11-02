import { styleById } from '../flow/styles';
export type Legendary = 'none' | 'crown' | 'floating';
export type Rarity = 'C' | 'U' | 'R' | 'M' | 'L' | 'P' | 'S' | 'T';
export type Border = 'black' | 'white' | 'silver' | 'gold';
/** 'auto' follows the mana cost. */
export type FrameColor = 'auto' | 'W' | 'U' | 'B' | 'R' | 'G' | 'M' | 'A' | 'L';

export interface ArtState {
  /** Image reference: an object/data URL, or "storage:<path>" for an uploaded file. */
  src: string;
  /** Offset of the art center from the art box center, as a fraction of card width/height. */
  x: number;
  y: number;
  /** 1 = cover the art box exactly. */
  zoom: number;
}

export interface FrameToggles {
  nickname: boolean;
  snow: boolean;
  devoid: boolean;
  nyx: boolean;
}

/** The second spell on Adventure, Omen and Prepare cards. */
export interface SecondFace {
  name: string;
  manaCost: string;
  typeLine: string;
  rulesText: string;
}

export interface Card {
  id: string;
  /** New card flow choices. */
  family: string;
  style: string;

  name: string;
  nickname: string;
  manaCost: string;
  supertype: string;
  cardType: string;
  subtype: string;
  rulesText: string;
  flavorText: string;
  power: string;
  toughness: string;

  legendary: Legendary;
  toggles: FrameToggles;
  frameColor: FrameColor;
  border: Border;
  holoStamp: boolean;

  rarity: Rarity;
  setId: string | null;
  setCode: string;
  collectorNumber: string;
  setTotal: string;
  language: string;
  artist: string;
  designer: string;

  face2: SecondFace;
  /** Text for style-specific boxes (planeswalker abilities, saga chapters, levels, loyalty, …), keyed by the pack's box id. */
  extra: Record<string, string>;
  /** Transform icon shown in the title bar (front), e.g. "Sun". */
  transformIcon: string;
  /** Back face of a double-faced card. */
  back?: Card;
  /** Mana cost to take frame colors from when the card has none (back faces use the front's). */
  colorCost?: string;

  art?: ArtState;
  /** Set symbol image reference (overrides the set's symbol), same format as art src. */
  setSymbol?: string;
  /** Color the set symbol by rarity; false = use the image as-is. */
  tintSymbol: boolean;

  updatedAt?: string;
}

export interface CardSet {
  id: string;
  code: string;
  name: string;
  /** Image reference for the symbol, same format as art src. */
  symbol?: string;
}

export function typeLine(card: Card): string {
  const left = [card.supertype, card.cardType].filter((s) => s.trim()).join(' ');
  return card.subtype.trim() ? `${left} — ${card.subtype.trim()}` : left;
}

export function blankCard(family = 'normal', style = 'regular'): Card {
  const def = styleById(style);
  const card = baseCard(family, style);
  if (def?.defaults) {
    card.cardType = def.defaults.cardType ?? card.cardType;
    card.subtype = def.defaults.subtype ?? card.subtype;
    card.supertype = def.defaults.supertype ?? card.supertype;
  }
  if (def?.special?.startsWith('planeswalker')) {
    card.extra = { cost0: '+1', cost1: '−2', cost2: '−7', loyalty: '4' };
    card.legendary = 'none';
  }
  if (def?.special === 'saga') card.extra = { chapters0: '1', chapters1: '1', chapters2: '1' };
  if (def?.back) card.back = { ...blankCard(family, def.back), id: card.id + '-back' };
  if (style === 'transform') card.transformIcon = 'Sun';
  if (style === 'transform-back') card.transformIcon = 'Crescent Moon';
  return card;
}

function baseCard(family: string, style: string): Card {
  return {
    id: crypto.randomUUID(),
    family,
    style,
    name: '',
    nickname: '',
    manaCost: '',
    supertype: '',
    cardType: style === 'land' ? 'Land' : style === 'vehicle' ? 'Artifact' : 'Creature',
    subtype: style === 'vehicle' ? 'Vehicle' : '',
    rulesText: '',
    flavorText: '',
    power: style === 'land' ? '' : '',
    toughness: '',
    legendary: 'none',
    toggles: { nickname: false, snow: false, devoid: false, nyx: false },
    frameColor: 'auto',
    border: 'black',
    holoStamp: true,
    rarity: 'R',
    setId: null,
    setCode: '',
    collectorNumber: '',
    setTotal: '',
    language: 'EN',
    artist: '',
    designer: '',
    tintSymbol: true,
    face2: { name: '', manaCost: '', typeLine: defaultFace2Type(style), rulesText: '' },
    extra: {},
    transformIcon: '',
  };
}

export function defaultFace2Type(style: string) {
  if (style === 'adventure') return 'Sorcery — Adventure';
  if (style === 'omen') return 'Sorcery — Omen';
  if (style === 'prepare') return 'Sorcery';
  return '';
}

/** Fill in fields missing from cards saved by older versions. */
export function upgradeCard(raw: Partial<Card> & { id: string }): Card {
  const base = blankCard(raw.family, raw.style);
  return {
    ...base, ...raw,
    toggles: { ...base.toggles, ...(raw.toggles ?? {}) },
    face2: { ...base.face2, ...(raw.face2 ?? {}) },
    extra: { ...(raw.extra ?? {}) },
    back: raw.back ? upgradeCard(raw.back) : undefined,
  };
}

export function sampleCard(): Card {
  return {
    ...blankCard(),
    name: 'Skarix, Beast Thane',
    manaCost: '{B}{R}{G}',
    supertype: 'Legendary',
    cardType: 'Creature',
    subtype: 'Lizard Warrior',
    rulesText: 'First strike, menace\nWhenever one or more creatures attack you, you may untap ~ and put a +1/+1 counter on it.',
    flavorText: '"The thane hunts alone, and never goes hungry."',
    power: '2',
    toughness: '2',
    legendary: 'crown',
    setCode: 'MOX',
    collectorNumber: '031',
    setTotal: '031',
    artist: 'Halint',
  };
}
