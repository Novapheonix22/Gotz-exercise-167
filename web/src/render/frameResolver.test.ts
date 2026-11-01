import { describe, expect, it } from 'vitest';
import { frameProperties, orderedColors } from './frameResolver';

describe('orderedColors', () => {
  it('uses the standard left/right order for pairs', () => {
    expect(orderedColors(['W', 'R'])).toEqual(['R', 'W']);
    expect(orderedColors(['W', 'U'])).toEqual(['W', 'U']);
    expect(orderedColors(['U', 'G'])).toEqual(['G', 'U']);
  });
});

describe('frameProperties', () => {
  it('mono red creature', () => {
    expect(frameProperties(['R'], '{1}{R}', 'Creature — Goblin', true)).toMatchObject({ frame: 'R', rules: 'R', typeTitle: 'R', pt: 'R' });
  });
  it('gold two-color card has gold frame with split pinlines', () => {
    const p = frameProperties(['B', 'R'], '{B}{R}', 'Creature', true);
    expect(p).toMatchObject({ frame: 'M', typeTitle: 'M', rules: 'B', rulesRight: 'R', pinline: 'B', pinlineRight: 'R', pt: 'M' });
    expect(p.frameRight).toBeUndefined();
  });
  it('hybrid two-color card splits the frame', () => {
    expect(frameProperties(['W', 'U'], '{W/U}', 'Instant', false)).toMatchObject({ frame: 'W', frameRight: 'U', typeTitle: 'L' });
  });
  it('three colors is gold', () => {
    expect(frameProperties(['B', 'R', 'G'], '{B}{R}{G}', 'Creature', true)).toMatchObject({ frame: 'M', rules: 'M', pt: 'M' });
  });
  it('colorless artifact', () => {
    expect(frameProperties([], '{3}', 'Artifact — Equipment', false)).toMatchObject({ frame: 'A', rules: 'A', typeTitle: 'A' });
  });
  it('vehicle', () => {
    expect(frameProperties([], '{2}', 'Artifact — Vehicle', true)).toMatchObject({ frame: 'V', pt: 'V' });
  });
});
