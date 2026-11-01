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
  };
}

/** Fill in fields missing from cards saved by older versions. */
export function upgradeCard(raw: Partial<Card> & { id: string }): Card {
  const base = blankCard(raw.family, raw.style);
  return { ...base, ...raw, toggles: { ...base.toggles, ...(raw.toggles ?? {}) } };
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
