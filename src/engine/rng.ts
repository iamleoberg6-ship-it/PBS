// Gerador pseudoaleatório determinístico (mulberry32).
// O estado inteiro fica no save, então a mesma partida + mesmas escolhas = mesmos resultados.

export interface RngState {
  seed: number;
  state: number;
}

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0, state: seed >>> 0 };
}

export function next(rng: RngState): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function range(rng: RngState, min: number, max: number): number {
  return min + (max - min) * next(rng);
}

export function int(rng: RngState, min: number, maxInclusive: number): number {
  return Math.floor(range(rng, min, maxInclusive + 1));
}

export function pick<T>(rng: RngState, items: readonly T[]): T {
  return items[Math.floor(next(rng) * items.length)];
}

/** Aproximação normal (Box-Muller). */
export function normal(rng: RngState, mean = 0, sd = 1): number {
  const u = Math.max(next(rng), 1e-12);
  const v = next(rng);
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Pareto para concentrar votos em poucos candidatos, como na vida real. */
export function pareto(rng: RngState, alpha: number): number {
  return 1 / Math.pow(Math.max(next(rng), 1e-9), 1 / alpha);
}
