// Brasil por grandes regiões (pós-Fase 6): a esfera federal do jogo.
//
// Quem chega à Câmara dos Deputados ou ao Senado passa a votar e a destinar recursos para o país inteiro.
// O mandato continua sendo de SÃO PAULO — quem reelege é o eleitorado paulista —, mas o parlamentar ganha
// (ou perde) projeção nacional, região por região.
//
// [REAL] População por grande região: IBGE, Censo 2022.
// [REAL] Eleitorado apto em 2026: TSE (jul/2026).
// [REAL] Taxa de desocupação: IBGE, PNAD Contínua, 4º trimestre de 2025.
// [REAL] Rendimento médio real habitual: IBGE, PNAD Contínua 2025 (trimestres indicados em SOURCES).
// [REAL] Emendas individuais de parlamentares federais podem ser destinadas a entes de qualquer lugar do país
//        (não há restrição ao estado de origem do parlamentar).
// [PROPOSTA] Reconhecimento e aprovação do jogador por região, impacto regional das matérias fictícias da pauta,
//        efeito de emendas e de agendas e a evolução mensal dos indicadores são mecânicas de jogo.
//        O jogo NÃO atribui ideologia às regiões: o impacto de cada matéria é econômico/social (quem é afetado),
//        e a reação ao voto vem desse impacto — eleitorado nenhum é tratado como bloco homogêneo.

import { next, normal, type RngState } from '../rng';
import type { GameState } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

export type BrRegion = 'norte' | 'nordeste' | 'sudeste' | 'sul' | 'centro_oeste';
export const BR_REGIONS: BrRegion[] = ['norte', 'nordeste', 'centro_oeste', 'sudeste', 'sul'];

export interface BrRegionData {
  id: BrRegion;
  name: string;
  states: string;
  population: number;
  electorate: number;
  /** Taxa de desocupação (%), dinâmica a partir do dado real. */
  unemployment: number;
  /** Rendimento médio real habitual (R$), dinâmico a partir do dado real. */
  income: number;
}

export interface NationalState {
  regions: Record<BrRegion, BrRegionData>;
  /** Projeção do jogador em cada região (0–100). */
  player: Record<BrRegion, { recognition: number; approval: number }>;
  /** Recursos federais que o jogador levou a cada região (R$ mi). */
  funds: Record<BrRegion, number>;
}

const BASE: Record<BrRegion, Omit<BrRegionData, 'id'>> = {
  norte: { name: 'Norte', states: 'AC, AP, AM, PA, RO, RR, TO', population: 17_349_619, electorate: 13_109_354, unemployment: 5.8, income: 2846 },
  nordeste: { name: 'Nordeste', states: 'AL, BA, CE, MA, PB, PE, PI, RN, SE', population: 54_644_582, electorate: 43_529_845, unemployment: 7.1, income: 2475 },
  centro_oeste: { name: 'Centro-Oeste', states: 'DF, GO, MT, MS', population: 16_287_809, electorate: 11_997_001, unemployment: 3.9, income: 4046 },
  sudeste: { name: 'Sudeste', states: 'ES, MG, RJ, SP', population: 84_847_187, electorate: 66_329_375, unemployment: 4.8, income: 4033 },
  sul: { name: 'Sul', states: 'PR, RS, SC', population: 29_933_315, electorate: 22_861_012, unemployment: 3.1, income: 4036 },
};

export const NATIONAL_SOURCES = {
  population: 'IBGE, Censo Demográfico 2022 — população residente por grande região.',
  electorate: 'TSE, eleitorado apto para as Eleições 2026 (divulgação de julho de 2026).',
  unemployment: 'IBGE, PNAD Contínua — taxa de desocupação do 4º trimestre de 2025 (Norte: 5,8%, estável no trimestre).',
  income: 'IBGE, PNAD Contínua — rendimento médio real habitual: Norte e Sudeste no 4º tri/2025; Sul e Centro-Oeste no 3º tri/2025; Nordeste, média anual de 2025 (BNB/ETENE sobre a PNAD).',
  rules: 'Emendas individuais federais podem ir para entes de qualquer região do país (sem vínculo com o estado do parlamentar).',
};

export function initNational(): NationalState {
  const regions = Object.fromEntries(BR_REGIONS.map((id) => [id, { id, ...BASE[id] }])) as Record<BrRegion, BrRegionData>;
  const player = Object.fromEntries(BR_REGIONS.map((id) => [id, { recognition: 0, approval: 50 }])) as NationalState['player'];
  const funds = Object.fromEntries(BR_REGIONS.map((id) => [id, 0])) as Record<BrRegion, number>;
  return { regions, player, funds };
}

export const isBrRegion = (id: string) => id.startsWith('br_') && (BR_REGIONS as string[]).includes(id.slice(3));
export const brId = (id: string) => id.replace(/^br_/, '') as BrRegion;
export const brName = (id: string) => BASE[brId(id)]?.name ?? id;

export function isFederal(s: GameState) {
  const o = s.player.mandate?.office;
  return o === 'deputado_federal' || o === 'senador';
}

/** Projeção nacional (média ponderada pelo eleitorado de cada região). */
export function nationalIndex(s: GameState, key: 'recognition' | 'approval') {
  const n = s.national;
  if (!n) return 0;
  const tot = BR_REGIONS.reduce((a, r) => a + n.regions[r].electorate, 0);
  return BR_REGIONS.reduce((a, r) => a + n.player[r][key] * n.regions[r].electorate, 0) / tot;
}

/** Ao tomar posse em Brasília: quem é conhecido em SP já parte com alguma projeção no Sudeste. */
export function startFederalProjection(s: GameState) {
  const n = (s.national ??= initNational());
  n.player.sudeste.recognition = Math.max(n.player.sudeste.recognition, s.player.recognition * 0.22);
  for (const r of BR_REGIONS) if (r !== 'sudeste') n.player[r].recognition = Math.max(n.player[r].recognition, 1 + s.player.recognition * 0.03);
}

/** Muda a aprovação numa região, com peso maior onde o jogador é mais conhecido. */
function nudge(s: GameState, r: BrRegion, delta: number) {
  const p = s.national!.player[r];
  const reach = 0.35 + p.recognition / 100;
  p.approval = clamp(p.approval + delta * reach);
}

/** Impacto regional (PROPOSTA) das matérias federais fictícias: −1..+1, quem é afetado. */
export const REGIONAL_IMPACT: Record<string, Partial<Record<BrRegion, number>>> = {
  'Medida provisória que reajusta o Bolsa Família': { nordeste: 0.8, norte: 0.7, sudeste: 0.3, sul: 0.2, centro_oeste: 0.25 },
  'Isenção do Imposto de Renda para salários mais baixos': { norte: 0.5, nordeste: 0.5, sudeste: 0.5, sul: 0.5, centro_oeste: 0.5 },
  'Fim da escala 6x1': { norte: 0.3, nordeste: 0.3, sudeste: 0.3, sul: 0.3, centro_oeste: 0.3 },
  'Novo arcabouço de gastos para estados endividados': { sudeste: 0.5, sul: 0.4 },
  'Licenciamento ambiental simplificado': { centro_oeste: 0.3, norte: 0.1 },
  'Piso nacional da enfermagem: fonte de custeio': { norte: 0.3, nordeste: 0.3, sudeste: 0.3, sul: 0.3, centro_oeste: 0.3 },
  'Prorrogação dos incentivos fiscais da Zona Franca de Manaus': { norte: 0.8, sudeste: -0.1 },
  'Recursos para obras hídricas no semiárido': { nordeste: 0.8 },
  'Renegociação de dívidas rurais após perdas climáticas': { sul: 0.6, centro_oeste: 0.4 },
  'Fundo nacional de saneamento para municípios': { norte: 0.6, nordeste: 0.6, centro_oeste: 0.2 },
  'Ferrovias para escoamento da produção': { centro_oeste: 0.7, norte: 0.3 },
  'Fundo de reconstrução após enchentes': { sul: 0.7, sudeste: 0.2 },
};

/** Reação regional ao voto do jogador numa matéria federal e efeito da matéria aprovada nos indicadores. */
export function nationalVoteEffects(s: GameState, title: string, vote: 'S' | 'N' | 'A', publicSupport: number, salience: number, approved: boolean): string | null {
  if (!s.national || !isFederal(s)) return null;
  const imp = REGIONAL_IMPACT[title] ?? {};
  const w = 0.5 + salience / 100;
  const sign = vote === 'S' ? 1 : vote === 'N' ? -1 : 0;
  const moved: string[] = [];
  for (const r of BR_REGIONS) {
    const i = imp[r] ?? 0;
    const d = sign * (publicSupport * 0.8 + i * 2.2) * w;
    if (sign) nudge(s, r, d);
    if (Math.abs(d) >= 1.2) moved.push(`${BASE[r].name} ${d > 0 ? '▲' : '▼'}`);
    s.national.player[r].recognition = clamp(s.national.player[r].recognition + salience / 400);
    // Matéria aprovada mexe devagar nos indicadores das regiões afetadas (PROPOSTA).
    if (approved && i) {
      const reg = s.national.regions[r];
      reg.unemployment = Math.max(1.5, reg.unemployment - 0.04 * i);
      reg.income = Math.round(reg.income * (1 + 0.002 * i));
    }
  }
  return moved.length ? `repercussão regional: ${moved.join(', ')}` : null;
}

/** Emenda federal paga numa região fora de SP: projeção e um pequeno efeito no indicador local. */
export function nationalAmendmentPaid(s: GameState, region: string, value: number) {
  const n = (s.national ??= initNational());
  const r = brId(region);
  n.funds[r] += value;
  const p = n.player[r];
  p.recognition = clamp(p.recognition + Math.min(4, 0.6 + value / 8));
  nudge(s, r, Math.min(5, 1 + value / 6));
  n.regions[r].unemployment = Math.max(1.5, n.regions[r].unemployment - Math.min(0.03, value / 2000));
}

/** Agenda nacional: viagem, audiências e imprensa regional (ação de 1 compromisso). */
export function nationalAgenda(s: GameState, rng: RngState, region: string): string {
  const n = (s.national ??= initNational());
  const r = brId(region);
  const a = s.character.attributes;
  const gain = 2 + (a.communication + a.charisma) / 60 + next(rng);
  n.player[r].recognition = clamp(n.player[r].recognition + gain);
  nudge(s, r, 1 + a.charisma / 60);
  const u = s.player.mandate?.upper;
  if (u) u.awayFromBase = Math.min(20, u.awayFromBase + 1);
  return `Agenda no ${BASE[r].name}: audiências, visitas e entrevistas à imprensa regional. Reconhecimento na região +${gain.toFixed(1)}. Lembre: quem reelege você é o eleitorado de SP, e cada viagem afasta da base.`;
}

/** Passo mensal: esquecimento lento e oscilação dos indicadores. */
export function nationalMonthlyStep(s: GameState, rng: RngState) {
  const n = s.national;
  if (!n) return;
  const fed = isFederal(s);
  for (const r of BR_REGIONS) {
    const p = n.player[r];
    p.recognition = clamp(p.recognition - (fed ? 0.15 : 0.4));
    p.approval = clamp(p.approval + (50 - p.approval) * 0.01);
    const reg = n.regions[r];
    reg.unemployment = Math.max(1.5, Math.min(18, reg.unemployment + normal(rng, 0, 0.03)));
    reg.income = Math.round(reg.income * (1 + normal(rng, 0.0004, 0.0015)));
  }
}
