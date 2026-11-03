// Câmara Municipal: composição nominal e eleição da Mesa.
// Regra observada na CMSP: mandato da Mesa de 1 ano (eleição em 1º/01 no início da legislatura
// e em dezembro para o ano seguinte — ex.: 01/01/2025 e 15/12/2025). Confirmar no Regimento Interno.

import { next, type RngState } from '../rng';
import { SP_COUNCILLORS_2024, COUNCIL_FACTS, COUNCILLOR_BIRTHS } from '../data/world';
import { partyById } from '../data/parties';
import type { Councillor, GameState } from './types';

export function initialCouncillors(): Councillor[] {
  return SP_COUNCILLORS_2024.map((c) => {
    const b = COUNCILLOR_BIRTHS[c.name];
    return { id: c.id, name: c.name, partyId: c.partyId, real: true, votes: c.votes2024, electedIn: 2024, birthDate: b?.date ?? null, birthPrecision: b?.precision ?? null };
  });
}

export function seatsByParty(cs: Councillor[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cs) out[c.partyId] = (out[c.partyId] ?? 0) + 1;
  return out;
}

export function councillorFacts(id: string): string[] {
  const base = SP_COUNCILLORS_2024.find((c) => c.id === id);
  if (!base) return [];
  return [
    `Eleito(a) vereador(a) de São Paulo em 2024 pelo ${partyById(base.partyId)?.acronym}, com ${base.votes2024.toLocaleString('pt-BR')} votos.`,
    ...(COUNCIL_FACTS[id] ?? []),
  ];
}

/** Eleição da Mesa pela IA: favorece vereadores dos partidos da base do prefeito e os mais votados. */
export function aiElectMesa(s: GameState, year: number, rng: RngState): string {
  const coalition = new Set(s.government.mayorCoalition);
  const pool = s.government.councillors.filter((c) => c.id !== 'character_player');
  const weights = pool.map((c) => (coalition.has(c.partyId) ? 3 : 1) * Math.pow(c.votes, 0.3) * (0.2 + next(rng) * 1.6));
  let best = 0;
  for (let i = 1; i < pool.length; i++) if (weights[i] > weights[best]) best = i;
  const winner = pool[best];
  s.government.councilPresident = { personId: winner.id, name: winner.name, partyId: winner.partyId, real: winner.real, year, simulated: true };
  s.flags[`mesa_${year}`] = true;
  if (s.player.mandate) s.player.mandate.councilPresident = false;
  return `Eleição da Mesa (simulada): ${winner.name} (${partyById(winner.partyId)?.acronym}) presidirá a Câmara em ${year}.`;
}
