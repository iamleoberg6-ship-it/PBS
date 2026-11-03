// Central de notícias (Módulo 09). Veículos FICTÍCIOS com perfis editoriais inventados.
// Regra editorial do jogo: notícias sobre pessoas reais só tratam de fatos de registro público
// ou de resultados institucionais marcados como simulação; nada de escândalos inventados sobre pessoas reais.

import { next, pick, type RngState } from '../rng';
import { monthIndex } from '../calendar';
import { generalPosition } from '../data/ideology';
import { partyById } from '../data/parties';
import { grow } from './actions';
import type { GameState, LogEntry, NewsItem, Poll } from './types';

export interface Outlet {
  id: string;
  name: string;
  kind: string;
  /** Linha editorial fictícia na escala 0–10 (null = sem linha marcada). */
  lean: number | null;
  reach: number;
}

export const OUTLETS: Outlet[] = [
  { id: 'tvmetropole', name: 'TV Metrópole', kind: 'TV aberta', lean: null, reach: 2.5 },
  { id: 'canal24', name: 'Canal 24 Brasil', kind: 'Canal de notícias 24h', lean: null, reach: 1.6 },
  { id: 'radiocapital', name: 'Rádio Capital Notícias', kind: 'Rádio all news', lean: null, reach: 1.1 },
  { id: 'diariopaulistano', name: 'Diário Paulistano', kind: 'Jornal local', lean: null, reach: 1.0 },
  { id: 'pauta', name: 'Revista Pauta', kind: 'Revista semanal (linha progressista)', lean: 3, reach: 0.8 },
  { id: 'contraponto', name: 'O Contraponto', kind: 'Site de notícias (linha conservadora)', lean: 7.5, reach: 0.8 },
  { id: 'papoplenario', name: 'Papo de Plenário', kind: 'Videocast de entrevistas', lean: null, reach: 1.2 },
];

export function outletById(id: string): Outlet {
  return OUTLETS.find((o) => o.id === id) ?? OUTLETS[0];
}

type Draft = Omit<NewsItem, 'id' | 'month' | 'outletId'> & { outlets?: string[] };

export function pushNews(s: GameState, rng: RngState, d: Draft) {
  const outletId = d.outlets ? pick(rng, d.outlets) : pick(rng, OUTLETS.filter((o) => o.id !== 'papoplenario')).id;
  const item: NewsItem = { id: `n_${monthIndex(s.month)}_${s.news.length}`, month: { ...s.month }, outletId, section: d.section, headline: d.headline, lead: d.lead, aboutPlayer: d.aboutPlayer, tone: d.tone };
  // Linha editorial: veículo de linha oposta à do jogador tende a enquadrar de forma crítica.
  const o = outletById(outletId);
  const pos = generalPosition(s.character.ideology);
  if (d.aboutPlayer && o.lean !== null && pos !== null && Math.abs(o.lean - pos) > 3.5 && item.tone === 'positivo' && next(rng) < 0.6) {
    item.tone = 'neutro';
    item.lead += ' O veículo, porém, questionou a viabilidade das propostas.';
  }
  if (d.aboutPlayer) {
    s.player.recognition = grow(s.player.recognition, 0.6 * o.reach);
    if (item.tone === 'critico') s.character.attributes.popularity = Math.max(0, s.character.attributes.popularity - 0.6 * o.reach);
    if (item.tone === 'positivo') s.character.attributes.popularity = Math.min(100, s.character.attributes.popularity + 0.3 * o.reach);
  }
  s.news.push(item);
  if (s.news.length > 250) s.news.splice(0, s.news.length - 250);
}

const me = (s: GameState) => s.character.name;

/** Notícias derivadas do que aconteceu no mês (log). */
export function newsFromLog(s: GameState, entries: LogEntry[], rng: RngState) {
  for (const e of entries) {
    const t = e.text;
    if (t.includes('VOCÊ FOI ELEITO(A) VEREADOR(A)')) {
      const votes = t.match(/com ([\d.]+) votos/)?.[1] ?? '';
      pushNews(s, rng, { section: 'Eleições', headline: `${me(s)} é eleito(a) vereador(a) de São Paulo`, lead: `Com ${votes} votos, ${me(s)} conquista uma das 55 cadeiras da Câmara Municipal.`, aboutPlayer: true, tone: 'positivo', outlets: ['tvmetropole', 'diariopaulistano', 'canal24'] });
    } else if (t.includes('mas não foi eleito(a)')) {
      pushNews(s, rng, { section: 'Eleições', headline: `${me(s)} fica fora da Câmara apesar de votação expressiva`, lead: 'O resultado reflete o sistema proporcional: a cadeira depende da votação do partido ou federação.', aboutPlayer: true, tone: 'neutro', outlets: ['diariopaulistano', 'radiocapital'] });
    } else if (t.startsWith('Prefeitura:')) {
      const playerWon = t.includes('VOCÊ FOI ELEITO');
      pushNews(s, rng, { section: 'Eleições', headline: playerWon ? `${me(s)} vence no 1º turno e será prefeito(a) de São Paulo` : `${t.replace('Prefeitura: ', '').replace(' foi eleito(a) prefeito(a).', '')} é eleito(a) prefeito(a) de São Paulo (simulação)`, lead: 'Resultado da eleição municipal de 2028.', aboutPlayer: playerWon, tone: playerWon ? 'positivo' : 'neutro', outlets: ['tvmetropole', 'canal24'] });
    } else if (t.includes('você está no 2º turno')) {
      pushNews(s, rng, { section: 'Eleições', headline: `${me(s)} vai ao 2º turno pela Prefeitura de São Paulo`, lead: 'A disputa final acontece no último domingo de outubro.', aboutPlayer: true, tone: 'positivo', outlets: ['tvmetropole', 'canal24', 'radiocapital'] });
    } else if (t.includes('VOCÊ VENCEU O 2º TURNO')) {
      pushNews(s, rng, { section: 'Eleições', headline: `${me(s)} é eleito(a) prefeito(a) de São Paulo`, lead: 'Vitória no 2º turno encerra a disputa municipal.', aboutPlayer: true, tone: 'positivo', outlets: ['tvmetropole', 'canal24', 'diariopaulistano'] });
    } else if (t.includes('venceu o 2º turno. Você não')) {
      pushNews(s, rng, { section: 'Eleições', headline: `${me(s)} perde o 2º turno em São Paulo`, lead: 'Derrota apertada encerra a campanha.', aboutPlayer: true, tone: 'neutro', outlets: ['tvmetropole', 'canal24'] });
    } else if (t.includes('Registro de candidatura indeferido')) {
      pushNews(s, rng, { section: 'Eleições', headline: `Justiça Eleitoral nega registro de ${me(s)}`, lead: t, aboutPlayer: true, tone: 'critico' });
    } else if (/Convenção do .* (aprovou sua candidatura|escolheu você)/.test(t)) {
      if (s.player.recognition >= 10) pushNews(s, rng, { section: 'Partidos', headline: `${me(s)} é oficializado(a) candidato(a) em convenção`, lead: t, aboutPlayer: true, tone: 'neutro', outlets: ['diariopaulistano', 'radiocapital'] });
    } else if (t.includes('Eleição da Mesa')) {
      pushNews(s, rng, { section: 'Câmara', headline: 'Câmara Municipal define novo comando (simulação)', lead: t.replace('Eleição da Mesa (simulada): ', ''), aboutPlayer: false, tone: 'neutro', outlets: ['diariopaulistano', 'radiocapital'] });
    } else if (t.includes('eleito(a) presidente da Câmara Municipal')) {
      pushNews(s, rng, { section: 'Câmara', headline: `${me(s)} é eleito(a) presidente da Câmara Municipal`, lead: 'Novo presidente passa a controlar a pauta do plenário.', aboutPlayer: true, tone: 'positivo', outlets: ['diariopaulistano', 'canal24', 'tvmetropole'] });
    } else if (t.includes('aprovado e sancionado')) {
      const title = t.split(':')[0].replace(/^PL \d+\/\d+ — /, '').replace('PL — ', '');
      pushNews(s, rng, { section: 'Câmara', headline: `Projeto de ${me(s)} vira lei: ${title.toLowerCase()}`, lead: 'Proposta aprovada em plenário e sancionada pela prefeitura.', aboutPlayer: true, tone: 'positivo', outlets: ['diariopaulistano', 'radiocapital'] });
    } else if (t.includes('vetado pelo prefeito')) {
      pushNews(s, rng, { section: 'Câmara', headline: `Prefeitura veta projeto de ${me(s)}`, lead: 'A Câmara pode analisar o veto.', aboutPlayer: true, tone: 'neutro', outlets: ['diariopaulistano'] });
    } else if (t.includes('CPI instalada')) {
      pushNews(s, rng, { section: 'Câmara', headline: `CPI proposta por ${me(s)} é instalada na Câmara`, lead: 'Comissão vai investigar contrato de manutenção da prefeitura.', aboutPlayer: true, tone: 'positivo', outlets: ['tvmetropole', 'canal24', 'pauta', 'contraponto'] });
    } else if (t.includes('A denúncia virou notícia')) {
      pushNews(s, rng, { section: 'Prefeitura', headline: `${me(s)} aponta sobrepreço em contrato da prefeitura`, lead: 'Prefeitura diz que vai apurar.', aboutPlayer: true, tone: 'positivo' });
    } else if (t.includes('Um vídeo seu viralizou') || t.includes('Aproveitar a onda')) {
      pushNews(s, rng, { section: 'Perfil', headline: `Vídeo de ${me(s)} viraliza nas redes`, lead: 'Publicação sobre problemas do bairro passa de 1 milhão de visualizações.', aboutPlayer: true, tone: 'positivo', outlets: ['canal24', 'papoplenario'] });
    } else if (t.includes('recortado fora de contexto') || t.includes('viralizou do jeito errado') || t.includes('Polêmica nas redes')) {
      pushNews(s, rng, { section: 'Perfil', headline: `Fala de ${me(s)} repercute mal nas redes`, lead: 'Trecho de vídeo foi compartilhado com críticas.', aboutPlayer: true, tone: 'critico' });
    } else if (t.includes('Você foi muito bem no debate')) {
      pushNews(s, rng, { section: 'Eleições', headline: `${me(s)} se destaca no debate entre candidatos`, lead: 'Analistas apontam bom desempenho.', aboutPlayer: true, tone: 'positivo', outlets: ['tvmetropole', 'canal24'] });
    } else if (t.includes('Você se filiou ao') && s.player.recognition >= 15) {
      pushNews(s, rng, { section: 'Partidos', headline: t.split('.')[0].replace('Você se filiou ao', `${me(s)} se filia ao`), lead: 'Movimento é lido como preparação para 2028.', aboutPlayer: true, tone: 'neutro', outlets: ['diariopaulistano', 'radiocapital', 'contraponto', 'pauta'] });
    } else if (t.includes('Você tomou posse como')) {
      pushNews(s, rng, { section: 'Prefeitura', headline: `${me(s)} toma posse`, lead: t, aboutPlayer: true, tone: 'neutro', outlets: ['diariopaulistano'] });
    } else if (t.includes('Você assumiu a Secretaria')) {
      pushNews(s, rng, { section: 'Prefeitura', headline: `${me(s)} assume secretaria municipal`, lead: t, aboutPlayer: true, tone: 'neutro', outlets: ['diariopaulistano'] });
    } else if (t.includes('não pode disputar um terceiro mandato')) {
      pushNews(s, rng, { section: 'Eleições', headline: 'Sem Nunes na urna, disputa pela Prefeitura de SP fica aberta', lead: 'A Constituição permite uma única reeleição consecutiva; o atual prefeito já exerceu dois mandatos seguidos.', aboutPlayer: false, tone: 'neutro', outlets: ['canal24', 'tvmetropole', 'diariopaulistano'] });
    } else if (t.includes('VOCÊ VENCEU a eleição para a presidência do diretório')) {
      pushNews(s, rng, { section: 'Partidos', headline: `${me(s)} assume o comando do diretório municipal`, lead: t.replace('VOCÊ VENCEU', 'Venceu'), aboutPlayer: true, tone: 'positivo', outlets: ['diariopaulistano', 'radiocapital'] });
    } else if (t.includes('Você perdeu a disputa do diretório')) {
      pushNews(s, rng, { section: 'Partidos', headline: `${me(s)} perde disputa interna e fica isolado(a) no partido`, lead: 'A nova direção assume com maioria dos delegados.', aboutPlayer: true, tone: 'critico', outlets: ['diariopaulistano'] });
    } else if (t.includes('foi expulso(a) do')) {
      pushNews(s, rng, { section: 'Partidos', headline: `${me(s)} é expulso(a) do partido`, lead: 'Conselho de ética conclui processo disciplinar.', aboutPlayer: true, tone: 'critico', outlets: ['tvmetropole', 'canal24', 'diariopaulistano'] });
    } else if (t.includes('Criticar publicamente a direção:')) {
      pushNews(s, rng, { section: 'Partidos', headline: `${me(s)} critica a direção do próprio partido`, lead: 'Racha interno vem a público.', aboutPlayer: true, tone: 'neutro', outlets: ['diariopaulistano', 'pauta', 'contraponto'] });
    } else if (t.includes('Reportagem aponta caixa dois')) {
      pushNews(s, rng, { section: 'Eleições', headline: `Reportagem aponta recursos não declarados na campanha de ${me(s)}`, lead: 'Ministério Público Eleitoral pode pedir apuração.', aboutPlayer: true, tone: 'critico', outlets: ['tvmetropole', 'pauta', 'contraponto'] });
    }
  }
}

export function newsFromPoll(s: GameState, p: Poll, rng: RngState) {
  const [a, b] = p.results;
  const player = p.results.find((r) => r.id === 'character_player');
  const pctS = (x: number) => `${Math.round(x * 100)}%`;
  pushNews(s, rng, {
    section: 'Eleições',
    headline: p.scenario === '2º turno' ? `Pesquisa de 2º turno: ${a.name} tem ${pctS(a.share)}, ${b.name} ${pctS(b.share)}` : `Pesquisa ${p.institute.replace(' (fictício)', '')}: ${a.name} lidera com ${pctS(a.share)}`,
    lead: `${b.name} aparece com ${pctS(b.share)}${player && player.id !== a.id && player.id !== b.id ? `; ${player.name} tem ${pctS(player.share)}` : ''}. Margem de erro de ${p.marginOfError.toLocaleString('pt-BR')} pontos.`,
    aboutPlayer: false, tone: 'neutro', outlets: ['canal24', 'tvmetropole', 'diariopaulistano', 'radiocapital'],
  });
}

// Notícias de contexto: genéricas, sem nomes de pessoas reais, claramente parte da simulação.
const BACKGROUND: Omit<Draft, 'aboutPlayer' | 'tone'>[] = [
  { section: 'Brasil', headline: 'Congresso retoma debate sobre regras de financiamento de campanhas', lead: 'Partidos discutem mudanças na distribuição de recursos públicos.' },
  { section: 'Brasil', headline: 'Câmara dos Deputados analisa pacote de segurança pública', lead: 'Texto ainda precisa passar pelo Senado.' },
  { section: 'Brasil', headline: 'Justiça Eleitoral reforça regras contra desinformação nas campanhas', lead: 'Resoluções tratam de conteúdo impulsionado e uso de inteligência artificial.' },
  { section: 'Partidos', headline: 'Federações partidárias negociam candidaturas nas capitais', lead: 'Acordos precisam valer em todo o país, já que federação é nacional.' },
  { section: 'Partidos', headline: 'Janela de trocas partidárias movimenta bastidores', lead: 'Parlamentares avaliam mudanças de legenda dentro do prazo legal.' },
  { section: 'Cidade', headline: 'Chuvas expõem pontos de alagamento na capital', lead: 'Moradores cobram obras de drenagem.' },
  { section: 'Cidade', headline: 'Fila por vaga em creche volta a crescer em bairros da periferia', lead: 'Educação infantil é responsabilidade do município.' },
  { section: 'Cidade', headline: 'Usuários reclamam de intervalos longos nos ônibus municipais', lead: 'Prefeitura promete reforço em linhas da zona leste.' },
  { section: 'Cidade', headline: 'Zeladoria vira tema central das reclamações à prefeitura', lead: 'Buracos, poda de árvores e iluminação lideram pedidos.' },
  { section: 'Câmara', headline: 'Vereadores discutem orçamento municipal do próximo ano', lead: 'Emendas parlamentares concentram as negociações.' },
  { section: 'Prefeitura', headline: 'Prefeitura anuncia mutirão de zeladoria nas subprefeituras', lead: 'Ação deve durar três meses.' },
  { section: 'Brasil', headline: 'Inflação de serviços pressiona orçamento das prefeituras', lead: 'Gestores municipais pedem revisão de transferências.' },
];

export function backgroundNews(s: GameState, rng: RngState) {
  const n = next(rng) < 0.5 ? 1 : 2;
  for (let i = 0; i < n; i++) pushNews(s, rng, { ...pick(rng, BACKGROUND), aboutPlayer: false, tone: 'neutro' });
}

/** Disputas internas decididas neste mês em partidos grandes viram notícia (o mundo se move sem o jogador). */
export function newsFromContests(s: GameState, rng: RngState) {
  for (const c of s.contests) {
    if (c.status !== 'decidida' || !c.result || monthIndex(c.decidesAt) !== monthIndex(s.month) || c.partyId === s.player.partyId) continue;
    if ((s.government.councilSeatsByParty[c.partyId] ?? 0) < 4) continue;
    const w = s.actors[c.result.winnerId];
    const acr = partyById(c.partyId)?.acronym ?? c.partyId;
    pushNews(s, rng, { section: 'Partidos', headline: `Disputa interna: diretório municipal do ${acr} tem novo comando (simulação)`, lead: `${w?.name ?? 'Novo dirigente'} (dirigente fictício) venceu com ${c.result.votes[c.result.winnerId]} delegados.`, aboutPlayer: false, tone: 'neutro', outlets: ['diariopaulistano', 'radiocapital'] });
  }
}
