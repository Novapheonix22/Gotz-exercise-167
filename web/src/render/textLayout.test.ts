import { describe, expect, it } from 'vitest';
import { layoutText, tokenize, type Measure } from './textLayout';

// Every character is 0.5 × size wide.
const measure: Measure = (text, _italic, size) => text.length * size * 0.5;

describe('tokenize', () => {
  it('replaces ~ with the card name', () => {
    const t = tokenize('~ attacks', { cardName: 'Skarix' });
    expect(t[0]).toEqual({ kind: 'word', text: 'Skarix', italic: false });
  });
  it('reads symbols and italics', () => {
    const t = tokenize('{T}: <i>Draw</i> now');
    expect(t[0]).toEqual({ kind: 'symbol', file: 't' });
    expect(t.find((x) => x.kind === 'word' && x.text === 'Draw')).toMatchObject({ italic: true });
    expect(t.find((x) => x.kind === 'word' && x.text === 'now')).toMatchObject({ italic: false });
  });
  it('auto-italicizes reminder text', () => {
    const t = tokenize('Flying (It flies.)', { autoItalicReminder: true });
    expect(t.find((x) => x.kind === 'word' && x.text === '(It')).toMatchObject({ italic: true });
    expect(t.find((x) => x.kind === 'word' && x.text === 'Flying')).toMatchObject({ italic: false });
  });
  it('adds a bar and italics for flavor, with *word* de-emphasis', () => {
    const t = tokenize('Haste{flavor}Run *fast* now');
    expect(t.some((x) => x.kind === 'bar')).toBe(true);
    expect(t.find((x) => x.kind === 'word' && x.text === 'Run')).toMatchObject({ italic: true });
    expect(t.find((x) => x.kind === 'word' && x.text === 'fast')).toMatchObject({ italic: false });
  });
  it('treats \\\\ as a line break and newline as a paragraph', () => {
    const t = tokenize('a\\\\b\nc');
    expect(t.map((x) => x.kind)).toEqual(['word', 'line', 'word', 'paragraph', 'word']);
  });
});

describe('layoutText', () => {
  it('wraps words to the box width', () => {
    const l = layoutText(tokenize('aaaa bbbb cccc'), measure, { width: 50, height: 1000, size: 10 });
    expect(l.lines.length).toBe(2);
    expect(l.size).toBe(10);
  });
  it('shrinks text that does not fit', () => {
    const long = Array.from({ length: 40 }, () => 'word').join(' ');
    const l = layoutText(tokenize(long), measure, { width: 100, height: 60, size: 20 });
    expect(l.size).toBeLessThan(20);
    expect(l.height).toBeLessThanOrEqual(60.5);
  });
  it('shrinks one-line text to fit the width', () => {
    const l = layoutText(tokenize('A Very Long Card Name Indeed'), measure, { width: 100, height: 30, size: 20, oneLine: true });
    expect(l.lines.length).toBe(1);
    expect(l.lines[0].width).toBeLessThanOrEqual(100.5);
  });
  it('right-aligns', () => {
    const l = layoutText(tokenize('ab'), measure, { width: 100, height: 30, size: 10, oneLine: true, align: 'right' });
    expect(l.lines[0].items[0].x).toBeCloseTo(90);
  });
});
