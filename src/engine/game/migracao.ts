/**
 * Fase 16b — Migração entre estados, entre as regiões do estado de SP e com o exterior.
 *
 * A projeção de população (demografia.ts) repete a taxa de 2010–2022, que JÁ inclui a migração daquela década.
 * Este módulo soma só o DESVIO causado pelo que a simulação produz: se uma área melhora mais que as outras
 * (emprego, renda, IDHM, segurança), atrai gente; se piora, perde. É MECÂNICA DO JOGO (PARÂMETROS abaixo),
 * não estimativa oficial.
 *
 * - Entre UFs (soma zero): atratividade = −0,12 × (variação da desocupação em p.p.) + 1,2 × ln(renda agora/renda
 *   inicial), em % da população ao ano, comparada com a média do país. UFs usam a sua grande região; SP usa a
 *   desocupação estadual e a segurança (homicídios) simuladas.
 * - Entre regiões intermediárias de SP (soma zero): 20 × (variação do IDHM estimado − média), em % ao ano.
 * - Exterior: saldo = −0,05 × (variação da desocupação nacional em p.p.) + 0,5 × ln(renda/renda inicial), em % ao
 *   ano. Desemprego 3 p.p. acima do início ≈ −0,15% da população por ano (≈ 300 mil pessoas).
 */
import type { GameState } from './types';
import { indicatorById, indicatorValue } from './indicators';
import { BR_REGIONS, BR_REGION_BASE } from './national';
import { MAP_STATE, UF_REGION } from '../data/maps';
import { pushNews } from './news';

export interface MigrationState {
  uf: Record<string, number>; // saldo acumulado (pessoas) desde o início da partida, por UF (inclui exterior)
  rg: Record<string, number>; // saldo acumulado entre regiões de SP (soma zero dentro do estado)
  intl: number; // saldo acumulado com o exterior (Brasil)
  year: { uf: Record<string, number>; rg: Record<string, number>; intl: number }; // ano corrente
  lastYear: { uf: Record<string, number>; rg: Record<string, number>; intl: number; year: number } | null;
}

const empty = (): MigrationState['year'] => ({ uf: {}, rg: {}, intl: 0 });
export function initMigration(): MigrationState { return { uf: {}, rg: {}, intl: 0, year: empty(), lastYear: null }; }

const ratio = (s: GameState, id: string) => { const d = indicatorById(id); return d?.base ? indicatorValue(s, id) / d.base : 1; };
const delta = (s: GameState, id: string) => { const d = indicatorById(id); return d ? indicatorValue(s, id) - d.base : 0; };

/** Atratividade de cada UF (% da população ao ano, antes de comparar com a média). */
export function ufAttractiveness(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [uf, reg] of Object.entries(UF_REGION)) {
    const now = s.national?.regions?.[reg]; const base = BR_REGION_BASE[reg];
    let du = now ? now.unemployment - base.unemployment : 0;
    const dinc = now ? Math.log(now.income / base.income) : 0;
    let a = 0;
    if (uf === 'SP') { du = delta(s, 'e_desemp'); a += -0.05 * (ratio(s, 'e_homic') - 1); }
    a += -0.12 * du + 1.2 * dinc;
    out[uf] = a;
  }
  return out;
}

/** Saldo com o exterior (% da população ao ano). */
export function intlRate(s: GameState): number {
  const du = delta(s, 'b_desemp');
  const tot = BR_REGIONS.reduce((x, r) => x + BR_REGION_BASE[r].population, 0);
  const dinc = BR_REGIONS.reduce((x, r) => { const n = s.national?.regions?.[r]; return x + (n ? Math.log(n.income / BR_REGION_BASE[r].income) : 0) * BR_REGION_BASE[r].population / tot; }, 0);
  return -0.05 * du + 0.5 * dinc;
}

/**
 * Passo mensal. Recebe funções de população (sem migração) para não criar dependência circular com demografia.ts.
 */
export function migrationMonthlyStep(s: GameState, basePop: { uf: (uf: string) => number; rg: (rg: string) => number }, rgIdhmDelta: (rg: string) => number): string[] {
  const m = (s.migration ??= initMigration());
  const notes: string[] = [];
  if (s.month.month === 1 && (Object.keys(m.year.uf).length || m.year.intl)) {
    m.lastYear = { ...m.year, year: s.month.year - 1 };
    const ly = m.lastYear;
    if (Math.abs(ly.intl) >= 100_000) {
      notes.push(`Migração (estimativa do jogo): em ${ly.year}, o saldo com o exterior foi de ${ly.intl > 0 ? '+' : '−'}${Math.round(Math.abs(ly.intl) / 1000)} mil pessoas.`);
      pushNews(s, s.rng, { section: 'Brasil', headline: ly.intl < 0 ? `Mais brasileiros deixam o país em busca de emprego (simulação)` : `Saldo migratório do Brasil fica positivo (simulação)`, lead: `Estimativa do jogo para ${ly.year}: ${Math.round(Math.abs(ly.intl) / 1000)} mil pessoas ${ly.intl < 0 ? 'a menos' : 'a mais'}, puxadas pelo emprego e pela renda.`, aboutPlayer: false, tone: 'neutro' });
    }
    const sp = ly.uf.SP ?? 0;
    if (Math.abs(sp) >= 50_000) notes.push(`Migração (estimativa do jogo): São Paulo ${sp > 0 ? 'ganhou' : 'perdeu'} ${Math.round(Math.abs(sp) / 1000)} mil moradores para outros estados em ${ly.year}.`);
    m.year = empty();
  }
  // ---- entre UFs (soma zero) + exterior ----
  const A = ufAttractiveness(s);
  const pops = Object.fromEntries(Object.keys(UF_REGION).map((uf) => [uf, basePop.uf(uf) + (m.uf[uf] ?? 0)]));
  const tot = Object.values(pops).reduce((a, b) => a + b, 0) || 1;
  const mean = Object.entries(A).reduce((a, [uf, v]) => a + v * pops[uf] / tot, 0);
  const intlPct = intlRate(s);
  for (const uf of Object.keys(UF_REGION)) {
    const flow = pops[uf] * ((A[uf] - mean) + intlPct) / 100 / 12;
    m.uf[uf] = (m.uf[uf] ?? 0) + flow;
    m.year.uf[uf] = (m.year.uf[uf] ?? 0) + flow;
  }
  const intlFlow = tot * intlPct / 100 / 12;
  m.intl += intlFlow; m.year.intl += intlFlow;
  // ---- entre regiões de SP (soma zero) ----
  const rgs = MAP_STATE.shapes.map((x) => x.id);
  const rp = Object.fromEntries(rgs.map((r) => [r, basePop.rg(r)]));
  const rtot = Object.values(rp).reduce((a, b) => a + b, 0) || 1;
  const d = Object.fromEntries(rgs.map((r) => [r, rgIdhmDelta(r)]));
  const dmean = rgs.reduce((a, r) => a + d[r] * rp[r] / rtot, 0);
  for (const r of rgs) {
    const flow = rp[r] * 20 * (d[r] - dmean) / 100 / 12;
    m.rg[r] = (m.rg[r] ?? 0) + flow;
    m.year.rg[r] = (m.year.rg[r] ?? 0) + flow;
  }
  return notes;
}

export const MIGRATION_RULES = [
  '[JOGO] A projeção de população já repete a migração de 2010–2022. O jogo soma o desvio causado pela partida: áreas que melhoram mais que as outras atraem gente, as que pioram perdem.',
  '[JOGO] Entre estados: −0,12 × variação da desocupação (p.p.) + 1,2 × variação logarítmica da renda, em % da população ao ano, comparado com a média do país. SP usa a desocupação e a segurança estaduais simuladas.',
  '[JOGO] Entre regiões do estado de SP: 20 × (variação do IDHM estimado − média do estado), em % ao ano.',
  '[JOGO] Exterior: −0,05 × variação da desocupação nacional (p.p.) + 0,5 × variação logarítmica da renda, em % ao ano. São estimativas do jogo, não dados oficiais.',
];
