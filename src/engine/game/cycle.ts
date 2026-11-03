// Calendário dos ciclos eleitorais (Fase 5). Eleições municipais em 2028, 2032, 2036…;
// eleições gerais em 2030, 2034… (CF art. 29 e art. 77/28: mandatos de 4 anos, eleições a cada 2 anos alternadas).
// Os anos seguintes a 2028 usam a legislação vigente em 2026 (projeção — ver rulepack).

import { monthIndex } from '../calendar';
import { genRulepack, munRulepack } from '../data/rulepack';
import type { GameState } from './types';

export const mi = (y: number, m: number) => y * 12 + (m - 1);
export const FIRST_MUN = 2028;
export const FIRST_GEN = 2030;
/** Fim da partida: dezembro de 2036 (cobre as eleições municipais de 2032 e as gerais de 2034 e o mandato 2033–2036). */
export const LAST_YEAR = 2036;

export const isMunYear = (y: number) => y >= FIRST_MUN && (y - FIRST_MUN) % 4 === 0;
export const isGenYear = (y: number) => y >= FIRST_GEN && (y - FIRST_GEN) % 4 === 0;

/** Ciclo municipal corrente: o ano da eleição cujos eleitos ainda não tomaram posse (posse em janeiro do ano seguinte). */
export function munCycle(t: number): number {
  let y = FIRST_MUN;
  while (mi(y + 1, 1) < t) y += 4;
  return y;
}

/** Ciclo geral corrente (a última posse do ciclo é a da Alesp, em março do ano seguinte). */
export function genCycle(t: number): number {
  let y = FIRST_GEN;
  while (mi(y + 1, 3) < t) y += 4;
  return y;
}

export const munCycleOf = (s: GameState) => munCycle(monthIndex(s.month));
export const genCycleOf = (s: GameState) => genCycle(monthIndex(s.month));

/** Próxima eleição (municipal ou geral) cujas convenções ainda não passaram. */
export function nextElection(t: number): { year: number; kind: 'municipal' | 'geral' } {
  let y = Math.floor(t / 12);
  if (t > mi(y, 7)) y += 1;
  while (!isMunYear(y) && !isGenYear(y)) y += 1;
  return { year: y, kind: isMunYear(y) ? 'municipal' : 'geral' };
}

/** Mandato municipal em curso: anos de início e fim. */
export function munTerm(t: number): { from: number; to: number } {
  const y = munCycle(t);
  // Se a eleição deste ciclo ainda não aconteceu, o mandato vigente é o anterior.
  const from = t >= mi(y + 1, 1) ? y + 1 : y - 3;
  return { from, to: from + 3 };
}

export function munPack(s: GameState) {
  return munRulepack(munCycleOf(s));
}
export function genPack(s: GameState) {
  return genRulepack(genCycleOf(s));
}

/** Número da legislatura da Câmara Municipal de SP (19ª = 2025–2028; PROPOSTA de contagem: +1 a cada 4 anos). */
export function councilLegislatureNumber(fromYear: number): number {
  return 19 + Math.round((fromYear - 2025) / 4);
}
