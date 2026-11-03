// Guia do jogador (Fase 6): introdução nos primeiros passos e dicas que aparecem na hora em que fazem sentido.
// Cada dica aparece uma vez por partida; o jogador pode desligar o guia a qualquer momento.
// As dicas citam regras reais só quando já estão implementadas e referenciadas no jogo.

import { monthIndex } from '../calendar';
import { nextElection } from './cycle';
import type { GameState } from './types';

export interface Tip {
  id: string;
  title: string;
  body: string;
  /** Página para onde o botão "Ir para" leva. */
  page?: string;
  pageLabel?: string;
  /** Prioridade: menor aparece antes. */
  order: number;
  when: (s: GameState) => boolean;
}

const has = (s: GameState, id: string) => (s.tutorial?.seen ?? []).includes(id);
const elapsed = (s: GameState) => monthIndex(s.month) - monthIndex({ year: 2027, month: 1 });

export const TIPS: Tip[] = [
  {
    id: 'intro_agenda', order: 0,
    title: 'Bem-vindo(a) ao PBS',
    body: 'Cada mês você tem 5 compromissos na agenda (as bolinhas no topo). Cada ação gasta compromissos. Quando acabarem, clique em "Avançar mês": o mundo anda, chegam notícias e eventos, e a agenda se renova. Repetir a mesma ação pessoal seguidas vezes rende menos.',
    page: 'gabinete', pageLabel: 'Ver as ações',
    when: () => true,
  },
  {
    id: 'intro_menu', order: 1,
    title: 'O menu muda com a sua carreira',
    body: 'O menu lateral é dividido por esfera. "Você" tem sua agenda, ficha e imagem. "Meu cargo" aparece quando você assume um mandato ou emprego público. "Eleições" mostra primeiro a próxima eleição. Partido, imprensa e redes ficam em "Partido e mídia".',
    when: (s) => has(s, 'intro_agenda'),
  },
  {
    id: 'intro_porque', order: 2,
    title: 'Todo número tem um motivo',
    body: 'Na Agenda, o quadro "O que mudou no último mês" resume cada variação e a causa. Clique em "por que mudou?" em qualquer indicador (ou no seu caixa, no topo) para ver o histórico de causas dos últimos meses.',
    page: 'gabinete', pageLabel: 'Ver na Agenda',
    when: (s) => has(s, 'intro_menu'),
  },
  {
    id: 'sem_partido', order: 10,
    title: 'Sem partido não há candidatura',
    body: 'No Brasil não existe candidatura avulsa: para disputar uma eleição você precisa estar filiado(a) até seis meses antes do pleito (Lei 9.504/97, art. 9º). Compare os partidos reais pela ideologia e pelo espaço que você teria dentro deles.',
    page: 'partidos', pageLabel: 'Ver partidos',
    when: (s) => !s.player.partyId && elapsed(s) >= 1,
  },
  {
    id: 'partido_interno', order: 11,
    title: 'Seu partido também é um campo de disputa',
    body: 'Confiança da direção, popularidade interna e mobilização são medidas separadas. São elas que decidem se a convenção escolhe você como candidato(a). Participe das reuniões, aproxime-se de uma corrente e evite brigar com a executiva às vésperas da eleição.',
    page: 'meupartido', pageLabel: 'Meu partido',
    when: (s) => !!s.player.partyId && elapsed(s) >= 2,
  },
  {
    id: 'redes', order: 12,
    title: 'Redes sociais',
    body: 'Escolha uma rede em foco: é ali que seu conteúdo cresce mais. Seguidores ajudam a ser conhecido(a), mas não viram voto automaticamente; cada rede converte de um jeito e algumas polemizam mais.',
    page: 'redes', pageLabel: 'Redes sociais',
    when: (s) => elapsed(s) >= 3,
  },
  {
    id: 'pre_campanha', order: 20,
    title: 'Ano de eleição',
    body: 'Neste ano tem eleição. Primeiro você manifesta a pré-candidatura no partido; a convenção (de 20 de julho a 5 de agosto) decide quem será candidato(a); depois vem o registro e a campanha oficial, a partir de 16 de agosto. Prepare base, dinheiro e apoio interno antes disso.',
    page: 'eleicoes', pageLabel: 'Eleições',
    when: (s) => nextElection(monthIndex(s.month)).year === s.month.year && s.month.month >= 2 && s.month.month <= 7 && !s.player.candidacy,
  },
  {
    id: 'campanha', order: 21,
    title: 'Campanha registrada',
    body: 'Na página Campanha você divide tempo e dinheiro entre regiões, segmentos de eleitores e canais. Os gastos têm limite legal e precisam ser declarados; doação de empresa é proibida. Acompanhe as pesquisas, que têm margem de erro e não garantem o resultado.',
    page: 'campanha', pageLabel: 'Campanha',
    when: (s) => s.player.candidacy?.status === 'registrada',
  },
  {
    id: 'evento', order: 5,
    title: 'Eventos pedem decisão',
    body: 'Quando aparece um evento, o mês só avança depois que você escolher uma opção. As escolhas têm consequências agora e depois: personagens e comunidades lembram do que você fez.',
    when: (s) => s.pendingEvents.length > 0,
  },
  {
    id: 'assessor', order: 30,
    title: 'Trabalho no gabinete',
    body: 'Como assessor(a), você recebe demandas do(a) vereador(a) todo mês. Use a agenda do cargo (os losangos ◆) para cumpri-las: entregas aumentam a confiança e a sua rede de bastidores. Lembre: servidor não pode fazer campanha no expediente.',
    page: 'gabparl', pageLabel: 'Gabinete parlamentar',
    when: (s) => !!s.player.staff,
  },
  {
    id: 'mandato', order: 31,
    title: 'Você assumiu um cargo',
    body: 'Agora você tem uma segunda agenda, só para o trabalho do cargo (os losangos ◆ no topo). Ações do cargo usam primeiro essa agenda e não perdem rendimento quando repetidas. A página do seu mandato fica em "Meu cargo".',
    when: (s) => !!s.player.mandate,
  },
  {
    id: 'votacoes', order: 32,
    title: 'Votações do mês',
    body: 'Todo mês há matérias em votação no plenário. Votar não gasta agenda. Votar contra o partido, contra o governo ou contra a opinião pública tem custo, e quem não vota segue a orientação da bancada.',
    page: 'gabinete', pageLabel: 'Ver votações',
    when: (s) => ['vereador', 'deputado_estadual', 'deputado_federal', 'senador'].includes(s.player.mandate?.office ?? ''),
  },
  {
    id: 'equipe', order: 33,
    title: 'Monte sua equipe de gabinete',
    body: 'Você pode nomear assessores. Cada ficha mostra atributos e uma avaliação de honestidade. Eles trabalham todo mês na tarefa que você der (redes, imprensa, base, atendimento, articulação, minutas), sem gastar sua agenda.',
    page: 'equipe', pageLabel: 'Minha equipe',
    when: (s) => ['vereador', 'deputado_estadual', 'deputado_federal', 'senador'].includes(s.player.mandate?.office ?? '') && !(s.player.team?.members.length),
  },
  {
    id: 'prefeito', order: 34,
    title: 'Governar a cidade',
    body: 'Como prefeito(a), o caixa é finito: pessoal e despesas obrigatórias consomem a maior parte da receita. Indicadores reagem devagar, obras levam meses e a Câmara precisa aprovar o orçamento. Nos dois últimos quadrimestres do mandato, assumir despesa sem caixa para pagá-la infringe a LRF (art. 42).',
    page: 'governo', pageLabel: 'Prefeitura',
    when: (s) => s.player.mandate?.office === 'prefeito',
  },
  {
    id: 'secretario', order: 35,
    title: 'Secretaria',
    body: 'Sua pasta tem orçamento, metas e indicadores. O(a) prefeito(a) pode exonerar quem não entrega ou quem confronta o governo.',
    page: 'secretaria', pageLabel: 'Minha secretaria',
    when: (s) => s.player.mandate?.office === 'secretario',
  },
  {
    id: 'crise', order: 6,
    title: 'Crise de imagem',
    body: 'Uma notícia sobre você está circulando. Você sabe se ela é verdadeira, falsa ou distorcida; o público não. Responda na aba Imagem: negar algo verdadeiro pode virar mentira exposta, e isso pesa mais que o escândalo original.',
    page: 'imagem', pageLabel: 'Imagem e promessas',
    when: (s) => s.crises.some((c) => c.status === 'ativa' && c.targetId === 'character_player'),
  },
  {
    id: 'caixa', order: 7,
    title: 'Dinheiro pessoal no vermelho',
    body: 'Seu caixa pessoal está negativo. Dívidas pesam no patrimônio e limitam o que você pode bancar na campanha. Uma profissão estável ou um cargo ajudam; cortar gastos também.',
    page: 'personagem', pageLabel: 'Ficha',
    when: (s) => s.finances.cash < 0,
  },
];

export function tutorialOn(s: GameState) {
  return s.tutorial?.enabled !== false;
}

/** Próxima dica a mostrar (ou null). */
export function pendingTip(s: GameState): Tip | null {
  if (!tutorialOn(s) || s.gameOver) return null;
  const seen = new Set(s.tutorial?.seen ?? []);
  const ok = TIPS.filter((t) => !seen.has(t.id) && t.when(s)).sort((a, b) => a.order - b.order);
  return ok[0] ?? null;
}

export function dismissTip(s: GameState, id: string): GameState {
  const t = s.tutorial ?? { enabled: true, seen: [] };
  return { ...s, tutorial: { ...t, seen: [...new Set([...t.seen, id])] } };
}

export function setTutorial(s: GameState, enabled: boolean): GameState {
  const t = s.tutorial ?? { enabled: true, seen: [] };
  return { ...s, tutorial: { ...t, enabled, seen: enabled ? t.seen : t.seen } };
}

/** Recomeçar o guia do zero (página Regras). */
export function resetTutorial(s: GameState): GameState {
  return { ...s, tutorial: { enabled: true, seen: [] } };
}
