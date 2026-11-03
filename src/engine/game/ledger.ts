// Livro de causas (Plano de Evolução §12.4): toda variação relevante de indicador fica registrada
// com o motivo, para o jogador consultar "por que mudou?". Funciona por fotografia antes/depois.

import { monthIndex } from '../calendar';
import type { GameState } from './types';

export const TRACKED: { key: string; label: string; get: (s: GameState) => number; set: (s: GameState, v: number) => void; money?: boolean }[] = [
  { key: 'recognition', label: 'Reconhecimento', get: (s) => s.player.recognition, set: (s, v) => (s.player.recognition = v) },
  { key: 'base', label: 'Base social', get: (s) => s.player.base, set: (s, v) => (s.player.base = v) },
  { key: 'popularity', label: 'Popularidade', get: (s) => s.character.attributes.popularity, set: (s, v) => (s.character.attributes.popularity = v) },
  { key: 'internalPopularity', label: 'Popularidade interna', get: (s) => s.player.partyRel.internalPopularity, set: (s, v) => (s.player.partyRel.internalPopularity = v) },
  { key: 'leadershipTrust', label: 'Confiança da direção', get: (s) => s.player.partyRel.leadershipTrust, set: (s, v) => (s.player.partyRel.leadershipTrust = v) },
  { key: 'partyInfluence', label: 'Influência no partido', get: (s) => s.player.partyRel.influence, set: (s, v) => (s.player.partyRel.influence = v) },
  { key: 'perceivedLoyalty', label: 'Fidelidade percebida', get: (s) => s.player.partyRel.perceivedLoyalty, set: (s, v) => (s.player.partyRel.perceivedLoyalty = v) },
  { key: 'mobilization', label: 'Mobilização', get: (s) => s.player.partyRel.mobilization, set: (s, v) => (s.player.partyRel.mobilization = v) },
  { key: 'approval', label: 'Aprovação do mandato', get: (s) => s.player.mandate?.approval ?? 0, set: (s, v) => { if (s.player.mandate) s.player.mandate.approval = v; } },
  { key: 'communication', label: 'Comunicação', get: (s) => s.character.attributes.communication, set: (s, v) => (s.character.attributes.communication = v) },
  { key: 'charisma', label: 'Carisma', get: (s) => s.character.attributes.charisma, set: (s, v) => (s.character.attributes.charisma = v) },
  { key: 'negotiation', label: 'Negociação', get: (s) => s.character.attributes.negotiation, set: (s, v) => (s.character.attributes.negotiation = v) },
  { key: 'leadership', label: 'Liderança', get: (s) => s.character.attributes.leadership, set: (s, v) => (s.character.attributes.leadership = v) },
  { key: 'management', label: 'Gestão', get: (s) => s.character.attributes.management, set: (s, v) => (s.character.attributes.management = v) },
  { key: 'politicalKnowledge', label: 'Conhecimento político', get: (s) => s.character.attributes.politicalKnowledge, set: (s, v) => (s.character.attributes.politicalKnowledge = v) },
  { key: 'articulation', label: 'Articulação', get: (s) => s.character.attributes.articulation, set: (s, v) => (s.character.attributes.articulation = v) },
  { key: 'campaignPoints', label: 'Força de campanha', get: (s) => s.player.candidacy?.campaignPoints ?? 0, set: (s, v) => { if (s.player.candidacy) s.player.candidacy.campaignPoints = v; } },
  { key: 'followers', label: 'Seguidores (soma)', get: (s) => Object.values(s.player.social.networks).reduce((a, b) => a + b, 0), set: () => undefined },
  { key: 'cash', label: 'Caixa pessoal', get: (s) => s.finances.cash, set: (s, v) => (s.finances.cash = v), money: true },
];

export type Snapshot = Record<string, number>;

export function snapshot(s: GameState): Snapshot {
  const out: Snapshot = {};
  for (const t of TRACKED) out[t.key] = t.get(s);
  return out;
}

export function recordDiff(s: GameState, before: Snapshot, cause: string): void {
  for (const t of TRACKED) {
    const d = t.get(s) - before[t.key];
    const min = t.money ? 1 : t.key === 'followers' ? 1 : 0.05;
    if (Math.abs(d) >= min) s.ledger.push({ month: { ...s.month }, indicator: t.key, delta: Math.round(d * 100) / 100, cause });
  }
  if (s.ledger.length > 900) s.ledger.splice(0, s.ledger.length - 900);
}

/** Executa `fn` registrando no livro de causas tudo o que ela mudou. */
export function withCauses<T>(s: GameState, cause: string, fn: () => T): T {
  const before = snapshot(s);
  const r = fn();
  recordDiff(s, before, cause);
  return r;
}

export function causesFor(s: GameState, indicator: string, months = 2) {
  const now = monthIndex(s.month);
  return s.ledger.filter((e) => e.indicator === indicator && now - monthIndex(e.month) < months);
}

export function labelOf(key: string): string {
  return TRACKED.find((t) => t.key === key)?.label ?? key;
}
