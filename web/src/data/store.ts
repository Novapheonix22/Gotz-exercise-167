// Saving cards, sets and images. Uses Supabase when configured, otherwise the
// browser's local storage (local development only).

import type { SupabaseClient } from '@supabase/supabase-js';
import { upgradeCard, type Card, type CardSet } from '../model/card';
import { supabase } from '../lib/supabase';

export interface CardSummary {
  id: string;
  name: string;
  setId: string | null;
  updatedAt: string;
  thumb?: string;
}

export interface Store {
  listCards(): Promise<CardSummary[]>;
  getCard(id: string): Promise<Card | null>;
  saveCard(card: Card, thumb?: string): Promise<void>;
  deleteCard(id: string): Promise<void>;
  listSets(): Promise<CardSet[]>;
  saveSet(set: CardSet): Promise<void>;
  deleteSet(id: string): Promise<void>;
  /** Upload an image; returns a reference to store on the card or set. */
  uploadImage(blob: Blob, kind: 'art' | 'symbol'): Promise<string>;
  /** Turn a stored reference into a URL the browser can load. */
  resolveImage(ref: string): Promise<string>;
}

// ---------- image preparation ----------

/** Shrink big images before upload. Symbols keep transparency (PNG); art becomes JPEG. */
export async function prepareImage(file: Blob, kind: 'art' | 'symbol'): Promise<Blob> {
  const maxSide = kind === 'art' ? 2400 : 600;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && (kind === 'symbol' ? file.type === 'image/png' : file.type === 'image/jpeg') && file.size < 4_000_000) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const type = kind === 'symbol' ? 'image/png' : 'image/jpeg';
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process image'))), type, 0.9));
}

// ---------- Supabase ----------

class SupabaseStore implements Store {
  private urlCache = new Map<string, { url: string; expires: number }>();
  private db: SupabaseClient;
  private userId: string;
  constructor(db: SupabaseClient, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  async listCards() {
    const { data, error } = await this.db.from('cards').select('id, name, set_id, updated_at, thumb:data->>thumb').order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.id as string, name: r.name as string, setId: r.set_id as string | null, updatedAt: r.updated_at as string, thumb: (r.thumb as string) || undefined }));
  }

  async getCard(id: string) {
    const { data, error } = await this.db.from('cards').select('id, data, updated_at').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { thumb: _thumb, ...card } = data.data as Card & { thumb?: string };
    return upgradeCard({ ...card, id: data.id, updatedAt: data.updated_at });
  }

  async saveCard(card: Card, thumb?: string) {
    const now = new Date().toISOString();
    const { error } = await this.db.from('cards').upsert({
      id: card.id,
      owner_id: this.userId,
      set_id: card.setId,
      name: card.name,
      data: { ...card, thumb },
      updated_at: now,
    });
    if (error) throw error;
  }

  async deleteCard(id: string) {
    const { error } = await this.db.from('cards').delete().eq('id', id);
    if (error) throw error;
  }

  async listSets() {
    const { data, error } = await this.db.from('card_sets').select('id, code, name, symbol_path').order('code');
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.id as string, code: r.code as string, name: r.name as string, symbol: (r.symbol_path as string) || undefined }));
  }

  async saveSet(set: CardSet) {
    const { error } = await this.db.from('card_sets').upsert({
      id: set.id, owner_id: this.userId, code: set.code, name: set.name, symbol_path: set.symbol ?? null, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  async deleteSet(id: string) {
    const { error } = await this.db.from('card_sets').delete().eq('id', id);
    if (error) throw error;
  }

  async uploadImage(blob: Blob, kind: 'art' | 'symbol') {
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${this.userId}/${kind}/${crypto.randomUUID()}.${ext}`;
    const { error } = await this.db.storage.from('card-images').upload(path, blob, { contentType: blob.type, upsert: false });
    if (error) throw error;
    return `storage:${path}`;
  }

  async resolveImage(ref: string) {
    if (!ref.startsWith('storage:')) return ref;
    const cached = this.urlCache.get(ref);
    if (cached && cached.expires > Date.now()) return cached.url;
    const path = ref.slice('storage:'.length);
    const { data, error } = await this.db.storage.from('card-images').createSignedUrl(path, 60 * 60 * 6);
    if (error || !data) throw error ?? new Error('No URL');
    this.urlCache.set(ref, { url: data.signedUrl, expires: Date.now() + 1000 * 60 * 60 * 5 });
    return data.signedUrl;
  }
}

// ---------- local (development without Supabase) ----------

class LocalStore implements Store {
  private read<T>(key: string, fallback: T): T {
    try { return JSON.parse(localStorage.getItem(key) ?? '') as T; } catch { return fallback; }
  }
  private write(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  }
  private cards() { return this.read<Record<string, Card & { thumb?: string }>>('dev-cards', {}); }

  async listCards() {
    return Object.values(this.cards())
      .map((c) => ({ id: c.id, name: c.name, setId: c.setId, updatedAt: c.updatedAt ?? '', thumb: c.thumb }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async getCard(id: string) {
    const c = this.cards()[id];
    if (!c) return null;
    const { thumb: _thumb, ...card } = c;
    return upgradeCard(card);
  }
  async saveCard(card: Card, thumb?: string) {
    const all = this.cards();
    all[card.id] = { ...card, thumb, updatedAt: new Date().toISOString() };
    this.write('dev-cards', all);
  }
  async deleteCard(id: string) {
    const all = this.cards();
    delete all[id];
    this.write('dev-cards', all);
  }
  async listSets() { return this.read<CardSet[]>('dev-sets', []); }
  async saveSet(set: CardSet) {
    const sets = (await this.listSets()).filter((s) => s.id !== set.id);
    this.write('dev-sets', [...sets, set].sort((a, b) => a.code.localeCompare(b.code)));
  }
  async deleteSet(id: string) { this.write('dev-sets', (await this.listSets()).filter((s) => s.id !== id)); }
  async uploadImage(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }
  async resolveImage(ref: string) { return ref; }
}

export function createStore(userId: string | null): Store {
  if (supabase && userId) return new SupabaseStore(supabase, userId);
  return new LocalStore();
}
