import { describe, expect, it } from 'vitest';
import { costColors, parseManaCost, symbolFile } from './symbols';

describe('symbolFile', () => {
  it('handles basic symbols', () => {
    expect(symbolFile('W')).toBe('w');
    expect(symbolFile('12')).toBe('12');
    expect(symbolFile('T')).toBe('t');
    expect(symbolFile('Q')).toBe('untap');
  });
  it('handles hybrid in both spellings and orders', () => {
    expect(symbolFile('U/B')).toBe('ub');
    expect(symbolFile('ub')).toBe('ub');
    expect(symbolFile('B/W')).toBe('wb');
    expect(symbolFile('2/W')).toBe('2w');
  });
  it('handles Phyrexian', () => {
    expect(symbolFile('G/P')).toBe('gp');
    expect(symbolFile('pg')).toBe('gp');
    expect(symbolFile('W/U/P')).toBe('wup');
    expect(symbolFile('U/W/P')).toBe('wup');
  });
  it('rejects unknown codes', () => {
    expect(symbolFile('banana')).toBeNull();
  });
});

describe('parseManaCost', () => {
  it('parses braces', () => {
    expect(parseManaCost('{2}{W}{U/B}').map((t) => t.file)).toEqual(['2', 'w', 'ub']);
  });
  it('parses bare shorthand', () => {
    expect(parseManaCost('3RG').map((t) => t.file)).toEqual(['3', 'r', 'g']);
  });
});

describe('costColors', () => {
  it('finds colors from hybrid and Phyrexian', () => {
    expect(costColors('{1}{U/B}{G/P}')).toEqual(['U', 'B', 'G']);
    expect(costColors('{5}')).toEqual([]);
  });
});
