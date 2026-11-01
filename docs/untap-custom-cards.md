# Untap (untap.in): How Custom Cards Get In

Found by reading untap.in's own app code on November 1, 2026. The Untap wiki (wiki.untap.in) was not reachable from the build environment, so this hasn't been checked against its docs yet.

## Two ways to add custom cards

1. **One card at a time:** Untap's add-card form accepts an **uploaded image file** (sent to Untap as image data) or an **image link**. Untap can also try to read the card's text from the image ("extract card fields").
   - For us: export a PNG, then upload it in Untap. No image hosting needed.
2. **Bulk upload (CSV file):** up to **100 cards per upload**. Images must be **links (URLs)**, not files.
   - For us: the app needs somewhere online to put the card images, then it writes the CSV.

Untap also checks a per-account **quota** for adding cards ("card-add-quota"). The limits aren't known yet.

## Bulk upload CSV columns

If the header row is left out, columns are read in this order.

| Column | Required | Value | Notes |
|---|---|---|---|
| `title` | yes | text | Card name |
| `set` | yes | text, max 4 characters | Set code, e.g. `MOX` |
| `image_type` | yes | `ofp`, `token`, `tst`, `alt`, `cus` | Use `cus` (Custom); `token` for tokens |
| `front_image` | yes | URL | Front image link |
| `back_image` | no | URL | Back face (double-faced cards) |
| `rarity` | yes | text | e.g. `common`, `rare` |
| `orientation` | no | empty, `lsd`, `rsd` | Left side down / right side down. Battles are sideways |
| `front_text` | yes | text | Card text (name, cost, type, rules) |
| `back_text` | no | text | Back face text |

## What this means for the app

- **Export one card for Untap:** PNG export + a short "upload it in Untap" guide. Works with no extra setup.
- **Export a set for Untap:** the CSV above, split into files of 100. Needs the images online first. Options, to decide when we build Phase 4:
  - a free image host with an upload API,
  - a free cloud storage bucket (e.g. Cloudflare R2),
  - or the backend added for cloud sync, if we build that.
