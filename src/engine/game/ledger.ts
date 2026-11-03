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
  { key: 'credibility', label: 'Credibilidade pessoal', get: (s) => s.player.credibility ?? 60, set: (s, v) => (s.player.credibility = v) },
  { key: 'relationExec', label: 'Relação com o Executivo', get: (s) => (s.player.mandate?.upper ? s.player.mandate.upper.relationGov : s.player.mandate?.relationExecutive ?? 0), set: (s, v) => { const m = s.player.mandate; if (!m) return; if (m.upper) m.upper.relationGov = v; else m.relationExecutive = v; } },
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

export interface MonthReportItem { key: string; label: string; total: number; money: boolean; causes: { cause: string; delta: number }[] }

/**
 * Resumo do mês que acabou (Fase 6): soma das variações por indicador, com as principais causas.
 * Chamado ao fim de advanceMonth: as entradas do mês antigo (ações) e do novo (processamento) formam o ciclo.
 */
export function buildMonthReport(s: GameState, old: { year: number; month: number }): MonthReportItem[] {
  const a = monthIndex(old);
  const b = monthIndex(s.month);
  const entries = s.ledger.filter((e) => { const m = monthIndex(e.month); return m === a || m === b; });
  const out: MonthReportItem[] = [];
  for (const t of TRACKED) {
    const es = entries.filter((e) => e.indicator === t.key);
    if (!es.length) continue;
    const total = es.reduce((x, e) => x + e.delta, 0);
    const min = t.money ? 100 : t.key === 'followers' ? 50 : 0.3;
    if (Math.abs(total) < min) continue;
    const byCause = new Map<string, number>();
    for (const e of es) byCause.set(e.cause, (byCause.get(e.cause) ?? 0) + e.delta);
    const causes = [...byCause].map(([cause, delta]) => ({ cause, delta: Math.round(delta * 100) / 100 })).filter((c) => Math.abs(c.delta) >= min / 3).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 3);
    out.push({ key: t.key, label: t.label, total: Math.round(total * 100) / 100, money: !!t.money, causes });
  }
  return out.sort((x, y) => (x.money === y.money ? 0 : x.money ? 1 : -1));
}
