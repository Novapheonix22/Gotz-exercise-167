# Spellcraft (web app)

Spellcraft: a mobile-first custom card maker. See `../BUILD_PLAN.md` for the full plan.

## Run it

```sh
npm install
npm run fetch-assets   # downloads Card Conjurer frames, fonts and symbols into public/cc (not committed)
npm run dev
npm test
```

`fetch-assets` reads Card Conjurer's frame pack scripts as data (parsed, never executed),
converts the frame PNGs to WebP and writes one JSON manifest per pack to `public/cc/packs/`.
Pass pack ids to fetch more, e.g. `npm run fetch-assets -- M15Nyx Adventure`.
