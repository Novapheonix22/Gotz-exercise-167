import { useEffect, useRef, useState, type CanvasHTMLAttributes } from 'react';
import type { Card } from '../model/card';
import { REGULAR_PACK_IDS, type Packs } from '../render/frameResolver';
import { loadPack } from '../render/packs';
import { CARD_H, CARD_W, renderCard } from '../render/renderer';

let packsPromise: Promise<Packs> | null = null;
export function loadAllPacks(): Promise<Packs> {
  // Only the regular pack is required; a missing optional pack just disables that frame option.
  packsPromise ??= Promise.all(
    Object.entries(REGULAR_PACK_IDS).map(async ([key, id]) => {
      try {
        return [key, await loadPack(id)] as const;
      } catch (e) {
        if (key === 'regular') throw e;
        console.warn(`Optional frame pack ${id} is missing`);
        return [key, undefined] as const;
      }
    }),
  ).then((entries) => Object.fromEntries(entries.filter(([, v]) => v)) as unknown as Packs);
  return packsPromise;
}

export function usePacks() {
  const [packs, setPacks] = useState<Packs | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { loadAllPacks().then(setPacks).catch((e: Error) => setError(e.message)); }, []);
  return { packs, error };
}

interface Props extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, 'children'> {
  card: Card;
  packs: Packs;
  scale: number;
  setSymbol?: string;
}

/** Live card preview. Re-renders when the card changes; never flickers between versions. */
export function CardCanvas({ card, packs, scale, setSymbol, className, ...rest }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pending = useRef(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = ++pending.current;
    const handle = requestAnimationFrame(async () => {
      setBusy(true);
      const off = document.createElement('canvas');
      try {
        await renderCard(off, card, packs, { scale, setSymbol });
      } catch (e) {
        console.error(e);
      }
      if (id !== pending.current || !ref.current) return;
      const c = ref.current;
      c.width = off.width;
      c.height = off.height;
      c.getContext('2d')!.drawImage(off, 0, 0);
      setBusy(false);
    });
    return () => cancelAnimationFrame(handle);
  }, [card, packs, scale, setSymbol]);
  return (
    <canvas
      ref={ref}
      className={`${className ?? ''}${busy ? ' busy' : ''}`}
      width={Math.round(CARD_W * scale)}
      height={Math.round(CARD_H * scale)}
      {...rest}
    />
  );
}

/** Small JPEG for the library grid. */
export async function makeThumbnail(card: Card, packs: Packs, setSymbol?: string): Promise<string> {
  const c = document.createElement('canvas');
  await renderCard(c, card, packs, { scale: 0.16, setSymbol });
  return c.toDataURL('image/jpeg', 0.82);
}
