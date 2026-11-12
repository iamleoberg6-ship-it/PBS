/**
 * Fase 13b — Discurso na noite da apuração.
 * O jogador escolhe como falar depois do resultado. Os efeitos são MECÂNICA DE JOGO (PROPOSTA):
 * não há regra legal envolvida; mexem em imagem, base, partido e campanha de 2º turno.
 * Um discurso por eleição/turno, e só no mesmo ano da eleição (não dá para "refazer" anos depois).
 */
import type { GameState } from './types';
import type { ApuracaoRef } from './scenes';
import { pushNews } from './news';

export type SpeechOutcome = 'eleito' | 'nao_eleito' | 'segundo_turno';
export interface Effect { recognition?: number; base?: number; popularity?: number; credibility?: number; internalPopularity?: number; leadershipTrust?: number; mobilization?: number; perceivedLoyalty?: number; heat?: number; campaignPoints?: number }
export interface SpeechOption { id: string; label: string; quote: string; summary: string; effect: Effect; tone: 'positivo' | 'neutro' | 'critico' | null; headline: (name: string) => string }

const OPTIONS: Record<SpeechOutcome, SpeechOption[]> = {
  eleito: [
    { id: 'unir', label: 'Agradecer e falar para todos', quote: '"A eleição acabou. A partir de amanhã, trabalho para quem votou e para quem não votou em mim."', summary: 'Imagem de quem soma. A militância queria mais festa.', effect: { popularity: 3, credibility: 3, recognition: 2, base: 1, internalPopularity: -2 }, tone: 'positivo', headline: (n) => `Eleito(a), ${n} promete trabalhar "para todos"` },
    { id: 'militancia', label: 'Festa com a militância', quote: '"Essa vitória é de cada um que gastou sola de sapato nessa campanha!"', summary: 'Partido e militância vibram. Fora da bolha, soa como mais do mesmo.', effect: { internalPopularity: 6, mobilization: 4, perceivedLoyalty: 3, base: 3, popularity: -1, heat: 2 }, tone: 'neutro', headline: (n) => `${n} comemora com a militância e exalta o partido` },
    { id: 'entregas', label: 'Prometer entregas concretas', quote: '"Não vim para fazer discurso. Vim para entregar. Me cobrem."', summary: 'Mais base e reconhecimento; a expectativa sobe junto.', effect: { base: 4, recognition: 2, credibility: 1 }, tone: 'positivo', headline: (n) => `${n} diz que vai entregar e pede para ser cobrado(a)` },
    { id: 'atacar', label: 'Provocar os adversários', quote: '"Hoje o povo mandou um recado para quem achou que ia ganhar no grito."', summary: 'O núcleo duro adora; o resto do eleitorado e a imprensa, nem tanto. Mais exposição.', effect: { base: 6, popularity: -3, credibility: -2, heat: 8 }, tone: 'critico', headline: (n) => `Em discurso de vitória, ${n} provoca adversários` },
  ],
  nao_eleito: [
    { id: 'parabenizar', label: 'Reconhecer e parabenizar', quote: '"O povo decidiu, e eu respeito. Parabéns aos eleitos. Seguimos no debate."', summary: 'Ganha respeito dentro e fora do partido.', effect: { credibility: 5, popularity: 3, recognition: 2, leadershipTrust: 3 }, tone: 'positivo', headline: (n) => `${n} reconhece a derrota e parabeniza os eleitos` },
    { id: 'voltar', label: 'Prometer voltar mais forte', quote: '"Não foi dessa vez. Mas essa caminhada não termina hoje."', summary: 'A militância segura a bandeira com você.', effect: { base: 3, internalPopularity: 5, mobilization: 3 }, tone: 'neutro', headline: (n) => `Derrotado(a), ${n} promete voltar` },
    { id: 'sistema', label: 'Culpar o sistema, sem provas', quote: '"Tem muita coisa estranha nessa eleição. Não vamos aceitar calados."', summary: 'Inflama o núcleo duro, mas queima credibilidade, popularidade e a confiança da direção. Muita exposição.', effect: { base: 4, credibility: -10, popularity: -5, leadershipTrust: -8, heat: 10 }, tone: 'critico', headline: (n) => `${n} levanta suspeitas sobre a eleição sem apresentar provas` },
    { id: 'silencio', label: 'Sair sem falar', quote: '(Você deixa o comitê pela porta dos fundos.)', summary: 'Nada muda muito. Um pouco de reconhecimento se perde.', effect: { recognition: -1 }, tone: null, headline: () => '' },
  ],
  segundo_turno: [
    { id: 'ampliar', label: 'Chamar os derrotados para conversar', quote: '"Quem votou em outros candidatos: a porta está aberta. Vamos construir juntos."', summary: 'Campanha do 2º turno mais forte; parte da militância torce o nariz.', effect: { campaignPoints: 8, credibility: 1, internalPopularity: -2 }, tone: 'positivo', headline: (n) => `${n} acena aos derrotados para o 2º turno` },
    { id: 'rua', label: 'Convocar a virada na rua', quote: '"Amanhã cedo, todo mundo na rua. Cada voto conta."', summary: 'Mobilização e base sobem; campanha um pouco mais forte.', effect: { campaignPoints: 5, base: 3, mobilization: 4 }, tone: 'neutro', headline: (n) => `${n} convoca militância para o 2º turno` },
    { id: 'polarizar', label: 'Polarizar contra o adversário', quote: '"Agora é a gente contra eles. Escolham o lado."', summary: 'Núcleo duro inflamado; o eleitor do meio se afasta. Mais exposição.', effect: { campaignPoints: 3, base: 5, popularity: -3, heat: 6 }, tone: 'critico', headline: (n) => `${n} aposta na polarização para o 2º turno` },
  ],
};

export const speechKey = (ref: ApuracaoRef) => `discurso_${ref.level}_${ref.year}_${ref.round}`;
export function speechOptions(outcome: SpeechOutcome): SpeechOption[] { return OPTIONS[outcome]; }
export function speechGiven(s: GameState, ref: ApuracaoRef): SpeechOption | null {
  const v = s.flags[speechKey(ref)];
  if (typeof v !== 'string') return null;
  for (const list of Object.values(OPTIONS)) { const o = list.find((x) => x.id === v); if (o) return o; }
  return null;
}
/** Dá para discursar se ainda não discursou e a eleição é deste ano (a noite da apuração é agora). */
export function canGiveSpeech(s: GameState, ref: ApuracaoRef): boolean {
  return !speechGiven(s, ref) && ref.year === s.month.year;
}

const c = (v: number) => Math.max(0, Math.min(100, v));

/** Aplica o discurso escolhido. Retorna um novo estado. */
export function giveSpeech(state: GameState, ref: ApuracaoRef, outcome: SpeechOutcome, id: string): GameState {
  if (!canGiveSpeech(state, ref)) return state;
  const opt = OPTIONS[outcome].find((o) => o.id === id);
  if (!opt) return state;
  const s = structuredClone(state);
  const e = opt.effect, p = s.player, r = p.partyRel;
  if (e.recognition) p.recognition = c(p.recognition + e.recognition);
  if (e.base) p.base = c(p.base + e.base);
  if (e.popularity) s.character.attributes.popularity = c(s.character.attributes.popularity + e.popularity);
  if (e.credibility) p.credibility = c((p.credibility ?? 50) + e.credibility);
  if (e.internalPopularity) r.internalPopularity = c(r.internalPopularity + e.internalPopularity);
  if (e.leadershipTrust) r.leadershipTrust = c(r.leadershipTrust + e.leadershipTrust);
  if (e.mobilization) r.mobilization = c(r.mobilization + e.mobilization);
  if (e.perceivedLoyalty) r.perceivedLoyalty = c(r.perceivedLoyalty + e.perceivedLoyalty);
  if (e.heat && s.personal) s.personal.heat = c(s.personal.heat + e.heat);
  if (e.campaignPoints && p.candidacy) p.candidacy.campaignPoints += e.campaignPoints;
  s.flags[speechKey(ref)] = opt.id;
  s.log.push({ month: { ...s.month }, kind: 'eleicao', text: `Discurso na noite da apuração: ${opt.label}. ${opt.quote}` });
  if (opt.tone) pushNews(s, s.rng, { section: 'Eleições', headline: opt.headline(s.character.name), lead: `${opt.quote} ${opt.summary}`, aboutPlayer: true, tone: opt.tone });
  return s;
}

/** Texto curto dos efeitos, para a interface. */
export function effectText(e: Effect): string {
  const L: [keyof Effect, string][] = [['base', 'base'], ['recognition', 'reconhecimento'], ['popularity', 'popularidade'], ['credibility', 'credibilidade'], ['internalPopularity', 'militância'], ['leadershipTrust', 'direção do partido'], ['mobilization', 'mobilização'], ['perceivedLoyalty', 'lealdade percebida'], ['campaignPoints', 'força da campanha'], ['heat', 'exposição']];
  return L.filter(([k]) => e[k]).map(([k, n]) => `${(e[k] as number) > 0 ? '+' : '−'}${Math.abs(e[k] as number)} ${n}`).join(' · ');
}
