// Perfil de governo da IA (Fase 9b): quando quem governa é um PERSONAGEM DO JOGO (prefeito, governador ou presidente
// fictício), as escolhas automáticas seguem a ideologia do partido dele.
//
// Base: vetor ideológico do partido (data/ideology.ts — escala de especialistas, Bolognesi et al. 2025, com 7 eixos
// derivados). O que cada posição implica em política pública é PROPOSTA do jogo (tendências típicas, não regra):
//   · eixo fiscal (expansão ↔ disciplina): postura fiscal do ano;
//   · eixo econômico (intervenção ↔ mercado): carga tributária (aumentar/manter/reduzir) e tamanho do gasto;
//   · eixos social, segurança e ambiente: prioridades de área.
// Pessoas reais no cargo (prefeito, governador e presidente em exercício de verdade) NÃO são simuladas por dentro:
// o jogo não decide por elas — os indicadores seguem só a tendência e a economia de fundo.

import { partyIdeology } from '../data/ideology';
import { next, normal, type RngState } from '../rng';
import type { GameState } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

export type GovArea = 'saude' | 'educacao' | 'seguranca' | 'social' | 'habitacao' | 'mobilidade' | 'infraestrutura' | 'ambiente' | 'cultura';
export interface GovProfile {
  classified: boolean;
  fiscal: 'expansao' | 'neutra' | 'ajuste';
  tax: 'aumentar' | 'manter' | 'reduzir';
  security: 'preventiva' | 'equilibrada' | 'punitiva';
  /** Peso de cada área (1 = neutro; 0,8–1,3). */
  priority: Record<GovArea, number>;
  summary: string;
}

const AREAS: GovArea[] = ['saude', 'educacao', 'seguranca', 'social', 'habitacao', 'mobilidade', 'infraestrutura', 'ambiente', 'cultura'];
export const GOV_AREA_LABEL: Record<GovArea, string> = { saude: 'saúde', educacao: 'educação', seguranca: 'segurança', social: 'assistência e renda', habitacao: 'habitação', mobilidade: 'mobilidade', infraestrutura: 'infraestrutura', ambiente: 'meio ambiente', cultura: 'cultura' };

export function profileForParty(partyId: string | null | undefined): GovProfile {
  const v = partyId ? partyIdeology(partyId) : null;
  const eco = v?.economia ?? null; // −100 intervenção … +100 mercado
  const fis = v?.fiscal ?? null; // −100 expansão … +100 disciplina
  const soc = v?.social ?? null; // −100 progressismo … +100 conservadorismo
  const seg = v?.seguranca ?? null; // −100 prevenção social … +100 punitivo
  const amb = v?.ambiente ?? null; // −100 preservação … +100 exploração
  const priority = Object.fromEntries(AREAS.map((a) => [a, 1])) as Record<GovArea, number>;
  if (eco === null) return { classified: false, fiscal: 'neutra', tax: 'manter', security: 'equilibrada', priority, summary: 'Partido sem classificação ideológica na fonte: governo de perfil neutro.' };
  const k = (x: number | null) => (x ?? 0) / 100; // −1…1
  // Mais intervenção → mais peso em assistência, habitação, saúde e educação; mais mercado → infraestrutura e mobilidade (concessões).
  priority.social += -k(eco) * 0.25;
  priority.habitacao += -k(eco) * 0.2;
  priority.saude += -k(eco) * 0.1;
  priority.educacao += -k(eco) * 0.1;
  priority.infraestrutura += k(eco) * 0.2;
  priority.mobilidade += k(eco) * 0.1;
  priority.seguranca += k(seg) * 0.25;
  priority.cultura += -k(soc) * 0.2;
  priority.ambiente += -k(amb) * 0.25;
  for (const a of AREAS) priority[a] = Math.max(0.75, Math.min(1.3, priority[a]));
  const fiscal = k(fis) > 0.3 ? 'ajuste' : k(fis) < -0.3 ? 'expansao' : 'neutra';
  const tax = k(eco) > 0.35 ? 'reduzir' : k(eco) < -0.45 ? 'aumentar' : 'manter';
  const security = k(seg) > 0.3 ? 'punitiva' : k(seg) < -0.3 ? 'preventiva' : 'equilibrada';
  const top = [...AREAS].sort((a, b) => priority[b] - priority[a]).slice(0, 3).map((a) => GOV_AREA_LABEL[a]);
  const summary = `${fiscal === 'ajuste' ? 'Disciplina fiscal' : fiscal === 'expansao' ? 'Expansão de gastos' : 'Postura fiscal neutra'}; ${tax === 'reduzir' ? 'quer reduzir impostos (e o gasto)' : tax === 'aumentar' ? 'aceita mais impostos, com foco nos mais ricos, para gastar mais' : 'mantém a carga tributária'}; segurança ${security}; prioridades: ${top.join(', ')}.`;
  return { classified: true, fiscal, tax, security, priority, summary };
}

/** Quem governa cada esfera, e se o jogo simula as decisões (só personagens do jogo). */
export function governments(s: GameState) {
  const mayor = s.government.mayor;
  const playerMayor = s.player.mandate?.office === 'prefeito';
  const gov = s.stateWorld.governor;
  const pres = s.stateWorld.president;
  return {
    cidade: { name: playerMayor ? s.character.name : mayor.name, partyId: playerMayor ? s.player.partyId : mayor.partyId, isPlayer: playerMayor, real: !playerMayor && mayor.real, office: 'Prefeito(a) de São Paulo' },
    estado: { name: gov.isPlayer ? s.character.name : gov.name, partyId: gov.partyId, isPlayer: !!gov.isPlayer, real: !gov.isPlayer && gov.real, office: 'Governador(a) de SP' },
    brasil: { name: pres.isPlayer ? s.character.name : pres.name, partyId: pres.partyId, isPlayer: !!pres.isPlayer, real: !pres.isPlayer && pres.real, office: 'Presidente da República' },
  };
}
export const aiModeled = (h: { isPlayer: boolean; real: boolean }) => !h.isPlayer && !h.real;
export const mayorProfile = (s: GameState) => { const g = governments(s).cidade; return aiModeled(g) ? profileForParty(g.partyId) : null; };
export const governorProfile = (s: GameState) => { const g = governments(s).estado; return aiModeled(g) ? profileForParty(g.partyId) : null; };
export const presidentProfile = (s: GameState) => { const g = governments(s).brasil; return aiModeled(g) ? profileForParty(g.partyId) : null; };

/** Áreas das secretarias municipais → área do perfil. */
const SEC_AREA: Record<string, GovArea> = { saude: 'saude', educacao: 'educacao', seguranca: 'seguranca', assistencia: 'social', habitacao: 'habitacao', mobilidade: 'mobilidade', subprefeituras: 'infraestrutura', meioambiente: 'ambiente', cultura: 'cultura', esportes: 'cultura' };
export const secretariatPriority = (s: GameState, portfolio: string) => mayorProfile(s)?.priority[SEC_AREA[portfolio] ?? 'saude'] ?? 1;

/** Áreas do governo estadual (as mesmas do modelo do governador jogador). */
const STATE_AREA_MAP: Record<string, GovArea> = { seguranca: 'seguranca', saude: 'saude', educacao: 'educacao', mobilidade: 'mobilidade', habitacao: 'habitacao' };
/** Índices do governo estadual quando o governador é personagem do jogo (0–100). */
export function stateGovIndices(s: GameState): Record<string, number> | null {
  return governorProfile(s) ? (s.stateWorld.govIndices ?? null) : null;
}

const FED_AREA: Record<string, GovArea> = { saude: 'saude', educacao: 'educacao', seguranca: 'seguranca', infraestrutura: 'infraestrutura', ambiente: 'ambiente', social: 'social' };

/** Passo mensal dos governos da IA com perfil ideológico. */
export function aiGovernmentsStep(s: GameState, rng: RngState): string[] {
  const notes: string[] = [];
  // Estado: governador personagem do jogo.
  const gp = governorProfile(s);
  const w = s.stateWorld;
  if (gp) {
    const ind = (w.govIndices ??= Object.fromEntries(Object.keys(STATE_AREA_MAP).map((a) => [a, 50])));
    for (const [a, area] of Object.entries(STATE_AREA_MAP)) {
      const target = 50 + (gp.priority[area] - 1) * 60 + (gp.fiscal === 'ajuste' ? -2 : gp.fiscal === 'expansao' ? 2 : 0);
      ind[a] = clamp(ind[a] + (target - ind[a]) * 0.03 + normal(rng, 0, 0.6));
    }
    if (s.month.month === 1 && next(rng) < 0.5) {
      const best = Object.entries(STATE_AREA_MAP).sort((a, b) => gp.priority[b[1]] - gp.priority[a[1]])[0];
      notes.push(`Governo do estado (${w.governor.name}, personagem do jogo) anuncia o ano: prioridade em ${GOV_AREA_LABEL[best[1]]}. ${gp.summary}`);
    }
  } else if (w.govIndices && !w.governor.isPlayer) w.govIndices = undefined;
  // União: presidente personagem do jogo.
  const pp = presidentProfile(s);
  if (pp && s.federal) {
    const f = s.federal;
    for (const [k, area] of Object.entries(FED_AREA)) {
      const key = k as keyof typeof f.indices;
      f.indices[key] = clamp(f.indices[key] + (pp.priority[area] - 1) * 0.25);
    }
    const ec = f.economy;
    if (pp.tax === 'reduzir') { ec.growth += 0.004; ec.primary -= 0.004; f.indices.social = clamp(f.indices.social - 0.05); }
    if (pp.tax === 'aumentar') { ec.growth -= 0.002; ec.primary += 0.004; f.indices.social = clamp(f.indices.social + 0.08); }
  }
  return notes;
}

export const GOVPROFILE_RULES = [
  'Prefeito, governador ou presidente que é PERSONAGEM DO JOGO governa conforme a ideologia do seu partido: postura fiscal, carga tributária e prioridades de área (PROPOSTA, derivada da escala ideológica de especialistas).',
  'Disciplina fiscal: mais contingenciamento e confiança do mercado; expansão: mais gasto e crescimento de curto prazo, com mais dívida.',
  'Reduzir impostos ajuda o crescimento e piora o resultado fiscal, com menos dinheiro para programas sociais; aumentar impostos faz o contrário. Mudança de tributo municipal ou estadual precisa de lei aprovada pelo Legislativo e respeita a anterioridade (CF art. 150, III, b e c).',
  'Pessoas reais em exercício (o prefeito, o governador e o presidente reais) não são simuladas por dentro: o jogo não decide por elas. Nesses mandatos, os indicadores seguem só a tendência de fundo e a economia.',
];
