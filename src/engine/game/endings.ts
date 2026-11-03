// Conquistas e finais (Fase 5.7). Tudo aqui é FICÇÃO de gameplay: avalia a trajetória do personagem.

import { monthIndex } from '../calendar';
import type { Ending, GameState } from './types';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  check: (s: GameState) => boolean;
}

const held = (s: GameState, label: string) => s.player.careerHistory.some((h) => h.office.toLowerCase().includes(label));
const promisesKept = (s: GameState) => s.communityPromises.filter((p) => p.status === 'cumprida').length;
const promisesBroken = (s: GameState) => s.communityPromises.filter((p) => p.status === 'quebrada').length;
const lawsByPlayer = (s: GameState) => s.legislature.bills.filter((b) => b.author === 'character_player' && b.stage === 'lei').length;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'primeira_filiacao', title: 'Entrei para o jogo', description: 'Filiou-se a um partido.', check: (s) => s.player.partyHistory.length > 0 },
  { id: 'assessor', title: 'Bastidores', description: 'Trabalhou como assessor(a) parlamentar.', check: (s) => !!s.player.staff || held(s, 'assessor') },
  { id: 'vereador', title: 'Voz da cidade', description: 'Eleito(a) vereador(a) de São Paulo.', check: (s) => held(s, 'vereador') },
  { id: 'lei_aprovada', title: 'Autor(a) de lei', description: 'Um projeto seu virou lei municipal.', check: (s) => lawsByPlayer(s) >= 1 },
  { id: 'tres_leis', title: 'Legislador(a) produtivo(a)', description: 'Três projetos seus viraram lei municipal.', check: (s) => lawsByPlayer(s) >= 3 },
  { id: 'presidente_camara', title: 'Dono(a) da pauta', description: 'Presidiu a Câmara Municipal.', check: (s) => s.government.councilPresident?.personId === 'character_player' || !!s.flags.foiPresidenteCamara },
  { id: 'secretario', title: 'Gestor(a)', description: 'Chefiou uma secretaria municipal.', check: (s) => held(s, 'secretário(a) municipal') },
  { id: 'prefeito', title: 'Prefeito(a) de São Paulo', description: 'Venceu a eleição para a prefeitura.', check: (s) => held(s, 'prefeito(a) de são paulo') },
  { id: 'reeleito_prefeito', title: 'Aprovação nas urnas', description: 'Reeleito(a) prefeito(a).', check: (s) => s.player.consecutiveTermsPrefeito >= 2 },
  { id: 'deputado_estadual', title: 'Alesp', description: 'Eleito(a) deputado(a) estadual.', check: (s) => held(s, 'deputado(a) estadual') },
  { id: 'deputado_federal', title: 'Rumo a Brasília', description: 'Eleito(a) deputado(a) federal.', check: (s) => held(s, 'deputado(a) federal') },
  { id: 'senador', title: 'Câmara Alta', description: 'Eleito(a) senador(a) por São Paulo.', check: (s) => held(s, 'senador(a)') },
  { id: 'governador', title: 'Palácio dos Bandeirantes', description: 'Eleito(a) governador(a) de São Paulo.', check: (s) => held(s, 'governador(a)') },
  { id: 'promessa_cumprida', title: 'Palavra dada', description: 'Cumpriu uma promessa pública a uma comunidade.', check: (s) => promisesKept(s) >= 1 },
  { id: 'cinco_promessas', title: 'Quem promete, entrega', description: 'Cumpriu cinco promessas públicas.', check: (s) => promisesKept(s) >= 5 },
  { id: 'crise_vencida', title: 'Sangue frio', description: 'Derrubou uma notícia falsa com a resposta certa.', check: (s) => s.crises.some((c) => c.targetId === 'character_player' && c.truth === 'falsa' && (c.response === 'desmentir' || c.response === 'direito_resposta' || c.response === 'explicar')) },
  { id: 'mea_culpa', title: 'Mea-culpa', description: 'Admitiu um erro verdadeiro em vez de negar.', check: (s) => s.crises.some((c) => c.targetId === 'character_player' && c.truth === 'verdadeira' && c.response === 'desculpas') },
  { id: 'ficha_limpa_campanha', title: 'Contas aprovadas', description: 'Teve as contas de campanha aprovadas sem ressalvas.', check: (s) => s.flags.contasCampanha === 'aprovadas' },
  { id: 'cpi', title: 'Fiscal da cidade', description: 'Instalou uma CPI.', check: (s) => s.legislature.cpis.some((c) => c.proposer === 'character_player' && (c.status === 'instalada' || c.status === 'concluida')) },
  { id: 'virada', title: 'Virada no 2º turno', description: 'Venceu um 2º turno.', check: (s) => !!s.flags.venceuSegundoTurno },
  { id: 'longa_carreira', title: 'Carreira longa', description: 'Exerceu três ou mais cargos ao longo da partida.', check: (s) => s.player.careerHistory.length >= 3 },
];

/** Verifica conquistas novas. Retorna os títulos desbloqueados neste mês. */
export function checkAchievements(s: GameState): string[] {
  const out: string[] = [];
  const have = new Set(s.achievements.map((a) => a.id));
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id)) continue;
    let ok = false;
    try { ok = a.check(s); } catch { ok = false; }
    if (ok) { s.achievements.push({ id: a.id, month: { ...s.month } }); out.push(a.title); }
  }
  return out;
}

/** Nota final da trajetória (0–100, PROPOSTA). */
export function careerScore(s: GameState): number {
  const peak = (() => {
    if (held(s, 'governador(a)')) return 95;
    if (held(s, 'senador(a)')) return 85;
    if (held(s, 'prefeito(a) de são paulo')) return 80;
    if (held(s, 'deputado(a) federal')) return 70;
    if (held(s, 'deputado(a) estadual')) return 62;
    if (held(s, 'secretário(a)')) return 50;
    if (held(s, 'vereador')) return 45;
    if (held(s, 'assessor') || s.player.staff) return 20;
    return 8;
  })();
  const rep = (s.player.credibility ?? 60) - 60;
  const promises = promisesKept(s) * 2 - promisesBroken(s) * 3;
  const approval = s.player.mandate ? (s.player.mandate.approval - 50) / 3 : 0;
  const stains = Number(s.flags.vantagemIndevida ?? 0) * 6 + Number(s.flags.mentirasExpostas ?? 0) * 5 + (s.flags.cassado ? 20 : 0);
  return Math.max(0, Math.min(100, Math.round(peak * 0.7 + rep * 0.3 + promises + approval + s.achievements.length * 0.6 - stains)));
}

/** Final da partida: escolhe o desfecho pela trajetória. Vários finais possíveis. */
export function computeEnding(s: GameState, reason: 'fim' | 'aposentadoria'): Ending {
  const score = careerScore(s);
  const lies = Number(s.flags.mentirasExpostas ?? 0);
  const corrupt = Number(s.flags.vantagemIndevida ?? 0) > 0;
  const kept = promisesKept(s);
  const broken = promisesBroken(s);
  const pick = (id: string, title: string, text: string): Ending => ({ id, title, text: `${text}${reason === 'aposentadoria' ? ' Você decidiu encerrar a carreira por conta própria.' : ''}`, score, month: { ...s.month } });
  if (s.flags.cassado) return pick('cassado', 'Diploma cassado', 'A Justiça Eleitoral cassou um mandato seu. Sua história política ficou marcada pelo processo — e pela inelegibilidade que a acompanha (LC 64/90).');
  if (corrupt && lies > 0) return pick('escandalo', 'Escândalo', 'Você chegou longe, mas o que aceitou por fora e as negações desmentidas viraram a sua biografia pública.');
  if (held(s, 'governador(a)') && (s.player.mandate?.office !== 'governador' || s.player.mandate.approval >= 50)) return pick('estadista', 'Estadista paulista', 'Você saiu do bairro para o Palácio dos Bandeirantes. Poucos conseguem; menos ainda deixam o cargo com a confiança do eleitor.');
  if (held(s, 'senador(a)')) return pick('senado', 'Voz de São Paulo no Senado', 'Oito anos de mandato no Senado coroam uma carreira construída na cidade.');
  if (held(s, 'prefeito(a) de são paulo') && kept >= broken) return pick('prefeito_entrega', 'Prefeito(a) que entregou', 'Você governou a maior cidade do país e cumpriu mais do que prometeu. A cidade lembra de quem entrega.');
  if (held(s, 'prefeito(a) de são paulo')) return pick('prefeito_promessas', 'Prefeitura de promessas', 'Você chegou ao topo da cidade, mas as comunidades lembram mais do que ficou no papel.');
  if (held(s, 'deputado(a)')) return pick('parlamentar', 'Parlamentar de carreira', 'Do plenário municipal às bancadas estadual ou federal, você fez da política institucional o seu ofício.');
  if (held(s, 'vereador') && kept >= 2) return pick('vereador_bairro', 'Vereador(a) de bairro', 'Você nunca saiu da Câmara Municipal, mas cada promessa cumprida tem endereço.');
  if (held(s, 'vereador') || held(s, 'secretário(a)')) return pick('cidade', 'Servidor(a) da cidade', 'Uma trajetória municipal: mandato, gestão e muita negociação.');
  if (held(s, 'assessor') || s.player.staff) return pick('bastidor', 'Eminência parda', 'Você conheceu a política por dentro, nos gabinetes. O nome na urna ficou para outra vida.');
  if (s.player.partyId) return pick('militante', 'Militância', 'Você participou da vida partidária, mas a urna não abriu as portas.');
  return pick('cidadao', 'Cidadão(ã) engajado(a)', 'A política institucional não foi o seu caminho — mas a comunidade sabe quem aparece.');
}

export const endingMonth = (s: GameState) => monthIndex(s.month);
