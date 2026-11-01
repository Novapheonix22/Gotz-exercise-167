# Custom Card Maker (Web App): Build Plan

**What it's for:** making custom cards (e.g. commanders) to play online with friends, mainly on untap.in. Not for printing.

**What it is:** a web app built mobile-first. On a phone it works like an app: add it to the home screen and it opens full screen and works offline. On a PC or tablet it gets a wider layout. It combines **MTG.design's** ease of use (fill in the boxes and you're done) with **Card Conjurer's** power (hundreds of frame packs, layered frames, movable text boxes).

> **Why a web app and not an iPhone app:** iPhone apps can only be built and installed with Xcode on a Mac. A web app runs on iPhone, iPad, Android and PC from one link. Friends just open the link, and it can be built and tested entirely in these cloud sessions. Card Conjurer itself is a web app, which proves the card rendering works fine in a browser.

Reference inventories:
- [`docs/mtg-design-inventory.md`](docs/mtg-design-inventory.md): every MTG.design editor option.
- [`docs/cardconjurer-inventory.md`](docs/cardconjurer-inventory.md): every Card Conjurer option and all 381 frame packs.

Mockups (phone, light and dark): https://claude.ai/artifact/9k5AcW5Xtw3MqdMfEBkK3U

---

## 0. Platform, hosting and assets

**Hosting:** a static site (no server needed) on a free host such as GitHub Pages or Cloudflare Pages. Anyone with the link can use it.

**On a phone:** open the link in Safari/Chrome → *Add to Home Screen*. It then has its own icon, opens full screen without browser bars, and works offline (a Progressive Web App).

**Where cards are saved:** in the browser on each device (IndexedDB, which holds far more than Card Conjurer's 5 MB limit). Two things follow from that:
- Cards on your phone don't automatically appear on your PC. A **backup file** (export/import all cards) covers this from Phase 4, and optional **cloud sync** is in Phase 7.
- iPhone Safari can clear storage for websites that go unused for a while. Adding the app to the home screen protects against that, and the app reminds you to make a backup now and then.

**Assets (authentic look, personal use):**
- **Symbols:** the open-source *Mana* icon font (andrewgioia/mana) for mana, tap/untap, loyalty, saga chapters, Phyrexian/hybrid symbols. *Keyrune* for real set symbols.
- **Fonts:** Beleren Bold (name, type line), Beleren Small Caps (artist/collector line), MPlantin + MPlantin Italic (rules and flavor text), loaded as web fonts.
- **Frames:** the Card Conjurer frame pack PNGs (frames, masks, crowns, stamps, P/T boxes), served as static files with one small manifest JSON per pack (see §2). A script downloads and converts them.
- **Custom set symbols:** upload your own image (see the new card flow, step 2).

---

## 1. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** | Catches mistakes early in a big codebase |
| UI | **React 19 + Vite** | Fast, widely used, good tooling |
| Card rendering | **HTML Canvas 2D** in one `CardRenderer` | Same code draws the live preview and the exported image, so they always match (what Card Conjurer does too) |
| Rich text | Custom text layout on Canvas with inline symbol glyphs | Rules text needs inline symbols, italics, line breaks and shrink-to-fit |
| Storage | **IndexedDB** (via Dexie) for cards, art and set symbols | Large, offline, per device |
| Offline + installable | **PWA** (web app manifest + service worker via vite-plugin-pwa) | Home-screen icon, full screen, works offline |
| Touch | Pointer Events for drag and pinch-to-zoom on the art and layers | Works on phone and mouse |
| Export | `canvas.toBlob` → PNG/JPG; **JSZip** for multi-file exports (Cockatrice, Forge, TTS); Web Share API on phones | Native share sheet on phones, downloads on PC |
| Appearance | Light / Dark / System, with CSS color tokens | Dark mode for the app; the card render looks the same in both |
| Layout | Phone: one column like the mockups. Tablet/PC: library sidebar, card preview, and form side by side | One app for all screen sizes |
| Tests | **Vitest** for logic (text codes, symbols, frame rules) + **Playwright** screenshot tests of rendered cards | Rendering bugs are the main risk |

---

## 2. Architecture

```
src/
├── model/           Card, CardSet, FrameLayer, TextBox types; IndexedDB storage
├── render/
│   ├── CardRenderer        draws a Card onto a canvas at any scale
│   ├── LayerCompositor     draws the frame layer stack (image + mask + rect + opacity + blend + color/HSL)
│   ├── FrameResolver       builds the layer stack from style + toggles + mana cost colors
│   ├── TextLayout          parses text codes, lays out symbols, fits text to the box
│   └── SymbolParser        "{2}{W}{U/B}{G/P}{T}" → tokens → glyphs
├── packs/           Card Conjurer frame packs: PNGs + manifest + frame version (text box and art positions)
├── flow/            new card flow: kind → style and frame → fill in the boxes
├── editor/          the in-depth editor: layers, text boxes, art, set symbol, watermark, collector
├── library/         cards grouped by custom set and "Ungrouped"
└── export/          PNG/JPG, Untap, Cockatrice, Tabletop Simulator, Forge, backup file
```

**Rules:**
- **Every card is a stack of frame layers**, the way Card Conjurer works: each layer is a PNG, an optional mask (Pinline, Title, Type, Rules, Frame, Border, or a half/third of the card), a rectangle, opacity, blend mode and optional color overlay/HSL shift. A floating legend crown, a holo stamp or a "Godzilla" nickname bar is one more layer.
- **The layer stack is always built for you.** The new card flow assembles every layer in the standard order (border → frame → P/T box → crowns/nickname → stamps), and changing the mana cost or a toggle rebuilds it. Each kind of layer has a fixed slot, so anything added lands in the right place. Layers you edit by hand are marked as yours and left alone by later rebuilds; **Reset to auto** puts a layer (or the whole stack) back.
- **Restore button (the panic button).** Opening the in-depth editor takes a snapshot of the layer stack. **Restore** (in the Layers header, with a confirm) puts the stack back to that snapshot: added layers removed, deleted ones back, order and positions reset. Color changes made since (e.g. a new mana cost) carry over, so the restored frame matches the card's current colors.
- **Frame packs are data.** A pack = PNGs + a manifest (names, colors, masks, default rects) + a *frame version* (where the title, type, rules, P/T text boxes and art window sit). Adding a pack never needs new code.
- **Frame color comes from the mana cost** (mono, gold, hybrid, artifact/colorless, land), with a manual override.
- **Fixed canvas.** Cards are laid out on a 1488 × 2078 canvas (exactly 2× MTG.design's 744 × 1039 export) and scaled when drawn.

### Data model (sketch)

```ts
interface Card {
  id: string;
  // Setup choices (new card flow)
  family: string;            // "adventure-omen-prepare", "two-halves", …
  style: string;             // "adventure", "room", …
  toggles: { legendary: 'none' | 'crown' | 'floating'; nickname: boolean; snow: boolean; devoid: boolean; nyx: boolean; miracle: boolean };
  frameColor: 'auto' | ColorChoice;
  border: 'black' | 'white' | 'silver' | 'gold';

  // Card text
  name: string; nickname?: string; manaCost: string;          // "{2}{W}{U/B}"
  supertype: string; cardType: string; subtype: string;
  rulesText: string; flavorText: string;
  power?: string; toughness?: string; loyalty?: string; defense?: string;
  secondFace?: Partial<Card>;                                 // adventure spell, room door, back face…
  loyaltyAbilities?: { cost: string; text: string }[];       // planeswalkers (3–6)
  chapters?: { numbers: string; text: string }[];             // sagas

  // Set and collector info
  setId?: string;                                             // brings set code, symbol, total
  collectorNumber: string; rarity: 'C' | 'U' | 'R' | 'M' | 'L' | 'P' | 'S' | 'T';
  language: string; artist: string; designer: string;

  // Art
  artId?: string; crop: { x: number; y: number; zoom: number; rotation: number };

  // In-depth editor
  layers: FrameLayer[];       // built automatically, editable
  textBoxes: TextBox[];       // title, type, rules, P/T, nickname… with bounds and font size
  watermark?: Watermark;

  createdAt: number; updatedAt: number;
}

interface CardSet { id: string; code: string; name: string; symbolImageId?: string; total: number }
```

---

## 3. New card flow

Creating a card is a short guided setup, then a simple form. The in-depth editor is always one tap away.

1. **What kind of card?** One tile per family:
   | Family | Styles (step 2) |
   |---|---|
   | Normal | Regular, Land, Vehicle, Colorshifted |
   | Double-faced | Transform, Modal DFC (then front/back and the transform icon) |
   | Adventure · Omen · Prepare | Adventure, Omen, Prepare |
   | Two halves | Split, Fuse, Aftermath, Flip, Room |
   | Planeswalker | Regular, Tall, Borderless, Extended Art, Compleated, Transform, MDFC |
   | Saga · Class · Case | Saga, Saga Creature, Class, Case (all split down the middle) |
   | Battle | (none, goes straight on) |
   | Level up · Station | Leveler, Station |
   | Token | Regular, Textless, Tall, Short, Emblem, Marker/Monarch/Initiative… |
   | Showcase & full art | Borderless, Extended Art, Full Art, Etched, Nickname-style showcases, set showcases |
   | Other mechanics | Mutate, Prototype, Spree, Attraction, Conspiracy |
   | Old frames | Alpha, 4th, 5th, 7th, 8th Edition |
2. **Style and frame:**
   - The style within the family (skipped when there's only one, e.g. Battle).
   - Every toggle that changes the frame: Legendary (none / legend crown / floating crown), Nickname, Snow, Devoid, Enchantment (Nyx), Miracle. Toggles the chosen style has no frames for are hidden (e.g. no Legendary on Fuse or Battle).
   - Frame color (auto from mana cost, or pick) and border.
   - **Set and symbol:** pick one of your sets (it brings its symbol, set code and numbering), make a new set right there (code, name, upload a symbol), or no set.
   - Cosmetic extras like the **holo stamp are always on** by default (removable in the in-depth editor), not asked about.
3. **Fill in the boxes:** the MTG.design-style form, showing only the fields that style needs (e.g. Adventure adds the adventure spell's name, cost, type and text). **Done** saves; **Customize in depth** opens the layer editor.

Under the hood, steps 1–2 pick a Card Conjurer frame pack plus the add-on layers, and step 3 fills the text boxes. The family/style table lives in one JSON file, so new frames can be added to the picker without code changes.

---

## 4. Phased build plan

Phases are in build order. Each ends with something you can open on your phone and try.

### Phase 1: Rendering prototype
Getting one card to look right is the riskiest part, so it comes first.
- [ ] Vite + React + TypeScript project, PWA setup, deploy to a free host so you can open it on your phone from day one
- [ ] Download script for the Card Conjurer Regular frame pack and fonts; manifest format + loader
- [ ] `CardRenderer` v0: frame layers, name, mana cost, art, type line, set symbol, rules + flavor text, P/T, collector block (`#/Total`, rarity letter, `SET • LANG`, artist with brush icon, designer)
- [ ] `SymbolParser`: `{X}{2}{R}`, `{T}`, hybrid `{2/W}{U/B}`, Phyrexian `{1/P}{G/P}` (Card Conjurer spellings like `{wu}`, `{pw}` too)
- [ ] `TextLayout` v0: `~` → card name, `<i>…</i>`, auto-italic `( … )`, line breaks, flavor divider, shrink-to-fit
- [ ] Unit tests for symbols and text; screenshot tests of a few reference cards
- **Done when:** a hard-coded creature card looks like a real card, on your phone.

### Phase 2: New card flow and editor for normal cards
- [ ] **New card flow** (section 3) with the Normal family, set picker and custom set symbol upload
- [ ] Fill-in-the-boxes form: name, mana cost (with a **mana symbol keyboard bar**), supertype / type / subtype, rules, flavor, P/T, art, artist, rarity, set
- [ ] **Frame resolution** from mana cost: mono, gold, hybrid, artifact/colorless, land, Nyx, color indicator
- [ ] Legendary (crown / floating crown), Nickname, Snow, Devoid toggles; border colors; holo stamp on by default
- [ ] Art: upload from Photos/Files or paste a link; **pinch to zoom and drag** on the preview; reset
- [ ] Set symbols colored by rarity (upload one black-and-white image; the app makes C/U/R/M versions), or use as-is
- [ ] **Dark mode** (System / Light / Dark) and the responsive layout (phone, tablet, PC)
- [ ] Undo/redo and autosave
- [ ] Library home screen: card grid, search, edit, delete, duplicate
- [ ] Export one card as a **744 × 1039 JPG** (MTG.design size) or PNG; share sheet on phones, download on PC
- **Done when:** you can make, save and export a normal card entirely on your phone.

### Phase 3: Every card family
One frame pack + frame version each; the form shows the matching extra fields:
- [ ] Double-faced (Transform, Modal DFC, transform icons, back power/toughness)
- [ ] Adventure, Omen, Prepare
- [ ] Two halves: Split, Fuse, Aftermath, Flip, Room
- [ ] Planeswalker (3 or 4 abilities, `+/-` cost badges, loyalty; all styles)
- [ ] Saga, Saga Creature, Class, Case
- [ ] Battle; Leveler, Station
- [ ] Tokens (all styles)
- [ ] Showcase & full art (Borderless, Extended Art, Full Art, Etched, Nickname-style)
- [ ] Other mechanics: Mutate, Prototype, Spree, Attraction, Conspiracy
- [ ] Old frames
- [ ] A screenshot test for each
- **Done when:** every tile in the new card flow makes a correct card.

### Phase 4: Sets, export and backup
- [ ] **Custom sets**: code, name, symbol, total; library grouped by set + "Ungrouped"; auto-numbering
- [ ] Higher-res export (1488 × 2078)
- [ ] **Export for online play** (one tap each; exact formats checked against each program while building):
  - **Untap (untap.in)**, the main one: whatever Untap accepts for custom cards (image upload vs. image link in a deck list). If it needs links, add an image hosting option.
  - **Cockatrice**: a custom set (cards XML + card images) for Cockatrice's custom sets folder
  - **Tabletop Simulator**: a deck sheet image (cards in a grid) plus the file TTS loads as a deck
  - **Forge**: custom card files plus card images in Forge's custom folders
- [ ] Export a whole set as images (ZIP)
- [ ] **Backup file**: export/import all cards, sets and art in one file (also how you move cards between phone and PC)
- [ ] Share one card as an editable file a friend can import

### Phase 5: In-depth editor (Card Conjurer features)
- [ ] Layer list: reorder (drag), hide, delete; per-layer position/size, opacity, blend mode, color overlay, HSL, erase
- [ ] **Restore** button (snapshot on opening the editor)
- [ ] **Add layer** sheet: only extras the new card flow doesn't cover (inner crown, color identity pips, dark P/T box, "The List" stamp, Brawl crown) plus your own PNG
- [ ] **Change card style**: reopens steps 1–2 on an existing card, keeping text and art
- [ ] Masks and half/third placement (how hybrid frames are built)
- [ ] **Text boxes**: move/resize, per-box font size, bold/italic, extra boxes (date stamp…), hide/auto-italicize reminder text
- [ ] **Full Card Conjurer text codes**: `{cardname}`, `{-}`, `{i}`/`{bold}`, `{lns}`, `{divider}`, `{flavor}`, `{oldflavor}`, `{fontsize}`, `{fontcolor}`, alignment, `{up#}`…`{permashift}`, `{shadow}`, `{outline}`, `{bullet}`, `{indent}`, `{kerning}`, `{roll}`, `{ruby}`
- [ ] **Full symbol codes**: `{1}`–`{20}`, hybrid, Phyrexian, hybrid Phyrexian, `{untap}`, old tap symbols, `{y}{z}`, `{s}`, `{e}`, loyalty `{+1}`, `{planeswalker}`, `{chaos}`, pawprint `{p}`
- [ ] Art: rotation, auto fit, grayscale, paste from clipboard
- [ ] Set symbol placement; real set symbols by set code (Keyrune)
- [ ] **Watermarks**: the lore list (guilds, colleges, families, clans…), two colors, opacity, placement
- [ ] **Collector info**: note, year, post-ONE style, show/hide, serial number (001/500), save as default
- [ ] Guidelines overlay, rounded corners on export

### Phase 6: More frame packs (in tiers)
Each pack = PNGs + manifest + screenshot test:
- [ ] **Tier 1:** everything the new card flow lists, plus all Regular add-ons (legend crowns, floating crowns, inner crowns, nicknames, smooth nickname crowns, holo stamps, dark P/T, colored borders, color identity pips, The List stamp, Brawl crowns)
- [ ] **Tier 2:** Universes Beyond, Promos (tall art), Textless/full-art basics, Accurate Frames, Phyrexian
- [ ] **Tier 3 (as you want them):** the ~60 set-specific showcases, community packs, 1/8" margin packs
- [ ] Not planned unless asked: Flesh and Blood frames

### Phase 7: Extras (optional)
- [ ] **Cloud sync** so cards follow you between phone and PC (needs a small backend and sign-in)
- [ ] **Scryfall features** (back burner): find art by card name, import a real card to edit
- [ ] Prompt challenges like MTG.design's Moxtober
- [ ] Desktop niceties: keyboard shortcuts, drag-and-drop art

---

## 5. Hardest problems

1. **Text fitting.** Shrink the font until the text fits the box, keep symbols the right size on the baseline, space paragraphs, and handle the flavor divider. `TextLayout` is a pure function, tested heavily on dense cards.
2. **Layer compositing speed on phones.** Some cards stack 10+ full-size PNG layers with masks. Cache composited layers, redraw only what changed, and draw the live preview at screen resolution.
3. **Frame rules.** Style, toggles and mana cost colors combine into the layer stack. Keep the rules in one `FrameResolver`, with tests.
4. **Preview = export.** One renderer, one canvas, used for both.
5. **Touch editing on a small screen.** Pinch and drag directly on the card preview, with a full-screen crop view as a fallback.
6. **Phone memory.** Downsample art for the live preview; use full resolution only for export.
7. **iPhone storage.** Safari can clear website data; mitigated by home-screen install, backup reminders and (later) cloud sync.

---

## 6. Feature checklists

### MTG.design

Every item from [`docs/mtg-design-inventory.md`](docs/mtg-design-inventory.md), with its phase.

| Site feature | Phase | Our version |
|---|---|---|
| `#`, Total, Set, Lang, Designer, Name, Mana Cost | 1–2 | Same fields |
| Super / Type / Sub | 2 | Same |
| Special Frames (Saga, Conspiracy, MDFC, transform pairs, Full Art Promo, Adventure, Token) | 3 | Picked in the new card flow |
| Planeswalker: 3/4 abilities, `+/-`, Loyalty | 3 | |
| Color Indicator, Accent | 2 | Auto from mana cost, with override |
| Miracle | 2–3 | Toggle in step 2 |
| Rarity: C, U, R, M, Land, Promo, Special, Token | 2 | |
| Custom set symbol, watermark | 2 / 5 | Upload an image; set symbol chosen with the set in step 2 |
| Border: Black, White, Silver, Gold | 2 | |
| Foil, Center, Lighten, Text Size | 2 / 5 | Holo stamp on by default; text auto-fits, size adjustable in depth |
| Artwork URL / Upload, crop & scale | 2 | Upload or link; pinch/drag on the preview |
| Artist, Rules, Flavor, Saga reminder | 1–3 | |
| Text syntax (`{}` symbols, hybrid, Phyrexian, `~`, `<i>`, auto-italic `()`, `*word*`, `\\`) | 1 | Plus a mana symbol keyboard bar |
| Render / Download / Save & Share | 2 / 4 | Live preview, autosave, export, editable card file |
| Dashboard grouped by set | 2 / 4 | Library screen |
| Moxtober | 7 | Optional |

### Card Conjurer (summary)

Full detail in [`docs/cardconjurer-inventory.md`](docs/cardconjurer-inventory.md).

| Card Conjurer feature | Phase |
|---|---|
| Frame groups/packs, Auto-frame presets | 3 / 6 (picked in the new card flow, not browsed in the editor) |
| Layer stack, masks, half/third placement, frame image editing | 5 |
| Custom frame upload | 5 |
| Text boxes, bounds, font size, bold/italic, extra boxes | 5 |
| All text codes and symbol codes | 1 / 5 |
| Art: upload/URL/paste, position/zoom/rotation, autofit, grayscale | 2 / 5 |
| Set symbol by code + rarity, placement | 5 |
| Watermarks | 5 |
| Collector info, post-ONE style, serial number, defaults | 2 / 5 |
| Save/load, cards file, download all images | 4 |
| Rounded corners, guidelines | 5 |
| Art by card name, import real cards (Scryfall) | 7 (back burner) |
| 381 frame packs | 3 / 6 (tiers) |
| Flesh and Blood | not planned |

---

## 7. Next steps

1. **Frame images and fonts:** allow `cardconjurer.app` in the session's network settings so the download script can fetch the frame packs and fonts.
2. **Untap:** allow `untap.in` so the Untap export format can be checked.
3. Start Phase 1.
