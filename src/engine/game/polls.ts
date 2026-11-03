// Pesquisas eleitorais (Módulo 09). Institutos FICTÍCIOS.
// Regra real usada: pesquisas divulgadas no ano eleitoral precisam de registro na Justiça Eleitoral
// até 5 dias antes da divulgação (Lei 9.504/97 art. 33). Margem de erro: fórmula estatística padrão
// (95% de confiança, p = 0,5). O "resultado verdadeiro" é a intenção simulada naquele mês.

import { normal, int, pick, type RngState } from '../rng';
import { monthIndex } from '../calendar';
import { currentMayorShares } from './elections';
import type { GameState, Poll } from './types';

export const INSTITUTES = ['Instituto Pulso (fictício)', 'DataCidade (fictício)', 'Opinar Pesquisas (fictício)'];

export function marginOfError(n: number): number {
  return Math.round(1.96 * Math.sqrt(0.25 / n) * 1000) / 10;
}

export function makeMayorPoll(s: GameState, rng: RngState): Poll | null {
  return makeRacePoll(s, rng, currentMayorShares(s), 'prefeito', s.month.year * 12 + 2);
}

/** Pesquisa de 1º turno para qualquer cargo majoritário (prefeito, governador, senador). */
export function makeRacePoll(s: GameState, rng: RngState, shares: { id: string; name: string; label: string; share: number }[], race: 'prefeito' | 'governador' | 'senador', start: number): Poll | null {
  if (shares.length < 2) return null;
  const t = monthIndex(s.month);
  const end = s.month.year * 12 + 8; // setembro do ano eleitoral
  const progress = Math.max(0, Math.min(1, (t - start) / (end - start)));
  const undecided = 0.4 - 0.28 * progress + normal(rng, 0, 0.015);
  const n = pick(rng, [800, 1092, 1204, 1600, 2000]);
  const house = shares.map(() => normal(rng, 0, 0.008));
  const raw = shares.map((c, i) => Math.max(0, (1 - undecided) * c.share + normal(rng, 0, Math.sqrt((c.share * (1 - c.share)) / n)) + house[i]));
  return {
    month: { ...s.month },
    institute: pick(rng, INSTITUTES),
    registration: `SP-${String(int(rng, 1000, 99999)).padStart(5, '0')}/${s.month.year}`,
    sample: n,
    marginOfError: marginOfError(n),
    undecided: Math.max(0.03, undecided),
    results: shares.map((c, i) => ({ id: c.id, name: c.name, label: c.label, share: raw[i] })).sort((a, b) => b.share - a.share),
    scenario: '1º turno',
    race,
  };
}

export function makeRunoffPoll(s: GameState, rng: RngState, a: { id: string; name: string; label: string; w: number }, b: { id: string; name: string; label: string; w: number }, race: 'prefeito' | 'governador' = 'prefeito'): Poll {
  const n = pick(rng, [1092, 1204, 1600]);
  const u = 0.1 + normal(rng, 0, 0.01);
  const pa = a.w / (a.w + b.w);
  const obsA = (1 - u) * pa + normal(rng, 0, Math.sqrt((pa * (1 - pa)) / n));
  return {
    month: { ...s.month },
    institute: pick(rng, INSTITUTES),
    registration: `SP-${String(int(rng, 1000, 99999)).padStart(5, '0')}/${s.month.year}`,
    sample: n,
    marginOfError: marginOfError(n),
    undecided: u,
    race,
    results: [
      { id: a.id, name: a.name, label: a.label, share: obsA },
      { id: b.id, name: b.name, label: b.label, share: 1 - u - obsA },
    ].sort((x, y) => y.share - x.share),
    scenario: '2º turno',
  };
}
