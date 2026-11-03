// Motor legislativo da Câmara Municipal de São Paulo (Fase 2).
//
// O QUE É REGRA REAL (com fonte) e O QUE É MECÂNICA DE JOGO está marcado em LEG_RULES, exibido na interface.
// Pessoas reais: os vereadores reais votam pelo MODELO do jogo (partido, bloco, ideologia do partido, relação,
// pressão pública e ruído). Isso é simulação: o jogo não afirma como um vereador real votaria.
// Projetos da IA são atribuídos a BANCADAS, nunca a uma pessoa real.

import { next, normal, pick, type RngState } from '../rng';
import { addMonths, monthIndex } from '../calendar';
import { EXPERT_SCALE, generalPosition } from '../data/ideology';
import { partyById } from '../data/parties';
import { PLAYER, adjustRel, rel, standing } from './relations';
import { councillorActors } from './actors';
import { pushNews } from './news';
import type { Bill, BillKind, BillStage, Committee, Cpi, GameState, Legislature, RollCall, Stance, VoteChoice } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
/** Maioria absoluta da Câmara de SP (55 cadeiras): 28 votos. */
export const ABSOLUTE_MAJORITY = 28;
/** 1/3 dos membros: 19 assinaturas para requerer CPI. */
export const CPI_SIGNATURES = 19;
export const CPI_MONTHS = 4;

export type RuleTag = 'REAL' | 'DERIVADA' | 'SIMPLIFICAÇÃO' | 'PARÂMETRO' | 'A CONFIRMAR';
export const LEG_RULES: { tag: RuleTag; text: string }[] = [
  { tag: 'REAL', text: 'Sanção ou veto do prefeito em 15 dias após receber o projeto aprovado; o silêncio importa sanção tácita (Lei Orgânica do Município de SP, art. 42; CF art. 66 por simetria).' },
  { tag: 'REAL', text: 'O veto é apreciado pela Câmara em 30 dias e só é rejeitado pelo voto da maioria absoluta dos vereadores — 28 de 55 (LOM-SP art. 42).' },
  { tag: 'REAL', text: 'A CMSP tem comissões permanentes de mérito; Constituição e Justiça (legalidade) e Finanças e Orçamento (impacto orçamentário) são etapas obrigatórias conforme a matéria.' },
  { tag: 'REAL', text: 'CPI exige requerimento de 1/3 dos membros (19 de 55), fato determinado e prazo certo (CF art. 58 §3º, aplicado por simetria; conferir no Regimento Interno da CMSP).' },
  { tag: 'REAL', text: 'São de iniciativa privativa do prefeito leis sobre criação de cargos, estrutura e atribuições de órgãos, regime de servidores e matéria orçamentária (LOM-SP art. 37 §2º — conferir incisos). Lei de vereador que só cria despesa, sem mexer nisso, não é inconstitucional por esse motivo (STF, Tema 917).' },
  { tag: 'DERIVADA', text: 'Composição das comissões proporcional às bancadas, calculada pelo método D\'Hondt sobre o número de vagas de cada comissão.' },
  { tag: 'SIMPLIFICAÇÃO', text: 'Cada vereador é titular de uma única comissão permanente (na CMSP pode haver acúmulo e suplência).' },
  { tag: 'SIMPLIFICAÇÃO', text: 'Parecer contrário em comissão arquiva o projeto (no Regimento real há recurso ao plenário).' },
  { tag: 'SIMPLIFICAÇÃO', text: 'Mesa com cinco cargos (presidente, 1º e 2º vice, 1º e 2º secretário); eleição por maioria absoluta no 1º escrutínio e maioria simples no 2º (a confirmar no Regimento).' },
  { tag: 'PARÂMETRO', text: 'Tamanho das comissões (9/9/7/7/7/7/9), ritmo de tramitação (≥1 mês por etapa), chance de entrar em pauta e prazo da CPI (4 meses) são parâmetros de jogo.' },
  { tag: 'PARÂMETRO', text: 'Modelo de voto de cada vereador: orientação do partido, bloco frente ao governo, ideologia do partido (escala de especialistas 2022), relação com o autor, pressão pública, compromissos e ruído.' },
];

export interface CommitteeDef { id: string; name: string; themes: string[]; seats: number }
export const COMMITTEES: CommitteeDef[] = [
  { id: 'ccj', name: 'Constituição, Justiça e Legislação Participativa', themes: [], seats: 9 },
  { id: 'financas', name: 'Finanças e Orçamento', themes: [], seats: 9 },
  { id: 'urbana', name: 'Política Urbana, Metropolitana e Meio Ambiente', themes: ['habitacao', 'meioambiente', 'zeladoria'], seats: 7 },
  { id: 'administracao', name: 'Administração Pública', themes: ['gcm'], seats: 7 },
  { id: 'transito', name: 'Trânsito, Transporte, Atividade Econômica, Turismo, Lazer e Gastronomia', themes: ['mobilidade'], seats: 7 },
  { id: 'educacao', name: 'Educação, Cultura e Esportes', themes: ['educacao', 'cultura'], seats: 7 },
  { id: 'saude', name: 'Saúde, Promoção Social, Trabalho e Mulher', themes: ['saude'], seats: 9 },
];

export const THEME_LABEL: Record<string, string> = {
  zeladoria: 'Zeladoria e limpeza urbana', saude: 'Atenção básica de saúde', educacao: 'Educação infantil',
  mobilidade: 'Mobilidade e ônibus', cultura: 'Cultura e esporte nos bairros', gcm: 'Guarda Civil Metropolitana',
  meioambiente: 'Parques e meio ambiente', habitacao: 'Habitação e regularização fundiária',
};

export const KIND_LABEL: Record<BillKind, string> = {
  regulacao: 'Regulação de serviço ou atividade local',
  programa: 'Cria programa municipal (gera despesa)',
  denominacao: 'Denominação de logradouro / data comemorativa',
  executivo: 'Projeto do Executivo',
};

export const STAGE_LABEL: Record<BillStage, string> = {
  ccj: 'Comissão de Constituição e Justiça', merito: 'Comissão de mérito', financas: 'Comissão de Finanças',
  plenario: 'Plenário', sancao: 'Sanção ou veto do prefeito', veto: 'Apreciação do veto',
  lei: 'Virou lei', arquivado: 'Arquivado (parecer contrário)', rejeitado: 'Rejeitado em plenário', veto_mantido: 'Veto mantido',
};
export const ACTIVE_STAGES: BillStage[] = ['ccj', 'merito', 'financas', 'plenario', 'sancao', 'veto'];
export const isActive = (b: Bill) => ACTIVE_STAGES.includes(b.stage);

// Títulos genéricos para projetos de bancadas (IA). Não reproduzem projetos reais.
const TITLES: Record<string, Record<'regulacao' | 'programa' | 'denominacao' | 'executivo', string[]>> = {
  zeladoria: { regulacao: ['Regras para coleta seletiva em condomínios', 'Prazo máximo para reparo de calçadas'], programa: ['Programa Bairro Limpo de mutirões', 'Programa de ecopontos móveis'], denominacao: ['Denomina praça na zona leste'], executivo: ['Reorganiza contratos de varrição'] },
  saude: { regulacao: ['Painel público de filas nas UBS', 'Horário estendido em UBS selecionadas'], programa: ['Programa de saúde mental nas escolas', 'Programa de agentes de saúde nas ocupações'], denominacao: ['Institui semana municipal de doação de sangue'], executivo: ['Reestrutura a rede de pronto atendimento'] },
  educacao: { regulacao: ['Regras para transporte escolar gratuito', 'Transparência da fila de creches'], programa: ['Programa de reforço escolar no contraturno', 'Programa de creches noturnas'], denominacao: ['Denomina CEI na zona sul'], executivo: ['Plano de expansão de vagas em creches'] },
  mobilidade: { regulacao: ['Regras para patinetes e bicicletas compartilhadas', 'Faixas exclusivas em horário de pico'], programa: ['Programa de tarifa zero aos domingos', 'Programa de ciclovias de bairro'], denominacao: ['Denomina terminal de ônibus'], executivo: ['Novo contrato de concessão de ônibus'] },
  cultura: { regulacao: ['Regras para eventos de rua', 'Licença simplificada para artistas de rua'], programa: ['Programa de bibliotecas comunitárias', 'Programa de esporte nas praças'], denominacao: ['Institui o dia municipal do samba de bairro'], executivo: ['Reforma de centros culturais'] },
  gcm: { regulacao: ['Uso de câmeras corporais pela GCM', 'Protocolo de atendimento a vulneráveis pela GCM'], programa: ['Programa de ronda escolar da GCM', 'Programa de bases comunitárias'], denominacao: ['Institui o dia do guarda civil'], executivo: ['Reorganiza a carreira da GCM'] },
  meioambiente: { regulacao: ['Regras de arborização em novas construções', 'Proibição de plásticos descartáveis em eventos públicos'], programa: ['Programa de hortas urbanas', 'Programa de parques lineares'], denominacao: ['Denomina parque municipal'], executivo: ['Plano municipal de mudanças climáticas'] },
  habitacao: { regulacao: ['Regras para regularização fundiária simplificada', 'Cota de habitação social em grandes empreendimentos'], programa: ['Programa de locação social', 'Programa de reforma de moradias precárias'], denominacao: ['Denomina conjunto habitacional'], executivo: ['Revisão de normas de habitação de interesse social'] },
};

const THEMES_LIST = Object.keys(THEME_LABEL);

// ---------------- Utilidades ----------------
export function memberIds(s: GameState): string[] {
  return s.government.councillors.map((c) => c.id);
}
function councillorParty(s: GameState, id: string): string {
  return s.government.councillors.find((c) => c.id === id)?.partyId ?? s.player.partyId ?? '';
}
export function nameOf(s: GameState, id: string): string {
  if (id === PLAYER) return s.character.name;
  return s.government.councillors.find((c) => c.id === id)?.name ?? s.actors[id]?.name ?? id;
}
const partyPos = (partyId: string | null | undefined): number => (partyId ? EXPERT_SCALE[partyId]?.value ?? 5 : 5);
function actorPos(s: GameState, id: string): number {
  if (id === PLAYER) return generalPosition(s.character.ideology) ?? 5;
  return s.actors[id]?.ideology ?? partyPos(councillorParty(s, id));
}
export function mayorPos(s: GameState): number {
  if (s.player.mandate?.office === 'prefeito') return generalPosition(s.character.ideology) ?? 5;
  return partyPos(s.government.mayor?.partyId);
}
export const playerIsMayor = (s: GameState) => s.player.mandate?.office === 'prefeito';
export const playerIsCouncillor = (s: GameState) => s.player.mandate?.office === 'vereador';
export function authorLabel(s: GameState, b: Bill): string {
  if (b.author === PLAYER) return `${s.character.name} (você)`;
  if (b.author === 'executivo') return playerIsMayor(s) ? 'Executivo (sua gestão)' : 'Executivo municipal';
  if (b.author.startsWith('bancada:')) return `Bancada do ${partyById(b.author.slice(8))?.acronym ?? '?'}`;
  return b.author;
}
const authorParty = (s: GameState, b: Bill): string | null =>
  b.author === PLAYER ? s.player.partyId : b.author === 'executivo' ? (playerIsMayor(s) ? s.player.partyId : s.government.mayor?.partyId ?? null) : b.author.startsWith('bancada:') ? b.author.slice(8) : null;

// ---------------- Blocos ----------------
const BLOC_FACTOR: Record<Stance, number> = { base: 0.65, independente: 0.12, oposicao: -0.4, oposicao_radical: -0.7 };
export const BLOC_LABEL: Record<Stance, string> = { base: 'Base do governo', independente: 'Independente', oposicao: 'Oposição moderada', oposicao_radical: 'Oposição radical' };

/** Bloco de cada vereador frente ao prefeito: coligação = base; demais pela distância ideológica do partido (PARÂMETRO). */
export function computeBlocs(s: GameState, rng: RngState): Record<string, Stance> {
  const coalition = new Set(s.government.mayorCoalition);
  const mp = mayorPos(s);
  const out: Record<string, Stance> = {};
  for (const c of s.government.councillors) {
    if (c.id === PLAYER) { out[c.id] = s.player.mandate?.stance ?? 'independente'; continue; }
    if (coalition.has(c.partyId)) { out[c.id] = 'base'; continue; }
    const v = EXPERT_SCALE[c.partyId]?.value;
    const d = v === null || v === undefined ? 1 : Math.abs(v - mp);
    let st: Stance = d <= 1.5 ? 'independente' : d <= 3.5 ? 'oposicao' : 'oposicao_radical';
    const prag = s.actors[c.id]?.traits.pragmatism ?? 50;
    if (st !== 'independente' && prag > 70 && next(rng) < 0.35) st = st === 'oposicao_radical' ? 'oposicao' : 'independente';
    else if (st === 'independente' && prag > 65 && next(rng) < 0.3) st = 'base';
    out[c.id] = st;
  }
  return out;
}

export function blocCounts(s: GameState): Record<Stance, number> {
  const out: Record<Stance, number> = { base: 0, independente: 0, oposicao: 0, oposicao_radical: 0 };
  for (const id of memberIds(s)) out[(id === PLAYER ? s.player.mandate?.stance : s.legislature.blocs[id]) ?? 'independente']++;
  return out;
}

// ---------------- Comissões (D'Hondt) ----------------
export function composeCommittees(s: GameState, rng: RngState): Committee[] {
  const byParty: Record<string, string[]> = {};
  for (const c of s.government.councillors) (byParty[c.partyId] ??= []).push(c.id);
  for (const k of Object.keys(byParty)) byParty[k].sort(() => next(rng) - 0.5);
  const total = s.government.councillors.length;
  const remaining = Object.fromEntries(Object.entries(byParty).map(([k, v]) => [k, v.length]));
  const seatsTotal = Object.fromEntries(Object.entries(byParty).map(([k, v]) => [k, v.length]));
  const defs = COMMITTEES.map((d) => ({ ...d, seats: Math.max(1, Math.round((d.seats * total) / 55)) }));
  const diff = total - defs.reduce((a, d) => a + d.seats, 0);
  defs[defs.length - 1].seats += diff;
  const got: Record<string, Record<string, number>> = Object.fromEntries(defs.map((d) => [d.id, {}]));
  const members: Record<string, string[]> = Object.fromEntries(defs.map((d) => [d.id, []]));
  // Preenchimento intercalado: uma vaga por comissão a cada rodada, pelo maior quociente D'Hondt da comissão.
  let filled = true;
  while (filled) {
    filled = false;
    for (const d of defs) {
      if (members[d.id].length >= d.seats) continue;
      let best: string | null = null;
      let bestQ = -1;
      for (const p of Object.keys(byParty)) {
        if (remaining[p] <= 0) continue;
        const q = seatsTotal[p] / ((got[d.id][p] ?? 0) + 1) + remaining[p] * 1e-3 + next(rng) * 1e-6;
        if (q > bestQ) { bestQ = q; best = p; }
      }
      if (!best) continue;
      got[d.id][best] = (got[d.id][best] ?? 0) + 1;
      remaining[best]--;
      members[d.id].push(byParty[best].shift()!);
      filled = true;
    }
  }
  const comms: Committee[] = defs.map((d) => ({ id: d.id, name: d.name, themes: d.themes, seats: members[d.id].length, members: members[d.id], presidentId: null }));
  // Presidências: preferência à base do governo e à maior bancada; peso pela influência (PARÂMETRO).
  const coalition = new Set(s.government.mayorCoalition);
  for (const c of comms) {
    const w = c.members.filter((id) => id !== PLAYER).map((id) => ({ id, w: (coalition.has(councillorParty(s, id)) ? 2.5 : 1) * (1 + (s.actors[id]?.influence ?? 30) / 50) * (0.5 + next(rng)) }));
    w.sort((a, b) => b.w - a.w);
    c.presidentId = w[0]?.id ?? null;
  }
  return comms;
}

export function playerCommittee(s: GameState): Committee | null {
  return s.legislature.committees.find((c) => c.members.includes(PLAYER)) ?? null;
}
export function committeeForTheme(theme: string): string {
  return COMMITTEES.find((c) => c.themes.includes(theme))?.id ?? 'administracao';
}

// ---------------- Estado inicial / reinício de legislatura ----------------
export function emptyLegislature(): Legislature {
  return { committees: [], bills: [], billSeq: 0, blocs: {}, cpis: [], mesa: [], mesaCandidates: [], mesaDeals: [], mesaYear: null, presidentId: null, playerVotes: {}, voteHistory: [] };
}

export function initLegislature(s: GameState, rng: RngState): void {
  councillorActors(s, rng);
  const prev = s.legislature ?? emptyLegislature();
  s.legislature = { ...emptyLegislature(), bills: prev.bills, billSeq: prev.billSeq, voteHistory: prev.voteHistory };
  s.legislature.blocs = computeBlocs(s, rng);
  s.legislature.committees = composeCommittees(s, rng);
  // Projetos em tramitação são arquivados ao fim da legislatura (regra usual de arquivamento — a confirmar no RI da CMSP).
  for (const b of s.legislature.bills) if (isActive(b) && b.stage !== 'sancao' && b.stage !== 'veto' && s.month.year === 2029 && s.month.month === 1 && b.history.length && b.history[0].month.year < 2029) {
    b.stage = 'arquivado';
    b.history.push({ month: { ...s.month }, text: 'Arquivado no fim da legislatura.' });
  }
}

// ---------------- Projetos ----------------
function newBill(s: GameState, rng: RngState, p: { title: string; theme: string; author: string; kind: BillKind; slant: number; salience: number; executiveInitiativeOnly: boolean; publicSupport: number; urgent?: boolean }): Bill {
  s.legislature.billSeq += 1;
  const yk = `plseq_${s.month.year}`;
  s.flags[yk] = Number(s.flags[yk] ?? 0) + 1;
  const b: Bill = {
    id: `pl_${monthIndex(s.month)}_${s.legislature.billSeq}`,
    number: `PL ${s.flags[yk]}/${s.month.year}`,
    title: p.title, theme: p.theme, author: p.author, kind: p.kind,
    executiveInitiativeOnly: p.executiveInitiativeOnly, slant: Math.max(-1, Math.min(1, p.slant)),
    salience: clamp(p.salience), publicSupport: Math.max(-1, Math.min(1, p.publicSupport)),
    stage: 'ccj', monthsInStage: 0, committeeId: 'ccj', rapporteurId: null,
    executivePosition: 'neutro', commitments: [], vote: null, vetoVote: null,
    scheduled: false, urgent: !!p.urgent, parecer: null,
    history: [{ month: { ...s.month }, text: 'Protocolado e enviado à Comissão de Constituição e Justiça.' }],
  };
  b.executivePosition = executiveStance(s, b);
  assignRapporteur(s, b, rng);
  s.legislature.bills.push(b);
  return b;
}

/** Posição do Executivo sobre um projeto (IA do prefeito; com o jogador prefeito, segue a ideologia dele). */
export function executiveStance(s: GameState, b: Bill): Bill['executivePosition'] {
  if (b.author === 'executivo') return 'favor';
  if (b.executiveInitiativeOnly) return 'contra';
  const bp = 5 + b.slant * 5;
  const fit = 1 - Math.abs(mayorPos(s) - bp) / 4;
  let score = fit + (b.kind === 'programa' ? -0.35 : 0) + (b.kind === 'denominacao' ? 0.5 : 0);
  if (b.author === PLAYER && s.player.mandate) score += (s.player.mandate.relationExecutive - 50) / 60;
  const ap = authorParty(s, b);
  if (ap && s.government.mayorCoalition.includes(ap)) score += 0.3;
  // O governo só se mobiliza contra o que contraria muito sua linha ou tem repercussão.
  return score > 0.45 ? 'favor' : score < -0.55 || (score < -0.2 && b.salience >= 45) ? 'contra' : 'neutro';
}

export function fileBill(s: GameState, rng: RngState, theme: string, kind: Exclude<BillKind, 'executivo'>): Bill {
  const pos = generalPosition(s.character.ideology) ?? 5;
  const flawProb = kind === 'programa' ? clamp(0.6 - s.character.attributes.politicalKnowledge / 180, 0.08, 0.6) : 0;
  const title = kind === 'denominacao' ? pick(rng, TITLES[theme].denominacao) : `${kind === 'programa' ? 'Programa municipal' : 'Regras municipais'}: ${THEME_LABEL[theme].toLowerCase()}`;
  return newBill(s, rng, {
    title, theme, author: PLAYER, kind,
    slant: (pos - 5) / 5 + normal(rng, 0, 0.1),
    salience: kind === 'denominacao' ? 5 : kind === 'programa' ? 35 + next(rng) * 20 : 20 + next(rng) * 25,
    executiveInitiativeOnly: next(rng) < flawProb,
    publicSupport: kind === 'denominacao' ? 0.1 : 0.15 + normal(rng, 0.2, 0.3),
  });
}

export function fileExecutiveBill(s: GameState, rng: RngState, theme: string): Bill {
  const used = new Set(s.legislature.bills.filter((b) => b.author === 'executivo').map((b) => b.title));
  const all = Object.values(TITLES).flatMap((t) => t.executivo);
  const own = (TITLES[theme] ?? TITLES.zeladoria).executivo.filter((x) => !used.has(x));
  const title = own.length ? pick(rng, own) : all.find((x) => !used.has(x)) ? pick(rng, all.filter((x) => !used.has(x))) : `${pick(rng, all)} (nova versão)`;
  return newBill(s, rng, {
    title, theme, author: 'executivo', kind: 'executivo',
    slant: (mayorPos(s) - 5) / 5 + normal(rng, 0, 0.1), salience: 40 + next(rng) * 35,
    executiveInitiativeOnly: false, publicSupport: normal(rng, 0.05, 0.35), urgent: next(rng) < 0.5,
  });
}

function aiBill(s: GameState, rng: RngState): Bill | null {
  const cs = s.government.councillors.filter((c) => c.id !== PLAYER);
  if (!cs.length) return null;
  const partyId = pick(rng, cs).partyId; // ponderado pelo tamanho da bancada
  const theme = pick(rng, THEMES_LIST);
  const r = next(rng);
  const kind: Exclude<BillKind, 'executivo'> = r < 0.55 ? 'regulacao' : r < 0.82 ? 'programa' : 'denominacao';
  return newBill(s, rng, {
    title: pick(rng, TITLES[theme][kind]), theme, author: `bancada:${partyId}`, kind,
    slant: (partyPos(partyId) - 5) / 5 + normal(rng, 0, 0.15),
    salience: kind === 'denominacao' ? 3 : 10 + next(rng) * 50,
    executiveInitiativeOnly: kind === 'programa' && next(rng) < 0.3,
    publicSupport: normal(rng, 0.1, 0.4),
  });
}

function stageCommittee(b: Bill): string {
  return b.stage === 'ccj' ? 'ccj' : b.stage === 'financas' ? 'financas' : committeeForTheme(b.theme);
}

function assignRapporteur(s: GameState, b: Bill, rng: RngState) {
  b.committeeId = stageCommittee(b);
  const c = s.legislature.committees.find((x) => x.id === b.committeeId);
  b.parecer = null;
  if (!c || !c.members.length) { b.rapporteurId = null; return; }
  const pool = c.members.filter((id) => id !== PLAYER);
  // O presidente da comissão designa o relator; temas de alta repercussão ele costuma avocar (PARÂMETRO).
  if (c.presidentId && c.presidentId !== PLAYER && b.salience > 55 && next(rng) < 0.5) b.rapporteurId = c.presidentId;
  else b.rapporteurId = pool.length ? pick(rng, pool) : null;
}

// ---------------- Modelo de voto ----------------
const SIGN = { favor: 1, contra: -1, neutro: 0 } as const;

/** Bloco do autor: jogador = posição declarada; bancada = bloco do partido; Executivo = base. */
function authorBloc(s: GameState, b: Bill): Stance {
  if (b.author === PLAYER) return s.player.mandate?.office === 'prefeito' ? 'base' : s.player.mandate?.stance ?? 'independente';
  if (b.author === 'executivo') return 'base';
  const pid = b.author.slice(8);
  if (s.government.mayorCoalition.includes(pid)) return 'base';
  const v = EXPERT_SCALE[pid]?.value;
  const d = v === null || v === undefined ? 1 : Math.abs(v - mayorPos(s));
  return d <= 1.5 ? 'independente' : d <= 3.5 ? 'oposicao' : 'oposicao_radical';
}
/** Rivalidade entre blocos: a base resiste a projetos da oposição e vice-versa (PARÂMETRO). */
function blocAffinity(author: Stance, voter: Stance): number {
  if (author === voter) return 0.15;
  const opp = (x: Stance) => x === 'oposicao' || x === 'oposicao_radical';
  if (author === 'base' && opp(voter)) return voter === 'oposicao_radical' ? -0.3 : -0.15;
  if (opp(author) && voter === 'base') return author === 'oposicao_radical' ? -0.4 : -0.2;
  return 0;
}

/** Apoio de um vereador a um projeto (−∞..+∞). Ver LEG_RULES (PARÂMETRO). */
export function supportScore(s: GameState, id: string, b: Bill, ctx: 'comissao' | 'plenario' | 'veto', noise: number): number {
  const bp = 5 + b.slant * 5;
  const fit = 1 - Math.abs(actorPos(s, id) - bp) / 4; // ~ −1.5..1
  const bloc: Stance = (id === PLAYER ? s.player.mandate?.stance : s.legislature.blocs[id]) ?? 'independente';
  const loyalty = (s.actors[id]?.traits.loyalty ?? 55) / 100;
  let v = 0.25 + fit * 0.4;
  v += SIGN[b.executivePosition] * BLOC_FACTOR[bloc] * (ctx === 'veto' ? 1.5 : 1);
  if (ctx === 'veto') v -= BLOC_FACTOR[bloc] * 0.6; // derrubar veto é enfrentar o prefeito
  if (b.author !== 'executivo') v += blocAffinity(authorBloc(s, b), bloc);
  const ap = authorParty(s, b);
  const myParty = id === PLAYER ? s.player.partyId : councillorParty(s, id);
  if (ap && ap === myParty) v += 0.35 + loyalty * 0.4;
  if (b.author === PLAYER && id !== PLAYER) v += standing(s, id, PLAYER) / 140;
  if (b.commitments.includes(id)) v += 1.4;
  v += b.publicSupport * (b.salience / 100) * 0.6;
  if (b.kind === 'denominacao') v += 0.7;
  if (b.executiveInitiativeOnly && (b.stage === 'ccj' || ctx === 'veto')) v -= 1.1;
  if (ctx === 'comissao' && b.rapporteurId && b.rapporteurId !== id && b.parecer) v += b.parecer === 'favoravel' ? 0.3 : -0.3;
  return v + noise;
}

/** Orientação da bancada do partido (sem fatores individuais). */
export function partyOrientation(s: GameState, partyId: string | null, b: Bill, ctx: 'comissao' | 'plenario' | 'veto' = 'plenario'): VoteChoice {
  if (!partyId) return 'A';
  const members = s.government.councillors.filter((c) => c.partyId === partyId && c.id !== PLAYER);
  const bp = 5 + b.slant * 5;
  const fit = 1 - Math.abs(partyPos(partyId) - bp) / 4;
  const counts: Record<Stance, number> = { base: 0, independente: 0, oposicao: 0, oposicao_radical: 0 };
  for (const m of members) counts[s.legislature.blocs[m.id] ?? 'independente']++;
  const bloc = (Object.entries(counts).sort((a, b2) => b2[1] - a[1])[0]?.[0] as Stance) ?? (s.government.mayorCoalition.includes(partyId) ? 'base' : 'independente');
  let v = 0.25 + fit * 0.4 + SIGN[b.executivePosition] * BLOC_FACTOR[members.length ? bloc : s.government.mayorCoalition.includes(partyId) ? 'base' : 'independente'] * (ctx === 'veto' ? 1.5 : 1);
  if (ctx === 'veto') v -= BLOC_FACTOR[bloc] * 0.6;
  if (authorParty(s, b) === partyId) v += 0.7;
  else if (b.author !== 'executivo') v += blocAffinity(authorBloc(s, b), members.length ? bloc : 'independente');
  v += b.publicSupport * (b.salience / 100) * 0.6;
  if (b.kind === 'denominacao') v += 0.7;
  if (b.executiveInitiativeOnly && (b.stage === 'ccj' || ctx === 'veto')) v -= 1.1;
  return v > 0.15 ? 'S' : v < -0.15 ? 'N' : 'A';
}

const toChoice = (v: number): VoteChoice => (v > 0.15 ? 'S' : v < -0.15 ? 'N' : 'A');

function playerChoice(s: GameState, b: Bill, ctx: 'comissao' | 'plenario' | 'veto'): VoteChoice {
  return s.legislature.playerVotes[b.id] ?? (b.author === PLAYER ? 'S' : partyOrientation(s, s.player.partyId, b, ctx));
}

function rollCall(s: GameState, rng: RngState, b: Bill, voters: string[], ctx: 'comissao' | 'plenario' | 'veto'): RollCall {
  const byMember: Record<string, VoteChoice> = {};
  let yes = 0, no = 0, abst = 0;
  for (const id of voters) {
    const c = id === PLAYER ? playerChoice(s, b, ctx) : toChoice(supportScore(s, id, b, ctx, normal(rng, 0, 0.32)));
    byMember[id] = c;
    if (c === 'S') yes++; else if (c === 'N') no++; else abst++;
  }
  let outcome: RollCall['outcome'];
  let quorum: string;
  if (ctx === 'veto') {
    outcome = yes >= ABSOLUTE_MAJORITY ? 'aprovado' : 'rejeitado';
    quorum = `Derrubada do veto exige maioria absoluta (${ABSOLUTE_MAJORITY} votos).`;
  } else {
    outcome = yes > no ? 'aprovado' : 'rejeitado';
    quorum = ctx === 'comissao' ? 'Maioria dos membros presentes da comissão.' : 'Maioria simples dos presentes (projeto de lei ordinária).';
  }
  return { yes, no, abst, byMember, outcome, quorum };
}

/** Previsão do placar sem ruído (para o painel "placar provável"). */
export function forecast(s: GameState, b: Bill, ctx: 'comissao' | 'plenario' | 'veto' = 'plenario'): { yes: number; no: number; undecided: number; byMember: Record<string, VoteChoice> } {
  const voters = ctx === 'comissao' ? s.legislature.committees.find((c) => c.id === b.committeeId)?.members ?? [] : memberIds(s);
  const byMember: Record<string, VoteChoice> = {};
  let yes = 0, no = 0, undecided = 0;
  for (const id of voters) {
    const v = id === PLAYER ? (playerChoice(s, b, ctx) === 'S' ? 1 : playerChoice(s, b, ctx) === 'N' ? -1 : 0) : supportScore(s, id, b, ctx, 0);
    const c: VoteChoice = v > 0.45 ? 'S' : v < -0.45 ? 'N' : 'A';
    byMember[id] = c;
    if (c === 'S') yes++; else if (c === 'N') no++; else undecided++;
  }
  return { yes, no, undecided, byMember };
}

// ---------------- Voto do jogador e consequências ----------------
export function setPlayerVote(state: GameState, billId: string, choice: VoteChoice | null): GameState {
  const s: GameState = structuredClone(state);
  if (choice === null) delete s.legislature.playerVotes[billId];
  else s.legislature.playerVotes[billId] = choice;
  return s;
}

function playerVoteEffects(s: GameState, b: Bill, rc: RollCall, ctx: 'plenario' | 'veto', notes: string[]) {
  const mine = rc.byMember[PLAYER];
  if (!mine || !s.player.mandate) return;
  const m = s.player.mandate;
  const pr = s.player.partyRel;
  const weight = 0.5 + b.salience / 100;
  const orient = partyOrientation(s, s.player.partyId, b, ctx);
  const effects: string[] = [];
  if (b.author !== PLAYER && orient !== 'A' && mine !== 'A') {
    if (mine !== orient) {
      pr.perceivedLoyalty = clamp(pr.perceivedLoyalty - 3 * weight);
      pr.leadershipTrust = clamp(pr.leadershipTrust - 2 * weight);
      effects.push('contrariou a orientação da bancada');
    } else pr.perceivedLoyalty = clamp(pr.perceivedLoyalty + 0.6);
  }
  const execWanted: VoteChoice | null = b.executivePosition === 'favor' ? 'S' : b.executivePosition === 'contra' ? 'N' : null;
  if (execWanted && mine !== 'A') {
    if (mine === execWanted) m.relationExecutive = clamp(m.relationExecutive + (m.stance === 'base' ? 1.5 : 0.8));
    else { m.relationExecutive = clamp(m.relationExecutive - (m.stance === 'base' ? 5 : 2) * weight); if (m.stance === 'base') effects.push('votou contra o governo sendo da base'); }
  }
  if (b.salience >= 40 && mine !== 'A') {
    const withPublic = (mine === 'S') === (b.publicSupport > 0);
    s.character.attributes.popularity = clamp(s.character.attributes.popularity + (withPublic ? 0.4 : -0.9) * weight);
    if (!withPublic) effects.push('ficou contra a opinião pública');
  }
  if (b.author.startsWith('bancada:')) {
    const pid = b.author.slice(8);
    for (const c of s.government.councillors.filter((x) => x.partyId === pid && x.id !== PLAYER)) {
      const r = rel(s, c.id, PLAYER);
      const helped = r.memory.some((x) => x.kind === 'favor' && x.text.startsWith('Votou no projeto'));
      if (mine === 'S') adjustRel(s, c.id, PLAYER, { affinity: 2 });
      else if (mine === 'N') {
        if (helped) {
          adjustRel(s, c.id, PLAYER, { trust: -10 }, { kind: 'traicao', text: `Você votou contra o ${b.number} depois de ter recebido apoio`, weight: 5 });
          effects.push(`${c.name} cobra o apoio que deu a você`);
        } else adjustRel(s, c.id, PLAYER, { affinity: -2 });
      }
    }
  }
  if (effects.length) notes.push(`Seu voto no ${b.number}: ${effects.join('; ')}.`);
}

// ---------------- Passo mensal ----------------
function advanceStage(s: GameState, b: Bill, to: BillStage, text: string, rng: RngState) {
  b.stage = to;
  b.monthsInStage = 0;
  b.scheduled = false;
  b.history.push({ month: { ...s.month }, text });
  if (to === 'merito' || to === 'financas' || to === 'ccj') assignRapporteur(s, b, rng);
}

const playerInterested = (s: GameState, b: Bill) => b.author === PLAYER || (b.author === 'executivo' && playerIsMayor(s)) || b.rapporteurId === PLAYER || b.salience >= 60;

export function legislatureMonthlyStep(s: GameState, rng: RngState): string[] {
  const notes: string[] = [];
  const L = s.legislature;
  if (!L.committees.length) return notes;
  // Novos projetos de bancadas e do Executivo (IA).
  const n = 1 + (next(rng) < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) aiBill(s, rng);
  if (!playerIsMayor(s) && next(rng) < 0.3) {
    const b = fileExecutiveBill(s, rng, pick(rng, THEMES_LIST));
    if (b.salience >= 55) notes.push(`A prefeitura enviou à Câmara: ${b.title} (${b.number}).`);
  }

  for (const b of L.bills) {
    if (!isActive(b)) continue;
    b.monthsInStage++;
    const comm = L.committees.find((c) => c.id === b.committeeId);
    if (b.stage === 'ccj' || b.stage === 'merito' || b.stage === 'financas') {
      if (b.monthsInStage < 1 || !comm) continue;
      const pres = comm.presidentId;
      // Presidente da comissão contrário pode segurar a matéria (até 3 meses — PARÂMETRO).
      if (pres && pres !== PLAYER && b.monthsInStage < 3 && supportScore(s, pres, b, 'comissao', 0) < -0.2 && next(rng) < 0.55) {
        if (b.monthsInStage === 1) b.history.push({ month: { ...s.month }, text: `Matéria sem pauta na comissão (decisão do presidente da comissão).` });
        continue;
      }
      if (b.rapporteurId === PLAYER) b.parecer = playerChoice(s, b, 'comissao') === 'N' ? 'contrario' : 'favoravel';
      else if (b.rapporteurId) b.parecer = supportScore(s, b.rapporteurId, b, 'comissao', normal(rng, 0, 0.2)) >= 0 ? 'favoravel' : 'contrario';
      const rc = rollCall(s, rng, b, comm.members, 'comissao');
      const rap = b.rapporteurId ? `relator(a) ${nameOf(s, b.rapporteurId)}, parecer ${b.parecer === 'favoravel' ? 'favorável' : 'contrário'}` : 'sem relator';
      if (rc.outcome === 'aprovado') {
        const nextStage: BillStage = b.stage === 'ccj' ? 'merito' : b.stage === 'merito' ? (b.kind === 'programa' || b.kind === 'executivo' ? 'financas' : 'plenario') : 'plenario';
        advanceStage(s, b, nextStage, `Aprovado na Comissão de ${comm.name} (${rc.yes}×${rc.no}; ${rap}).`, rng);
      } else {
        const why = b.stage === 'ccj' && b.executiveInitiativeOnly ? ' Motivo central: vício de iniciativa (matéria privativa do prefeito).' : '';
        advanceStage(s, b, 'arquivado', `Parecer rejeitado/contrário na Comissão de ${comm.name} (${rc.yes}×${rc.no}; ${rap}).${why}`, rng);
        if (b.author === PLAYER) notes.push(`Seu projeto ${b.number} foi barrado na Comissão de ${comm.name} (${rc.yes}×${rc.no}).${why}`);
      }
      if (b.author === PLAYER && rc.outcome === 'aprovado') notes.push(`Seu projeto ${b.number} passou na Comissão de ${comm.name} (${rc.yes}×${rc.no}).`);
      continue;
    }
    if (b.stage === 'plenario') {
      const presId = L.presidentId;
      let chance = 0.3 + b.salience / 250 + (b.urgent ? 0.3 : 0) + Math.min(0.3, b.monthsInStage * 0.08);
      if (presId && presId !== PLAYER) chance += supportScore(s, presId, b, 'plenario', 0) > 0.3 ? 0.2 : supportScore(s, presId, b, 'plenario', 0) < -0.2 ? -0.25 : 0;
      if (presId === PLAYER) chance = b.scheduled ? 1 : 0.05;
      if (!b.scheduled && next(rng) > chance) continue;
      const rc = rollCall(s, rng, b, memberIds(s), 'plenario');
      b.vote = rc;
      if (s.player.mandate?.office === 'vereador') {
        L.voteHistory.push({ billId: b.id, month: { ...s.month }, title: `${b.number} — ${b.title}`, player: rc.byMember[PLAYER] ?? null, outcome: rc.outcome });
        playerVoteEffects(s, b, rc, 'plenario', notes);
      }
      if (rc.outcome === 'aprovado') {
        advanceStage(s, b, 'sancao', `Aprovado em plenário (${rc.yes} sim, ${rc.no} não, ${rc.abst} abstenções). Enviado ao prefeito.`, rng);
        if (b.author === PLAYER) {
          s.player.recognition = clamp(s.player.recognition + 2);
          notes.push(`Seu projeto ${b.number} foi aprovado em plenário (${rc.yes}×${rc.no}) e segue para o prefeito.`);
        } else if (playerInterested(s, b)) notes.push(`Plenário aprovou o ${b.number} — ${b.title} (${rc.yes}×${rc.no}).`);
      } else {
        advanceStage(s, b, 'rejeitado', `Rejeitado em plenário (${rc.yes} sim, ${rc.no} não, ${rc.abst} abstenções).`, rng);
        if (b.author === PLAYER) { s.player.recognition = clamp(s.player.recognition - 1); notes.push(`Seu projeto ${b.number} foi rejeitado em plenário (${rc.yes}×${rc.no}).`); }
        else if (b.author === 'executivo' && playerIsMayor(s)) { if (s.player.mandate) s.player.mandate.approval = clamp(s.player.mandate.approval - 2); notes.push(`Derrota do governo: a Câmara rejeitou seu projeto ${b.number} (${rc.yes}×${rc.no}).`); }
        else if (playerInterested(s, b)) notes.push(`Plenário rejeitou o ${b.number} — ${b.title} (${rc.yes}×${rc.no}).`);
      }
      continue;
    }
    if (b.stage === 'sancao') {
      if (playerIsMayor(s)) {
        if (b.monthsInStage >= 2) { enactLaw(s, b, 'Sanção tácita: o prazo de 15 dias passou sem manifestação do prefeito.', notes); }
        continue;
      }
      if (b.monthsInStage < 1) continue;
      let vetoP = b.executivePosition === 'contra' ? 0.8 : b.executivePosition === 'neutro' ? 0.18 : 0.04;
      if (b.executiveInitiativeOnly) vetoP = 0.9;
      if (b.author === PLAYER && s.player.mandate?.stance === 'oposicao_radical') vetoP += 0.1;
      if (next(rng) < vetoP) {
        advanceStage(s, b, 'veto', b.executiveInitiativeOnly ? 'Vetado pelo prefeito por vício de iniciativa (inconstitucionalidade).' : 'Vetado pelo prefeito (contrariedade ao interesse público, segundo a prefeitura).', rng);
        if (b.author === PLAYER) notes.push(`${b.number} — ${b.title}: aprovado na Câmara, mas vetado pelo prefeito. A Câmara aprecia o veto em até 30 dias.`);
      } else enactLaw(s, b, 'Sancionado pelo prefeito.', notes);
      continue;
    }
    if (b.stage === 'veto') {
      if (b.monthsInStage < 1) continue;
      const rc = rollCall(s, rng, b, memberIds(s), 'veto');
      b.vetoVote = rc;
      if (s.player.mandate?.office === 'vereador') {
        L.voteHistory.push({ billId: b.id, month: { ...s.month }, title: `Veto ao ${b.number}`, player: rc.byMember[PLAYER] ?? null, outcome: rc.outcome === 'aprovado' ? 'veto derrubado' : 'veto mantido' });
        playerVoteEffects(s, b, rc, 'veto', notes);
      }
      if (rc.outcome === 'aprovado') {
        enactLaw(s, b, `Veto derrubado (${rc.yes} votos; mínimo ${ABSOLUTE_MAJORITY}). Lei promulgada.`, notes);
        if (playerIsMayor(s) && s.player.mandate) { s.player.mandate.approval = clamp(s.player.mandate.approval - 2); notes.push(`A Câmara derrubou seu veto ao ${b.number} (${rc.yes} votos).`); }
      } else {
        advanceStage(s, b, 'veto_mantido', `Veto mantido (${rc.yes} votos pela derrubada; eram necessários ${ABSOLUTE_MAJORITY}).`, rng);
        if (b.author === PLAYER) notes.push(`O veto ao seu ${b.number} foi mantido (${rc.yes} votos pela derrubada; precisava de ${ABSOLUTE_MAJORITY}).`);
      }
    }
  }
  // Limpeza: guarda projetos ativos, os do jogador e os 60 mais recentes encerrados.
  const done = L.bills.filter((b) => !isActive(b) && b.author !== PLAYER && !(b.author === 'executivo' && playerIsMayor(s)));
  if (done.length > 60) {
    const drop = new Set(done.slice(0, done.length - 60).map((b) => b.id));
    L.bills = L.bills.filter((b) => !drop.has(b.id));
    for (const id of drop) delete L.playerVotes[id];
  }
  if (L.voteHistory.length > 120) L.voteHistory.splice(0, L.voteHistory.length - 120);
  notes.push(...cpiMonthlyStep(s, rng));
  return notes;
}

function enactLaw(s: GameState, b: Bill, text: string, notes: string[]) {
  b.stage = 'lei';
  b.monthsInStage = 0;
  b.history.push({ month: { ...s.month }, text });
  if (b.author === PLAYER && s.player.mandate) {
    s.player.mandate.approval = clamp(s.player.mandate.approval + 3 + b.salience / 25);
    s.player.recognition = clamp(s.player.recognition + 2 + b.salience / 20);
    s.player.base = clamp(s.player.base + 1.5);
    notes.push(`${b.number} — ${b.title}: aprovado e sancionado! Agora é lei municipal.`);
  } else if (b.author === 'executivo' && playerIsMayor(s) && s.player.mandate) {
    s.player.mandate.approval = clamp(s.player.mandate.approval + 1.5 + b.salience / 30);
    notes.push(`Seu projeto ${b.number} — ${b.title} virou lei.`);
  }
}

/** Prefeito-jogador sanciona ou veta. */
export function mayorDecide(s: GameState, billId: string, decision: 'sancionar' | 'vetar'): string {
  const b = s.legislature.bills.find((x) => x.id === billId && x.stage === 'sancao');
  if (!b) return 'Projeto não está aguardando sanção.';
  const notes: string[] = [];
  if (decision === 'sancionar') {
    enactLaw(s, b, 'Sancionado por você.', notes);
    if (s.player.mandate) s.player.mandate.approval = clamp(s.player.mandate.approval + b.publicSupport * b.salience / 40);
    return `Você sancionou o ${b.number}. ${notes.join(' ')}`.trim();
  }
  b.stage = 'veto';
  b.monthsInStage = 0;
  b.history.push({ month: { ...s.month }, text: 'Vetado por você.' });
  if (s.player.mandate) s.player.mandate.approval = clamp(s.player.mandate.approval - b.publicSupport * b.salience / 40);
  const ap = authorParty(s, b);
  if (ap) for (const c of s.government.councillors.filter((x) => x.partyId === ap)) adjustRel(s, c.id, PLAYER, { affinity: -4 }, { kind: 'derrota_imposta', text: `Vetou o ${b.number}`, weight: 2 });
  return `Você vetou o ${b.number}. A Câmara tem 30 dias para apreciar o veto (derrubada exige ${ABSOLUTE_MAJORITY} votos).`;
}

// ---------------- Articulação ----------------
/** Conversas com vereadores indecisos ou contrários para fechar votos num projeto. */
export function articulateVotes(s: GameState, rng: RngState, billId: string): string {
  const b = s.legislature.bills.find((x) => x.id === billId);
  if (!b) return 'Projeto não encontrado.';
  const a = s.character.attributes;
  const ctx = b.stage === 'veto' ? 'veto' : b.stage === 'plenario' ? 'plenario' : 'comissao';
  const voters = ctx === 'comissao' ? s.legislature.committees.find((c) => c.id === b.committeeId)?.members ?? [] : memberIds(s);
  const targets = voters.filter((id) => id !== PLAYER && !b.commitments.includes(id))
    .map((id) => ({ id, v: supportScore(s, id, b, ctx, 0) }))
    .filter((x) => x.v < 0.45 && x.v > -1.2)
    .sort((x, y) => y.v - x.v)
    .slice(0, 3 + Math.floor(a.articulation / 25));
  const won: string[] = [];
  for (const t of targets) {
    const p = 0.25 + a.negotiation / 250 + a.articulation / 300 + standing(s, t.id, PLAYER) / 250 + t.v * 0.25;
    if (next(rng) < Math.max(0.05, Math.min(0.85, p))) {
      b.commitments.push(t.id);
      won.push(nameOf(s, t.id));
      adjustRel(s, t.id, PLAYER, { owed: -1 }, { kind: 'favor', text: `Votou no projeto ${b.number} a seu pedido`, weight: 3 });
    }
  }
  if (!targets.length) return 'Não há votos em disputa: quem é contra não muda de ideia por conversa, e os demais já estão com você.';
  return won.length ? `Você fechou ${won.length} compromisso(s) de voto: ${won.join(', ')}. Eles vão cobrar reciprocidade.` : `Você conversou com ${targets.length} vereadores, mas ninguém se comprometeu.`;
}

export function requestRapporteur(s: GameState, rng: RngState, billId: string): string {
  const b = s.legislature.bills.find((x) => x.id === billId);
  const c = playerCommittee(s);
  if (!b || !c || b.committeeId !== c.id) return 'O projeto não está na sua comissão.';
  const pres = c.presidentId;
  const p = pres === PLAYER ? 1 : 0.25 + standing(s, pres ?? '', PLAYER) / 150 + s.character.attributes.articulation / 250 - b.salience / 300;
  if (next(rng) < p) {
    b.rapporteurId = PLAYER;
    s.player.recognition = clamp(s.player.recognition + 0.5 + b.salience / 60);
    return `Você foi designado(a) relator(a) do ${b.number}. Seu parecer seguirá o voto que você registrar.`;
  }
  return `O presidente da comissão preferiu manter ${b.rapporteurId ? nameOf(s, b.rapporteurId) : 'outro relator'} na relatoria.`;
}

export function publicHearing(s: GameState, rng: RngState, billId: string): string {
  const b = s.legislature.bills.find((x) => x.id === billId);
  if (!b) return 'Projeto não encontrado.';
  b.salience = clamp(b.salience + 12 + next(rng) * 8);
  b.publicSupport = Math.max(-1, Math.min(1, b.publicSupport + (b.author === PLAYER ? 0.12 : 0) + normal(rng, 0, 0.1)));
  b.history.push({ month: { ...s.month }, text: `Audiência pública convocada por ${s.character.name}.` });
  s.player.recognition = clamp(s.player.recognition + 1.2);
  s.player.base = clamp(s.player.base + 1);
  return `Audiência pública sobre o ${b.number}: o tema ganhou repercussão (pressão pública ${Math.round(b.salience)}/100; opinião ${b.publicSupport > 0.1 ? 'favorável' : b.publicSupport < -0.1 ? 'contrária' : 'dividida'}).`;
}

export function schedule(s: GameState, billId: string): string {
  const b = s.legislature.bills.find((x) => x.id === billId && x.stage === 'plenario');
  if (!b) return 'Projeto não está pronto para o plenário.';
  b.scheduled = true;
  return `${b.number} incluído na Ordem do Dia. A votação acontece no fechamento do mês.`;
}

// ---------------- Mesa Diretora ----------------
export const MESA_ROLES = ['Presidente', '1º Vice-presidente', '2º Vice-presidente', '1º Secretário', '2º Secretário'];

/** Mês em que se elege a Mesa e o ano do mandato (prática observada na CMSP: 1º/01 no início da legislatura e dezembro para o ano seguinte). */
export function mesaWindow(s: GameState): number | null {
  const { year, month } = s.month;
  if (year === 2029 && month === 1) return 2029;
  if (month === 12 && year !== 2028 && year <= 2031) return year + 1;
  return null;
}

function aiMesaCandidate(s: GameState, rng: RngState): string {
  const coalition = new Set(s.government.mayorCoalition);
  const pool = s.government.councillors.filter((c) => c.id !== PLAYER);
  let best = pool[0];
  let bw = -1;
  for (const c of pool) {
    const w = (coalition.has(c.partyId) ? 3 : 1) * Math.pow(Math.max(1000, c.votes), 0.3) * (1 + (s.actors[c.id]?.traits.ambition ?? 50) / 100) * (0.2 + next(rng) * 1.6);
    if (w > bw) { bw = w; best = c; }
  }
  return best.id;
}

function fillMesa(s: GameState, presId: string, rng: RngState, dealParties: string[]) {
  const seats = [{ role: MESA_ROLES[0], actorId: presId }];
  const used = new Set([presId]);
  const presParty = presId === PLAYER ? s.player.partyId : councillorParty(s, presId);
  const coalition = s.government.mayorCoalition;
  const order = [...dealParties, ...Object.entries(s.government.councilSeatsByParty).sort((a, b) => b[1] - a[1]).map(([p]) => p).filter((p) => presId === PLAYER || coalition.includes(p) || next(rng) < 0.3)];
  const seen = new Set<string>();
  for (const p of order) {
    if (seats.length >= MESA_ROLES.length) break;
    if (seen.has(p) || (p === presParty && seats.length < 3)) continue;
    seen.add(p);
    const c = s.government.councillors.filter((x) => x.partyId === p && !used.has(x.id) && x.id !== PLAYER).sort((a, b) => (s.actors[b.id]?.influence ?? 0) - (s.actors[a.id]?.influence ?? 0))[0];
    if (!c) continue;
    used.add(c.id);
    seats.push({ role: MESA_ROLES[seats.length], actorId: c.id });
  }
  for (const c of s.government.councillors) {
    if (seats.length >= MESA_ROLES.length) break;
    if (used.has(c.id) || c.id === PLAYER) continue;
    used.add(c.id);
    seats.push({ role: MESA_ROLES[seats.length], actorId: c.id });
  }
  s.legislature.mesa = seats;
}

/** Eleição da Mesa (fechamento do mês da janela). Retorna texto para o log. */
export function electMesa(s: GameState, term: number, rng: RngState): string {
  const L = s.legislature;
  const ai = aiMesaCandidate(s, rng);
  const playerRuns = L.mesaCandidates.includes(PLAYER) && playerIsCouncillor(s);
  let winner = ai;
  let detail = '';
  if (playerRuns) {
    const aiParty = councillorParty(s, ai);
    let pv = 0, av = 0;
    for (const c of s.government.councillors) {
      if (c.id === PLAYER) { pv++; continue; }
      const bloc = L.blocs[c.id] ?? 'independente';
      let p = 0.15 + standing(s, c.id, PLAYER) / 70 + (c.partyId === s.player.partyId ? 1.1 : 0) + (L.mesaDeals.includes(c.partyId) ? 1.3 : 0);
      if (s.player.mandate?.stance !== 'base' && (bloc === 'oposicao' || bloc === 'oposicao_radical')) p += 0.6;
      if (s.player.mandate?.stance === 'base' && bloc === 'base') p += 0.2;
      let a = 0.35 + (bloc === 'base' ? 0.7 : bloc === 'independente' ? 0.2 : -0.3) + (c.partyId === aiParty ? 1.2 : 0) + (s.actors[c.id]?.traits.loyalty ?? 50) / 200;
      p += normal(rng, 0, 0.35);
      a += normal(rng, 0, 0.35);
      if (p > a) pv++; else av++;
    }
    const total = pv + av;
    const playerWins = pv >= ABSOLUTE_MAJORITY || (av < ABSOLUTE_MAJORITY && pv > av);
    detail = ` Votação: você ${pv} × ${av} ${nameOf(s, ai)} (${partyById(aiParty)?.acronym}); ${pv >= ABSOLUTE_MAJORITY || av >= ABSOLUTE_MAJORITY ? 'decidida no 1º escrutínio por maioria absoluta' : 'sem maioria absoluta, decidida no 2º escrutínio'} (total ${total}).`;
    if (playerWins) winner = PLAYER;
    for (const pid of L.mesaDeals) {
      const pr = s.promises.find((x) => x.kind === 'cargo_mesa' && x.status === 'aberta' && x.text.includes(`[${pid}]`));
      if (pr) pr.status = playerWins ? 'cumprida' : 'caducou';
    }
    if (!playerWins && s.player.mandate) s.player.mandate.relationExecutive = clamp(s.player.mandate.relationExecutive - (s.player.mandate.stance === 'base' ? 3 : 6));
  }
  fillMesa(s, winner, rng, winner === PLAYER ? L.mesaDeals : []);
  L.presidentId = winner;
  L.mesaYear = term;
  L.mesaCandidates = [];
  L.mesaDeals = [];
  s.flags[`mesa_${term}`] = true;
  const wc = s.government.councillors.find((c) => c.id === winner);
  s.government.councilPresident = { personId: winner, name: nameOf(s, winner), partyId: winner === PLAYER ? s.player.partyId! : wc!.partyId, real: winner === PLAYER ? false : !!wc?.real, year: term, simulated: winner !== PLAYER };
  if (s.player.mandate) s.player.mandate.councilPresident = winner === PLAYER;
  if (winner === PLAYER) {
    s.player.recognition = clamp(s.player.recognition + 8);
    return `Você foi eleito(a) presidente da Câmara Municipal para ${term}! Agora controla a pauta do plenário.${detail}`;
  }
  return `Eleição da Mesa (simulada): ${nameOf(s, winner)} (${partyById(s.government.councilPresident.partyId)?.acronym}) presidirá a Câmara em ${term}.${detail}`;
}

export function negotiateMesaVote(s: GameState, rng: RngState, partyId: string): string {
  const L = s.legislature;
  const seats = s.government.councilSeatsByParty[partyId] ?? 0;
  if (!seats) return 'Esse partido não tem bancada.';
  if (L.mesaDeals.includes(partyId)) return 'Você já fechou acordo com essa bancada.';
  const members = s.government.councillors.filter((c) => c.partyId === partyId && c.id !== PLAYER);
  const avgStanding = members.reduce((a, c) => a + standing(s, c.id, PLAYER), 0) / Math.max(1, members.length);
  const inCoalition = s.government.mayorCoalition.includes(partyId);
  const p = 0.2 + s.character.attributes.negotiation / 220 + avgStanding / 200 - (inCoalition ? 0.15 : 0) - seats / 60;
  const acr = partyById(partyId)?.acronym ?? partyId;
  if (next(rng) < Math.max(0.05, Math.min(0.8, p))) {
    L.mesaDeals.push(partyId);
    s.promises.push({ id: `pm_mesa_${monthIndex(s.month)}_${partyId}`, toActorId: members[0]?.id ?? partyId, kind: 'cargo_mesa', contestId: null, text: `Cargo na Mesa para a bancada do ${acr} [${partyId}]`, status: 'aberta', madeAt: { ...s.month } });
    for (const c of members) adjustRel(s, c.id, PLAYER, { trust: 3 }, { kind: 'acordo', text: 'Acordo para a eleição da Mesa', weight: 3 });
    return `Acordo fechado: a bancada do ${acr} (${seats} votos) apoia sua chapa em troca de um cargo na Mesa.`;
  }
  return `A bancada do ${acr} não fechou com você${inCoalition ? ' — está comprometida com o candidato do governo' : ''}.`;
}

// ---------------- CPI ----------------
export function startCpi(s: GameState, topic: string): Cpi {
  const cpi: Cpi = { id: `cpi_${monthIndex(s.month)}`, topic, signatures: [PLAYER], status: 'coleta', startedAt: { ...s.month }, endsAt: null, proposer: PLAYER };
  s.legislature.cpis.push(cpi);
  return cpi;
}

export function collectSignatures(s: GameState, rng: RngState, cpiId: string): string {
  const cpi = s.legislature.cpis.find((c) => c.id === cpiId && c.status === 'coleta');
  if (!cpi) return 'Não há coleta de assinaturas aberta.';
  const a = s.character.attributes;
  const tries = 5 + Math.floor(a.articulation / 15);
  const pool = memberIds(s).filter((id) => !cpi.signatures.includes(id)).sort(() => next(rng) - 0.5).slice(0, tries);
  let got = 0;
  for (const id of pool) {
    const bloc = s.legislature.blocs[id] ?? 'independente';
    const p = { base: 0.04, independente: 0.3, oposicao: 0.6, oposicao_radical: 0.8 }[bloc] + standing(s, id, PLAYER) / 200 + a.articulation / 500;
    if (next(rng) < p) { cpi.signatures.push(id); got++; }
  }
  if (cpi.signatures.length >= CPI_SIGNATURES) {
    cpi.status = 'instalada';
    cpi.endsAt = addMonths(s.month, CPI_MONTHS);
    s.player.recognition = clamp(s.player.recognition + 8);
    if (s.player.mandate) s.player.mandate.relationExecutive = clamp(s.player.mandate.relationExecutive - 20);
    return `CPI instalada com ${cpi.signatures.length} assinaturas! Prazo de ${CPI_MONTHS} meses para investigar: ${cpi.topic}.`;
  }
  return `+${got} assinatura(s). A CPI tem ${cpi.signatures.length} de ${CPI_SIGNATURES} necessárias.`;
}

function cpiMonthlyStep(s: GameState, rng: RngState): string[] {
  const out: string[] = [];
  for (const cpi of s.legislature.cpis) {
    const age = monthIndex(s.month) - monthIndex(cpi.startedAt);
    if (cpi.status === 'coleta' && age >= 3) {
      cpi.status = 'arquivada';
      out.push(`O pedido de CPI (${cpi.topic}) não alcançou ${CPI_SIGNATURES} assinaturas em 3 meses e foi arquivado.`);
    }
    if (cpi.status === 'instalada') {
      s.player.recognition = clamp(s.player.recognition + 1.2);
      if (s.player.mandate) s.player.mandate.relationExecutive = clamp(s.player.mandate.relationExecutive - 2);
      if (cpi.endsAt && monthIndex(s.month) >= monthIndex(cpi.endsAt)) {
        cpi.status = 'concluida';
        const strong = next(rng) < 0.35 + s.character.attributes.politicalKnowledge / 250;
        if (strong) {
          s.player.recognition = clamp(s.player.recognition + 5);
          s.character.attributes.popularity = clamp(s.character.attributes.popularity + 2);
          out.push(`CPI concluída: o relatório final aponta irregularidades e é enviado ao Ministério Público e ao Tribunal de Contas do Município.`);
        } else out.push('CPI concluída: a base do governo esvaziou o relatório final, que saiu sem recomendações fortes.');
      }
    }
  }
  return out;
}

// ---------------- Notícias da Câmara ----------------
export function legislatureNews(s: GameState, rng: RngState, notes: string[]) {
  for (const t of notes) {
    if (t.includes('aprovado em plenário') && t.startsWith('Seu projeto')) pushNews(s, rng, { section: 'Câmara', headline: `Câmara aprova projeto de ${s.character.name}`, lead: t.replace('Seu projeto', 'O projeto'), aboutPlayer: true, tone: 'positivo', outlets: ['diariopaulistano', 'radiocapital'] });
    else if (t.includes('barrado na Comissão') || (t.includes('rejeitado em plenário') && t.startsWith('Seu projeto'))) pushNews(s, rng, { section: 'Câmara', headline: `Projeto de ${s.character.name} é derrotado na Câmara`, lead: t.replace('Seu projeto', 'O projeto'), aboutPlayer: true, tone: 'neutro', outlets: ['diariopaulistano'] });
    else if (t.includes('cobra o apoio')) pushNews(s, rng, { section: 'Câmara', headline: `Bastidores: aliados reclamam de voto de ${s.character.name}`, lead: t, aboutPlayer: true, tone: 'critico', outlets: ['papoplenario', 'diariopaulistano'] });
    else if (t.startsWith('Derrota do governo')) pushNews(s, rng, { section: 'Prefeitura', headline: 'Câmara impõe derrota à prefeitura', lead: t.replace('seu projeto', 'o projeto do Executivo'), aboutPlayer: true, tone: 'critico', outlets: ['tvmetropole', 'canal24'] });
    else if (t.startsWith('CPI concluída')) pushNews(s, rng, { section: 'Câmara', headline: t.includes('aponta irregularidades') ? 'CPI da Câmara aponta irregularidades em contrato' : 'CPI termina sem conclusões fortes', lead: t, aboutPlayer: true, tone: t.includes('aponta') ? 'positivo' : 'neutro', outlets: ['tvmetropole', 'pauta', 'contraponto'] });
    else if (t.startsWith('Plenário aprovou') || t.startsWith('Plenário rejeitou')) pushNews(s, rng, { section: 'Câmara', headline: t.split(' (')[0], lead: 'Votação simulada pelo modelo do jogo.', aboutPlayer: false, tone: 'neutro', outlets: ['diariopaulistano', 'radiocapital'] });
  }
}
