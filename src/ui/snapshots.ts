/**
 * Cópias automáticas da partida ("voltar no tempo"), guardadas no IndexedDB do navegador
 * (cabe muito mais que o localStorage). A cada mês avançado: guarda uma cópia; mantém os
 * últimos 6 meses e o mês de janeiro de cada ano de jogo (até 12 anos) por partida.
 * Tudo é opcional: se o navegador não tiver IndexedDB, o jogo segue normalmente.
 */
import { monthLabel, serialize, type GameState } from '../engine';

export interface Snapshot { key: string; createdAt: string; name: string; monthIdx: number; monthLabel: string; savedAt: string; text?: string }

const DB = 'pbs', STORE = 'snapshots';
function db(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'key' }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
function all(d: IDBDatabase): Promise<Snapshot[]> {
  return new Promise((resolve) => { const r = d.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess = () => resolve(r.result as Snapshot[]); r.onerror = () => resolve([]); });
}

export async function saveSnapshot(s: GameState): Promise<void> {
  const d = await db(); if (!d) return;
  const idx = s.month.year * 12 + s.month.month;
  const snap: Snapshot = { key: `${s.createdAt}|${idx}`, createdAt: s.createdAt, name: s.character.name, monthIdx: idx, monthLabel: monthLabel(s.month), savedAt: new Date().toISOString(), text: serialize(s) };
  await new Promise<void>((res) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(snap); tx.oncomplete = () => res(); tx.onerror = () => res(); });
  // poda: últimos 6 meses + janeiros (até 12) desta partida; no máximo 5 partidas diferentes
  const list = (await all(d)).sort((a, b) => b.monthIdx - a.monthIdx);
  const mine = list.filter((x) => x.createdAt === s.createdAt);
  const keep = new Set(mine.slice(0, 6).map((x) => x.key));
  mine.filter((x) => x.monthIdx % 12 === 1).slice(0, 12).forEach((x) => keep.add(x.key));
  const games = [...new Set(list.map((x) => x.createdAt))];
  const others = games.filter((g) => g !== s.createdAt).slice(0, 4);
  const drop = list.filter((x) => (x.createdAt === s.createdAt ? !keep.has(x.key) : !others.includes(x.createdAt)));
  if (drop.length) await new Promise<void>((res) => { const tx = d.transaction(STORE, 'readwrite'); drop.forEach((x) => tx.objectStore(STORE).delete(x.key)); tx.oncomplete = () => res(); tx.onerror = () => res(); });
}

/** Lista sem o texto (leve), mais recentes primeiro. */
export async function listSnapshots(): Promise<Snapshot[]> {
  const d = await db(); if (!d) return [];
  return (await all(d)).map(({ text: _t, ...r }) => r).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
export async function snapshotText(key: string): Promise<string | null> {
  const d = await db(); if (!d) return null;
  return new Promise((resolve) => { const r = d.transaction(STORE).objectStore(STORE).get(key); r.onsuccess = () => resolve((r.result as Snapshot | undefined)?.text ?? null); r.onerror = () => resolve(null); });
}

// ---- lembrete de exportar ----
const EXP = (createdAt: string) => `pbs_last_export_${createdAt}`;
export function markExported(s: GameState) { try { localStorage.setItem(EXP(s.createdAt), String(s.month.year * 12 + s.month.month)); } catch { /* ok */ } }
/** Meses de jogo desde a última exportação (ou desde o início, se nunca exportou). */
export function monthsSinceExport(s: GameState): number {
  const now = s.month.year * 12 + s.month.month;
  try { const v = localStorage.getItem(EXP(s.createdAt)); if (v) return now - Number(v); } catch { /* ok */ }
  return now - (2027 * 12 + 1);
}
