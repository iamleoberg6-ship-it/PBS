// Campanha territorial (Fase 4): regiões, segmentos, plano, equipe, comunicação, financiamento,
// pesquisas internas, prestação de contas e consequências jurídicas.
//
// Modelo de voto (SIMULAÇÃO documentada): em cada região, a intenção do jogador é
//   conhecimento × avaliação × proximidade de temas × (1 − rejeição) × influência local.
// O fator territorial compara essa intenção com a de uma campanha sem trabalho regional e multiplica a força
// geral da candidatura. Dinheiro só converte em voto via conhecimento, e com retornos decrescentes.

import { next, normal, type RngState } from '../rng';
import { REGIONS, SEGMENTS, regionById, regionWeights, segmentById } from '../data/regions';
import { EXPERT_SCALE, generalPosition } from '../data/ideology';
import { GAMEPLAY } from '../data/rulepack';
import { PLAYER, adjustRel } from './relations';
import { BR_REGIONS, initNational, nationalIndex, type BrRegion } from './national';
import type { CampaignPlan, GameState, Poll, RegionCampaign } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const grow = (cur: number, gain: number) => clamp(cur + gain * Math.pow(1 - cur / 100, 1.3));

export const TEAM_ROLES = {
  coordenacao: { label: 'Coordenação de campanha', costV: 40000, costP: 900000, note: 'Organiza a agenda: visitas e eventos rendem mais.' },
  marketing: { label: 'Marketing e redes', costV: 50000, costP: 1500000, note: 'Propaganda e conteúdo convertem melhor em conhecimento.' },
  juridico: { label: 'Assessoria jurídica eleitoral', costV: 25000, costP: 400000, note: 'Reduz o risco de irregularidades e defende a candidatura.' },
  contabilidade: { label: 'Contabilidade eleitoral', costV: 15000, costP: 250000, note: 'Prestação de contas organizada (obrigatória por lei).' },
} as const;
export type TeamRole = keyof typeof TEAM_ROLES;

export const CAMPAIGN_RULES = [
  { tag: 'REAL', text: 'Limites de gastos de 2024 em São Paulo: prefeito R$ 67,3 mi (1º turno) e R$ 26,9 mi (2º turno); vereador R$ 2,07 mi. Os de 2028 serão divulgados pelo TSE até 20 de julho; o jogo projeta pela inflação.' },
  { tag: 'REAL', text: 'Gastar acima do limite gera multa de 100% do excesso, sem prejuízo de apuração de abuso de poder econômico (Lei 9.504/97, art. 18-B).' },
  { tag: 'REAL', text: 'Pessoas jurídicas não podem doar; pessoas físicas doam até 10% da renda bruta do ano anterior; autofinanciamento até 10% do limite (Lei 9.504/97, art. 23).' },
  { tag: 'REAL', text: 'FEFC e Fundo Partidário são recursos do partido, distribuídos por critérios internos; não se misturam com o dinheiro pessoal.' },
  { tag: 'REAL', text: 'Prestação de contas é obrigatória; contas desaprovadas e captação ilícita podem levar à cassação do diploma (Lei 9.504/97, arts. 28, 30 e 30-A; LC 64/90, art. 22).' },
  { tag: 'REAL', text: 'É vedado usar servidor público em campanha durante o expediente (Lei 9.504/97, art. 73, III).' },
  { tag: 'REAL', text: 'Pesquisas divulgadas precisam de registro até 5 dias antes; pesquisas internas, não divulgadas, não (Lei 9.504/97, art. 33).' },
  { tag: 'PARÂMETRO', text: 'Intenção regional = conhecimento × avaliação × temas × (1 − rejeição) × influência local; pesos e retornos decrescentes são parâmetros do jogo.' },
];

export function spendingLimit(office: string): number {
  switch (office) {
    case 'prefeito': return GAMEPLAY.spendingLimitPrefeitoSP.value;
    case 'deputado_estadual': return GAMEPLAY.spendingLimitDepEstadual.value;
    case 'deputado_federal': return GAMEPLAY.spendingLimitDepFederal.value;
    case 'senador': return GAMEPLAY.spendingLimitSenadorSP.value;
    case 'governador': return GAMEPLAY.spendingLimitGovernadorSP.value;
    case 'presidente': case 'vice_presidente': return GAMEPLAY.spendingLimitPresidente.value;
    default: return GAMEPLAY.spendingLimitVereadorSP.value;
  }
}

/** Boa vontade acumulada numa região da capital (−100..100). Afeta a próxima campanha (PROPOSTA). */
export function addGoodwill(s: GameState, region: string, v: number) {
  const g = (s.player.regionalGoodwill ??= {});
  g[region] = Math.max(-100, Math.min(100, (g[region] ?? 0) + v));
  const rc = s.player.candidacy?.plan?.regions[region];
  if (rc) {
    if (v > 0) { rc.presence = clamp(rc.presence + v * 0.5); rc.knowledge = clamp(rc.knowledge + v * 0.3); } else rc.rejection = clamp(rc.rejection - v * 0.6);
  }
}

// ---------------- Geografia da campanha ----------------
// Campanha municipal/estadual: as 8 regiões da capital. Campanha presidencial (presidente ou vice): as 5 grandes
// regiões do país, com peso pelo eleitorado real de 2026 (TSE). Prioridades das regiões do país são parâmetros de
// jogo inspirados nos indicadores (desemprego e renda da PNAD, cobertura de saneamento) — o jogo não atribui
// ideologia às regiões.

export const NATIONAL_THEMES = [
  { value: 'emprego', label: 'Emprego e renda' },
  { value: 'custo', label: 'Custo de vida e inflação' },
  { value: 'saude', label: 'Saúde (SUS)' },
  { value: 'educacao', label: 'Educação' },
  { value: 'seguranca', label: 'Segurança pública' },
  { value: 'social', label: 'Combate à pobreza' },
  { value: 'infraestrutura', label: 'Infraestrutura e saneamento' },
  { value: 'ambiente', label: 'Meio ambiente e clima' },
];
export const NATIONAL_THEME_LABEL: Record<string, string> = Object.fromEntries(NATIONAL_THEMES.map((t) => [t.value, t.label]));

const NATIONAL_PRIORITIES: Record<BrRegion, string[]> = {
  norte: ['infraestrutura', 'saude', 'emprego'],
  nordeste: ['emprego', 'social', 'educacao'],
  centro_oeste: ['infraestrutura', 'seguranca', 'custo'],
  sudeste: ['seguranca', 'saude', 'custo'],
  sul: ['custo', 'infraestrutura', 'saude'],
};
/** Temas municipais dos segmentos traduzidos para a pauta nacional. */
const SEG_THEME_NATIONAL: Record<string, string> = { mobilidade: 'infraestrutura', gcm: 'seguranca', habitacao: 'social', zeladoria: 'infraestrutura', cultura: 'educacao', meioambiente: 'ambiente', saude: 'saude', educacao: 'educacao' };

export interface CampaignArea { id: string; name: string; priorities: string[]; weight: number; detail: string }

export const isNationalCampaign = (s: GameState) => ['presidente', 'vice_presidente'].includes(s.player.candidacy?.office ?? '');

export function campaignAreas(s: GameState): CampaignArea[] {
  if (isNationalCampaign(s)) {
    const n = s.national ?? initNational();
    const tot = BR_REGIONS.reduce((a, r) => a + n.regions[r].electorate, 0);
    return BR_REGIONS.map((r) => ({ id: `br_${r}`, name: n.regions[r].name, priorities: NATIONAL_PRIORITIES[r], weight: n.regions[r].electorate / tot, detail: `${n.regions[r].states} · ${(n.regions[r].electorate / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi de eleitores` }));
  }
  const w = regionWeights();
  return REGIONS.map((r) => ({ id: r.id, name: r.name, priorities: r.priorities, weight: w[r.id], detail: `renda ${r.income} (parâmetro)` }));
}
export const areaName = (s: GameState, id: string) => campaignAreas(s).find((a) => a.id === id)?.name ?? regionById(id)?.name ?? id;
const areaPriorities = (id: string) => (id.startsWith('br_') ? NATIONAL_PRIORITIES[id.slice(3) as BrRegion] ?? [] : regionById(id)?.priorities ?? []);
export const campaignHome = (s: GameState) => (isNationalCampaign(s) ? 'br_sudeste' : s.player.homeRegion);

function initNationalPlan(s: GameState): CampaignPlan {
  const n = s.national ?? initNational();
  const pos = generalPosition(s.character.ideology) ?? 5;
  const extreme = Math.abs(pos - 5) * 4;
  const regions: Record<string, RegionCampaign> = {};
  for (const r of BR_REGIONS) {
    const p = n.player[r];
    const home = r === 'sudeste';
    regions[`br_${r}`] = {
      presence: clamp((home ? 15 + s.player.base * 0.2 : 3) + Math.min(25, n.funds[r] * 0.4)),
      knowledge: clamp(Math.max(3, p.recognition) + (home ? s.player.recognition * 0.25 : 0)),
      rejection: clamp(8 + extreme + Math.max(0, 50 - p.approval) * 0.4),
      leaders: home ? 1 : 0,
    };
  }
  return {
    regions, focus: ['br_sudeste'], themes: [], segments: [], tone: 'propositivo',
    team: { coordenacao: false, marketing: false, juridico: false, contabilidade: false },
    internalPolls: [], accountability: null,
  };
}

/** Plano atual, coerente com a geografia da candidatura (se o cargo mudou, o plano é refeito). */
export function currentPlan(s: GameState): CampaignPlan | null {
  const c = s.player.candidacy;
  if (!c?.plan) return null;
  const want = campaignAreas(s)[0].id;
  if (!c.plan.regions[want]) c.plan = initPlan(s);
  return c.plan;
}

// ---------------- Plano ----------------
export function initPlan(s: GameState): CampaignPlan {
  if (isNationalCampaign(s)) return initNationalPlan(s);
  const regions: Record<string, RegionCampaign> = {};
  const pos = generalPosition(s.character.ideology) ?? 5;
  const extreme = Math.abs(pos - 5) * 4;
  for (const r of REGIONS) {
    const home = r.id === s.player.homeRegion;
    // Fase 5: o trabalho de mandato (emendas, promessas cumpridas ou quebradas) deixa marca nas regiões.
    const gw = s.player.regionalGoodwill?.[r.id] ?? 0;
    regions[r.id] = {
      presence: clamp((home ? 25 + s.player.base * 0.4 : 5) + Math.max(0, gw) * 0.5),
      knowledge: clamp(s.player.recognition * 0.85 + (home ? s.player.base * 0.6 + 10 : 0) + Math.max(0, gw) * 0.3),
      rejection: clamp(8 + extreme + Math.max(0, (pos - 5) * r.lean * -6) + Math.max(0, -gw) * 0.6),
      leaders: home ? 1 : 0,
    };
  }
  return {
    regions, focus: [s.player.homeRegion], themes: [], segments: [], tone: 'propositivo',
    team: { coordenacao: false, marketing: false, juridico: false, contabilidade: false },
    internalPolls: [], accountability: null,
  };
}

export function ensurePlan(s: GameState): CampaignPlan | null {
  const c = s.player.candidacy;
  if (!c) return null;
  if (!c.plan) c.plan = initPlan(s);
  return currentPlan(s);
}

/** Avaliação geral do candidato (0–1). */
function appeal(s: GameState): number {
  const a = s.character.attributes;
  return Math.max(0.15, Math.min(1, (a.popularity * 0.4 + a.charisma * 0.3 + a.communication * 0.3) / 100 + 0.15 - (s.player.candidacy?.irregularities ?? 0) * 0.04));
}

export function themeFit(plan: CampaignPlan, regionId: string): number {
  const pr = areaPriorities(regionId);
  const nat = regionId.startsWith('br_');
  const hits = plan.themes.filter((t) => pr.includes(t)).length;
  const segHits = plan.segments.reduce((acc, sg) => acc + (segmentById(sg)?.themes.filter((t) => plan.themes.includes(nat ? SEG_THEME_NATIONAL[t] ?? t : t)).length ?? 0), 0);
  return 0.7 + hits * 0.15 + Math.min(0.15, segHits * 0.05) - (plan.themes.length === 0 ? 0.05 : 0);
}

export function regionalIntention(s: GameState, plan: CampaignPlan, regionId: string): number {
  const rc = plan.regions[regionId];
  const local = 0.6 + Math.min(0.5, rc.leaders * 0.1 + rc.presence / 250);
  return (rc.knowledge / 100) * appeal(s) * themeFit(plan, regionId) * (1 - rc.rejection / 100) * local;
}

/** Intenção de referência: candidatura com o mesmo reconhecimento, sem plano, sem temas e sem trabalho territorial. */
function baselineIntention(s: GameState): number {
  const rec = isNationalCampaign(s) ? (s.national ? nationalIndex(s, 'recognition') : s.player.recognition * 0.25) : s.player.recognition * 0.85;
  return (Math.max(5, rec) / 100) * appeal(s) * 0.65 * 0.88 * 0.62;
}

/** Fator territorial que multiplica a força geral da candidatura (limitado). */
export function campaignFactor(s: GameState): number {
  const plan = currentPlan(s);
  if (!plan) return 1;
  const avg = campaignAreas(s).reduce((acc, r) => acc + r.weight * regionalIntention(s, plan, r.id), 0);
  const f = avg / Math.max(0.005, baselineIntention(s));
  return Math.max(0.65, Math.min(1.45, Math.pow(f, 0.6)));
}

/** Distribui um total de votos do jogador pelas regiões, segundo a intenção regional. */
export function distributeVotes(s: GameState, total: number): Record<string, number> {
  const plan = currentPlan(s) ?? initPlan(s);
  const areas = campaignAreas(s);
  const raw = areas.map((r) => r.weight * Math.max(0.0001, regionalIntention(s, plan, r.id)));
  const tot = raw.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  let acc = 0;
  areas.forEach((r, i) => { out[r.id] = Math.round((total * raw[i]) / tot); acc += out[r.id]; });
  out[areas[areas.length - 1].id] += total - acc;
  return out;
}

/** Participação de cada candidato a prefeito por região (para pesquisas regionais e apuração). */
export function mayorRegionalShares(s: GameState, shares: { id: string; name: string; share: number; partyId?: string }[]): Record<string, { id: string; name: string; share: number }[]> {
  const plan = s.player.candidacy?.plan;
  const w = regionWeights();
  const playerAvg = plan ? REGIONS.reduce((a, r) => a + w[r.id] * regionalIntention(s, plan, r.id), 0) : 1;
  const out: Record<string, { id: string; name: string; share: number }[]> = {};
  for (const r of REGIONS) {
    const raw = shares.map((c) => {
      const pid = c.partyId ?? (c.id === PLAYER ? s.player.partyId : null);
      const p = pid ? EXPERT_SCALE[pid]?.value ?? 5 : 5;
      let m = Math.exp(0.6 * r.lean * ((p - 5) / 5));
      if (c.id === PLAYER && plan && playerAvg > 0) m *= Math.max(0.5, Math.min(1.8, regionalIntention(s, plan, r.id) / playerAvg));
      return c.share * m;
    });
    const tot = raw.reduce((a, b) => a + b, 0) || 1;
    out[r.id] = shares.map((c, i) => ({ id: c.id, name: c.name, share: raw[i] / tot })).sort((a, b) => b.share - a.share);
  }
  return out;
}

// ---------------- Ações ----------------
const efficiency = (plan: CampaignPlan) => (plan.team.coordenacao ? 1.25 : 1);

export function visitRegion(s: GameState, rng: RngState, regionId: string): string {
  const plan = ensurePlan(s)!;
  const rc = plan.regions[regionId];
  const a = s.character.attributes;
  const focus = plan.focus.includes(regionId) ? 1.2 : 1;
  const g = (6 + a.charisma / 15 + next(rng) * 4) * efficiency(plan) * focus;
  rc.presence = grow(rc.presence, g);
  rc.knowledge = grow(rc.knowledge, g * 0.8);
  s.player.candidacy!.campaignPoints += 1.5;
  return `${isNationalCampaign(s) ? 'Caravana pelo' : 'Agenda em'} ${areaName(s, regionId)}: presença +${g.toFixed(0)}, conhecimento do seu nome na região sobe.`;
}

export function recruitLeader(s: GameState, rng: RngState, regionId: string): string {
  const plan = ensurePlan(s)!;
  const rc = plan.regions[regionId];
  if (rc.leaders >= 5) return 'Você já tem o apoio das principais lideranças da região.';
  const a = s.character.attributes;
  const p = 0.3 + a.articulation / 250 + a.negotiation / 300 + rc.presence / 300 + s.player.base / 400;
  if (next(rng) < p) {
    rc.leaders += 1;
    rc.knowledge = grow(rc.knowledge, 4);
    return isNationalCampaign(s) ? `Governadores, prefeitos e lideranças do ${areaName(s, regionId)} (personagens do jogo) entraram no palanque. Apoios na região: ${rc.leaders}.` : `Uma liderança comunitária de ${areaName(s, regionId)} (personagem do jogo) declarou apoio. Lideranças na região: ${rc.leaders}.`;
  }
  return `As lideranças de ${areaName(s, regionId)} ainda não fecharam com você.`;
}

/** Custo de cada função da equipe: majoritárias pagam o valor "grande"; a presidencial, 5× (PROPOSTA). */
export function teamCost(s: GameState, role: TeamRole): number {
  const o = s.player.candidacy?.office ?? '';
  if (o === 'presidente' || o === 'vice_presidente') return TEAM_ROLES[role].costP * 5;
  return ['prefeito', 'governador', 'senador'].includes(o) ? TEAM_ROLES[role].costP : TEAM_ROLES[role].costV;
}

export function hireRole(s: GameState, role: TeamRole): string | number {
  const plan = ensurePlan(s)!;
  if (plan.team[role]) return 'Essa função já está contratada.';
  const c = s.player.candidacy!;
  const cost = teamCost(s, role);
  const bal = c.account.fefc + c.account.donations + c.account.ownFunds + (c.account.fundoPartidario ?? 0) - c.account.spent;
  if (bal < cost) return `Saldo de campanha insuficiente (precisa de R$ ${cost.toLocaleString('pt-BR')}).`;
  c.account.spent += cost;
  addCategory(c.account, 'pessoal', cost);
  plan.team[role] = true;
  return cost;
}

export function addCategory(acc: { byCategory?: Record<string, number> }, cat: string, v: number) {
  acc.byCategory ??= {};
  acc.byCategory[cat] = (acc.byCategory[cat] ?? 0) + v;
}

export function mediaPush(s: GameState, rng: RngState, channel: 'digital' | 'impresso' | 'tv'): string {
  const plan = ensurePlan(s)!;
  const segs = plan.segments.length ? plan.segments.map((x) => segmentById(x)!) : SEGMENTS;
  const key = channel === 'impresso' ? 'rua' : channel;
  const reach = segs.reduce((a, sg) => a + sg.channels[key] * sg.share, 0) / segs.reduce((a, sg) => a + sg.share, 0);
  const mk = plan.team.marketing ? 1.3 : 1;
  const comm = s.character.attributes.communication;
  const g = (3 + comm / 25 + next(rng) * 2) * reach * mk;
  for (const r of campaignAreas(s)) plan.regions[r.id].knowledge = grow(plan.regions[r.id].knowledge, g * (plan.focus.includes(r.id) ? 1.3 : 0.8));
  if (plan.tone === 'ataque') for (const r of campaignAreas(s)) plan.regions[r.id].rejection = clamp(plan.regions[r.id].rejection + 1.5);
  return `Comunicação (${channel === 'digital' ? 'redes e impulsionamento' : channel === 'tv' ? 'rádio e TV' : 'material impresso e carro de som'}): alcance de ${Math.round(reach * 100)}% no público-alvo; conhecimento +${g.toFixed(1)}.`;
}

export function attackOpponent(s: GameState, rng: RngState): string {
  const plan = ensurePlan(s)!;
  const office = s.player.candidacy!.office;
  const race = (office === 'prefeito' ? s.mayorRace : office === 'presidente' ? s.stateWorld.presidentRace : office === 'governador' ? s.stateWorld.governorRace : null)?.filter((r) => !r.isPlayer) ?? [];
  const target = race.length ? [...race].sort((a, b) => b.baseStrength - a.baseStrength)[0] : null;
  const ok = next(rng) < 0.45 + s.character.attributes.communication / 300;
  for (const r of campaignAreas(s)) plan.regions[r.id].rejection = clamp(plan.regions[r.id].rejection + (ok ? 1.5 : 4));
  if (target && ok) {
    target.baseStrength *= 0.94;
    return `Campanha de contraste contra ${target.name}: o adversário perdeu terreno, mas sua rejeição também subiu.`;
  }
  if (ok) { s.player.candidacy!.campaignPoints += 2; return 'Contraste com os adversários repercutiu bem na sua base; a rejeição subiu um pouco.'; }
  return `O ataque foi visto como baixaria: sua rejeição subiu ${isNationalCampaign(s) ? 'no país inteiro' : 'em toda a cidade'}.`;
}

export function internalPoll(s: GameState, rng: RngState): string {
  const plan = ensurePlan(s)!;
  const byRegion: Record<string, number> = {};
  const areas = campaignAreas(s);
  for (const r of areas) byRegion[r.id] = Math.max(0, regionalIntention(s, plan, r.id) * 100 + normal(rng, 0, 1.2));
  const overall = areas.reduce((a, r) => a + r.weight * byRegion[r.id], 0);
  const rejection = areas.reduce((a, r) => a + r.weight * plan.regions[r.id].rejection, 0);
  plan.internalPolls.push({ month: { ...s.month }, byRegion, overall, rejection });
  const best = [...areas].sort((a, b) => byRegion[b.id] - byRegion[a.id]);
  return `Pesquisa interna (não divulgada, sem registro): melhor desempenho em ${best[0].name} e ${best[1].name}; pior em ${best[best.length - 1].name}. Rejeição média ${rejection.toFixed(0)}%.`;
}

export function requestPartyFund(s: GameState, rng: RngState): string {
  const c = s.player.candidacy!;
  if ((c.account.fundoPartidario ?? 0) > 0) return 'O partido já fez o repasse do Fundo Partidário para sua campanha.';
  const pr = s.player.partyRel;
  const p = 0.2 + pr.leadershipTrust / 160 + pr.influence / 250;
  if (next(rng) < p) {
    const v = Math.round((c.office === 'prefeito' ? 2_000_000 : 20_000) * (0.5 + pr.leadershipTrust / 100));
    c.account.fundoPartidario = v;
    if (s.partyOrgs[s.player.partyId!]) adjustRel(s, s.partyOrgs[s.player.partyId!].directorate.presidentId, PLAYER, { owed: -1 });
    return `O partido repassou R$ ${v.toLocaleString('pt-BR')} do Fundo Partidário (critério interno da direção). A direção vai lembrar disso.`;
  }
  return 'A direção priorizou outras candidaturas no repasse do Fundo Partidário.';
}

// ---------------- Passo mensal e pós-eleição ----------------
export function campaignMonthlyStep(s: GameState) {
  const plan = currentPlan(s);
  if (!plan) return;
  const nat = isNationalCampaign(s);
  for (const r of campaignAreas(s)) {
    const rc = plan.regions[r.id];
    const floor = nat ? (s.national?.player[r.id.slice(3) as BrRegion]?.recognition ?? 3) : s.player.recognition * 0.85;
    rc.knowledge = clamp(rc.knowledge + (floor - rc.knowledge) * 0.05);
    rc.presence = clamp(rc.presence * 0.95);
    rc.rejection = clamp(rc.rejection + (10 - rc.rejection) * 0.03);
  }
  // Campanha presidencial: o que o eleitor de cada região aprende sobre você fica (reconhecimento nacional).
  if (nat && s.national) for (const r of BR_REGIONS) {
    const p = s.national.player[r];
    const k = plan.regions[`br_${r}`]?.knowledge ?? 0;
    if (k > p.recognition) p.recognition = clamp(p.recognition + (k - p.recognition) * 0.06);
  }
  const home = plan.regions[campaignHome(s)];
  if (home) home.knowledge = grow(home.knowledge, s.player.base / (nat ? 120 : 40));
}

/** Prestação de contas à Justiça Eleitoral (dezembro do ano eleitoral). */
export function judgeAccounts(s: GameState, rng: RngState): string | null {
  const c = s.player.candidacy;
  if (!c || c.status !== 'registrada') return null;
  const plan = ensurePlan(s)!;
  if (plan.accountability) return null;
  const notes: string[] = [];
  const limit = spendingLimit(c.office);
  let status: 'aprovadas' | 'aprovadas_ressalvas' | 'desaprovadas' = 'aprovadas';
  if (c.account.spent > limit) {
    const fine = Math.round(c.account.spent - limit);
    s.finances.cash -= fine;
    notes.push(`Gasto acima do limite: multa de R$ ${fine.toLocaleString('pt-BR')} (100% do excesso).`);
    status = 'desaprovadas';
  }
  if (c.irregularities > 0) {
    if (next(rng) < 0.5 + c.irregularities * 0.15 - (plan.team.juridico ? 0.2 : 0)) { status = 'desaprovadas'; notes.push('Recursos sem origem declarada (caixa dois) identificados.'); }
  }
  if (status === 'aprovadas' && !plan.team.contabilidade && next(rng) < 0.45) { status = 'aprovadas_ressalvas'; notes.push('Falhas formais na escrituração, sem gravidade (faltou contabilidade dedicada).'); }
  plan.accountability = { status, notes };
  // Guardado para a fase judicial (a candidatura é encerrada na posse).
  s.flags.contasCampanha = status;
  s.flags.irregCampanha = c.irregularities;
  s.flags.juridicoCampanha = plan.team.juridico;
  if (status === 'desaprovadas') s.character.attributes.popularity = clamp(s.character.attributes.popularity - 4);
  return `Prestação de contas de campanha: ${status === 'aprovadas' ? 'aprovadas' : status === 'aprovadas_ressalvas' ? 'aprovadas com ressalvas' : 'DESAPROVADAS'}${notes.length ? ` — ${notes.join(' ')}` : ''}.`;
}

/** Ação de investigação judicial eleitoral (AIJE/art. 30-A): risco de cassação de quem se elegeu com irregularidades. */
export function electoralLawsuit(s: GameState, rng: RngState): string | null {
  const y = Number(s.flags.lastElectionYear ?? 2028);
  const rec = s.elections.find((e) => e.year === y) ?? s.generalElections?.find((e) => e.year === y);
  if (!rec?.playerElected) return null;
  const irreg = Number(s.flags.irregCampanha ?? 0);
  const desaprov = s.flags.contasCampanha === 'desaprovadas';
  if (irreg < 2 && !desaprov) return null;
  const p = 0.15 + irreg * 0.12 + (desaprov ? 0.15 : 0) - (s.flags.juridicoCampanha ? 0.15 : 0);
  if (next(rng) < p) {
    s.flags.cassado = true;
    return 'CASSAÇÃO: a Justiça Eleitoral julgou procedente a ação por captação e gasto ilícito de recursos (Lei 9.504/97, art. 30-A) e cassou seu diploma.';
  }
  return 'A ação eleitoral contra sua campanha foi julgada improcedente por falta de provas.';
}

export function pickHomeRegion(rng: RngState): string {
  const w = regionWeights();
  let x = next(rng);
  for (const r of REGIONS) { x -= w[r.id]; if (x <= 0) return r.id; }
  return REGIONS[0].id;
}

/** Cortes regionais de uma pesquisa presidencial: o jogador varia conforme a campanha em cada região; os demais, não (sem viés ideológico regional). */
export function enrichNationalPoll(s: GameState, poll: Poll) {
  const plan = currentPlan(s);
  const areas = campaignAreas(s);
  const avg = plan ? areas.reduce((a, r) => a + r.weight * regionalIntention(s, plan, r.id), 0) : 1;
  const out: Record<string, { id: string; share: number }[]> = {};
  for (const r of areas) {
    const raw = poll.results.map((c) => c.share * (c.id === PLAYER && plan && avg > 0 ? Math.max(0.4, Math.min(2, regionalIntention(s, plan, r.id) / avg)) : 1));
    const tot = raw.reduce((a, b) => a + b, 0) || 1;
    out[r.id] = poll.results.map((c, i) => ({ id: c.id, share: (raw[i] / tot) * (1 - poll.undecided) })).sort((a, b) => b.share - a.share).slice(0, 3);
  }
  poll.byRegion = out;
}

/** Acréscimos de uma pesquisa de prefeito: rejeição, conhecimento, avaliação do governo e cortes regionais. */
export function enrichMayorPoll(s: GameState, rng: RngState, poll: Poll) {
  const ids = poll.results.map((r) => r.id);
  poll.rejection = {};
  poll.knowledge = {};
  const plan = s.player.candidacy?.plan;
  const w = regionWeights();
  for (const id of ids) {
    if (id === PLAYER && plan) {
      poll.rejection[id] = Math.min(0.8, REGIONS.reduce((a, r) => a + w[r.id] * plan.regions[r.id].rejection, 0) / 100 + normal(rng, 0, 0.01));
      poll.knowledge[id] = Math.min(0.99, REGIONS.reduce((a, r) => a + w[r.id] * plan.regions[r.id].knowledge, 0) / 100);
    } else {
      const share = poll.results.find((r) => r.id === id)!.share;
      poll.knowledge[id] = Math.min(0.97, 0.45 + share * 1.6 + normal(rng, 0, 0.03));
      poll.rejection[id] = Math.max(0.05, Math.min(0.6, 0.12 + share * 0.7 + normal(rng, 0, 0.03)));
    }
  }
  const appr = s.player.mandate?.office === 'prefeito' ? s.player.mandate.approval : s.city?.approval ?? 50;
  const good = Math.max(0.05, Math.min(0.75, appr / 100 - 0.12 + normal(rng, 0, 0.015)));
  const bad = Math.max(0.05, Math.min(0.75, (100 - appr) / 100 - 0.2 + normal(rng, 0, 0.015)));
  poll.govEval = { good, bad, regular: Math.max(0, 1 - good - bad) };
  const parties = new Map((s.mayorRace ?? []).map((r) => [r.id, r.partyId]));
  const reg = mayorRegionalShares(s, poll.results.map((r) => ({ id: r.id, name: r.name, share: r.share, partyId: parties.get(r.id) })));
  poll.byRegion = Object.fromEntries(Object.entries(reg).map(([k, v]) => [k, v.slice(0, 3).map((x) => ({ id: x.id, share: x.share * (1 - poll.undecided) }))]));
}


