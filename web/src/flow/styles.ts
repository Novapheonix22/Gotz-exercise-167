// Every card style the app can make. Each style points at a Card Conjurer frame
// pack; the pack supplies the frame images, masks and text box positions.

export type CrownKind = 'm15' | 'floating' | 'transform' | 'transformBack' | 'modal' | 'none';
export type Special = 'planeswalker' | 'planeswalkerTall' | 'planeswalkerTransform' | 'saga' | null;

export interface StyleDef {
  id: string;
  family: string;
  name: string;
  /** Card Conjurer pack id. 'M15Regular-1' styles use the classic regular-frame builder. */
  pack: string;
  /** Appended to frame names in packs that hold several faces, e.g. " (Front)". */
  suffix?: string;
  crown: CrownKind;
  /** The M15 holo stamp fits this layout. */
  stamp?: boolean;
  /** Supports the M15 nickname bar add-on. */
  nickname?: boolean;
  /** Has Nyx/enchantment frame variants. */
  nyx?: boolean;
  /** Snow and devoid variants (regular frames only). */
  snowDevoid?: boolean;
  special?: Special;
  /** Text box key that holds the main rules text when the pack doesn't use "rules". */
  mainRules?: string;
  /** Style id of the back face (double-faced cards). */
  back?: string;
  /** Mask name that colors the second half from the second spell's cost (split cards etc.). */
  halfMask?: string;
  /** Second art window for two-half cards: same art, shifted down by this fraction of the card height. */
  art2Offset?: number;
  /** Default text for the type line etc. when starting a card in this style. */
  defaults?: { cardType?: string; subtype?: string; supertype?: string };
  /** Hidden from step 2 (e.g. back faces). */
  hidden?: boolean;
}

const m15 = { crown: 'm15' as const, stamp: true, nickname: true };

export const STYLES: StyleDef[] = [
  // Normal
  { id: 'regular', family: 'normal', name: 'Regular', pack: 'M15Regular-1', ...m15, nyx: true, snowDevoid: true },
  { id: 'land', family: 'normal', name: 'Land', pack: 'M15Regular-1', ...m15, nyx: true, snowDevoid: true, defaults: { cardType: 'Land' } },
  { id: 'vehicle', family: 'normal', name: 'Vehicle', pack: 'M15Regular-1', ...m15, snowDevoid: true, defaults: { cardType: 'Artifact', subtype: 'Vehicle' } },
  { id: 'colorshifted', family: 'normal', name: 'Colorshifted', pack: 'Colorshifted', ...m15 },

  // Double-faced
  { id: 'transform', family: 'dfc', name: 'Transform', pack: 'M15TransformFront', crown: 'transform', stamp: true, back: 'transform-back' },
  { id: 'transform-back', family: 'dfc', name: 'Transform (back)', pack: 'M15TransformBackNew', crown: 'transformBack', stamp: true, hidden: true },
  { id: 'mdfc', family: 'dfc', name: 'Modal DFC', pack: 'ModalRegular', suffix: ' (Front)', crown: 'modal', stamp: true, back: 'mdfc-back' },
  { id: 'mdfc-back', family: 'dfc', name: 'Modal DFC (back)', pack: 'ModalRegular', suffix: ' (Back)', crown: 'modal', stamp: true, hidden: true },

  // Adventure · Omen · Prepare
  { id: 'adventure', family: 'adventure', name: 'Adventure', pack: 'Adventure', ...m15, nyx: true },
  { id: 'omen', family: 'adventure', name: 'Omen', pack: 'Omen', ...m15, nyx: true },
  { id: 'prepare', family: 'adventure', name: 'Prepare', pack: 'Prepare', ...m15, nyx: true },

  // Two halves
  { id: 'split', family: 'halves', name: 'Split', pack: 'Split', crown: 'none', halfMask: 'Top Half', art2Offset: 0.4562, defaults: { cardType: 'Instant' } },
  { id: 'fuse', family: 'halves', name: 'Fuse', pack: 'Fuse', crown: 'none', halfMask: 'Top Half', art2Offset: 0.4562, defaults: { cardType: 'Instant' } },
  { id: 'aftermath', family: 'halves', name: 'Aftermath', pack: 'Aftermath', crown: 'none', halfMask: 'Bottom Half', defaults: { cardType: 'Sorcery' } },
  { id: 'flip', family: 'halves', name: 'Flip', pack: 'Flip', crown: 'none' },
  { id: 'room', family: 'halves', name: 'Room', pack: 'Room', crown: 'none', nyx: true, halfMask: 'Top Right', defaults: { cardType: 'Enchantment', subtype: 'Room' } },

  // Planeswalker
  { id: 'pw', family: 'planeswalker', name: 'Regular', pack: 'PlaneswalkerRegular', crown: 'none', special: 'planeswalker', defaults: { supertype: 'Legendary', cardType: 'Planeswalker' } },
  { id: 'pw-tall', family: 'planeswalker', name: 'Tall', pack: 'PlaneswalkerTall', crown: 'none', special: 'planeswalkerTall', defaults: { supertype: 'Legendary', cardType: 'Planeswalker' } },
  { id: 'pw-borderless', family: 'planeswalker', name: 'Borderless', pack: 'PlaneswalkerBorderless', crown: 'none', special: 'planeswalker', defaults: { supertype: 'Legendary', cardType: 'Planeswalker' } },
  { id: 'pw-extended', family: 'planeswalker', name: 'Extended Art', pack: 'PlaneswalkerBoxTopper', crown: 'none', special: 'planeswalker', defaults: { supertype: 'Legendary', cardType: 'Planeswalker' } },
  { id: 'pw-compleated', family: 'planeswalker', name: 'Compleated', pack: 'PlaneswalkerCompleated', crown: 'none', special: 'planeswalkerTall', defaults: { supertype: 'Legendary', cardType: 'Planeswalker' } },
  { id: 'pw-transform', family: 'planeswalker', name: 'Transform', pack: 'PlaneswalkerTransformFront', suffix: ' (Front)', crown: 'none', special: 'planeswalkerTransform', back: 'pw-transform-back', defaults: { supertype: 'Legendary', cardType: 'Planeswalker' } },
  { id: 'pw-transform-back', family: 'planeswalker', name: 'Transform (back)', pack: 'PlaneswalkerTransformBack', suffix: ' (Back)', crown: 'none', special: 'planeswalker', hidden: true, defaults: { supertype: 'Legendary', cardType: 'Planeswalker' } },

  // Saga · Class · Case
  { id: 'saga', family: 'saga', name: 'Saga', pack: 'SagaRegular', crown: 'm15', nyx: true, special: 'saga', defaults: { cardType: 'Enchantment', subtype: 'Saga' } },
  { id: 'class', family: 'saga', name: 'Class', pack: 'Class', crown: 'm15', defaults: { cardType: 'Enchantment', subtype: 'Class' } },
  { id: 'case', family: 'saga', name: 'Case', pack: 'Case', crown: 'm15', defaults: { cardType: 'Enchantment', subtype: 'Case' } },

  // Battle
  { id: 'battle', family: 'battle', name: 'Battle', pack: 'Battle', crown: 'none', defaults: { cardType: 'Battle', subtype: 'Siege' } },

  // Level up · Station
  { id: 'leveler', family: 'level', name: 'Leveler', pack: 'Leveler', crown: 'm15', defaults: { cardType: 'Creature' } },
  { id: 'station', family: 'level', name: 'Station', pack: 'StationRegular', crown: 'none', defaults: { cardType: 'Artifact', subtype: 'Spacecraft' } },

  // Token
  { id: 'token', family: 'token', name: 'Regular', pack: 'TokenRegular-1', crown: 'floating', defaults: { cardType: 'Token Creature' } },
  { id: 'token-textless', family: 'token', name: 'Textless', pack: 'TokenTextless-1', crown: 'floating', defaults: { cardType: 'Token Creature' } },
  { id: 'token-tall', family: 'token', name: 'Tall', pack: 'TokenTall-1', crown: 'floating', defaults: { cardType: 'Token Creature' } },
  { id: 'token-short', family: 'token', name: 'Short', pack: 'TokenShort-1', crown: 'floating', defaults: { cardType: 'Token Creature' } },
  { id: 'emblem', family: 'token', name: 'Emblem', pack: 'Emblem', crown: 'none', defaults: { cardType: 'Emblem' } },

  // Showcase & full art
  { id: 'borderless', family: 'showcase', name: 'Borderless', pack: 'GenericShowcase', crown: 'floating' },
  { id: 'extended', family: 'showcase', name: 'Extended Art', pack: 'M15BoxTopper', crown: 'floating', stamp: true, nyx: true },
  { id: 'fullart', family: 'showcase', name: 'Full Art', pack: 'M15ClearTextboxes', crown: 'floating', stamp: true },
  { id: 'etched', family: 'showcase', name: 'Etched', pack: 'Etched', crown: 'none' },
  { id: 'fulltext', family: 'showcase', name: 'Full Text', pack: 'FullText', ...m15 },
  { id: 'nickname-showcase', family: 'showcase', name: 'Nickname (Godzilla)', pack: 'M15Nickname', crown: 'none' },
  { id: 'phyrexian', family: 'showcase', name: 'Phyrexian', pack: 'Praetors', crown: 'none' },

  // Other mechanics
  { id: 'mutate', family: 'other', name: 'Mutate', pack: 'M15Mutate', ...m15, mainRules: 'rules2', defaults: { cardType: 'Creature' } },
  { id: 'prototype', family: 'other', name: 'Prototype', pack: 'Prototype', ...m15, mainRules: 'rules2', defaults: { cardType: 'Artifact Creature' } },
  { id: 'spree', family: 'other', name: 'Spree', pack: 'Spree', ...m15, defaults: { cardType: 'Instant' } },
  { id: 'attraction', family: 'other', name: 'Attraction', pack: 'Attraction', crown: 'none', defaults: { cardType: 'Artifact', subtype: 'Attraction' } },
  { id: 'conspiracy', family: 'other', name: 'Conspiracy', pack: 'Conspiracy', crown: 'none', defaults: { cardType: 'Conspiracy' } },

  // Old frames
  { id: 'eighth', family: 'old', name: '8th Edition', pack: '8th', crown: 'none', nyx: true },
  { id: 'seventh', family: 'old', name: '7th Edition', pack: 'Seventh', crown: 'none' },
  { id: 'fifth', family: 'old', name: '5th Edition', pack: 'SeventhButFifth', crown: 'none' },
  { id: 'fourth', family: 'old', name: '4th Edition', pack: 'Fourth', crown: 'none' },
  { id: 'abu', family: 'old', name: 'Alpha / Beta', pack: 'ABU', crown: 'none' },
];

export const styleById = (id: string) => STYLES.find((s) => s.id === id);

/** Every pack id any style needs (also read by the asset script). */
export const STYLE_PACK_IDS = [...new Set(STYLES.map((s) => s.pack))];
