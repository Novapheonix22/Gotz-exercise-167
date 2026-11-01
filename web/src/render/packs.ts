import type { Bounds } from './frameResolver';

export interface TextBoxSpec {
  name?: string;
  x?: number; y?: number; width?: number; height?: number;
  size?: number;
  font?: string;
  oneLine?: boolean;
  align?: 'left' | 'center' | 'right';
  shadowX?: number; shadowY?: number;
  manaCost?: boolean;
}

export interface PackFrame {
  name: string;
  src: string;
  masks?: { name: string; src: string }[];
  bounds?: Bounds;
  complementary?: number;
}

export interface FrameVersion {
  version?: string;
  artBounds?: Bounds;
  setSymbolBounds?: Bounds & { vertical?: string; horizontal?: string };
  watermarkBounds?: Bounds;
  text: Record<string, TextBoxSpec>;
}

export interface Pack {
  id: string;
  frames: PackFrame[];
  version: FrameVersion | null;
}

const cache = new Map<string, Promise<Pack>>();

export function loadPack(id: string): Promise<Pack> {
  if (!cache.has(id)) {
    cache.set(id, fetch(`/cc/packs/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`Frame pack ${id} is missing. Run: npm run fetch-assets`);
      return r.json() as Promise<Pack>;
    }));
  }
  return cache.get(id)!;
}
