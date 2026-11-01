export type Legendary = 'none' | 'crown' | 'floating';
export type Rarity = 'C' | 'U' | 'R' | 'M' | 'L' | 'P' | 'S' | 'T';

export interface ArtState {
  /** Object URL or data URL of the art image. */
  src: string;
  /** Offset of the art center from the art box center, as a fraction of card width/height. */
  x: number;
  y: number;
  /** 1 = cover the art box exactly. */
  zoom: number;
}

export interface Card {
  id: string;
  name: string;
  manaCost: string;
  supertype: string;
  cardType: string;
  subtype: string;
  rulesText: string;
  flavorText: string;
  power: string;
  toughness: string;

  legendary: Legendary;
  holoStamp: boolean;

  rarity: Rarity;
  setCode: string;
  collectorNumber: string;
  setTotal: string;
  language: string;
  artist: string;
  designer: string;

  art?: ArtState;
}

export function typeLine(card: Card): string {
  const left = [card.supertype, card.cardType].filter((s) => s.trim()).join(' ');
  return card.subtype.trim() ? `${left} — ${card.subtype.trim()}` : left;
}

export function newCard(): Card {
  return {
    id: crypto.randomUUID(),
    name: 'Skarix, Beast Thane',
    manaCost: '{B}{R}{G}',
    supertype: 'Legendary',
    cardType: 'Creature',
    subtype: 'Lizard Warrior',
    rulesText: 'First strike, menace\nWhenever one or more creatures attack you, you may untap ~ and put a +1/+1 counter on it. (A creature with menace can\'t be blocked except by two or more creatures.)',
    flavorText: '"The thane hunts alone, and never goes hungry."',
    power: '2',
    toughness: '2',
    legendary: 'crown',
    holoStamp: true,
    rarity: 'R',
    setCode: 'MOX',
    collectorNumber: '031',
    setTotal: '031',
    language: 'EN',
    artist: 'Halint',
    designer: '',
  };
}
