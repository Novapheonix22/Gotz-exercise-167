import { describe, expect, it } from 'vitest';
import { colorOrder, normalizeManaCost, setGeneric } from './manaOrder';

describe('colorOrder', () => {
  it('uses the official order for every combination', () => {
    expect(colorOrder(['G', 'W']).join('')).toBe('GW');
    expect(colorOrder(['W', 'R']).join('')).toBe('RW');
    expect(colorOrder(['U', 'G']).join('')).toBe('GU');
    expect(colorOrder(['B', 'W', 'R']).join('')).toBe('RWB');
    expect(colorOrder(['R', 'U', 'G']).join('')).toBe('GUR');
    expect(colorOrder(['W', 'G', 'U']).join('')).toBe('GWU');
    expect(colorOrder(['G', 'B', 'W']).join('')).toBe('WBG');
    expect(colorOrder(['W', 'U', 'B', 'G']).join('')).toBe('GWUB');
    expect(colorOrder(['G', 'R', 'B', 'U', 'W']).join('')).toBe('WUBRG');
  });
});

describe('normalizeManaCost', () => {
  it('puts generic first and colors in order', () => {
    expect(normalizeManaCost('{G}{R}{2}{B}{U}{W}')).toBe('{2}{W}{U}{B}{R}{G}');
    expect(normalizeManaCost('{W}{R}{R}')).toBe('{R}{R}{W}');
    expect(normalizeManaCost('{B}{W}{1}{R}')).toBe('{1}{R}{W}{B}');
  });
  it('puts X first and adds up generic numbers', () => {
    expect(normalizeManaCost('{R}{X}{2}{3}')).toBe('{X}{5}{R}');
  });
  it('orders colorless and snow before colors', () => {
    expect(normalizeManaCost('{U}{C}{4}')).toBe('{4}{C}{U}');
  });
  it('places hybrid symbols by their colors', () => {
    expect(normalizeManaCost('{U/B}{2}{W}')).toBe('{2}{W}{U/B}');
  });
  it('keeps a lone zero', () => {
    expect(normalizeManaCost('{0}')).toBe('{0}');
  });
});

describe('setGeneric', () => {
  it('replaces the generic number', () => {
    expect(setGeneric('{2}{R}{G}', 12)).toBe('{12}{R}{G}');
    expect(setGeneric('{G}', 5)).toBe('{5}{G}');
  });
});

describe('two-color pairs', () => {
  it('orders all ten pairs officially, whichever order they are typed in', () => {
    const pairs = ['WU', 'UB', 'BR', 'RG', 'GW', 'WB', 'UR', 'BG', 'RW', 'GU'];
    for (const p of pairs) {
      const typedBackwards = `{${p[1]}}{${p[0]}}`;
      expect(normalizeManaCost(typedBackwards)).toBe(`{${p[0]}}{${p[1]}}`);
    }
  });
});
