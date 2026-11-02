// Downloads Card Conjurer frame packs, fonts and mana symbols for personal use,
// converts frame PNGs to WebP, and writes one JSON manifest per pack.
//
// Pack scripts are parsed with acorn and only literal values are read from them.
// The downloaded JavaScript is never executed.
//
// Usage: node scripts/fetch-assets.mjs [packId ...]
//   With no pack ids, fetches DEFAULT_PACKS.

import { mkdir, writeFile, readFile, access, cp } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import sharp from 'sharp';

const ORIGIN = 'https://cardconjurer.app';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// node_modules/.cache survives between Vercel builds, so downloads and conversions are reused.
const CACHE = join(ROOT, 'node_modules', '.cache', 'cardconjurer');
const CONVERTED = join(CACHE, 'converted');
const OUT = join(ROOT, 'public', 'cc');
const RAW = join(CACHE, 'raw');

// Every pack the app uses. Shared with the app so the two lists can't drift apart.
const ADDON_PACKS = Object.values(JSON.parse(await readFile(join(ROOT, 'src', 'render', 'packIds.json'), 'utf8')));
// Style packs are listed in src/flow/styles.ts as `pack: '<id>'`.
const STYLE_PACKS = [...(await readFile(join(ROOT, 'src', 'flow', 'styles.ts'), 'utf8')).matchAll(/pack: '([^']+)'/g)].map((m) => m[1]);
const DEFAULT_PACKS = [...new Set([...ADDON_PACKS, ...STYLE_PACKS])];

// Font files as named on Card Conjurer; saved under the same names.
const FONTS = ['beleren-b.ttf', 'beleren-bsc.ttf', 'mplantin.ttf', 'mplantin-i.ttf', 'gotham-medium.ttf',
  'matrix.ttf', 'matrix-b.ttf', 'Matrix Bold Small Caps.ttf', 'plantin-semibold.otf', 'goudy-medieval.ttf'];

const MANA = [
  ...Array.from({ length: 21 }, (_, i) => String(i)),
  'w', 'u', 'b', 'r', 'g', 'c', 'x', 'y', 'z', 't', 'untap', 's', 'e', 'p',
  'wu', 'wb', 'ub', 'ur', 'br', 'bg', 'rg', 'rw', 'gw', 'gu',
  '2w', '2u', '2b', '2r', '2g', 'wp', 'up', 'bp', 'rp', 'gp',
  'wup', 'wbp', 'ubp', 'urp', 'brp', 'bgp', 'rgp', 'rwp', 'gwp', 'gup',
  'brush', 'whitebrush',
];
const MANA_PNG = ['bar.png'];
// Shared masks used to put a layer on only half of the card (two-color frames).
const EXTRA_IMAGES = ['/img/frames/maskRightHalf.png', '/img/frames/maskLeftHalf.png', '/img/black.png',
  // Planeswalker loyalty badges, ability stripes and text masks
  '/img/frames/planeswalker/planeswalkerPlus.png', '/img/frames/planeswalker/planeswalkerMinus.png',
  '/img/frames/planeswalker/planeswalkerNeutral.png', '/img/frames/planeswalker/abilityLineOdd.png',
  '/img/frames/planeswalker/abilityLineEven.png', '/img/frames/planeswalker/text.svg',
  '/img/frames/planeswalker/tall/planeswalkerTallMaskRules.png', '/img/frames/planeswalker/transform/textFront.svg',
  // Saga chapter markers
  '/img/frames/saga/sagaChapter.png', '/img/frames/saga/sagaDivider.png'];

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function download(urlPath, cachePath) {
  if (await exists(cachePath)) return readFile(cachePath);
  const res = await fetch(ORIGIN + urlPath);
  if (!res.ok) throw new Error(`${res.status} for ${urlPath}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, buf);
  return buf;
}

// ---------- safe literal evaluation of pack scripts ----------

function evalLiteral(node, scope) {
  switch (node.type) {
    case 'Literal': return node.value;
    case 'TemplateLiteral':
      if (node.expressions.length === 0) return node.quasis.map((q) => q.value.cooked).join('');
      return undefined;
    case 'ArrayExpression': return node.elements.map((e) => (e ? evalLiteral(e, scope) : undefined));
    case 'ObjectExpression': {
      const obj = {};
      for (const p of node.properties) {
        if (p.type !== 'Property') continue;
        const key = p.key.type === 'Identifier' ? p.key.name : p.key.value;
        obj[key] = evalLiteral(p.value, scope);
      }
      return obj;
    }
    case 'Identifier': return scope.has(node.name) ? scope.get(node.name) : undefined;
    case 'UnaryExpression': {
      const v = evalLiteral(node.argument, scope);
      if (typeof v !== 'number') return undefined;
      return node.operator === '-' ? -v : node.operator === '+' ? v : undefined;
    }
    case 'BinaryExpression': {
      const a = evalLiteral(node.left, scope);
      const b = evalLiteral(node.right, scope);
      if (typeof a !== 'number' || typeof b !== 'number') {
        if (node.operator === '+' && typeof a === 'string' && typeof b === 'string') return a + b;
        return undefined;
      }
      switch (node.operator) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        default: return undefined;
      }
    }
    default: return undefined;
  }
}

function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && walk(c, visit));
    else if (v && typeof v.type === 'string') walk(v, visit);
  }
}

function memberPath(node) {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression' && !node.computed) {
    const obj = memberPath(node.object);
    return obj ? `${obj}.${node.property.name}` : null;
  }
  return null;
}

function parsePack(source) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script', allowAwaitOutsideFunction: true });
  const scope = new Map();
  const result = { frames: [], version: null };
  const version = { text: {} };
  let hasVersion = false;

  walk(ast, (node) => {
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init) {
      const v = evalLiteral(node.init, scope);
      if (v !== undefined) scope.set(node.id.name, v);
    }
    if (node.type === 'AssignmentExpression' && node.operator === '=') {
      const target = memberPath(node.left);
      if (target === 'availableFrames') {
        const v = evalLiteral(node.right, scope);
        if (Array.isArray(v)) result.frames = v.filter(Boolean);
      } else if (target && target.startsWith('card.')) {
        const v = evalLiteral(node.right, scope);
        if (v !== undefined) { version[target.slice(5)] = v; hasVersion = true; }
      } else if (target && node.left.type === 'Identifier') {
        const v = evalLiteral(node.right, scope);
        if (v !== undefined) scope.set(target, v);
      }
    }
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'loadTextOptions') {
      const v = node.arguments[0] && evalLiteral(node.arguments[0], scope);
      if (v && typeof v === 'object') { Object.assign(version.text, v); hasVersion = true; }
    }
  });

  if (hasVersion) result.version = version;
  return result;
}

// ---------- conversion ----------

async function fetchFrameImage(src) {
  const buf = await download(src, join(RAW, src));
  const isSvg = /\.svg$/i.test(src);
  const webpRel = src.replace(/^\//, '').replace(/\.(png|svg)$/i, '.webp');
  const outPath = join(CONVERTED, webpRel);
  if (!(await exists(outPath))) {
    await mkdir(dirname(outPath), { recursive: true });
    // SVG masks are drawn over the whole card, so rasterize them at full card size.
    const img = isSvg ? sharp(buf, { density: 300 }).resize(2010, 2814, { fit: 'fill' }) : sharp(buf);
    await img.webp({ quality: 90, alphaQuality: 100, effort: 4 }).toFile(outPath);
  }
  return '/cc/' + webpRel;
}

async function fetchPack(id) {
  const js = (await download(`/js/frames/pack${id}.js`, join(RAW, 'packs', `${id}.js`))).toString('utf8');
  const pack = parsePack(js);
  const imageMap = new Map();
  const convert = async (src) => {
    if (!src || !/\.(png|svg)$/i.test(src)) return src;
    if (!imageMap.has(src)) imageMap.set(src, fetchFrameImage(src));
    return imageMap.get(src);
  };
  // Card Conjurer occasionally lists an image it doesn't have. Skip those instead of failing the build.
  const tryConvert = async (src) => {
    try { return await convert(src); } catch (err) { console.warn(`  skipped ${src}: ${err.message}`); return null; }
  };
  // Convert frames 8 at a time, keeping the pack's order.
  const list = pack.frames.filter((f) => f && f.src);
  const results = new Array(list.length);
  let next = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (next < list.length) {
      const i = next++;
      const f = list[i];
      const src = await tryConvert(f.src);
      if (!src) continue;
      const masks = f.masks
        ? (await Promise.all(f.masks.map(async (m) => ({ name: m.name, src: await tryConvert(m.src) })))).filter((m) => m.src)
        : undefined;
      results[i] = { name: f.name, src, masks, bounds: f.bounds, complementary: f.complementary };
    }
  }));
  const frames = results.filter(Boolean);
  const manifest = { id, frames, version: pack.version };
  await mkdir(join(OUT, 'packs'), { recursive: true });
  await writeFile(join(OUT, 'packs', `${id}.json`), JSON.stringify(manifest, null, 2));
  console.log(`pack ${id}: ${frames.length} frames, ${imageMap.size} images${pack.version ? ', has frame version' : ''}`);
}

async function main() {
  const packs = process.argv.slice(2);
  for (const f of FONTS) {
    const buf = await download(`/fonts/${encodeURIComponent(f)}`, join(RAW, 'fonts', f));
    await mkdir(join(OUT, 'fonts'), { recursive: true });
    await writeFile(join(OUT, 'fonts', f), buf);
  }
  console.log(`fonts: ${FONTS.length}`);
  for (const m of [...MANA.map((n) => n + '.svg'), ...MANA_PNG]) {
    const buf = await download(`/img/manaSymbols/${m}`, join(RAW, 'mana', m));
    await mkdir(join(OUT, 'mana'), { recursive: true });
    await writeFile(join(OUT, 'mana', m), buf);
  }
  console.log(`mana symbols: ${MANA.length + MANA_PNG.length}`);
  for (const src of EXTRA_IMAGES) await fetchFrameImage(src);
  console.log(`extra images: ${EXTRA_IMAGES.length}`);
  for (const id of packs.length ? packs : DEFAULT_PACKS) await fetchPack(id);
  await cp(CONVERTED, OUT, { recursive: true });
  console.log('copied converted images to public/cc');
}

main().catch((err) => { console.error(err); process.exit(1); });
