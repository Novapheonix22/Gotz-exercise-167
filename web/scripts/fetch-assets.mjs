// Downloads Card Conjurer frame packs, fonts and mana symbols for personal use,
// converts frame PNGs to WebP, and writes one JSON manifest per pack.
//
// Pack scripts are parsed with acorn and only literal values are read from them.
// The downloaded JavaScript is never executed.
//
// Usage: node scripts/fetch-assets.mjs [packId ...]
//   With no pack ids, fetches DEFAULT_PACKS.

import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import sharp from 'sharp';

const ORIGIN = 'https://cardconjurer.app';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache', 'cc');
const OUT = join(ROOT, 'public', 'cc');

const DEFAULT_PACKS = ['M15Regular-1', 'M15LegendCrowns', 'M15LegendCrownsFloating', 'M15HoloStamps'];

const FONTS = ['beleren-b', 'beleren-bsc', 'mplantin', 'mplantin-i', 'gotham-medium'];

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
const EXTRA_IMAGES = ['/img/frames/maskRightHalf.png', '/img/frames/maskLeftHalf.png', '/img/black.png'];

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
  const png = await download(src, join(CACHE, src));
  const webpRel = src.replace(/^\//, '').replace(/\.png$/i, '.webp');
  const outPath = join(OUT, webpRel);
  if (!(await exists(outPath))) {
    await mkdir(dirname(outPath), { recursive: true });
    await sharp(png).webp({ quality: 90, alphaQuality: 100, effort: 4 }).toFile(outPath);
  }
  return '/cc/' + webpRel;
}

async function fetchPack(id) {
  const js = (await download(`/js/frames/pack${id}.js`, join(CACHE, 'packs', `${id}.js`))).toString('utf8');
  const pack = parsePack(js);
  const imageMap = new Map();
  const convert = async (src) => {
    if (!src || !/\.png$/i.test(src)) return src;
    if (!imageMap.has(src)) imageMap.set(src, await fetchFrameImage(src));
    return imageMap.get(src);
  };
  const frames = [];
  for (const f of pack.frames) {
    if (!f || !f.src) continue;
    frames.push({
      name: f.name,
      src: await convert(f.src),
      masks: f.masks ? await Promise.all(f.masks.map(async (m) => ({ name: m.name, src: await convert(m.src) }))) : undefined,
      bounds: f.bounds,
      complementary: f.complementary,
    });
  }
  const manifest = { id, frames, version: pack.version };
  await mkdir(join(OUT, 'packs'), { recursive: true });
  await writeFile(join(OUT, 'packs', `${id}.json`), JSON.stringify(manifest, null, 2));
  console.log(`pack ${id}: ${frames.length} frames, ${imageMap.size} images${pack.version ? ', has frame version' : ''}`);
}

async function main() {
  const packs = process.argv.slice(2);
  for (const f of FONTS) {
    const buf = await download(`/fonts/${f}.ttf`, join(CACHE, 'fonts', `${f}.ttf`));
    await mkdir(join(OUT, 'fonts'), { recursive: true });
    await writeFile(join(OUT, 'fonts', `${f}.ttf`), buf);
  }
  console.log(`fonts: ${FONTS.length}`);
  for (const m of [...MANA.map((n) => n + '.svg'), ...MANA_PNG]) {
    const buf = await download(`/img/manaSymbols/${m}`, join(CACHE, 'mana', m));
    await mkdir(join(OUT, 'mana'), { recursive: true });
    await writeFile(join(OUT, 'mana', m), buf);
  }
  console.log(`mana symbols: ${MANA.length + MANA_PNG.length}`);
  for (const src of EXTRA_IMAGES) await fetchFrameImage(src);
  console.log(`extra images: ${EXTRA_IMAGES.length}`);
  for (const id of packs.length ? packs : DEFAULT_PACKS) await fetchPack(id);
}

main().catch((err) => { console.error(err); process.exit(1); });
