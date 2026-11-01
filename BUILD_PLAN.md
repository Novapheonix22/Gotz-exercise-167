# iOS Custom Card Maker: Build Plan

Goal (for making custom cards, e.g. commanders, to play online with friends; not for printing): a native iOS app with the customization and functionality of **MTG.design** (the simple, form-based editor) **plus Card Conjurer** (cardconjurer.app: hundreds of frame packs, layered frames, free-form text boxes). It's for personal use (and maybe a few friends), installed from Xcode rather than the App Store.

Reference inventories:
- [`docs/mtg-design-inventory.md`](docs/mtg-design-inventory.md): every MTG.design editor option.
- [`docs/cardconjurer-inventory.md`](docs/cardconjurer-inventory.md): every Card Conjurer option and all 381 frame packs.

The approach: **MTG.design's ease of use on top, Card Conjurer's power underneath.** Phases 1–4 reach MTG.design parity. Phases 5–6 add Card Conjurer's layer editor and frame packs. Section 5 maps every feature to a phase.

---

## 0. Distribution and assets

**Getting the app onto phones:**
- **Free Apple ID + Xcode:** build straight to your iPhone. The app stops opening after **7 days**, and you reinstall it from Xcode to renew. Fine if it's just you.
- **Paid Apple Developer account ($99/yr):** builds last a year. You can share with friends through **TestFlight** (an invite link; builds last 90 days) or **Ad Hoc** (register their device IDs).
- **AltStore / SideStore:** refreshes the 7-day signing over Wi-Fi, so there's no need to plug in to Xcode each week.

**Assets (authentic look):**
- **Symbols:** the open-source *Mana* icon font (andrewgioia/mana) for mana, tap/untap, loyalty, saga chapters and Phyrexian/hybrid symbols.
- **Fonts:** Beleren Bold (name, type line), Beleren Small Caps (artist/collector line), MPlantin + MPlantin Italic (rules and flavor text). Bundle them in the app.
- **Frames:** the Card Conjurer frame pack PNGs (frames, masks, crowns, stamps, P/T boxes). Each pack is imported with a small manifest JSON (see §2). A helper script can generate manifests from a folder of PNGs.
- **Set symbol:** MTG.design takes a PNG URL. The app takes an image from Photos/Files (and optionally a URL), plus the *Keyrune* font as a bonus picker.

---

## 1. Tech stack

| Concern | Choice | Why |
|---|---|---|
| UI | **SwiftUI**, iOS 17+ | Fast to build, good iPad support |
| Card rendering | **Core Graphics + Core Text** in one `CardRenderer` | The preview and the exported image come from the same code, so they always match |
| Rich text | **Core Text** with inline symbol glyphs | Rules text needs inline symbols, italics, line breaks and shrink-to-fit |
| Storage | **SwiftData**, art stored as files on disk | Local, simple, no server |
| Sync (optional) | CloudKit through SwiftData | Free iPhone ↔ iPad sync if you want it later |
| Images | `PhotosPicker`, Files picker, URL download | Covers MTG.design's "Artwork URL" and "Upload File" |
| Export | `UIGraphicsImageRenderer` → JPG/PNG | Native |
| Sharing | `ShareLink` (system share sheet) | Replaces the site's "Save & Share" link |
| Tests | XCTest + snapshot tests (swift-snapshot-testing) | Rendering bugs are the main risk |
| Appearance | Light, Dark, or follow System (`preferredColorScheme`) | Dark mode for the whole app UI; the card render itself always looks the same |

---

## 2. Architecture

```
App
├── Models          Card, CardSet, ArtAsset (SwiftData) + enums mirroring the site's dropdowns
├── Rendering
│   ├── CardRenderer        draws a Card into a CGContext at any scale
│   ├── FrameResolver       picks frame assets from Type + Special Frame + colors + Accent + Border
│   ├── TextLayoutEngine    parses the site's text syntax, lays out symbols, fits text to the box
│   ├── SymbolParser        "{2}{W}{U/B}{G/P}{T}" → tokens → glyphs
│   └── LayoutSpecs/        one JSON per Special Frame: rectangles, fonts, colors, asset names
│   ├── LayerCompositor     draws a stack of frame layers (image + mask + rect + opacity + blend + color/HSL)
│   └── FramePacks/         Card Conjurer-style packs: images, masks, and a "frame version" (text box + art bounds)
├── Editor
│   ├── Simple mode     MTG.design-style form; picks a preset that builds the layer stack for you
│   └── Advanced mode   Card Conjurer-style: layer list, masks, text box bounds, per-element X/Y/scale
├── Library         cards grouped by "Ungrouped" and by custom set
└── Export          JPG/PNG, share
```

**Rules:**
- **Two-level frame model.** Underneath, every card is a **stack of frame layers**, the way Card Conjurer works: each layer is a PNG, an optional mask (Pinline, Title, Type, Rules, Frame, Border, or a half/third of the card), a rectangle, opacity, blend mode and optional color overlay/HSL shift. On top, **presets** (MTG.design's Special Frames, Card Conjurer's Auto-frame list) build that stack automatically from the mana cost and type. Simple mode only shows presets; Advanced mode lets you edit the stack directly. That is how a floating legend crown, a holo stamp or a "Godzilla" nickname bar gets added: it's one more layer.
- **Frame packs are data.** A pack = PNGs + a manifest (names, colors, masks, default rects) + an optional *frame version* (where the title, type, rules, P/T text boxes and art window sit). Adding a pack never needs new Swift code.
- **Frames are data, not code.** Each Special Frame is a `LayoutSpec` JSON + PNG layers, so 17+ layouts don't mean 17 hand-written renderers.
- **Fixed canvas.** Lay out on a 1488 × 2078 canvas (exactly 2× the site's 744 × 1039 export) and scale when drawing. The site's export size then comes from a plain 0.5× scale.
- **Frame is derived, not picked.** The site has no "frame color" dropdown. The color comes from the mana cost (and Color Indicator), the frame style from the **Type** (artifact, enchantment → Nyx, land, etc.), and the pinlines from **Accent**. `FrameResolver` encodes those rules, and the "Not verified" items in the inventory get settled by comparing against real site renders.

### Data model (mirrors the site's form)

```swift
@Model final class Card {
    // Identity
    var collectorNumber: String      // "#", max 4
    var setTotal: String             // max 4
    var setCode: String = "SET"      // max 3
    var language: String = "EN"      // max 2
    var designer: String             // max 47
    var name: String = "Untitled"
    var manaCost: String             // "{2}{W}{U/B}"

    // Type line
    var supertype: String            // free text, e.g. "Legendary"
    var cardType: CardType = .creature   // the site's Type dropdown (Artifact … Enchantment Artifact Land Creature, Saga, Planeswalker, Conspiracy, Blank)
    var subtype: String

    // Frame
    var specialFrame: SpecialFrame = .regular   // regular, saga, conspiracy, mdfcFront/Back, sun/moon, compass/land, eldraziFront/Back, origin/spark, fullArtPromo, adventure, adventureReversed, token
    var colorIndicator: ColorCombo?             // None, W, WU, … WUBRG
    var accent: Accent = .default               // Default, Gold, W, WU, WB, U, UB, UR, B, BR, BG, R, RG, RW, G, GW, GU
    var landOverlay: Accent = .default
    var layers: [FrameLayer]                    // Card Conjurer-style stack, generated by presets or edited by hand
    var textBoxes: [TextBox]                    // title, type, rules, P/T, nickname, date stamp… each with bounds, font size, bold/italic
    var planeswalkerSize: Int = 3               // 3 or 4
    var isMiracle: Bool = false

    // Rarity / symbols
    var rarity: Rarity = .common                // C, U, R, M, Land, Promo, Special, Token
    var setSymbol: ArtAsset?
    var watermark: ArtAsset?

    // Finish
    var border: Border = .black                 // black, white, silver, gold
    var isFoil: Bool, centerText: Bool, lightenArt: Bool
    var textSize: Double = 38                   // 18…38; acts as the max size, auto-shrink below it

    // Art
    var art: ArtAsset?                          // from Photos, Files or URL
    var crop: CropState                         // offset + zoom (the site stores 4 points + zoom)
    var artist: String                          // max 63

    // Text
    var rulesText: String                       // ability #1 on planeswalkers
    var flavorText: String
    var adventure: AdventureFace?               // name, type, mana cost, text
    var sagaReminder: String
    var loyaltyAbilities: [LoyaltyAbility]      // abilities #1–6, each with a "+/-" cost

    // Stats
    var power: String, toughness: String
    var backPower: String, backToughness: String   // double-faced
    var loyalty: String

    var set: CardSet?                           // nil = "Ungrouped Cards"
    var createdAt: Date, updatedAt: Date
}
```

---

## 3. Phased build plan

Estimates assume one developer part-time on evenings and weekends. Treat them as rough.

### Phase 1: Rendering prototype (2–3 weeks)
Getting one card to look right is the riskiest part, so it comes first.
- [ ] Xcode project, SwiftUI shell, SwiftData container
- [ ] Bundle fonts (Beleren, MPlantin, Mana) and the Normal frame PNGs: W, U, B, R, G, gold, colorless/artifact, land
- [ ] `LayoutSpec` JSON format + loader
- [ ] `CardRenderer` v0: frame, name, mana cost, art, type line, set symbol, rules + flavor text, P/T, collector block (`#/Total`, rarity letter, `SET • LANG`, artist with brush icon, designer, copyright line)
- [ ] `SymbolParser` with the full site syntax: `{X}{2}{R}`, `{T}`, hybrid `{2/W}{U/B}`, Phyrexian `{1/P}{G/P}`
- [ ] `TextLayoutEngine` v0: `~` → card name, `<i>…</i>`, auto-italic `( … )`, `*word*` de-emphasis in flavor, `\\` line break, flavor divider, shrink-to-fit starting at Text Size
- [ ] Snapshot tests against a few real MTG.design renders, side by side
- **Done when:** a hard-coded creature card looks like an MTG.design export.

### New card flow (applies from Phase 2 on)

Creating a card is a short guided setup, then a simple form. The in-depth editor is always one tap away.

1. **What kind of card?** One tile per family:
   | Family | Second step (styles) |
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
2. **Style and frame:** pick the style within the family (skipped choice if there's only one, e.g. Battle), plus every toggle that changes the frame: Legendary (none / legend crown / floating crown), Nickname, Snow, Devoid, Enchantment (Nyx), Miracle, frame color (auto from mana cost, or pick) and border. Toggles the chosen style has no frames for are hidden (e.g. no Legendary on Fuse or Battle). Cosmetic extras like the **holo stamp are always on** by default (removable in the in-depth editor), not asked about.
3. **Fill in the boxes:** the MTG.design-style form, showing only the fields that style needs (e.g. Adventure adds the adventure spell's name, cost, type and text). **Done** saves; **Customize in depth** opens the layer editor.

Under the hood, steps 1–2 pick a Card Conjurer frame pack plus the add-on layers, and step 3 fills the text boxes. The family/style table lives in one JSON file, so new frames can be added to the picker without code changes.

### Phase 2: Editor at site parity for normal cards (3 weeks)
- [ ] **New card flow** (above): kind picker, style and frame toggles, then the form
- [ ] Editor screen: live preview on top, form below (iPhone); side by side on iPad
- [ ] **Dark mode**: semantic colors throughout, an Appearance setting (System / Light / Dark), amber accent tuned for contrast in both modes. Mockups: https://claude.ai/artifact/9k5AcW5Xtw3MqdMfEBkK3U
- [ ] Every field from the site's form: `#`, Total, Set, Lang, Designer, Name, Mana Cost, Super / Type (full dropdown) / Sub, Rarity (all 8), Artist, Rules Text, Flavor Text, Power, Tough
- [ ] Mana symbol keyboard bar so you don't have to type braces on a phone
- [ ] **Frame resolution** from mana cost + Type: mono, gold, hybrid, artifact, land, **enchantment/Nyx** variants, Color Indicator dot
- [ ] Accent dropdown, Border (Black/White/Silver/Gold), Foil, Center, Lighten, Text Size slider (18–38)
- [ ] Art: Photos / Files / paste URL; **pinch to zoom and drag to crop** directly on the preview; Reset Zoom
- [ ] Custom set symbol + watermark from an image; rarity tinting of the set symbol
- [ ] Undo/redo and autosave (the site needs "Render" and "Save"; the app renders live and saves automatically)
- [ ] Library home screen: card grid, edit, delete, duplicate
- [ ] Export one card as a **744 × 1039 JPG** (site match) to Photos/Files + share sheet
- **Done when:** any normal card you'd make on MTG.design can be made on the phone.

### Phase 3: Every Special Frame on the site (4 weeks)
One `LayoutSpec` + PNG set each. The editor shows the matching extra fields, like the site's hidden fields:
- [ ] **Saga** (Type "Enchantment Saga"/Special Frame Saga): chapter layout, Saga Reminder Text
- [ ] **Planeswalker**: Size 3 or 4, abilities #1–6 with `+/-` cost badges, Loyalty box
- [ ] **Adventure** and **Adventure Reversed**: Adventure Name, Adv. Type, Adv. Mana Cost, Adventure Text
- [ ] **Token** frame (+ Token rarity)
- [ ] **Full Art Promo**
- [ ] **Conspiracy Draft** (+ Conspiracy type)
- [ ] **Modal DFC** Front / Back
- [ ] **Transform pairs**: Sun/Moon, Compass/Land, Eldrazi Front/Back, Origin/Spark, with Back Power / Back Tough
- [ ] **Miracle** toggle
- [ ] **Land overlay** accent for land frames
- [ ] Composite types: all the Artifact/Enchantment/Land/Creature combinations from the Type dropdown
- [ ] Snapshot test for each frame
- **Done when:** every row in section 5 marked Phase 3 renders correctly.

### Phase 4: Organization, export and sharing (2 weeks)
- [ ] **Custom sets**: set code, name, symbol, total; library grouped as "Ungrouped Cards" + one section per set (like the site's dashboard)
- [ ] Auto-fill `#`/Total/Set/symbol when you add a card to a set
- [ ] Higher-res export (1488 × 2078) and PNG, in addition to the 744 × 1039 JPG
- [ ] **Untap (untap.in) export**: one-tap export in whatever form Untap accepts for custom cards (to check: image upload vs. image URL in a deck list). If it needs URLs, add an image hosting option.
- [ ] Export a whole set as images; share a card as an editable file (`.card` with embedded art) so friends with the app can open and remix it. This replaces the site's share link.
- [ ] Search/filter by name, color, type, rarity, set

### Phase 5: Card Conjurer editor features (4 weeks)
- [ ] **Advanced mode** layer list: add, reorder (drag), delete; per-layer X/Y/W/H, opacity, blend mode, preserve alpha, color overlay, HSL, erase
- [ ] Masks: Pinline, Title, Type, Rules, Frame, Border, No Mask; add to **right half / left half / middle third / top half / bottom half** (how hybrid frames are built)
- [ ] Import your own frame PNGs from Files
- [ ] **Text boxes** with Edit Bounds, per-box font size, Bold/Italic; add extra boxes (Nickname, Date Stamp…); Hide reminder text / Auto-italicize reminder text
- [ ] **Full Card Conjurer text codes** alongside MTG.design's: `{cardname}`, `{-}`, `{i}`/`{bold}`, `{lns}`, `{divider}`, `{flavor}`, `{oldflavor}`, `{fontsize}`, `{fontcolor}`, alignment/justify, `{up#}`…`{permashift}`, `{shadow}`, `{outline}`, `{bullet}`, `{indent}`, `{kerning}`, `{roll}`, `{ruby}`
- [ ] **Full symbol codes**: `{1}`–`{20}`, lowercase colors, hybrid `{wu}`/`{2w}`, Phyrexian `{pw}`, hybrid Phyrexian `{wup}`, `{untap}`, old tap symbols, `{y}{z}`, `{s}`, `{e}`, loyalty `{+1}`, `{planeswalker}`, `{chaos}`, pawprint `{p}`. Both spellings (`{U/B}` and `{ub}`) work.
- [ ] **Art**: X/Y/zoom/**rotation**, Auto Fit, Preserve position, Grayscale, paste from clipboard; *optional* "find art by card name" via Scryfall (needs internet)
- [ ] **Set symbol**: by set code + rarity (Keyrune bundled), or image; X/Y/zoom; lock code
- [ ] **Watermarks**: the full lore list (guilds, colleges, families, clans, poleis, factions…), left/right colors, opacity, X/Y/scale
- [ ] **Collector info**: Number, Rarity, Note, Set, Language, Artist, Year; post-ONE style toggle; show/hide; **serial number** (001/500) with star/dot; Save as Default
- [ ] Guidelines overlay, Rounded Corners on export, transparency highlight
- [ ] *Optional* **Import a real card by name** (Scryfall, any print, 12 languages) and Paste full text
- [ ] Backup/restore all cards as one file; Download All Images as ZIP

### Phase 6: Card Conjurer frame packs (in tiers)
Each pack = PNGs + manifest + snapshot test. Order:
- [ ] **Tier 1, the ones you asked for (6–8 weeks):** all of the Regular add-ons (**legend crowns, floating legend crowns, inner crowns, nicknames ("Godzilla"), smooth nickname crowns**, holo stamps, dark P/T, colored borders, color identity pips, The List stamp, Brawl crowns, miracle, lands), **Omens, Battles, Rooms, Adventures**, Prepare, Stations, Spree, Cases, Class, Snow, Mutate, Devoid, Aftermath, Flip, Levelers, Split/Fuse, Prototype, Attractions, Conspiracies, Colorshifted; all **Tokens**, **Sagas** (incl. saga creatures), **Planeswalkers** (all variants), **Modal DFC** and **Transform** families with transform icons
- [ ] **Tier 2 (4 weeks):** generic showcase styles (Borderless, Extended Art, Fullart, Etched, Full Text, FNM promo), Universes Beyond, Promos (Tall Art), Textless/Fullart basics, Accurate Frames, Phyrexian
- [ ] **Tier 3 (ongoing, as you want them):** the ~60 set-specific showcases, Custom/community packs, Old/Misc (Alpha through Eighth Edition, playtest, Planechase, Vanguard), 1/8" margin packs
- [ ] Not planned unless asked: Flesh and Blood frames

### Phase 7: Extras (optional)
- [ ] **Mirror layout** switch: flip the frame images and move every text box, mana cost and P/T to the opposite side (left-handed style cards)
- [ ] **Prompt challenges** like MTG.design's Moxtober
- [ ] iCloud sync between devices
- [ ] iPad niceties: keyboard shortcuts, drag-and-drop art

**Totals (part-time):** MTG.design parity (Phases 1–4) about 11–12 weeks; plus Card Conjurer editor and Tier 1 frames (Phases 5–6) about 10–12 more weeks. Tiers 2–3 are open-ended and can ship pack by pack.

---

## 4. Hardest problems

1. **Text fitting.** The site has a Text Size slider (18–38) and still fits text into the box. Treat the slider as the *maximum* size and binary-search down until the text fits. Write `TextLayoutEngine` as a pure function and test it on dense cards.
2. **Layer compositing performance.** Some Card Conjurer cards stack 10+ full-size PNG layers with masks. Cache composited layers, only redraw what changed, and keep the preview at screen resolution.
3. **Frame resolution rules.** No single dropdown sets the frame. Mana cost, Type, Accent, Color Indicator, Border and Special Frame all combine. Put the rules in one `FrameResolver` with tests, and check them against real site renders.
4. **Preview = export.** One renderer, one canvas. Never build the preview from SwiftUI `Text` views.
5. **Cropping on a phone.** Pinch and drag directly on the art box in the preview, with a full-screen crop view as a fallback.
6. **Memory.** Downsample art for the live preview, and use full resolution only for export.

---

## 5. Feature parity checklist

Every item from [`docs/mtg-design-inventory.md`](docs/mtg-design-inventory.md), with its phase.

| Site feature | Phase | App equivalent |
|---|---|---|
| `#`, Total, Set, Lang, Designer, Name, Mana Cost | 1–2 | Same fields |
| Super / Type dropdown (all composite types) / Sub | 2–3 | Same; composite types drive frame style |
| Special Frames: Normal | 1–2 | |
| Special Frames: Saga, Conspiracy Draft, Token, Full Art Promo | 3 | |
| Special Frames: Adventure, Adventure Reversed (+ 4 adventure fields) | 3 | |
| Special Frames: Modal DFC Front/Back | 3 | |
| Special Frames: Sun/Moon, Compass/Land, Eldrazi F/B, Origin/Spark (+ Back P/T) | 3 | |
| Planeswalker: Size 3/4, abilities 1–6 with `+/-`, Loyalty | 3 | |
| Color Indicator (27 options) | 2 | |
| Accent (17 options) + land overlay | 2 / 3 | |
| Miracle | 3 | |
| Rarity: C, U, R, M, Land, Promo, Special, Token | 2 | |
| Custom Set Symbol (PNG URL) | 2 | Image from Photos/Files, or a URL |
| Watermark (PNG URL) | 2 | Same |
| Border: Black, White, Silver, Gold | 2 | |
| Foil, Center, Lighten | 2 | |
| Text Size slider 18–38 | 2 | Max size, with auto-shrink |
| Artwork URL / Upload File | 2 | Photos, Files, camera, URL |
| Crop & scale, Reset Zoom | 2 | Pinch/drag on the preview |
| Artist | 2 | |
| Rules Text, Flavor Text, Saga Reminder | 1–3 | |
| Syntax: `{}` symbols, hybrid, Phyrexian, `~`, `<i>`, auto-italic `()`, `*word*`, `\\` | 1 | Plus a symbol keyboard bar |
| Render button | 2 | Live preview |
| Download (744 × 1039 JPG) | 2 | Export + higher-res option |
| Save & Share link | 2 / 4 | Autosave + share sheet + editable card file |
| Dashboard: edit/view/delete, Ungrouped + custom set groups | 2 / 4 | Library screen |
| Moxtober event submission | 5 | Optional prompt challenges |

---

### Card Conjurer checklist (summary)

Full detail in [`docs/cardconjurer-inventory.md`](docs/cardconjurer-inventory.md).

| Card Conjurer feature | Phase |
|---|---|
| Frame groups/packs, search, Auto-frame (22 presets) | 3 / 6 |
| Layer stack, masks, half/third placement, Frame Image Editor | 5 |
| Custom frame upload | 5 |
| Text boxes, Edit Bounds, font size, Bold/Italic, extra boxes | 5 |
| All text codes and symbol codes | 1 / 5 |
| Art: upload/URL/paste, X/Y/zoom/rotation, autofit, grayscale | 2 / 5 |
| Art by card name (Scryfall) | 5 (optional) |
| Set symbol by code + rarity, placement, lock | 5 |
| Watermarks: lore list, two colors, opacity, placement | 5 |
| Collector info, post-ONE style, serial number, defaults | 2 / 5 |
| Import real card by name, 12 languages, paste text | 5 (optional) |
| Save/load/delete, cards file, download all images | 4 / 5 |
| Rounded corners, guidelines | 4 / 5 |
| 381 frame packs | 6 (tiers) |
| Flesh and Blood | not planned |

---

## 6. Next steps

1. Pick free Apple ID vs. $99 developer account (see §0).
2. Collect the fonts and the Card Conjurer Regular frame pack PNGs.
3. Download a handful of your own MTG.design renders to use as visual references for the snapshot tests.
4. Start Phase 1.
