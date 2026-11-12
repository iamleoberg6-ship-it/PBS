// Pauta de votações para mandatos estaduais e federais (ajuste pós-Fase 5).
// Todo mês, deputado(a) estadual, deputado(a) federal e senador(a) recebem matérias para votar (sem custo de agenda).
// O voto pesa na relação com o partido (orientação da bancada), com o governo, com o eleitorado e com a base.
// FICÇÃO/PROPOSTA: as matérias são genéricas e fictícias (não reproduzem projetos reais em tramitação);
// placares e efeitos são mecânica de jogo. REGRA REAL citada: maioria simples para lei ordinária (CF art. 47),
// 3/5 em dois turnos para emenda constitucional (CF art. 60 §2º; Constituição de SP art. 22).

import { next, normal, pick, type RngState } from '../rng';
import { PARTIES, partyById } from '../data/parties';
import { generalPosition, partyIdeology } from '../data/ideology';
import { partyAlignment } from './general';
import { pushNews } from './news';
import { nationalVoteEffects } from './national';
import type { FloorVote, GameState, VoteChoice } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

export interface Template { title: string; summary: string; theme: string; slant: number; support: number; salience: number; byGov: boolean; pec?: boolean; houses: ('alesp' | 'camara' | 'senado')[] }

// slant: −1 progressista/estatal … +1 conservador/mercado · support: −1..+1 apoio do público (aproximação de jogo)
export const TEMPLATES: Template[] = [
  { title: 'Concessão de linhas de trens metropolitanos à iniciativa privada', summary: 'Projeto do Executivo autoriza conceder operação e manutenção por 30 anos.', theme: 'mobilidade', slant: 0.6, support: -0.1, salience: 60, byGov: true, houses: ['alesp'] },
  { title: 'Reajuste do piso dos professores da rede estadual', summary: 'Eleva o piso salarial do magistério estadual acima da inflação.', theme: 'educacao', slant: -0.4, support: 0.6, salience: 55, byGov: false, houses: ['alesp'] },
  { title: 'Câmeras corporais obrigatórias nas polícias estaduais', summary: 'Torna obrigatório o uso e define regras de guarda das gravações.', theme: 'seguranca', slant: -0.3, support: 0.3, salience: 65, byGov: false, houses: ['alesp'] },
  { title: 'Ampliação das escolas cívico-militares na rede estadual', summary: 'Expande o modelo para mais escolas, com adesão das comunidades escolares.', theme: 'educacao', slant: 0.6, support: 0.1, salience: 50, byGov: true, houses: ['alesp'] },
  { title: 'Redução do ICMS sobre a conta de luz', summary: 'Corta a alíquota estadual; o governo estima perda de arrecadação.', theme: 'economia', slant: 0.2, support: 0.7, salience: 60, byGov: false, houses: ['alesp'] },
  { title: 'Reforma da previdência dos servidores estaduais', summary: 'PEC estadual muda idade mínima e regras de transição.', theme: 'economia', slant: 0.5, support: -0.4, salience: 70, byGov: true, pec: true, houses: ['alesp'] },
  { title: 'Programa estadual de moradia para famílias em área de risco', summary: 'Cria linha de crédito e subsídio para reassentamento.', theme: 'habitacao', slant: -0.3, support: 0.5, salience: 40, byGov: true, houses: ['alesp'] },
  { title: 'Autonomia orçamentária para universidades estaduais', summary: 'Mantém vinculação de receita do ICMS às universidades.', theme: 'educacao', slant: -0.4, support: 0.2, salience: 35, byGov: false, houses: ['alesp'] },
  { title: 'Proibição de celulares em sala de aula na rede estadual', summary: 'Restringe o uso de aparelhos durante as aulas.', theme: 'educacao', slant: 0.1, support: 0.5, salience: 45, byGov: true, houses: ['alesp'] },
  { title: 'Aumento de pena para crimes contra policiais', summary: 'Endurece penas e agrava regime de cumprimento.', theme: 'seguranca', slant: 0.7, support: 0.4, salience: 55, byGov: false, houses: ['camara', 'senado'] },
  { title: 'Medida provisória que reajusta o Bolsa Família', summary: 'Reajusta benefícios e cria adicional por criança.', theme: 'social', slant: -0.6, support: 0.5, salience: 60, byGov: true, houses: ['camara', 'senado'] },
  { title: 'Isenção do Imposto de Renda para salários mais baixos', summary: 'Amplia a faixa de isenção, compensada por taxação de altas rendas.', theme: 'economia', slant: -0.3, support: 0.8, salience: 75, byGov: true, houses: ['camara', 'senado'] },
  { title: 'Regulação das plataformas digitais', summary: 'Obriga redes sociais a remover conteúdo ilegal e ter representante no país.', theme: 'tecnologia', slant: -0.4, support: 0.1, salience: 70, byGov: true, houses: ['camara', 'senado'] },
  { title: 'Marco temporal para terras indígenas', summary: 'Restringe demarcações a áreas ocupadas na data da Constituição.', theme: 'meioambiente', slant: 0.8, support: -0.1, salience: 55, byGov: false, houses: ['camara', 'senado'] },
  { title: 'PEC que limita decisões individuais de ministros do STF', summary: 'Restringe decisões monocráticas que suspendam leis.', theme: 'instituicoes', slant: 0.6, support: 0.2, salience: 60, byGov: false, pec: true, houses: ['camara', 'senado'] },
  { title: 'Fim da escala 6x1', summary: 'Reduz a jornada máxima semanal e garante dois dias de descanso.', theme: 'trabalho', slant: -0.6, support: 0.6, salience: 80, byGov: false, pec: true, houses: ['camara', 'senado'] },
  { title: 'Novo arcabouço de gastos para estados endividados', summary: 'Renegocia dívidas estaduais com contrapartidas de investimento.', theme: 'economia', slant: 0.1, support: 0.1, salience: 40, byGov: true, houses: ['camara', 'senado'] },
  { title: 'Licenciamento ambiental simplificado', summary: 'Cria licença por adesão para atividades de médio impacto.', theme: 'meioambiente', slant: 0.7, support: -0.2, salience: 50, byGov: false, houses: ['camara', 'senado'] },
  { title: 'Aprovação de indicação de autoridade (sabatina)', summary: 'Plenário vota a indicação feita pelo presidente para cargo que depende do Senado.', theme: 'instituicoes', slant: 0, support: 0, salience: 50, byGov: true, houses: ['senado'] },
  { title: 'Prorrogação dos incentivos fiscais da Zona Franca de Manaus', summary: 'Estende benefícios tributários do polo industrial por mais dez anos.', theme: 'economia', slant: 0.1, support: 0.0, salience: 45, byGov: true, houses: ['camara', 'senado'] },
  { title: 'Recursos para obras hídricas no semiárido', summary: 'Crédito extraordinário para adutoras, cisternas e barragens.', theme: 'infraestrutura', slant: -0.2, support: 0.4, salience: 45, byGov: true, houses: ['camara', 'senado'] },
  { title: 'Renegociação de dívidas rurais após perdas climáticas', summary: 'Alonga prazos e reduz juros para produtores atingidos por seca ou enchente.', theme: 'economia', slant: 0.4, support: 0.2, salience: 45, byGov: false, houses: ['camara', 'senado'] },
  { title: 'Fundo nacional de saneamento para municípios', summary: 'Repasses a cidades com baixa cobertura de esgoto, com metas de universalização.', theme: 'infraestrutura', slant: -0.2, support: 0.5, salience: 40, byGov: true, houses: ['camara', 'senado'] },
  { title: 'Ferrovias para escoamento da produção', summary: 'Autoriza concessões e investimento público em ferrovias de carga.', theme: 'infraestrutura', slant: 0.4, support: 0.3, salience: 40, byGov: true, houses: ['camara', 'senado'] },
  { title: 'Fundo de reconstrução após enchentes', summary: 'Recursos para moradia, estradas e crédito a empresas em áreas atingidas.', theme: 'social', slant: -0.1, support: 0.6, salience: 55, byGov: true, houses: ['camara', 'senado'] },
  { title: 'Piso nacional da enfermagem: fonte de custeio', summary: 'Define de onde sai o dinheiro para pagar o piso.', theme: 'saude', slant: -0.3, support: 0.7, salience: 55, byGov: false, houses: ['camara', 'senado'] },
];

export const HOUSE: Record<string, { key: 'alesp' | 'camara' | 'senado'; label: string; seats: number }> = {
  deputado_estadual: { key: 'alesp', label: 'Alesp', seats: 94 },
  deputado_federal: { key: 'camara', label: 'Câmara dos Deputados', seats: 513 },
  senador: { key: 'senado', label: 'Senado', seats: 81 },
};

const posOf = (partyId: string | null) => (partyId ? generalPosition(partyIdeology(partyId)) ?? 5 : 5);
const govOf = (s: GameState, office: string) => (office === 'deputado_estadual' ? { h: s.stateWorld.governor, coalition: s.stateWorld.governorCoalition } : { h: s.stateWorld.president, coalition: s.stateWorld.presidentCoalition });

/** Orientação de uma bancada: governo × oposição pesa mais que ideologia, como na prática do plenário. */
/** Matérias de iniciativa parlamentar aprovadas pelo Congresso que chegam à sanção do presidente (jogador). */
export const TEMPLATES_FOR_SANCTION = TEMPLATES.filter((t) => !t.byGov && t.houses.includes('camara'));

export function benchOrientation(s: GameState, office: string, partyId: string | null, v: Pick<FloorVote, 'slant' | 'govPosition'>): VoteChoice {
  if (!partyId) return 'A';
  const g = govOf(s, office);
  const align = partyAlignment(partyId, g.h.partyId, g.coalition);
  const fit = 1 - Math.abs(posOf(partyId) - (5 + v.slant * 5)) / 4; // −1..1
  const gov = v.govPosition === 'favor' ? 1 : v.govPosition === 'contra' ? -1 : 0;
  const score = fit * 0.6 + gov * (align - 0.45) * 1.4;
  return score > 0.12 ? 'S' : score < -0.12 ? 'N' : 'A';
}

export function generateFloorVotes(s: GameState, rng: RngState): FloorVote[] {
  const m = s.player.mandate;
  const h = m ? HOUSE[m.office] : null;
  if (!m || !h) return [];
  const pool = TEMPLATES.filter((t) => t.houses.includes(h.key) && !s.floorVotes.slice(-12).some((f) => f.title === t.title));
  const n = next(rng) < 0.45 ? 2 : 1;
  const out: FloorVote[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const t = pick(rng, pool);
    pool.splice(pool.indexOf(t), 1);
    const g = govOf(s, m.office);
    const govPos: FloorVote['govPosition'] = t.byGov ? 'favor' : (() => { const fit = 1 - Math.abs(posOf(g.h.partyId) - (5 + t.slant * 5)) / 4; return fit > 0.35 ? 'favor' : fit < -0.2 ? 'contra' : 'neutro'; })();
    const v: FloorVote = {
      id: `fv_${s.month.year}_${s.month.month}_${i}`, month: { ...s.month }, house: h.key, title: t.title, summary: t.summary, theme: t.theme,
      slant: Math.max(-1, Math.min(1, t.slant + normal(rng, 0, 0.1))), publicSupport: Math.max(-1, Math.min(1, t.support + normal(rng, 0, 0.15))),
      salience: clamp(t.salience + normal(rng, 0, 8)), author: t.byGov ? 'governo' : 'parlamentares', govPosition: govPos, pec: !!t.pec,
      partyOrientation: 'A', playerVote: null, result: null, effects: null,
    };
    v.partyOrientation = benchOrientation(s, m.office, s.player.partyId, v);
    out.push(v);
  }
  return out;
}

export function setFloorVote(state: GameState, id: string, choice: VoteChoice | null): GameState {
  const s: GameState = structuredClone(state);
  const v = s.floorVotes.find((x) => x.id === id && !x.result);
  if (v) v.playerVote = choice;
  return s;
}

/** Placar simulado da casa: cada bancada segue a orientação, com dissidências. */
function tally(s: GameState, office: string, v: FloorVote, rng: RngState) {
  const h = HOUSE[office];
  const seats: Record<string, number> = h.key === 'alesp' ? s.stateWorld.alespSeats : h.key === 'camara' ? scaleCamara(s) : senateSeats();
  let yes = 0, no = 0, abst = 0;
  for (const [pid, n] of Object.entries(seats)) {
    const o = benchOrientation(s, office, pid, v);
    for (let k = 0; k < n; k++) {
      const r = next(rng);
      const dissent = 0.12 + Math.abs(v.publicSupport) * 0.1;
      const c = r < dissent ? (o === 'S' ? 'N' : o === 'N' ? 'S' : next(rng) < 0.5 ? 'S' : 'N') : o;
      if (c === 'S') yes++; else if (c === 'N') no++; else abst++;
    }
  }
  // Fase 15: substitutivo negociado pelo relator (jogador) desloca parte da casa para o Sim (PROPOSTA).
  if (v.boost) { const shift = Math.round(h.seats * Math.abs(v.boost)); if (v.boost > 0) { const k = Math.min(shift, no); no -= k; yes += k; } else { const k = Math.min(shift, yes); yes -= k; no += k; } }
  const total = h.seats;
  const needed = v.pec ? Math.ceil(total * 0.6) : null;
  const outcome: 'aprovado' | 'rejeitado' = needed ? (yes >= needed ? 'aprovado' : 'rejeitado') : yes > no ? 'aprovado' : 'rejeitado';
  return { yes, no, abst, outcome, rule: needed ? `PEC: exige 3/5 (${needed} votos)` : 'maioria simples dos presentes' };
}

// Câmara inteira (513): o jogo só conhece a bancada de SP; extrapola proporcionalmente (aproximação de jogo).
export const scaleCamaraSeats = (s: GameState) => scaleCamara(s);
export const senateSeatsApprox = () => senateSeats();
function scaleCamara(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  const sp = s.stateWorld.camaraSeats;
  const tot = Object.values(sp).reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  for (const [p, n] of Object.entries(sp)) { out[p] = Math.round((n / tot) * 513); acc += out[p]; }
  const first = Object.keys(out)[0];
  if (first) out[first] += 513 - acc;
  return out;
}
function senateSeats(): Record<string, number> {
  // Distribuição aproximada de jogo (o jogo não modela os 81 senadores individualmente).
  const w: Record<string, number> = { PL: 16, PSD: 13, MDB: 11, PT: 9, 'UNIÃO': 7, PP: 7, REPUBLICANOS: 5, PODE: 4, PSB: 4, PDT: 3, NOVO: 1, PSDB: 1 };
  return Object.fromEntries(Object.entries(w).map(([acr, n]) => [PARTIES.find((p) => p.acronym === acr)!.id, n]));
}

/** Resolve as votações do mês anterior e aplica as consequências do voto do jogador. */
export function resolveFloorVotes(s: GameState, rng: RngState): string[] {
  const notes: string[] = [];
  const m = s.player.mandate;
  for (const v of s.floorVotes) {
    if (v.result) continue;
    if (!m || !HOUSE[m.office] || HOUSE[m.office].key !== v.house) { v.result = { yes: 0, no: 0, abst: 0, outcome: 'rejeitado', rule: 'sessão sem você (mandato encerrado)' }; continue; }
    // Fase 15: o líder define a orientação da própria bancada.
    const ld = m.upper?.leg?.leaderUntil; const leader = !!ld && ld > s.month.year * 12 + s.month.month;
    if (leader && v.playerVote) v.partyOrientation = v.playerVote;
    const auto = !v.playerVote;
    const mine: VoteChoice = v.playerVote ?? v.partyOrientation;
    v.playerVote = mine;
    const rc = tally(s, m.office, v, rng);
    v.result = rc;
    const w = 0.5 + v.salience / 100;
    const fx: string[] = [];
    const pr = s.player.partyRel;
    if (v.partyOrientation !== 'A' && mine !== 'A') {
      if (mine !== v.partyOrientation) { pr.perceivedLoyalty = clamp(pr.perceivedLoyalty - 3 * w); pr.leadershipTrust = clamp(pr.leadershipTrust - 2 * w); s.flags.votosContraPartido = Number(s.flags.votosContraPartido ?? 0) + 1; fx.push('contrariou a orientação do partido'); }
      else { pr.perceivedLoyalty = clamp(pr.perceivedLoyalty + 0.6); }
    }
    const u = m.upper;
    const govWanted: VoteChoice | null = v.govPosition === 'favor' ? 'S' : v.govPosition === 'contra' ? 'N' : null;
    if (u && govWanted && mine !== 'A') {
      if (mine === govWanted) { u.relationGov = clamp(u.relationGov + 2 * w); fx.push('agradou ao governo'); }
      else { u.relationGov = clamp(u.relationGov - 3 * w); fx.push('desagradou ao governo'); }
    }
    if (mine !== 'A') {
      const pub = v.publicSupport * (mine === 'S' ? 1 : -1) * w * 1.6;
      m.approval = clamp(m.approval + pub);
      s.character.attributes.popularity = clamp(s.character.attributes.popularity + pub * 0.4);
      if (Math.abs(pub) > 0.8) fx.push(pub > 0 ? 'o eleitorado aprovou seu voto' : 'o eleitorado reprovou seu voto');
      const me = generalPosition(s.character.ideology) ?? 5;
      const coherent = (mine === 'S' ? 1 : -1) * (1 - Math.abs(me - (5 + v.slant * 5)) / 4);
      s.player.base = clamp(s.player.base + coherent * 0.8 * w);
      if (coherent < -0.5) fx.push('sua base estranhou o voto');
    } else if (v.salience > 55) { m.approval = clamp(m.approval - 0.4); fx.push('abstenção em tema importante foi criticada'); }
    const reg = nationalVoteEffects(s, v.title, mine, v.publicSupport, v.salience, rc.outcome === 'aprovado');
    if (reg) fx.push(reg);
    if (v.relatorPlayer) {
      const won = (rc.outcome === 'aprovado') === (v.parecer !== 'contrario');
      s.player.recognition = clamp(s.player.recognition + (won ? 2 : 0.5));
      fx.push(won ? 'seu parecer de relator(a) prevaleceu no plenário' : 'o plenário contrariou seu parecer');
    }
    v.effects = fx.join('; ') || 'sem repercussão relevante';
    notes.push(`${HOUSE[m.office].label} ${rc.outcome === 'aprovado' ? 'aprovou' : 'rejeitou'} "${v.title}" (${rc.yes} sim, ${rc.no} não). Seu voto: ${mine === 'S' ? 'SIM' : mine === 'N' ? 'NÃO' : 'abstenção'}${auto ? ' (você não votou: seguiu a orientação da bancada)' : ''} — ${v.effects}.`);
    if (v.salience >= 60) pushNews(s, rng, { section: 'Brasil', headline: `${HOUSE[m.office].label} ${rc.outcome === 'aprovado' ? 'aprova' : 'rejeita'}: ${v.title.toLowerCase()} (simulação)`, lead: `Placar: ${rc.yes} a ${rc.no}. ${s.character.name} votou ${mine === 'S' ? 'a favor' : mine === 'N' ? 'contra' : 'pela abstenção'}.`, aboutPlayer: true, tone: 'neutro', outlets: ['canal24', 'diariopaulistano'] });
  }
  if (s.floorVotes.length > 60) s.floorVotes.splice(0, s.floorVotes.length - 60);
  return notes;
}

export const partyAcr = (id: string | null) => (id ? partyById(id)?.acronym ?? id : '—');
