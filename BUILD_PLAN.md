# iOS Custom Card Maker: Build Plan

Goal: a native iOS app that matches the customization and functionality of MTG.design: build a card from frame templates, edit every text field with inline mana symbols, place and crop art, pick set symbol and rarity, export print-quality images, and save, organize and share cards.

> **Note on scope:** mtg.design's editor requires a login, so it has not been audited yet. Verified from public pages (2026-10-31):
> - Cards export as **744 × 1039 JPG** (≈ 300 DPI at card size). Match this as the "standard" export, and offer a higher-res option.
> - Modern (M15-style) frames with textured color frames, gold multicolor, holo foil stamp at the bottom center.
> - Full collector info block: `collector# / set total`, rarity letter (C/U/R/M), "Not For Sale" (or similar) line, `SET • LANG`, artist with brush icon, designer credit ("NAME • MTG.Design"), copyright line.
> - **Custom set symbols** (e.g. a pumpkin icon) tinted by rarity; set codes (e.g. `MOX`).
> - Flavor text with a divider line; rules text auto-fits.
> - Community features: public card gallery, themed events (e.g. "Moxtober" daily prompts with submission to an event), share links, user accounts, Patreon early-access features.
>
> Anything behind the login (exact frame list, editor options) still needs checking via screenshots.

---

## 0. Distribution and assets (personal use)

This app is for personal use and a few friends. It will not go on the App Store, so App Store review and monetization rules don't apply. The plan uses the authentic look directly.

**Getting the app onto phones:**
- **Free Apple ID + Xcode:** build straight to your own iPhone. The app expires after **7 days** and you re-run it from Xcode to renew. Fine if it's just you.
- **Paid Apple Developer account ($99/yr):** builds last a year, and you can share with friends by **Ad Hoc** (register their device IDs, up to 100) or **TestFlight** (send an invite link; builds last 90 days). TestFlight is the least hassle for friends.
- Alternative for friends without Xcode: AltStore/SideStore (refreshes the 7-day signing over Wi-Fi).

**Asset sources (authentic look):**
- **Mana and other symbols:** the open-source *Mana* icon font (andrewgioia/mana) covers mana, tap, loyalty, saga chapters and more.
- **Set symbols:** the *Keyrune* font (andrewgioia/keyrune), plus custom image upload.
- **Fonts:** Beleren (titles, type line), MPlantin (rules text), Beleren Small Caps (artist line), Matrix (older frames). Bundle them in the app.
- **Frame images:** high-res frame PNGs from the custom-card community (e.g. the frame packs used by open-source card makers like Card Conjurer). Store them as asset catalogs with a `LayoutSpec` JSON per frame.
- Because nothing is sandboxed by App Review, you can also add a "frame pack" import (a ZIP of PNGs + JSON) to add frames later without rebuilding.

---

## 1. Tech stack

| Concern | Choice | Why |
|---|---|---|
| UI | **SwiftUI**, iOS 17+ | Modern, fast to build, `@Observable`, good iPad support |
| Card rendering | **Core Graphics + Core Text** in one `CardRenderer`, wrapped in a SwiftUI `Canvas`/`UIViewRepresentable` | One renderer for the on-screen preview and the export, so they always match exactly |
| Rich text | **TextKit 2 / Core Text** with inline symbol glyphs | Rules text needs inline symbols, italics, paragraph spacing and shrink-to-fit |
| Persistence | **SwiftData** (local) + **CloudKit** sync | Free iCloud sync between iPhone and iPad, no backend needed for v1 |
| Images | `PhotosPicker`, `UIImagePickerController` (camera), `UIDocumentPicker` (Files) | Covers every art source |
| Export | `UIGraphicsImageRenderer` → PNG/JPEG, `UIGraphicsPDFRenderer` → print sheets | Native and high resolution |
| Sharing | `ShareLink` / `UIActivityViewController` | System share sheet |
| Online gallery (optional, Phase 6) | Supabase or Firebase (auth, Postgres/Firestore, storage) | Only if you want a public community gallery like the website |
| Tests | XCTest + **snapshot tests** (swift-snapshot-testing) | Rendering regressions are the main source of bugs |

---

## 2. Architecture

```
App
├── Models          Card, CardFace, FrameStyle, ManaCost, Rarity, CardSet, ArtAsset (SwiftData)
├── Rendering
│   ├── CardRenderer        draws a Card into a CGContext at any scale
│   ├── FrameLibrary        frame templates and per-template layout metrics
│   ├── TextLayoutEngine    parses rules text, lays out symbols, shrinks to fit
│   ├── SymbolParser        "{2}{W}{U/B}{T}" → tokens → glyph images
│   └── LayoutSpecs         JSON describing each frame's boxes (title, art, type, text, P/T…)
├── Editor          SwiftUI editor screens and inspectors
├── Library         card list, sets/folders, search, duplicate, delete
├── Export          PNG/JPEG/PDF, print sheets, bleed options
└── Sync/Share      CloudKit, share sheet, (optional) online gallery
```

**Key design rule:** describe every frame in **data** (a `LayoutSpec` JSON with normalized rectangles, fonts, colors and asset names), not in code. New frames then cost an art asset plus a JSON file, with no renderer changes. The website supports many frames, so this is what makes reaching parity practical.

**Canonical canvas:** lay everything out in a fixed coordinate space (e.g. 1500 × 2100, i.e. 2.5" × 3.5" at 600 DPI) and scale at draw time. The preview, thumbnails and print export all come from the same layout.

### Core data model (sketch)

```swift
@Model final class Card {
    var id: UUID
    var name: String
    var layout: CardLayout          // .normal, .planeswalker, .saga, .split, .flip, .transform, .adventure, .token…
    var faces: [CardFace]           // 1 for most, 2 for split/flip/transform/adventure
    var set: CardSet?
    var rarity: Rarity              // common, uncommon, rare, mythic, special
    var artist: String
    var designer: String
    var collectorNumber: String
    var createdAt: Date, updatedAt: Date
}

struct CardFace: Codable {
    var title: String
    var manaCost: String            // raw "{2}{W}{W}", parsed for display
    var frameColor: FrameColor      // W/U/B/R/G, gold, hybrid(a,b), artifact, colorless, land(identity)
    var frameModifiers: Set<FrameModifier> // legendary crown, nyx/enchantment, devoid, snow, vehicle, full-art…
    var typeLine: String
    var rulesText: String           // supports {symbols}, *italic*, reminder text in ( )
    var flavorText: String
    var power: String?, toughness: String?, loyalty: String?, defense: String?
    var loyaltyAbilities: [LoyaltyAbility]   // planeswalkers
    var chapters: [SagaChapter]              // sagas
    var art: ArtAsset?              // image + crop rect + zoom + offset
    var textSizeOverride: CGFloat?  // manual override of auto-fit
}
```

---

## 3. Phased build plan

Rough estimates assume one experienced iOS developer working full time. Double them if you're learning Swift along the way.

### Phase 1: Foundations and the rendering spike (2 weeks)
The riskiest part is getting a card to *look right*, so start there.
- [ ] Xcode project, SwiftUI app shell, SwiftData container, CI (Xcode Cloud or GitHub Actions)
- [ ] Gather frame PNGs for the standard creature frame (5 colors, gold, artifact, land) and bundle Beleren, MPlantin, Mana and Keyrune fonts
- [ ] `LayoutSpec` JSON format + loader
- [ ] `CardRenderer` v0: frame, title, mana cost, art box, type line, rules text, P/T, rarity-colored set symbol
- [ ] `SymbolParser`: `{W} {U} {B} {R} {G} {C} {X} {0-20} {T} {Q} {S} {E}`, hybrid `{W/U}`, Phyrexian `{W/P}`, two-hybrid `{2/W}`
- [ ] `TextLayoutEngine` v0: inline symbols, italic flavor text below a divider, **auto shrink-to-fit**
- [ ] Snapshot tests for 10 reference cards
- [ ] Audit mtg.design live and finalize the parity checklist
- **Exit criterion:** a hard-coded card renders at 1500×2100 and looks like a real printed card.

### Phase 2: The editor MVP (3 weeks)
- [ ] Editor screen: live preview on top, form/inspector below (iPhone); side-by-side on iPad
- [ ] Collector info block: number/total, rarity letter, "Not For Sale" line, set code • language, artist (brush icon), designer credit, copyright line, holo stamp toggle
- [ ] Fields: title, mana cost (with a **symbol keyboard / palette** so nobody has to type braces), type line, rules text, flavor text, P/T, artist, designer, collector number
- [ ] Frame picker: color (W/U/B/R/G, multicolor gold, two-color hybrid, artifact, colorless, land with color identity)
- [ ] **Auto-detect frame color from the mana cost**, with a manual override
- [ ] Art: import from Photos, Files or camera; **pinch-zoom and drag to position inside the art box**; reset/fit/fill
- [ ] Rarity picker + set symbol (built-in symbol library + custom image upload, tinted by rarity)
- [ ] Rules text helpers: italicize reminder text in parentheses automatically, `CARDNAME`/`~` replaced with the title, bullet points for modal spells
- [ ] Undo/redo (`UndoManager`), autosave
- [ ] Library: grid of saved cards, open, duplicate, rename, delete
- [ ] Export a single card to Photos/Files as PNG
- **Exit criterion:** you can make, save and export a normal creature/spell/land card entirely on a phone.

### Phase 3: Frame and layout parity (4 to 5 weeks)
One `LayoutSpec` plus frame art per item:
- [ ] **Legendary** crown overlay
- [ ] **Enchantment / Nyx** textured frames
- [ ] **Devoid / colorless** frames
- [ ] **Vehicle** (artifact with brown P/T box)
- [ ] **Snow** frame variant
- [ ] **Planeswalker** (3- and 4-ability variants, loyalty cost badges +N / −N / 0, starting loyalty, tall art)
- [ ] **Saga** (vertical art on the right, chapter markers I–IV, chapter text boxes)
- [ ] **Tokens** (standard and full-art, with no mana cost)
- [ ] **Full-art / borderless / extended-art** variants
- [ ] **Split cards** (two halves rotated, plus the "Fuse" bar)
- [ ] **Flip cards** (upside-down second half)
- [ ] **Transform / modal double-faced** (front and back faces, face indicators, a flip toggle in the editor)
- [ ] **Adventure** (secondary spell box in the left half of the text box)
- [ ] **Class**, **Battle** (horizontal, defense counter), **Leveler**, **Meld** (stretch goals)
- [ ] Border color: black / white / silver / gold-bordered
- [ ] Optional card elements: watermark behind rules text, power/toughness hidden, "custom stamp", holo foil stamp
- **Exit criterion:** every frame on the parity checklist renders correctly and has a snapshot test.

### Phase 4: Export, print and sharing (2 weeks)
- [ ] Export resolutions: standard 744×1039 JPG (matches mtg.design), high (1500×2100), print (600 DPI with **3 mm bleed** and optional rounded/square corners)
- [ ] PNG / JPEG / PDF export
- [ ] **Print sheets**: 3×3 cards on Letter/A4 PDF with cut marks (proxy printing)
- [ ] Share sheet: Messages, Discord, save to Files, etc.
- [ ] Export a **set** as a ZIP of images
- [ ] Copy card as image to the clipboard
- [ ] **Card file format** (`.cardjson` package with embedded art) for import/export and sharing editable cards; register it as a UTType so tapping the file opens the app

### Phase 5: Organization and power-user features (2 to 3 weeks)
- [ ] **Sets/collections**: name, custom set symbol, set code, auto-numbered collector numbers
- [ ] Search and filter the library (by color, type, rarity, set)
- [ ] Templates and "start from duplicate"
- [ ] iCloud sync through CloudKit
- [ ] iPad: multi-window, keyboard shortcuts, Apple Pencil drag for art positioning, drag-and-drop images in
- [ ] Frame pack import (ZIP of PNGs + LayoutSpec JSON) and custom font import
- [ ] Accessibility: Dynamic Type in the editor (not on the card itself), VoiceOver labels, symbol palette with accessible names
- [ ] Localization of the app UI

### Phase 6: Community gallery (optional, 4+ weeks)
This matches the website's public card gallery. Only build it if you want a social product, because it adds a backend, moderation and ongoing cost.
- [ ] Sign in with Apple
- [ ] Publish a card to a public gallery, with a link to view it on the web
- [ ] Browse / search / like / comment
- [ ] Rate limiting, image size limits, storage costs plan

### Phase 7: Polish and launch (2 weeks)
- [ ] Onboarding (sample cards, a "make your first card" walkthrough)
- [ ] Performance: render the preview on a background thread, cache frame assets, keep editing smooth at 60fps on older devices
- [ ] Crash reporting and privacy-friendly analytics
- [ ] App icon and launch screen
- [ ] Share builds with friends via TestFlight or Ad Hoc (see §0), and get feedback on text fit for dense cards

**Total estimate:** about 15 to 18 weeks to a feature-complete v1 without the community gallery, and about 20+ weeks with it.

---

## 4. Hardest problems, and how to tackle them

1. **Rules text layout.** Real cards shrink the font until the text fits, keep symbols on the baseline at the right size, put extra space between paragraphs, use a flavor divider, and center short text vertically. Build `TextLayoutEngine` as a pure function `(text, box, fontSpec) → layout` and test it heavily. Use binary search on font size to fit.
2. **Preview and export matching pixel for pixel.** Keep a single renderer and a single coordinate space. Never lay out the preview with SwiftUI `Text` views.
3. **Frame variety.** Make frames data-driven (`LayoutSpec`) from day one. Hard-coding each frame leads to a rewrite at frame #6.
4. **Art cropping UX on a small screen.** Edit art directly on the card preview (pinch/drag), with a full-screen crop mode as a fallback.
5. **Memory.** Full-res art plus 1500×2100 renders add up quickly. Downsample art for the preview, and render at full resolution only on export.

---

## 5. Feature parity checklist

Verify each item against the live mtg.design site and mark it ✅ (have), ⏳ (planned phase), or ➖ (skip).

| Area | Feature | Phase |
|---|---|---|
| Frames | Standard creature/spell, all 5 colors, gold, hybrid, artifact, colorless, land | 1–2 |
| Frames | Legendary crown, Nyx/enchantment, devoid, vehicle, snow | 3 |
| Frames | Planeswalker (3/4 abilities), Saga, Token, Full-art/borderless | 3 |
| Frames | Split, Flip, Transform/MDFC, Adventure, Battle, Class | 3 |
| Text | Title, mana cost, type line, rules, flavor, P/T, loyalty | 2 |
| Text | Inline symbol syntax, auto-fit, manual size override | 1–2 |
| Text | Artist, designer/copyright line, collector number | 2 |
| Art | Upload, zoom, reposition, full-art | 2 |
| Set | Set symbol library + custom upload, rarity color | 2 |
| Border | Black / white / silver / gold | 3 |
| Export | Download PNG, high resolution | 2 / 4 |
| Export | Print-ready with bleed, print sheets | 4 |
| Library | Save cards, edit later, delete, duplicate | 2 |
| Library | Group into sets | 5 |
| Social | Public gallery, share links, likes/comments | 6 |
| Accounts | Login / sync across devices | 5 (iCloud) / 6 |

---

## 6. Suggested next steps

1. Decide between a free Apple ID (7-day re-signing) and the $99/yr developer account (see §0).
2. Collect the fonts and the first frame set.
3. Start the Phase 1 rendering spike: one creature card that looks right.
