// Relações bilaterais entre personagens, com memória de acontecimentos relevantes (Plano §8.2 e §10.4).
// Só relações diferentes do neutro são guardadas (o save fica leve).

import type { GameState, MemoryEntry, Relation } from './types';

export const PLAYER = 'character_player';
const key = (from: string, to: string) => `${from}|${to}`;
const clamp = (v: number, a = -100, b = 100) => Math.max(a, Math.min(b, v));

export function rel(s: GameState, from: string, to: string): Relation {
  return s.relations[key(from, to)] ?? { trust: 0, affinity: 0, owed: 0, memory: [] };
}

export function adjustRel(
  s: GameState, from: string, to: string,
  d: { trust?: number; affinity?: number; owed?: number },
  memory?: Omit<MemoryEntry, 'month'>,
): Relation {
  const r = structuredClone(rel(s, from, to));
  r.trust = clamp(r.trust + (d.trust ?? 0));
  r.affinity = clamp(r.affinity + (d.affinity ?? 0));
  r.owed = clamp(r.owed + (d.owed ?? 0), -10, 10);
  if (memory) {
    r.memory.push({ ...memory, month: { ...s.month } });
    r.memory.sort((a, b) => b.weight - a.weight);
    r.memory = r.memory.slice(0, 8);
  }
  s.relations[key(from, to)] = r;
  return r;
}

/** Visão geral de `from` sobre `to`, −100..100 (média de confiança e afinidade, mais o peso das memórias). */
export function standing(s: GameState, from: string, to: string): number {
  const r = rel(s, from, to);
  const mem = r.memory.reduce((acc, m) => acc + (['traicao', 'promessa_quebrada', 'ataque', 'derrota_imposta'].includes(m.kind) ? -m.weight : m.weight), 0);
  return clamp((r.trust + r.affinity) / 2 + mem * 2);
}

/** Decaimento mensal: sentimentos voltam devagar ao neutro; memórias perdem peso, mas traições pesam por mais tempo. */
export function decayRelations(s: GameState): void {
  for (const [k, r] of Object.entries(s.relations)) {
    r.trust = Math.round(r.trust * 0.985 * 10) / 10;
    r.affinity = Math.round(r.affinity * 0.98 * 10) / 10;
    r.owed = Math.round(r.owed * 0.97 * 100) / 100;
    for (const m of r.memory) m.weight = Math.round(m.weight * (['traicao', 'promessa_quebrada'].includes(m.kind) ? 0.99 : 0.96) * 100) / 100;
    r.memory = r.memory.filter((m) => m.weight >= 0.5);
    if (Math.abs(r.trust) < 1 && Math.abs(r.affinity) < 1 && Math.abs(r.owed) < 0.1 && r.memory.length === 0) delete s.relations[k];
  }
}
