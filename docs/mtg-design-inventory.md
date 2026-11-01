# MTG.Design Card Creator: Options Inventory

Source: https://mtg.design/create (logged in as a donor account, October 31, 2026). Collected by reading the page's form controls and its on-page syntax help. Nothing was saved, downloaded, or shared while collecting this.

Site navigation: Home, Create, account menu (Reset Password, Logout). Donors also get a link to the "Preview Version" at beta.spellshapers.com.

---

## 1. Card identity fields (top of form)

| Field | Max length | Notes |
|---|---|---|
| `#` (collector number) | 4 | |
| Total | 4 | Total cards in set |
| Set | 3 | Set code, default "SET" |
| Lang | 2 | Default "EN" |
| Designer | 47 | Prefilled with account name |
| Name | 255 | Default "Untitled" |
| Mana Cost | 47 | Uses `{}` symbol syntax (see section 8) |

---

## 2. Type line

| Field | Max length | Notes |
|---|---|---|
| Super | 255 | Free text, supertype (e.g. Legendary) |
| Type | n/a | Dropdown, listed below |
| Sub | 255 | Free text, subtypes |

### Type dropdown (grouped as on the site)

- **Artifact group:** Artifact, Artifact Creature, Artifact Land, Artifact Land Creature, Enchantment Artifact, Enchantment Artifact Creature, Enchantment Artifact Land, Enchantment Artifact Land Creature
- **Creature group (default is Creature):** Creature, Artifact Creature, Enchantment Creature, Enchantment Artifact Creature, Land Creature, Artifact Land Creature
- **Enchantment group:** Enchantment, Enchantment Artifact, Enchantment Creature, Enchantment Artifact Creature, Enchantment Land, Enchantment Saga
- **Land group:** Land, Artifact Land, Land Creature, Artifact Land Creature, Enchantment Land, Enchantment Artifact Land, Enchantment Artifact Land Creature
- **Spells:** Instant, Sorcery
- **Other:** Planeswalker, Conspiracy
- **Blank** (internal value "Custom")

---

## 3. Frames and templates

### Special Frames dropdown (field "card-layout")

| Option | Internal value |
|---|---|
| Normal (default) | regular |
| Saga | saga |
| Conspiracy Draft | conspiracy |
| Modal DFC: Front | transform-modal_front |
| Modal DFC: Back | transform-modal_back |
| Double-Faced: Sun (Front) | transform-sun |
| Double-Faced: Moon (Back) | transform-moon |
| Double-Faced: Compass (Front) | transform-compass |
| Double-Faced: Land (Back) | transform-land |
| Double-Faced: Eldrazi (Front) | transform-mooneldrazi |
| Double-Faced: Eldrazi (Back) | transform-eldrazi |
| Double-Faced: Origin (Front) | transform-origin |
| Double-Faced: Spark (Back) | transform-spark |
| Full Art Promo | mgdpromo |
| Adventure | adventure |
| Adventure Reversed | adventure-reversed |
| Token | token |

### Frame-related companion fields

- **Color Indicator** dropdown (default None): None, W, WU, WB, WUB, WBG, U, UB, UR, UBR, URW, B, BR, BG, BRG, BGU, R, RG, RW, RGW, RWB, G, GW, GU, GWU, GUR, WUBRG (shown on the site by color names, e.g. "White-Blue-Black").
- **Accent** dropdown (default "Default"): Default (C), Gold (A), White (W), White-Blue (WU), White-Black (WB), Blue (U), Blue-Black (UB), Blue-Red (UR), Black (B), Black-Red (BR), Black-Green (BG), Red (R), Red-Green (RG), Red-White (RW), Green (G), Green-White (GW), Green-Blue (GU).
  - A second control with the same label and the same options exists as a hidden field (`land-overlay`). Its name suggests it applies to land frames.
- **Size** dropdown: 3 or 4. Hidden by default. Its field name (`pw-size`) suggests it applies to Planeswalkers and sets the number of abilities.
- **Miracle** checkbox. Hidden by default.

> Not verified: which Type or Special Frames selection reveals each hidden control. I read the hidden fields from the page structure but did not change the dropdowns to see the form react.

---

## 4. Rarity and set symbol

**Rarity dropdown** (default Common): Common (C), Uncommon (U), Rare (R), Mythic Rare (M), Land (L), Promo (P), Special (S), Token (T).

**Set symbol:** the "Custom Set Symbol URL (PNG format)" field (max 255) takes a URL to a PNG. No built-in symbol picker is on the form. The symbol's rarity coloring presumably follows the Rarity dropdown, but I did not render a card to confirm.

**Watermark (PNG format):** URL field, max 255.

---

## 5. Border and finish

| Control | Type | Options |
|---|---|---|
| Border | Dropdown (default Black) | Black, White, Silver, Gold |
| Foil | Checkbox | |
| Center | Checkbox | Centers the text block |
| Lighten | Checkbox | Likely lightens the art area (not verified) |
| Text Size | Slider | 18 to 38, step 1, default 38 pt |

---

## 6. Art, upload and cropping

- **Artwork URL**: text field, max 1023 characters.
- **Upload File…**: file picker plus an **Upload** button (hidden file input, field name `upload`).
- **Image Crop and Scale**: the crop widget uses the Croppie library. Its crop box appears hidden until art is loaded, so I did not see it live. From the page script and markup:
  - Drag to reposition and zoom to scale (the crop widget saves zoom with the crop points).
  - **Reset Zoom** button.
  - A text field, `crop-points`, stores the four crop coordinates plus the zoom value as comma-separated numbers. It is max 255 and hidden.
- **Artist**: text, max 63.

---

## 7. Text boxes

| Field | Max length | Notes |
|---|---|---|
| Rules Text | 768 | Has a "Show/Hide Syntax" help link |
| Flavor Text | 768 | |
| Adventure Name | 255 | Hidden unless an Adventure frame is used (inferred) |
| Adv. Type | 47 | Same |
| Adv. Mana Cost | 47 | Same |
| Adventure Text (left side, unless reversed) | 768 | Same |
| Saga Reminder Text | 255 | Hidden unless a Saga frame/type is used (inferred) |
| Planeswalker abilities 1 to 6 | 768 each | Each has its own `+/-` cost box. The first is Rules Text. Labeled "Ability #2" to "Ability #6" |
| `+/-` cost boxes | first one: 3 | |

### Stats

- Power (max 4), Tough (max 4)
- Back Power (max 4), Back Tough (max 4): for double-faced cards, hidden by default
- Loyalty (max 2): hidden by default

---

## 8. Text formatting syntax (from the site's own Syntax help)

- Mana and other symbols go in braces: `{X}{2}{R}`, `{T}`
- Hybrid mana uses a slash: `{2/W}{U/B}`
- Phyrexian mana: `{1/P}{G/P}`
- `~` is shorthand for the card's name
- `<i>Ability Word</i>` italicizes specific words
- Text in parentheses `( )` italicizes automatically
- `*word*` de-emphasizes text in the flavor text box
- `\\` forces a new line

---

## 9. Render, download, share

The three action buttons sit at the top right:

1. **Render**: renders the card preview.
2. **Download**: downloads the card image. I did not click it, since it would trigger a file download.
3. **Save & Share**: saves the card and produces a share link. Clicking it would save a card to your account, so I did not click it. A "shareLink" text field holds the resulting URL.

**Moxtober:** below the form is a "Submit for Moxtober?" prompt with **Yes / No** and a "Choose a Day" dropdown: Day 1: Witches, 2: Double, 3: Toil, 4: Trouble, 5: Fire, 6: Boil, 7: Cauldron, 8: Bubble, 9: Blood, 10: Bold, 11: Resolute, 12: Poison, 13: Toad, 14: Eye, 15: Newt, 16: Knock, 17: Wood, 18: Beware, 19: Wing, 20: Something, 21: Wicked, 22: Share, 23: Sting, 24: Salt, 25: Maw, 26: Laugh, 27: Pain, 28: Secret, 29: Midnight, 30: Hemlock, 31: Thane.

**Dashboard (Home page):** each saved card has links to edit, view (`/i/<id>`), and delete (`/i/<id>/delete`). Cards are grouped under "Ungrouped Cards" and under "Custom set: <code>" headings.

---

## 10. Gaps and caveats

- Which fields appear for which type/frame was not tested live.
- The crop widget and exact effects of Lighten, Center and Foil were not observed on a rendered card.
- Download file format/resolution and share-link behavior were not tested.
- From public gallery renders (checked separately): downloads are 744 × 1039 JPG.
