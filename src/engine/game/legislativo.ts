/**
 * Fase 15 — Trabalho legislativo de deputado(a) estadual, deputado(a) federal e senador(a):
 * comissão permanente, presidência de comissão, relatoria com parecer, liderança da bancada e CPI.
 * Governador(a): investimento por região intermediária do estado, com aprovação regional.
 *
 * REGRAS REAIS usadas:
 * - Comissões permanentes compostas pela representação proporcional dos partidos (CF art. 58 §1º; regimentos).
 *   Câmara dos Deputados: 30 comissões permanentes, presidências escolhidas por acordo de líderes e proporcionalidade,
 *   mandato de 1 ano. Senado: 16 comissões permanentes, presidências por 2 anos. Alesp: 21 comissões permanentes de 11
 *   ou 13 deputados, indicados pelos líderes, por 2 anos (Agência Câmara, Agência Senado, Alesp — 2023–2025).
 *   Nomes das comissões: listas oficiais (Alesp: dados abertos; Câmara e Senado: portais das casas). O jogo usa uma SELEÇÃO.
 * - CPI: requerimento de 1/3 dos membros, fato determinado e prazo certo (CF art. 58 §3º). Câmara: 171; Senado: 27.
 *   Alesp: 1/3 de 94 = 32 (aplicação por simetria; conferir na Constituição do Estado e no Regimento).
 * - Relator emite parecer na comissão; a comissão vota o parecer; a matéria segue ao plenário (regimentos).
 *
 * MECÂNICA DO JOGO (PROPOSTA): chances de conseguir comissão, presidência e liderança; frequência das relatorias;
 * efeitos dos pareceres; ritmo de assinaturas da CPI e duração de 4 meses; valores e efeitos do investimento regional.
 */
import { next, pick, type RngState } from '../rng';
import { HOUSE, TEMPLATES, benchOrientation, scaleCamaraSeats, senateSeatsApprox } from './pauta';
import { partyAlignment } from './general';
import { pushNews } from './news';
import { addImpulse } from './indicators';
import { STATE_REGION_STATS, MAP_STATE } from '../data/maps';
import type { FloorVote, GameState, UpperMandate } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
type HouseKey = 'alesp' | 'camara' | 'senado';

export interface UpperCommitteeDef { id: string; sigla: string; name: string; themes: string[] }
export const UPPER_COMMITTEES: Record<HouseKey, UpperCommitteeDef[]> = {
  alesp: [
    { id: 'CCJR', sigla: 'CCJR', name: 'Comissão de Constituição, Justiça e Redação', themes: ['instituicoes'] },
    { id: 'CFOP', sigla: 'CFOP', name: 'Comissão de Finanças, Orçamento e Planejamento', themes: ['economia'] },
    { id: 'CS', sigla: 'CS', name: 'Comissão de Saúde', themes: ['saude'] },
    { id: 'CEC', sigla: 'CEC', name: 'Comissão de Educação e Cultura', themes: ['educacao'] },
    { id: 'CSPAP', sigla: 'CSPAP', name: 'Comissão de Segurança Pública e Assuntos Penitenciários', themes: ['seguranca'] },
    { id: 'CTC', sigla: 'CTC', name: 'Comissão de Transportes e Comunicações', themes: ['mobilidade', 'tecnologia'] },
    { id: 'CI', sigla: 'CI', name: 'Comissão de Infraestrutura', themes: ['infraestrutura'] },
    { id: 'CMADS', sigla: 'CMADS', name: 'Comissão de Meio Ambiente e Desenvolvimento Sustentável', themes: ['meioambiente'] },
    { id: 'CHDRU', sigla: 'CHDRU', name: 'Comissão de Habitação, Desenvolvimento e Reforma Urbana', themes: ['habitacao'] },
    { id: 'CAPRT', sigla: 'CAPRT', name: 'Comissão de Administração Pública e Relações do Trabalho', themes: ['trabalho'] },
    { id: 'CAE', sigla: 'CAE', name: 'Comissão de Atividades Econômicas', themes: ['economia'] },
    { id: 'CDD', sigla: 'CDD', name: 'Comissão de Defesa dos Direitos da Pessoa Humana, da Cidadania, da Participação e das Questões Sociais', themes: ['social'] },
  ],
  camara: [
    { id: 'CCJC', sigla: 'CCJC', name: 'Comissão de Constituição e Justiça e de Cidadania', themes: ['instituicoes'] },
    { id: 'CFT', sigla: 'CFT', name: 'Comissão de Finanças e Tributação', themes: ['economia'] },
    { id: 'CSAUDE', sigla: 'CSAUDE', name: 'Comissão de Saúde', themes: ['saude'] },
    { id: 'CE', sigla: 'CE', name: 'Comissão de Educação', themes: ['educacao'] },
    { id: 'CSPCCO', sigla: 'CSPCCO', name: 'Comissão de Segurança Pública e Combate ao Crime Organizado', themes: ['seguranca'] },
    { id: 'CVT', sigla: 'CVT', name: 'Comissão de Viação e Transportes', themes: ['mobilidade', 'infraestrutura'] },
    { id: 'CMADS', sigla: 'CMADS', name: 'Comissão de Meio Ambiente e Desenvolvimento Sustentável', themes: ['meioambiente'] },
    { id: 'CDU', sigla: 'CDU', name: 'Comissão de Desenvolvimento Urbano', themes: ['habitacao'] },
    { id: 'CTRAB', sigla: 'CTRAB', name: 'Comissão de Trabalho', themes: ['trabalho'] },
    { id: 'CPASF', sigla: 'CPASF', name: 'Comissão de Previdência, Assistência Social, Infância, Adolescência e Família', themes: ['social'] },
    { id: 'CCOM', sigla: 'CCOM', name: 'Comissão de Comunicação', themes: ['tecnologia'] },
  ],
  senado: [
    { id: 'CCJ', sigla: 'CCJ', name: 'Comissão de Constituição, Justiça e Cidadania', themes: ['instituicoes'] },
    { id: 'CAE', sigla: 'CAE', name: 'Comissão de Assuntos Econômicos', themes: ['economia'] },
    { id: 'CAS', sigla: 'CAS', name: 'Comissão de Assuntos Sociais', themes: ['saude', 'social', 'trabalho'] },
    { id: 'CE', sigla: 'CE', name: 'Comissão de Educação e Cultura', themes: ['educacao'] },
    { id: 'CI', sigla: 'CI', name: 'Comissão de Infraestrutura', themes: ['infraestrutura', 'mobilidade'] },
    { id: 'CMA', sigla: 'CMA', name: 'Comissão de Meio Ambiente', themes: ['meioambiente'] },
    { id: 'CSP', sigla: 'CSP', name: 'Comissão de Segurança Pública', themes: ['seguranca'] },
    { id: 'CDH', sigla: 'CDH', name: 'Comissão de Direitos Humanos e Legislação Participativa', themes: ['social'] },
    { id: 'CDR', sigla: 'CDR', name: 'Comissão de Desenvolvimento Regional e Turismo', themes: ['habitacao', 'infraestrutura'] },
    { id: 'CCT', sigla: 'CCT', name: 'Comissão de Ciência, Tecnologia, Inovação e Informática', themes: ['tecnologia'] },
  ],
};
/** Câmara: presidência de comissão por 1 ano; Senado e Alesp: 2 anos (fontes no topo). */
const CHAIR_YEARS: Record<HouseKey, number> = { camara: 1, senado: 2, alesp: 2 };
const CPI_NEEDED: Record<HouseKey, number> = { camara: 171, senado: 27, alesp: 32 };
export const CPI_TOPICS = [
  { value: 'contratos', label: 'Contratos e obras do governo' },
  { value: 'saude', label: 'Filas e falta de remédios na saúde' },
  { value: 'seguranca', label: 'Crime organizado e segurança pública' },
  { value: 'transporte', label: 'Concessões de transporte e pedágios' },
  { value: 'apostas', label: 'Empresas de apostas e publicidade' },
];

export interface Relatoria { id: string; title: string; summary: string; theme: string; slant: number; support: number; salience: number; byGov: boolean; pec: boolean; month: number; status: 'pendente' | 'feito' | 'redistribuida'; parecer?: 'favoravel' | 'substitutivo' | 'contrario'; outcome?: string }
export interface UpperCpi { topic: string; label: string; signatures: number; needed: number; status: 'coletando' | 'instalada' | 'relatorio' | 'encerrada'; monthsLeft: number; relator: boolean; report?: 'duro' | 'acordo' }
export interface LegState { committee: string | null; committeeAsked: number; chairUntil: number | null; leaderUntil: number | null; relatorias: Relatoria[]; cpi: UpperCpi | null; lastLeaderTry: number; lastChairTry: number }

export const houseOf = (s: GameState): HouseKey | null => { const o = s.player.mandate?.office; return o && HOUSE[o] ? HOUSE[o].key : null; };
const now = (s: GameState) => s.month.year * 12 + s.month.month;
export function legState(s: GameState): LegState | null {
  const u = s.player.mandate?.upper; if (!u || !houseOf(s)) return null;
  return (u.leg ??= { committee: null, committeeAsked: 0, chairUntil: null, leaderUntil: null, relatorias: [], cpi: null, lastLeaderTry: 0, lastChairTry: 0 });
}
export const committeeDef = (h: HouseKey, id: string | null) => UPPER_COMMITTEES[h].find((c) => c.id === id) ?? null;
export const isChair = (s: GameState) => { const l = legState(s); return !!l?.chairUntil && l.chairUntil > now(s); };
export const isLeader = (s: GameState) => { const l = legState(s); return !!l?.leaderUntil && l.leaderUntil > now(s); };

function seats(s: GameState, h: HouseKey): Record<string, number> {
  return h === 'alesp' ? s.stateWorld.alespSeats : h === 'camara' ? scaleCamaraSeats(s) : senateSeatsApprox();
}
export function partyShare(s: GameState): number {
  const h = houseOf(s); if (!h || !s.player.partyId) return 0;
  const st = seats(s, h); const tot = Object.values(st).reduce((a, b) => a + b, 0) || 1;
  return (st[s.player.partyId] ?? 0) / tot;
}
function govAlign(s: GameState): number {
  const o = s.player.mandate?.office;
  const g = o === 'deputado_estadual' ? { p: s.stateWorld.governor.partyId, c: s.stateWorld.governorCoalition } : { p: s.stateWorld.president.partyId, c: s.stateWorld.presidentCoalition };
  return partyAlignment(s.player.partyId, g.p, g.c);
}

// ---------------- Comissão ----------------

/** Pedir vaga numa comissão: a bancada indica, respeitando a proporcionalidade. Comissões disputadas são mais difíceis. */
export function chooseCommittee(state: GameState, id: string): GameState {
  const s = structuredClone(state); const l = legState(s); const h = houseOf(s);
  if (!l || !h || l.committeeAsked === now(s)) return state;
  const def = committeeDef(h, id); if (!def) return state;
  const hot = ['CCJR', 'CCJC', 'CCJ', 'CFT', 'CFOP', 'CAE'].includes(id);
  const a = s.character.attributes, pr = s.player.partyRel;
  const chance = clamp(55 + partyShare(s) * 120 + pr.leadershipTrust * 0.2 + a.articulation * 0.1 - (hot ? 30 : 0), 15, 95) / 100;
  l.committeeAsked = now(s);
  let msg: string;
  if (next(s.rng) < chance) { l.committee = id; msg = `A bancada indicou você para a ${def.name}.`; }
  else {
    const others = UPPER_COMMITTEES[h].filter((c) => c.id !== id && !['CCJR', 'CCJC', 'CCJ', 'CFT', 'CFOP', 'CAE'].includes(c.id));
    const alt = pick(s.rng, others); l.committee = alt.id;
    msg = `As vagas do partido na ${def.sigla} ficaram com colegas mais antigos. A bancada indicou você para a ${alt.name}.`;
  }
  s.log.push({ month: { ...s.month }, kind: 'mandato', text: msg });
  return s;
}

export function disputeChair(s: GameState, rng: RngState): string {
  const l = legState(s); const h = houseOf(s);
  if (!l || !h || !l.committee) return 'Primeiro você precisa estar numa comissão.';
  l.lastChairTry = now(s);
  const def = committeeDef(h, l.committee)!;
  const a = s.character.attributes, pr = s.player.partyRel;
  const chance = clamp(8 + partyShare(s) * 160 + pr.influence * 0.25 + a.articulation * 0.2 + a.negotiation * 0.1 + govAlign(s) * 8, 4, 70) / 100;
  if (next(rng) < chance) {
    const years = CHAIR_YEARS[h];
    l.chairUntil = (s.month.year + years) * 12 + 2;
    s.player.recognition = clamp(s.player.recognition + 3);
    pr.influence = clamp(pr.influence + 5);
    pushNews(s, rng, { section: 'Brasil', headline: `${s.character.name} é eleito(a) presidente da ${def.name}`, lead: `Acordo entre os líderes garante a presidência por ${years === 1 ? 'um ano' : 'dois anos'}. O cargo decide o que entra na pauta da comissão.`, aboutPlayer: true, tone: 'positivo' });
    return `Acordo fechado: você preside a ${def.sigla} por ${years === 1 ? 'um ano' : 'dois anos'}. Mais relatorias, mais poder de pauta e seus projetos do tema ganham força.`;
  }
  return 'Os líderes fecharam o acordo das presidências com outro nome. Tente de novo no início do próximo ano legislativo.';
}

// ---------------- Liderança ----------------

export function disputeLeadership(s: GameState, rng: RngState): string {
  const l = legState(s); if (!l) return 'Sem mandato legislativo.';
  l.lastLeaderTry = now(s);
  const a = s.character.attributes, pr = s.player.partyRel;
  const share = partyShare(s);
  const chance = clamp(10 + pr.influence * 0.3 + pr.leadershipTrust * 0.2 + pr.internalPopularity * 0.15 + a.articulation * 0.15 - share * 60, 5, 65) / 100;
  if (next(rng) < chance) {
    l.leaderUntil = (s.month.year + 1) * 12 + 2;
    s.player.recognition = clamp(s.player.recognition + 2.5);
    pr.influence = clamp(pr.influence + 8);
    pushNews(s, rng, { section: 'Partidos', headline: `${s.character.name} é escolhido(a) líder da bancada`, lead: 'A liderança orienta os votos do partido no plenário e negocia a pauta com a presidência da casa.', aboutPlayer: true, tone: 'positivo' });
    return 'A bancada escolheu você como líder por um ano. Agora a orientação do partido no plenário segue o seu voto.';
  }
  return 'A bancada preferiu outro nome para a liderança neste ano.';
}

// ---------------- Relatoria ----------------

export function giveParecer(state: GameState, id: string, parecer: Relatoria['parecer']): GameState {
  const s = structuredClone(state); const l = legState(s); const m = s.player.mandate; const h = houseOf(s);
  const r = l?.relatorias.find((x) => x.id === id && x.status === 'pendente');
  if (!l || !m || !h || !r || !parecer) return state;
  if (parecer === 'substitutivo' && s.actionPoints < 1) return state;
  if (parecer === 'substitutivo') s.actionPoints -= 1;
  const u = m.upper!; const a = s.character.attributes;
  r.status = 'feito'; r.parecer = parecer;
  const govWants = r.byGov;
  if (parecer === 'contrario') {
    const keep = clamp(30 + partyShare(s) * 150 + (isChair(s) ? 25 : 0) + (govWants ? -15 : 15) + a.articulation * 0.1, 10, 85) / 100;
    if (next(s.rng) < keep) {
      r.outcome = 'A comissão aprovou seu parecer contrário: a matéria foi arquivada.';
      u.relationGov = clamp(u.relationGov + (govWants ? -6 : 3));
      s.player.recognition = clamp(s.player.recognition + 1.5);
      s.log.push({ month: { ...s.month }, kind: 'mandato', text: `Relatoria: "${r.title}" arquivada com o seu parecer contrário.` });
      return s;
    }
    r.outcome = 'A comissão derrubou seu parecer (voto em separado venceu): a matéria vai ao plenário mesmo assim.';
    u.relationGov = clamp(u.relationGov + (govWants ? -4 : 1));
  } else if (parecer === 'favoravel') {
    r.outcome = 'Parecer favorável aprovado na comissão: a matéria vai ao plenário no próximo mês.';
    u.relationGov = clamp(u.relationGov + (govWants ? 4 : 0));
  } else {
    r.outcome = 'Substitutivo negociado com bancadas e governo: a matéria vai ao plenário com mais apoio.';
    u.relationGov = clamp(u.relationGov + 2);
    s.player.credibility = clamp((s.player.credibility ?? 50) + 2);
    s.player.recognition = clamp(s.player.recognition + 1);
  }
  const v: FloorVote = {
    id: `fv_rel_${r.id}`, month: { ...s.month }, house: h, title: r.title + (parecer === 'substitutivo' ? ' (substitutivo)' : ''), summary: r.summary, theme: r.theme,
    slant: r.slant, publicSupport: Math.max(-1, Math.min(1, r.support + (parecer === 'substitutivo' ? 0.12 : 0))), salience: r.salience, author: r.byGov ? 'governo' : 'parlamentares',
    govPosition: r.byGov ? 'favor' : 'neutro', pec: r.pec, partyOrientation: 'A', playerVote: null, result: null, effects: null,
    relatorPlayer: true, parecer, boost: parecer === 'substitutivo' ? 0.05 + a.negotiation / 2000 : parecer === 'contrario' ? -0.04 : 0.01,
  };
  v.partyOrientation = benchOrientation(s, m.office, s.player.partyId, v);
  s.floorVotes.push(v);
  s.log.push({ month: { ...s.month }, kind: 'mandato', text: `Relatoria: "${r.title}" — ${r.outcome}` });
  return s;
}

// ---------------- CPI ----------------

export function collectCpi(s: GameState, rng: RngState, topic: string): string {
  const l = legState(s); const h = houseOf(s); if (!l || !h) return 'Sem mandato legislativo.';
  const t = CPI_TOPICS.find((x) => x.value === topic) ?? CPI_TOPICS[0];
  if (l.cpi && l.cpi.status !== 'encerrada' && l.cpi.topic !== t.value) return `Você já está à frente da CPI sobre ${l.cpi.label.toLowerCase()}.`;
  if (!l.cpi || l.cpi.status === 'encerrada') l.cpi = { topic: t.value, label: t.label, signatures: 1, needed: CPI_NEEDED[h], status: 'coletando', monthsLeft: 0, relator: false };
  const c = l.cpi;
  if (c.status !== 'coletando') return 'A CPI já foi instalada.';
  const opp = 1 - govAlign(s);
  const gain = Math.round(c.needed * (0.08 + opp * 0.18 + s.character.attributes.articulation / 900 + next(rng) * 0.08));
  c.signatures = Math.min(c.needed, c.signatures + gain);
  if (c.signatures >= c.needed) {
    c.status = 'instalada'; c.monthsLeft = 4;
    c.relator = next(rng) < 0.35 + opp * 0.3 + partyShare(s);
    s.player.recognition = clamp(s.player.recognition + 4);
    pushNews(s, rng, { section: 'Brasil', headline: `CPI sobre ${t.label.toLowerCase()} é instalada por iniciativa de ${s.character.name}`, lead: `O requerimento reuniu ${c.needed} assinaturas, um terço da casa, como exige a Constituição.${c.relator ? ` ${s.character.name} será o(a) relator(a).` : ''}`, aboutPlayer: true, tone: 'neutro' });
    return `CPI instalada com ${c.needed} assinaturas (1/3 da casa).${c.relator ? ' Você é o(a) relator(a): o relatório final será seu.' : ' A relatoria ficou com outro parlamentar.'}`;
  }
  return `Mais ${gain} assinaturas: ${c.signatures} de ${c.needed} necessárias (1/3 da casa).${opp < 0.4 ? ' Colegas da base do governo resistem a assinar.' : ''}`;
}

export function cpiReport(state: GameState, kind: 'duro' | 'acordo'): GameState {
  const s = structuredClone(state); const l = legState(s); const u = s.player.mandate?.upper;
  if (!l?.cpi || l.cpi.status !== 'relatorio' || !u) return state;
  l.cpi.status = 'encerrada'; l.cpi.report = kind;
  if (kind === 'duro') {
    s.player.recognition = clamp(s.player.recognition + 4); s.player.credibility = clamp((s.player.credibility ?? 50) + 3);
    u.relationGov = clamp(u.relationGov - 10); if (s.personal) s.personal.heat = clamp(s.personal.heat + 5);
    pushNews(s, s.rng, { section: 'Brasil', headline: `Relatório de ${s.character.name} pede indiciamentos na CPI`, lead: 'O relatório é enviado ao Ministério Público, que decide se abre processos. O governo reage.', aboutPlayer: true, tone: 'neutro' });
  } else {
    u.relationGov = clamp(u.relationGov + 6); s.player.credibility = clamp((s.player.credibility ?? 50) - 4);
    pushNews(s, s.rng, { section: 'Brasil', headline: `CPI termina com relatório brando de ${s.character.name}`, lead: 'Oposição fala em "acordão"; governo comemora o fim das investigações.', aboutPlayer: true, tone: 'critico' });
  }
  s.log.push({ month: { ...s.month }, kind: 'mandato', text: `CPI encerrada com relatório ${kind === 'duro' ? 'duro (pede indiciamentos ao Ministério Público)' : 'brando (acordo)'}.` });
  return s;
}

// ---------------- Passo mensal ----------------

export function legislativoMonthlyStep(s: GameState, rng: RngState): string[] {
  const l = legState(s); const h = houseOf(s); const notes: string[] = [];
  if (!l || !h) return notes;
  const t = now(s);
  if (l.chairUntil && l.chairUntil <= t) { l.chairUntil = null; notes.push('Terminou seu mandato na presidência da comissão.'); }
  if (l.leaderUntil && l.leaderUntil <= t) { l.leaderUntil = null; notes.push('Terminou seu ano na liderança da bancada.'); }
  if (isLeader(s)) { s.player.recognition = clamp(s.player.recognition + 0.3); }
  // relatorias pendentes há mais de 2 meses são redistribuídas
  for (const r of l.relatorias) if (r.status === 'pendente' && t - r.month >= 2) { r.status = 'redistribuida'; s.player.partyRel.leadershipTrust = clamp(s.player.partyRel.leadershipTrust - 2); notes.push(`A relatoria de "${r.title}" foi redistribuída: você não apresentou parecer.`); }
  // nova relatoria (sessão legislativa: fevereiro a dezembro)
  const pending = l.relatorias.filter((r) => r.status === 'pendente').length;
  if (l.committee && s.month.month >= 2 && pending < 2) {
    const def = committeeDef(h, l.committee)!;
    const chance = 0.3 + (isChair(s) ? 0.25 : 0) + s.player.partyRel.influence / 500;
    if (next(rng) < chance) {
      const pool = TEMPLATES.filter((x) => x.houses.includes(h) && def.themes.includes(x.theme));
      const tp = pool.length ? pick(rng, pool) : pick(rng, TEMPLATES.filter((x) => x.houses.includes(h)));
      l.relatorias.push({ id: `rel_${t}_${l.relatorias.length}`, title: tp.title, summary: tp.summary, theme: tp.theme, slant: tp.slant, support: tp.support, salience: tp.salience, byGov: tp.byGov, pec: !!tp.pec, month: t, status: 'pendente' });
      notes.push(`Você foi designado(a) relator(a) de "${tp.title}" na ${def.sigla}. Apresente o parecer na página do mandato.`);
    }
  }
  if (l.relatorias.length > 30) l.relatorias.splice(0, l.relatorias.length - 30);
  // CPI em andamento
  const c = l.cpi; const u = s.player.mandate!.upper!;
  if (c?.status === 'instalada') {
    c.monthsLeft -= 1;
    s.player.recognition = clamp(s.player.recognition + 1.2);
    u.relationGov = clamp(u.relationGov - 1.5);
    if (s.personal) s.personal.heat = clamp(s.personal.heat + 1.5);
    if (c.monthsLeft <= 0) {
      if (c.relator) { c.status = 'relatorio'; notes.push('A CPI chegou ao fim do prazo: escreva o relatório final na página do mandato.'); }
      else { c.status = 'encerrada'; c.report = next(rng) < 0.5 ? 'duro' : 'acordo'; notes.push(`A CPI terminou. O relator apresentou um relatório ${c.report === 'duro' ? 'duro, com pedidos de indiciamento' : 'brando'}.`); }
    } else notes.push(`CPI em andamento (${c.label}): depoimentos e documentos rendem exposição.`);
  }
  return notes;
}

// ---------------- Governador: investimento por região do estado ----------------

export const REGION_INVEST_VALUE = 500; // R$ mi por ação (PARÂMETRO)
export function govRegionOptions() { return MAP_STATE.shapes.map((x) => ({ value: x.id, label: x.name })); }

export function govInvestRegion(s: GameState, rng: RngState, rg: string): string {
  const m = s.player.mandate; const u = m?.upper; if (!m || !u) return 'Sem governo.';
  const st = STATE_REGION_STATS[rg]; const name = MAP_STATE.shapes.find((x) => x.id === rg)?.name ?? rg;
  if (!st) return 'Região inválida.';
  u.regionInvest ??= {}; u.regionApproval ??= Object.fromEntries(MAP_STATE.shapes.map((x) => [x.id, m.approval]));
  const before = u.regionInvest[rg] ?? 0;
  u.regionInvest[rg] = before + REGION_INVEST_VALUE;
  // Retorno decrescente: o mesmo valor pesa mais numa região pequena e menos onde já se investiu muito.
  const perCapita = (REGION_INVEST_VALUE * 1e6) / st.pop;
  const gain = Math.min(9, 1.5 + perCapita / 25) / (1 + before / 2000);
  u.regionApproval[rg] = clamp((u.regionApproval[rg] ?? m.approval) + gain);
  const comps: ['idhm_e' | 'idhm_l' | 'idhm_r', string][] = [['idhm_e', 'educacao'], ['idhm_l', 'saude'], ['idhm_r', 'economia']];
  const weakest = comps.sort((a, b) => st[a[0]] - st[b[0]])[0][1];
  const fx = addImpulse(s, 'estado', weakest, 0.4 * (st.pop / 44.4e6) * 10, 12, `Investimento regional (${name})`);
  void rng;
  return `R$ ${REGION_INVEST_VALUE} mi para a região de ${name} (foco em ${weakest === 'educacao' ? 'educação' : weakest === 'saude' ? 'saúde' : 'emprego e renda'}, o ponto mais fraco do IDHM local). Aprovação na região +${gain.toFixed(1)}.${fx.length ? '' : ''}`;
}

/** Mensal: aprovações regionais convergem devagar para a média estadual; a média estadual puxa a aprovação geral. */
export function governorRegionsStep(s: GameState) {
  const m = s.player.mandate; const u = m?.upper;
  if (!m || m.office !== 'governador' || !u) return;
  u.regionApproval ??= Object.fromEntries(MAP_STATE.shapes.map((x) => [x.id, m.approval]));
  const tot = Object.values(STATE_REGION_STATS).reduce((a, x) => a + x.pop, 0);
  let mean = 0;
  for (const [rg, v] of Object.entries(u.regionApproval)) { const nv = v + (m.approval - v) * 0.06; u.regionApproval[rg] = nv; mean += nv * (STATE_REGION_STATS[rg]?.pop ?? 0) / tot; }
  m.approval = clamp(m.approval + (mean - m.approval) * 0.3);
}

export const UPPER_LEG_RULES = [
  '[REAL] Comissões permanentes seguem a proporcionalidade dos partidos (CF art. 58 §1º). Câmara: 30 comissões, presidência de 1 ano; Senado: 16 comissões, presidência de 2 anos; Alesp: 21 comissões, 11 ou 13 membros, 2 anos.',
  '[REAL] CPI exige requerimento de 1/3 dos membros, fato determinado e prazo certo (CF art. 58 §3º): 171 deputados federais, 27 senadores; Alesp: 32 de 94 (por simetria — conferir).',
  '[REAL] O relator apresenta parecer na comissão; a comissão vota o parecer e a matéria segue ao plenário.',
  '[JOGO] Nomes das comissões: seleção das listas oficiais. Chances de vaga, presidência e liderança, frequência das relatorias, ritmo de assinaturas, duração da CPI (4 meses) e efeitos são parâmetros do jogo.',
];
export type { UpperMandate };
