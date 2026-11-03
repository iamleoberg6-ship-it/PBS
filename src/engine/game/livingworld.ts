// Mundo vivo (Fase 5.1–5.3): ambições da IA, crises de imagem e promessas públicas a comunidades.
//
// Política para pessoas reais: a IA só toma decisões de carreira (trocar de partido, disputar outro cargo)
// por personagens FICTÍCIOS. Vereadores reais em exercício não trocam de partido nem se candidatam a deputado
// por decisão do jogo. Crises de imagem atingem apenas o jogador e personagens fictícios — nunca pessoas reais.
// REGRA REAL citada: janela partidária (Lei 9.096/95 art. 22-A, III), direito de resposta (Lei 13.188/2015).
// Todo o resto (probabilidades, efeitos, veículos) é PROPOSTA de gameplay.

import { next, pick, type RngState } from '../rng';
import { monthIndex } from '../calendar';
import { PARTIES, listIdForParty, partyById } from '../data/parties';
import { REGIONS } from '../data/regions';
import { ideologicalDistance, partyIdeology } from '../data/ideology';
import { partyStrength } from './elections';
import { seatsByParty } from './council';
import { computeBlocs } from './legislature';
import { addGoodwill } from './campaign';
import { OUTLETS, outletById, outletCredibility, pushNews } from './news';
import { PLAYER } from './relations';
import { THEMES } from './actions';
import { freeBudget } from './secretariat';
import type { CommunityPromise, CrisisResponse, GameState, ImageCrisis, OutletState } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const OFFICE_LABEL: Record<string, string> = { vereador: 'vereador(a)', prefeito: 'prefeito(a)', secretario: 'secretário(a) municipal', deputado_estadual: 'deputado(a) estadual', deputado_federal: 'deputado(a) federal', senador: 'senador(a)', governador: 'governador(a)', secretario_estadual: 'secretário(a) estadual' };
const now = (s: GameState) => monthIndex(s.month);

// =====================================================================
// 5.1 Ambições: trocas de partido na janela (vereadores fictícios)
// =====================================================================

export function councillorWindowSwitches(s: GameState, rng: RngState): string[] {
  const notes: string[] = [];
  const moved: string[] = [];
  for (const c of s.government.councillors) {
    if (c.id === PLAYER || c.real) continue;
    const own = partyStrength(s, c.partyId);
    const base = own < 2 ? 0.16 : own < 4 ? 0.08 : 0.03;
    if (next(rng) >= base) continue;
    const ownIdeo = partyIdeology(c.partyId);
    const options = PARTIES.filter((p) => p.id !== c.partyId && listIdForParty(p.id) !== listIdForParty(c.partyId))
      .map((p) => ({ p, d: ideologicalDistance(ownIdeo, partyIdeology(p.id)) ?? 0.3, st: partyStrength(s, p.id) }))
      .filter((x) => x.d <= 0.22 && x.st > own)
      .sort((a, b) => b.st - b.d * 20 - (a.st - a.d * 20));
    if (!options.length) continue;
    const dest = options[Math.floor(next(rng) * Math.min(3, options.length))].p;
    moved.push(`${c.name} (${partyById(c.partyId)?.acronym} → ${dest.acronym})`);
    c.partyId = dest.id;
  }
  if (moved.length) {
    s.government.councilSeatsByParty = seatsByParty(s.government.councillors);
    s.legislature.blocs = computeBlocs(s, rng);
    notes.push(`Janela partidária (Lei 9.096/95 art. 22-A, III): ${moved.length} vereador(es) fictício(s) trocaram de legenda — ${moved.join('; ')}.`);
    pushNews(s, rng, { section: 'Partidos', headline: `Janela partidária: ${moved.length} vereador(es) mudam de partido na Câmara de SP (simulação)`, lead: moved.join('; '), aboutPlayer: false, tone: 'neutro', outlets: ['diariopaulistano', 'radiocapital'] });
  } else {
    notes.push('Janela partidária aberta: nenhum vereador trocou de legenda neste ciclo.');
  }
  return notes;
}

// =====================================================================
// 5.2 Crises de imagem
// =====================================================================

export function initOutlets(): OutletState[] {
  return OUTLETS.map((o) => ({ id: o.id, credibility: o.credibility, falseStories: 0, correctedStories: 0 }));
}

const outletState = (s: GameState, id: string) => {
  let o = s.outlets.find((x) => x.id === id);
  if (!o) { o = { id, credibility: outletById(id).credibility, falseStories: 0, correctedStories: 0 }; s.outlets.push(o); }
  return o;
};

interface Topic { topic: string; headline: (name: string) => string; truth: ImageCrisis['truth']; origin: string }

/** Pautas verdadeiras nascem de atos registrados do jogador (flags/estado). */
function trueTopics(s: GameState): Topic[] {
  const out: Topic[] = [];
  const c = s.player.candidacy;
  if ((c?.irregularities ?? 0) > 0 || s.flags.irregCampanha) out.push({ topic: 'campanha', truth: 'verdadeira', origin: 'irregularidade de campanha registrada', headline: (n) => `Gastos da campanha de ${n} não batem com a prestação de contas` });
  if (Number(s.flags.esquemaEmendas ?? 0) > 0 && !s.flags.esquemaInvestigado) out.push({ topic: 'esquema', truth: 'verdadeira', origin: 'esquema com emendas', headline: (n) => `Prefeito do interior diz que devolvia parte das emendas de ${n}` });
  if (Number(s.flags.vantagemIndevida ?? 0) > 0) out.push({ topic: 'vantagem', truth: 'verdadeira', origin: 'vantagem indevida aceita', headline: (n) => `Empresário relata pagamento a ${n} em troca de emenda` });
  if (s.communityPromises.some((p) => p.status === 'quebrada')) out.push({ topic: 'promessa', truth: 'verdadeira', origin: 'promessa quebrada', headline: (n) => `Moradores cobram ${n}: promessa de campanha não saiu do papel` });
  if (s.player.mandate?.office === 'prefeito' && s.city.cash < 0) out.push({ topic: 'contas', truth: 'verdadeira', origin: 'caixa negativo da prefeitura', headline: (n) => `Prefeitura de ${n} fecha o mês no vermelho` });
  return out;
}

const FALSE_TOPICS: Topic[] = [
  { topic: 'patrimonio', truth: 'falsa', origin: 'boato', headline: (n) => `Perfil acusa ${n} de ter mansão em nome de laranja` },
  { topic: 'video', truth: 'falsa', origin: 'montagem', headline: (n) => `Vídeo editado atribui a ${n} frase que nunca foi dita` },
  { topic: 'nepotismo', truth: 'falsa', origin: 'boato', headline: (n) => `Postagem diz que ${n} empregou parentes no gabinete` },
];
const DISTORTED_TOPICS: Topic[] = [
  { topic: 'voto', truth: 'distorcida', origin: 'recorte', headline: (n) => `${n} votou "contra a saúde", diz campanha adversária` },
  { topic: 'viagem', truth: 'distorcida', origin: 'recorte', headline: (n) => `${n} gastou dinheiro público em viagem, aponta post` },
  { topic: 'fala', truth: 'distorcida', origin: 'recorte', headline: (n) => `Trecho de entrevista de ${n} circula fora de contexto` },
];

export function inCampaignPeriod(s: GameState): boolean {
  const c = s.player.candidacy;
  return !!c && c.status === 'registrada' && s.month.year === (c.year ?? 2028) && s.month.month >= 8 && s.month.month <= 10;
}

/** Sorteio mensal de crises. Retorna notas para o log. */
export function crisisMonthlyStep(s: GameState, rng: RngState): string[] {
  const notes: string[] = [];
  const t = now(s);
  // Prazos vencidos: sem resposta conta como "ignorar".
  for (const c of s.crises) if (c.status === 'ativa' && t > c.deadline) notes.push(resolveCrisis(s, rng, c, 'ignorar', true));
  const active = s.crises.filter((c) => c.status === 'ativa' && c.targetId === PLAYER).length;
  const exposure = s.player.recognition / 1400 + (inCampaignPeriod(s) ? 0.04 : 0) + (s.player.mandate ? 0.012 : 0);
  if (active === 0 && s.player.recognition >= 12 && next(rng) < 0.008 + exposure) {
    const trueT = trueTopics(s);
    const roll = next(rng);
    const topic = trueT.length && roll < 0.55 ? pick(rng, trueT) : roll < 0.78 ? pick(rng, FALSE_TOPICS) : pick(rng, DISTORTED_TOPICS);
    const outletId = topic.truth === 'falsa'
      ? (next(rng) < 0.8 ? pick(rng, ['urgentezap', 'blogdobastidor']) : pick(rng, ['contraponto', 'pauta', 'canal24']))
      : topic.truth === 'verdadeira' ? pick(rng, ['diariopaulistano', 'tvmetropole', 'pauta', 'contraponto', 'radiocapital']) : pick(rng, ['canal24', 'contraponto', 'pauta', 'urgentezap', 'papoplenario']);
    const cred = outletCredibility(s, outletId);
    const severity = Math.round(clamp(25 + next(rng) * 40 + outletById(outletId).reach * 8));
    const crisis: ImageCrisis = {
      id: `cr_${t}_${s.crises.length}`, targetId: PLAYER, targetName: s.character.name, topic: topic.topic,
      headline: topic.headline(s.character.name), truth: topic.truth, outletId, severity, month: { ...s.month },
      deadline: t + 1, status: 'ativa', response: null, outcome: null, origin: topic.origin,
    };
    s.crises.push(crisis);
    const hit = (severity * cred) / 100 / 7;
    s.character.attributes.popularity = clamp(s.character.attributes.popularity - hit);
    if (s.player.mandate) s.player.mandate.approval = clamp(s.player.mandate.approval - hit * 0.6);
    pushNews(s, rng, { section: 'Perfil', headline: crisis.headline, lead: `Publicado por ${outletById(outletId).name}. A repercussão depende de como você responder.`, aboutPlayer: true, tone: 'critico', outlets: [outletId] });
    notes.push(`CRISE DE IMAGEM: "${crisis.headline}" (${outletById(outletId).name}, credibilidade ${Math.round(cred)}). Você sabe que a história é ${crisis.truth === 'verdadeira' ? 'VERDADEIRA' : crisis.truth === 'falsa' ? 'FALSA' : 'DISTORCIDA'}. Responda até o fim do mês que vem (aba Imagem).`);
  }
  // Crises de personagens fictícios (o mundo se move sem o jogador).
  if (next(rng) < 0.08) {
    const targets = [
      ...(!s.government.mayor.real && s.government.mayor.personId !== PLAYER ? [{ id: s.government.mayor.personId, name: s.government.mayor.name, role: 'prefeito(a)' }] : []),
      ...s.government.councillors.filter((c) => !c.real && c.id !== PLAYER).slice(0, 20).map((c) => ({ id: c.id, name: c.name, role: 'vereador(a)' })),
      ...(s.mayorRace ?? []).filter((r) => !r.isPlayer).map((r) => ({ id: r.id, name: r.name, role: 'pré-candidato(a)' })),
    ];
    if (targets.length) {
      const tg = pick(rng, targets);
      const truth: ImageCrisis['truth'] = pick(rng, ['verdadeira', 'falsa', 'distorcida']);
      const outletId = pick(rng, ['diariopaulistano', 'canal24', 'urgentezap', 'contraponto', 'pauta']);
      const resp: CrisisResponse = truth === 'verdadeira' ? pick(rng, ['desculpas', 'desmentir', 'explicar']) : truth === 'falsa' ? pick(rng, ['desmentir', 'direito_resposta']) : 'explicar';
      const c: ImageCrisis = { id: `cr_ai_${t}`, targetId: tg.id, targetName: tg.name, topic: 'ia', headline: `Reportagem questiona conduta de ${tg.name}, ${tg.role} (personagem fictício)`, truth, outletId, severity: 30, month: { ...s.month }, deadline: t, status: 'respondida', response: resp, outcome: null, origin: 'mundo' };
      c.outcome = aiOutcome(s, c);
      s.crises.push(c);
      // Efeito no mundo: pré-candidato fictício perde força; prefeito fictício perde aprovação proxy.
      const rc = s.mayorRace?.find((r) => r.id === tg.id);
      if (rc && truth === 'verdadeira') rc.baseStrength *= resp === 'desmentir' ? 0.8 : 0.9;
      if (tg.role === 'prefeito(a)' && truth === 'verdadeira') s.flags.mayorScandals = Number(s.flags.mayorScandals ?? 0) + 1;
      pushNews(s, rng, { section: 'Cidade', headline: c.headline, lead: c.outcome, aboutPlayer: false, tone: 'neutro', outlets: [outletId] });
    }
  }
  if (s.crises.length > 60) s.crises.splice(0, s.crises.length - 60);
  return notes;
}

function aiOutcome(s: GameState, c: ImageCrisis): string {
  const o = outletState(s, c.outletId);
  if (c.truth === 'falsa') { o.falseStories += 1; o.credibility = clamp(o.credibility - 4); return 'A acusação não se sustentou; o veículo publicou correção.'; }
  if (c.truth === 'verdadeira') { o.credibility = clamp(o.credibility + 1.5); return c.response === 'desmentir' ? 'O personagem negou, mas novos documentos confirmaram a reportagem.' : 'O personagem admitiu o erro e prometeu providências.'; }
  return 'O personagem apresentou o contexto completo; a polêmica perdeu força.';
}

export const RESPONSE_LABEL: Record<CrisisResponse, string> = {
  desmentir: 'Desmentir categoricamente',
  explicar: 'Explicar o contexto com documentos',
  desculpas: 'Admitir e pedir desculpas',
  direito_resposta: 'Pedir direito de resposta (Lei 13.188/2015)',
  ignorar: 'Não responder',
};

/** Aplica a resposta do jogador. Matriz verdade × resposta (PROPOSTA), modulada por credibilidade e comunicação. */
export function resolveCrisis(s: GameState, rng: RngState, c: ImageCrisis, resp: CrisisResponse, expired = false): string {
  c.status = 'respondida';
  c.response = resp;
  const o = outletState(s, c.outletId);
  const name = outletById(c.outletId).name;
  const credP = s.player.credibility ?? 60;
  const comm = s.character.attributes.communication;
  const sev = c.severity / 100;
  let pop = 0; // variação de popularidade
  let credD = 0; // variação da credibilidade pessoal
  let text = '';
  const roll = next(rng);
  switch (`${c.truth}:${resp}`) {
    case 'falsa:desmentir': pop = 4 * sev + credP / 40; o.falseStories++; o.credibility = clamp(o.credibility - 6); credD = 2; text = `O desmentido funcionou: ${name} perdeu credibilidade.`; break;
    case 'falsa:explicar': pop = 2.5 * sev + comm / 50; o.falseStories++; o.credibility = clamp(o.credibility - 4); credD = 1; text = 'Você mostrou os documentos e a história caiu.'; break;
    case 'falsa:desculpas': pop = -3 * sev; credD = -2; text = 'Pedir desculpas por algo que não aconteceu soou como confissão. A história ganhou força.'; break;
    case 'falsa:direito_resposta': {
      const anon = outletById(c.outletId).credibility < 30;
      pop = anon ? 1 : 4 * sev + 1; o.correctedStories++; o.credibility = clamp(o.credibility - (anon ? 2 : 8)); credD = 2;
      text = anon ? 'O perfil é anônimo: a Justiça demora a identificar o responsável. Efeito limitado.' : `A Justiça garantiu direito de resposta com o mesmo destaque. ${name} publicou correção.`; break;
    }
    case 'falsa:ignorar': pop = o.credibility < 35 ? 0.5 : -1.5 * sev; text = o.credibility < 35 ? 'O boato morreu sozinho: o perfil tem pouca credibilidade.' : 'Sem resposta, a dúvida ficou no ar.'; break;
    case 'distorcida:desmentir': pop = roll < 0.5 ? 1.5 : -2 * sev; credD = roll < 0.5 ? 0 : -3; text = roll < 0.5 ? 'O desmentido colou.' : 'Como havia um fundo de verdade, o desmentido total foi contestado e a polêmica cresceu.'; break;
    case 'distorcida:explicar': pop = 2 * sev + comm / 45; credD = 2; o.credibility = clamp(o.credibility - 2); text = 'Você mostrou o contexto completo e a versão recortada perdeu força.'; break;
    case 'distorcida:desculpas': pop = -1.5 * sev; credD = 1; text = 'Você pediu desculpas pelo mal-entendido; parte do público entendeu como admissão.'; break;
    case 'distorcida:direito_resposta': pop = 1 * sev; credD = 0; text = 'O pedido de resposta foi parcialmente aceito.'; break;
    case 'distorcida:ignorar': pop = -2 * sev; text = 'A versão distorcida virou a versão dominante.'; break;
    case 'verdadeira:desmentir': {
      if (roll < 0.6 + (100 - credP) / 400) { pop = -8 * sev - 3; credD = -15; o.credibility = clamp(o.credibility + 4); text = `Você negou, mas ${name} publicou novas provas. A mentira virou a história principal.`; s.flags.mentirasExpostas = Number(s.flags.mentirasExpostas ?? 0) + 1; }
      else { pop = 1; credD = -3; text = 'Você negou e, por ora, a história esfriou. O risco de reaparecer continua.'; s.flags.negacoesArriscadas = Number(s.flags.negacoesArriscadas ?? 0) + 1; }
      break;
    }
    case 'verdadeira:explicar': pop = -2 * sev + comm / 80; credD = 0; o.credibility = clamp(o.credibility + 1); text = 'A explicação reduziu o dano, mas não o eliminou.'; break;
    case 'verdadeira:desculpas': pop = -2.5 * sev; credD = 6; o.credibility = clamp(o.credibility + 2); text = 'Você admitiu e pediu desculpas. O dano imediato foi grande, mas sua palavra ganhou peso.'; break;
    case 'verdadeira:direito_resposta': pop = -4 * sev; credD = -6; o.credibility = clamp(o.credibility + 3); text = 'A Justiça negou o pedido: a reportagem era verdadeira. Tentar calar a imprensa pegou mal.'; break;
    case 'verdadeira:ignorar': pop = -3.5 * sev; credD = -2; o.credibility = clamp(o.credibility + 1); text = 'O silêncio foi lido como culpa.'; break;
  }
  if (c.truth !== 'falsa' && resp !== 'ignorar') o.credibility = clamp(o.credibility + 0.5);
  s.character.attributes.popularity = clamp(s.character.attributes.popularity + pop);
  if (s.player.mandate) s.player.mandate.approval = clamp(s.player.mandate.approval + pop * 0.6);
  s.player.credibility = clamp((s.player.credibility ?? 60) + credD);
  c.outcome = `${expired ? 'Prazo vencido sem resposta. ' : ''}${text}`;
  return `Crise "${c.headline}": ${c.outcome} (popularidade ${pop >= 0 ? '+' : ''}${pop.toFixed(1)}; sua credibilidade ${credD >= 0 ? '+' : ''}${credD}).`;
}

export function respondCrisis(s: GameState, rng: RngState, param: string): string {
  const [id, resp] = param.split('|') as [string, CrisisResponse];
  const c = s.crises.find((x) => x.id === id && x.status === 'ativa');
  if (!c) return 'Essa crise já foi resolvida.';
  return resolveCrisis(s, rng, c, resp);
}

// =====================================================================
// 5.3 Promessas públicas a comunidades
// =====================================================================

/** Prazo de uma promessa: fim do mandato em disputa (candidatura) ou do mandato atual. */
export function promiseDue(s: GameState): { due: number; context: string } {
  const c = s.player.candidacy;
  if (c && c.status !== 'rejeitada_convencao' && c.status !== 'indeferida') {
    const y = c.year ?? 2028;
    const years = c.office === 'senador' ? 8 : 4;
    return { due: (y + years) * 12 + 11, context: `campanha ${y} (${OFFICE_LABEL[c.office] ?? c.office})` };
  }
  const m = s.player.mandate;
  if (m) return { due: Number(m.until.slice(0, 4)) * 12 + Number(m.until.slice(5, 7)) - 1, context: `mandato de ${OFFICE_LABEL[m.office] ?? m.office}` };
  return { due: now(s) + 24, context: 'liderança comunitária' };
}

export function makePromise(s: GameState, rng: RngState, param: string): string {
  const [region, theme] = param.split('|');
  const r = REGIONS.find((x) => x.id === region)!;
  const th = THEMES.find((x) => x.value === theme)!;
  const { due, context } = promiseDue(s);
  const p: CommunityPromise = {
    id: `pc_${now(s)}_${s.communityPromises.length}`, region, theme,
    text: `${th.label} na região ${r.name}`, madeAt: { ...s.month }, dueMonth: due, status: 'aberta', progress: 0, context,
  };
  s.communityPromises.push(p);
  const g = 5 + s.character.attributes.charisma / 20 + next(rng) * 2;
  addGoodwill(s, region, g);
  s.player.base = clamp(s.player.base + 1);
  return `Promessa pública registrada: ${p.text}. A comunidade vai cobrar até ${Math.floor(due / 12)} (prazo: ${context}). Boa vontade na região +${g.toFixed(1)}.`;
}

/** Quanto o cargo atual permite avançar uma promessa (e a que custo). */
export function promiseCapacity(s: GameState, p: CommunityPromise): { gain: number; cost: string; block: string | null } {
  const m = s.player.mandate;
  if (!m) return { gain: 0, cost: '', block: 'Sem cargo, você não tem como entregar obras ou serviços. Pode apenas cobrar quem tem.' };
  switch (m.office) {
    case 'prefeito': return s.city.cash >= 120 ? { gain: 55, cost: 'R$ 120 mi do caixa da prefeitura', block: null } : { gain: 0, cost: '', block: 'Caixa da prefeitura insuficiente (R$ 120 mi).' };
    case 'secretario': {
      const sec = m.secretariat;
      const fits = sec && (sec.portfolio === p.theme || (p.theme === 'zeladoria' && sec.portfolio === 'subprefeituras'));
      if (!sec) return { gain: 0, cost: '', block: 'Sem pasta.' };
      return freeBudget(sec) >= 40 ? { gain: fits ? 45 : 20, cost: 'R$ 40 mi do orçamento livre da pasta', block: null } : { gain: 0, cost: '', block: 'Orçamento livre insuficiente (R$ 40 mi).' };
    }
    case 'vereador': return { gain: 15 + Math.round(m.relationExecutive / 8), cost: 'indicação e emenda ao orçamento (depende da relação com a prefeitura)', block: null };
    case 'deputado_estadual': case 'deputado_federal': case 'senador': {
      const u = m.upper;
      return u && u.amendmentBudget >= 3 ? { gain: 30, cost: 'R$ 3 mi do saldo de emendas', block: null } : { gain: 0, cost: '', block: 'Saldo de emendas insuficiente (R$ 3 mi).' };
    }
    case 'governador': return { gain: 60, cost: 'convênio estadual', block: null };
    default: return { gain: 10, cost: 'articulação', block: null };
  }
}

export function workOnPromise(s: GameState, rng: RngState, id: string): string {
  const p = s.communityPromises.find((x) => x.id === id);
  if (!p || (p.status !== 'aberta' && p.status !== 'em_andamento')) return 'Promessa não está aberta.';
  const cap = promiseCapacity(s, p);
  if (cap.block) return cap.block;
  const m = s.player.mandate!;
  if (m.office === 'prefeito') { s.city.cash -= 120; s.city.loa.areas.subprefeituras += 120; }
  if (m.office === 'secretario' && m.secretariat) m.secretariat.extraSpent += 40;
  if (m.upper && ['deputado_estadual', 'deputado_federal', 'senador'].includes(m.office)) m.upper.amendmentBudget -= 3;
  const gain = Math.round(cap.gain * (0.8 + next(rng) * 0.4));
  p.progress = clamp(p.progress + gain);
  p.status = 'em_andamento';
  if (p.progress >= 100) {
    p.status = 'cumprida';
    addGoodwill(s, p.region, 14);
    m.approval = clamp(m.approval + 2);
    s.player.credibility = clamp((s.player.credibility ?? 60) + 3);
    s.flags.promessasCumpridas = Number(s.flags.promessasCumpridas ?? 0) + 1;
    pushNews(s, rng, { section: 'Cidade', headline: `${s.character.name} entrega o que prometeu: ${p.text.toLowerCase()}`, lead: 'Moradores reconhecem a entrega.', aboutPlayer: true, tone: 'positivo', outlets: ['diariopaulistano', 'radiocapital'] });
    return `PROMESSA CUMPRIDA: ${p.text}. Boa vontade na região +14, credibilidade +3.`;
  }
  return `Promessa "${p.text}" avançou para ${p.progress}% (${cap.cost}).`;
}

/** Vencimento das promessas. */
export function promisesMonthlyStep(s: GameState, rng: RngState): string[] {
  const notes: string[] = [];
  const t = now(s);
  for (const p of s.communityPromises) {
    if ((p.status === 'aberta' || p.status === 'em_andamento') && t >= p.dueMonth) {
      p.status = 'quebrada';
      addGoodwill(s, p.region, -18);
      s.character.attributes.popularity = clamp(s.character.attributes.popularity - 2.5);
      s.player.credibility = clamp((s.player.credibility ?? 60) - 4);
      notes.push(`Promessa quebrada: ${p.text} (${p.progress}% feito). A região vai lembrar disso na próxima eleição.`);
      pushNews(s, rng, { section: 'Cidade', headline: `Moradores cobram promessa não cumprida de ${s.character.name}`, lead: p.text, aboutPlayer: true, tone: 'critico', outlets: ['diariopaulistano', 'radiocapital', 'urgentezap'] });
    }
  }
  return notes;
}

/** Ao perder a eleição, promessas feitas na campanha deixam de ser exigíveis (caducam sem penalidade). */
export function lapseCampaignPromises(s: GameState, year: number) {
  for (const p of s.communityPromises) if (p.status === 'aberta' && p.context.startsWith(`campanha ${year}`)) p.status = 'caducou';
}

