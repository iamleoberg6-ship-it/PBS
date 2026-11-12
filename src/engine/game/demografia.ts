/**
 * Fase 16 — Os números dos mapas andam com o tempo.
 *
 * POPULAÇÃO (DERIVADA): população do Censo 2022 (data de referência: 1º/08/2022) projetada com a taxa geométrica
 * anual de cada área entre os Censos 2010 e 2022 (IBGE). Subprefeituras usam a taxa da capital (não há série
 * por subprefeitura no jogo).
 *
 * IDHM (ESTIMATIVA DO JOGO): parte do último IDHM municipal oficial (2010, Atlas Brasil — PNUD/IPEA/FJP) e soma só
 * as mudanças SIMULADAS desde o início da partida. O jogo não inventa a trajetória 2010→2027 (não há IDHM municipal
 * oficial depois de 2010).
 *  - Renda: fórmula oficial do IDHM-Renda (PNUD): R = [ln(renda) − ln(8)] / [ln(4.033,33) − ln(8)]; logo uma variação
 *    de renda vira ΔR = ln(renda_agora / renda_base) / ln(4.033,33 / 8). Brasil/UF: renda média da região (simulada a
 *    partir da PNAD). Estado de SP: a renda não é simulada por região; usa-se a desocupação estadual como aproximação
 *    (PARÂMETRO: cada 10% a mais de desocupação ≈ −0,003 em R).
 *  - Longevidade e educação: elasticidades de jogo (PARÂMETRO) sobre a mortalidade infantil e o Ideb simulados:
 *    10% menos mortalidade infantil ≈ +0,004 em L; 10% mais Ideb ≈ +0,010 em E.
 *  - Investimento: investimento regional do governador e verbas federais levadas pelo jogador a cada região
 *    (PARÂMETRO: até +0,02 no componente mais fraco, proporcional ao valor por habitante).
 *  - IDHM = raiz cúbica do produto dos três componentes (fórmula do PNUD).
 */
import type { GameState } from './types';
import { indicatorById, indicatorValue } from './indicators';
import { POP_RATE_BR, POP_RATE_CAPITAL, POP_RATE_RG, POP_RATE_UF, STATE_REGION_STATS, UF_REGION, UF_STATS, type AreaStats } from '../data/maps';
import { BR_REGIONS } from './national';

/** Anos desde a data de referência do Censo 2022 (1º de agosto). */
export const yearsSinceCensus = (s: GameState) => s.month.year + (s.month.month - 8) / 12 - 2022;
export const projectPop = (s: GameState, pop2022: number, rate: number) => Math.round(pop2022 * Math.pow(1 + rate, yearsSinceCensus(s)));

export const rgPop = (s: GameState, rg: string) => projectPop(s, STATE_REGION_STATS[rg]?.pop ?? 0, POP_RATE_RG[rg] ?? 0);
export const ufPop = (s: GameState, uf: string) => projectPop(s, UF_STATS[uf]?.pop ?? 0, POP_RATE_UF[uf] ?? POP_RATE_BR);
export const capitalAreaPop = (s: GameState, pop2022: number) => projectPop(s, pop2022, POP_RATE_CAPITAL);
export const brRegionPop = (s: GameState, region: string) => Object.entries(UF_REGION).filter(([, r]) => r === region).reduce((a, [uf]) => a + ufPop(s, uf), 0);
export const brPop = (s: GameState) => BR_REGIONS.reduce((a, r) => a + brRegionPop(s, r), 0);

const ratio = (s: GameState, id: string) => { const d = indicatorById(id); if (!d) return 1; const v = indicatorValue(s, id); return d.base ? v / d.base : 1; };
const R_SPAN = Math.log(4033.33 / 8);
/** Renda média inicial por grande região (PNAD Contínua, ponto de partida do jogo). */
const BASE_INCOME: Record<string, number> = { norte: 2846, nordeste: 2475, centro_oeste: 4046, sudeste: 4033, sul: 4036 };

export interface IdhmEst { idhm: number; e: number; l: number; r: number; base: AreaStats; delta: { e: number; l: number; r: number } }
const geo = (e: number, l: number, r: number) => Math.cbrt(e * l * r);
const cap = (x: number) => Math.max(0, Math.min(1, x));

function invBoost(base: AreaStats, reaisPerCapita: number) {
  const b = Math.min(0.02, reaisPerCapita / 50000);
  const comps: ['e' | 'l' | 'r', number][] = [['e', base.idhm_e], ['l', base.idhm_l], ['r', base.idhm_r]];
  const weakest = comps.sort((a, c) => a[1] - c[1])[0][0];
  return { e: weakest === 'e' ? b : 0, l: weakest === 'l' ? b : 0, r: weakest === 'r' ? b : 0 };
}

/** IDHM estimado de uma região intermediária do estado de SP. */
export function rgIdhm(s: GameState, rg: string): IdhmEst | null {
  const base = STATE_REGION_STATS[rg]; if (!base) return null;
  const dl = -0.04 * (ratio(s, 'e_mortinf') - 1);
  const de = 0.1 * (ratio(s, 'e_ideb') - 1);
  const dr = -0.03 * (ratio(s, 'e_desemp') - 1);
  const inv = Number(s.flags[`invRG_${rg}`] ?? 0);
  const ib = invBoost(base, (inv * 1e6) / Math.max(1, rgPop(s, rg)));
  const e = cap(base.idhm_e + de + ib.e), l = cap(base.idhm_l + dl + ib.l), r = cap(base.idhm_r + dr + ib.r);
  return { idhm: geo(e, l, r), e, l, r, base, delta: { e: e - base.idhm_e, l: l - base.idhm_l, r: r - base.idhm_r } };
}

/** IDHM estimado de uma UF (indicadores nacionais + renda da grande região). */
export function ufIdhm(s: GameState, uf: string): IdhmEst | null {
  const base = UF_STATS[uf]; if (!base) return null;
  const reg = UF_REGION[uf];
  const dl = -0.04 * (ratio(s, 'b_mortinf') - 1);
  const de = 0.1 * (ratio(s, 'b_ideb') - 1);
  const inc = s.national?.regions?.[reg]?.income;
  const dr = inc && BASE_INCOME[reg] ? Math.log(inc / BASE_INCOME[reg]) / R_SPAN : 0;
  const funds = s.national?.funds?.[reg] ?? 0;
  const ib = invBoost(base, (funds * 1e6) / Math.max(1, brRegionPop(s, reg)));
  const e = cap(base.idhm_e + de + ib.e), l = cap(base.idhm_l + dl + ib.l), r = cap(base.idhm_r + dr + ib.r);
  return { idhm: geo(e, l, r), e, l, r, base, delta: { e: e - base.idhm_e, l: l - base.idhm_l, r: r - base.idhm_r } };
}

export const DEMO_RULES = [
  '[REAL] População: Censo 2022 (IBGE) e taxa anual de cada área entre os Censos 2010 e 2022; a projeção para os anos do jogo é DERIVADA (repete a tendência da década).',
  '[REAL] IDHM de partida: Atlas do Desenvolvimento Humano 2010 (último IDHM municipal oficial). IDHM = raiz cúbica do produto de educação, longevidade e renda (PNUD).',
  '[REAL] IDHM-Renda: R = [ln(renda) − ln(8)] / [ln(4.033,33) − ln(8)] (metodologia do Atlas 2013).',
  '[JOGO] O IDHM estimado só muda com o que a simulação produz desde o início da partida: mortalidade infantil, Ideb, desocupação/renda, investimentos regionais e verbas federais (elasticidades são parâmetros do jogo).',
];
