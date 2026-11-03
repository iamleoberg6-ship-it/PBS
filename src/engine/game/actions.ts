// Catálogo de ações mensais. Cada ação custa pontos de agenda (PROPOSTA: 3 por mês).
// availability() explica por que uma ação está bloqueada; apply() altera o estado.

import { GAMEPLAY } from '../data/rulepack';
import { PARTIES, listIdForParty, partyById } from '../data/parties';
import { monthIndex } from '../calendar';
import { next, normal, type RngState } from '../rng';
import { partyStrength } from './elections';
import { aiElectMesa } from './council';
import { PLAYER, adjustRel, standing } from './relations';
import { contestBlock } from './partyorg';
import { fatigueMultiplier, registerUse, dampenGains } from './fatigue';
import { snapshot, recordDiff } from './ledger';
import { recomputeNetWorth } from './finance';
import { NETWORKS, produceContent } from './social';
import { ideologicalDistance, partyIdeology } from '../data/ideology';
import type { AttributeKey, GameState } from './types';

export type ActionCategory = 'Vida e carreira' | 'Partido' | 'Pré-candidatura' | 'Campanha' | 'Mandato de vereador' | 'Prefeitura' | 'Secretaria';

export interface ActionParamOption {
  value: string;
  label: string;
}

export interface ActionDef {
  id: string;
  label: string;
  category: ActionCategory;
  description: string;
  cost: number;
  /** null = disponível; string = motivo do bloqueio; 'hidden' = não mostrar. */
  availability: (s: GameState) => string | null | 'hidden';
  params?: (s: GameState) => ActionParamOption[];
  paramLabel?: string;
  apply: (s: GameState, rng: RngState, param?: string) => string;
  /** false = ação de decisão/configuração, sem desgaste por repetição. */
  fatigue?: boolean;
}

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
/** Ganho com retornos decrescentes: quanto mais alto o indicador, mais difícil subir. */
export const grow = (current: number, gain: number) => (gain > 0 ? clamp(current + gain * Math.pow(1 - current / 100, 1.6)) : clamp(current + gain));
const mi = (y: number, m: number) => y * 12 + (m - 1);
const now = (s: GameState) => monthIndex(s.month);
const raise = (s: GameState, k: AttributeKey, v: number) => {
  s.character.attributes[k] = clamp(s.character.attributes[k] + v);
};
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export const THEMES = [
  { value: 'zeladoria', label: 'Zeladoria e limpeza urbana' },
  { value: 'saude', label: 'Atenção básica de saúde (UBS)' },
  { value: 'educacao', label: 'Educação infantil (creches)' },
  { value: 'mobilidade', label: 'Mobilidade e ônibus municipais' },
  { value: 'cultura', label: 'Cultura e esporte nos bairros' },
  { value: 'gcm', label: 'Guarda Civil Metropolitana' },
  { value: 'meioambiente', label: 'Parques e meio ambiente' },
  { value: 'habitacao', label: 'Habitação e regularização fundiária' },
];

const PORTFOLIOS = ['Esportes e Lazer', 'Cultura', 'Subprefeituras', 'Assistência Social', 'Habitação', 'Meio Ambiente'];

const mesaTerm = (s: GameState): number | null => {
  if (s.month.year === 2029 && s.month.month === 1) return 2029;
  if (s.month.month === 12 && s.month.year >= 2029 && s.month.year <= 2031) return s.month.year + 1;
  return null;
};
const isFiliado = (s: GameState) => s.player.partyId !== null;
const inMandate = (s: GameState, office: string) => s.player.mandate?.office === office;
const campaignOn = (s: GameState) => {
  const c = s.player.candidacy;
  if (!c || c.status !== 'registrada') return false;
  const t = now(s);
  if (t === mi(2028, 8) || t === mi(2028, 9)) return true;
  const runoffPlayer = s.elections.find((e) => e.year === 2028)?.runoffPending;
  return t === mi(2028, 10) && !!runoffPlayer;
};
const campaignBalance = (s: GameState) => {
  const a = s.player.candidacy?.account;
  return a ? a.fefc + a.donations + a.ownFunds - a.spent : 0;
};
const isMayorRace = (s: GameState) => s.player.candidacy?.office === 'prefeito';

function spendCampaign(s: GameState, vereadorCost: number, mayorCost: number): number | string {
  const cost = isMayorRace(s) ? mayorCost : vereadorCost;
  if (campaignBalance(s) < cost) return `Saldo de campanha insuficiente (precisa de ${brl(cost)}).`;
  s.player.candidacy!.account.spent += cost;
  return cost;
}

export const ACTIONS: ActionDef[] = [
  // ---------------- Vida e carreira ----------------
  {
    id: 'trabalho_extra', label: 'Fazer trabalhos extras', category: 'Vida e carreira', cost: 1,
    description: 'Reforça o caixa pessoal. Dinheiro pessoal não se mistura com o do partido nem da campanha.',
    availability: (s) => (s.player.mandate?.office === 'prefeito' ? 'hidden' : null),
    apply: (s, rng) => {
      const v = Math.round(Math.max(1500, s.finances.monthlyIncome * 0.35) * (0.8 + next(rng) * 0.4));
      s.finances.cash += v;
      return `Você fez trabalhos extras e ganhou ${brl(v)}.`;
    },
  },
  {
    id: 'comunidade', label: 'Atuar na comunidade', category: 'Vida e carreira', cost: 1,
    description: 'Associações de bairro, mutirões, conselhos. Constrói base e reconhecimento local.',
    availability: () => null,
    apply: (s, rng) => {
      const b = 2 + s.character.attributes.charisma / 25 + next(rng) * 2;
      s.player.base = grow(s.player.base, b);
      s.player.recognition = grow(s.player.recognition, 0.8);
      raise(s, 'popularity', 0.4);
      return `Trabalho comunitário: base +${b.toFixed(1)}.`;
    },
  },
  {
    id: 'estudar', label: 'Estudar política e gestão pública', category: 'Vida e carreira', cost: 1,
    description: 'Cursos, leitura de legislação, orçamento público.',
    availability: (s) => (s.character.attributes.politicalKnowledge >= 95 ? 'Você já domina o assunto.' : null),
    apply: (s) => {
      raise(s, 'politicalKnowledge', 2.5);
      raise(s, 'management', 1);
      return 'Conhecimento político +2,5; Gestão +1.';
    },
  },
  {
    id: 'redes', label: 'Produzir conteúdo nas redes', category: 'Vida e carreira', cost: 1,
    description: 'Conteúdo concentrado na rede em foco do mês (escolha na página Redes sociais). Cresce seguidores e reconhecimento; existe risco de polêmica.',
    availability: () => null,
    apply: (s, rng) => {
      const r = produceContent(s, rng);
      const net = NETWORKS.find((n) => n.id === r.network)!;
      if (r.polemic) {
        raise(s, 'popularity', -2);
        s.player.recognition = grow(s.player.recognition, 1);
        return `Polêmica nas redes: um vídeo seu no ${net.label} foi recortado fora de contexto. Popularidade −2 (+${r.gained.toLocaleString('pt-BR')} seguidores mesmo assim).`;
      }
      const rec = 1 + Math.log10(1 + r.gained) * 0.8;
      s.player.recognition = grow(s.player.recognition, rec);
      if (r.network === 'youtube') raise(s, 'popularity', 0.5);
      if (r.network === 'x') s.player.partyRel.influence = grow(s.player.partyRel.influence, 0.8);
      if (r.network === 'instagram') s.player.base = grow(s.player.base, 0.8);
      return `${net.label}: +${r.gained.toLocaleString('pt-BR')} seguidores, reconhecimento +${rec.toFixed(1)}.`;
    },
  },
  {
    id: 'rede_contatos', label: 'Construir rede de contatos políticos', category: 'Vida e carreira', cost: 1,
    description: 'Cafés com lideranças, assessores e dirigentes. Custa R$ 500.',
    availability: (s) => (s.finances.cash < 500 ? 'Sem caixa pessoal para isso.' : null),
    apply: (s) => {
      s.finances.cash -= 500;
      raise(s, 'articulation', 2);
      raise(s, 'negotiation', 1);
      return 'Articulação +2; Negociação +1.';
    },
  },
  {
    id: 'cargo_assessor', fatigue: false, label: 'Buscar cargo de assessor(a) parlamentar', category: 'Vida e carreira', cost: 1,
    description: 'Trabalhar no gabinete de um vereador do seu partido. É um cargo de confiança, não eletivo.',
    availability: (s) => {
      if (s.player.job === 'assessor') return 'hidden';
      if (s.player.mandate) return 'hidden';
      if (!isFiliado(s)) return 'Exige filiação partidária (indicação política).';
      if ((s.government.councilSeatsByParty[s.player.partyId!] ?? 0) === 0) return 'Seu partido não tem vereadores na Câmara.';
      if (s.player.partyRel.leadershipTrust < 30) return 'Confiança da direção precisa ser ≥ 30.';
      return null;
    },
    apply: (s, rng) => {
      if (next(rng) < 0.25 + s.player.partyRel.leadershipTrust / 150) {
        s.player.job = 'assessor';
        s.finances.monthlyIncome = 9500;
        s.player.careerHistory.push({ office: 'Assessor(a) parlamentar — Câmara Municipal de São Paulo', from: `${s.month.year}-${String(s.month.month).padStart(2, '0')}`, to: null, note: 'Cargo de confiança' });
        return 'Você foi nomeado(a) assessor(a) parlamentar. Salário de R$ 9.500 (valor de jogo).';
      }
      return 'Não havia vaga no gabinete este mês. Tente de novo.';
    },
  },
  {
    id: 'gabinete', label: 'Trabalho de gabinete', category: 'Vida e carreira', cost: 1,
    description: 'Como assessor(a): pareceres, agenda do vereador, atendimento a lideranças.',
    availability: (s) => (s.player.job === 'assessor' && !s.player.mandate ? null : 'hidden'),
    apply: (s) => {
      raise(s, 'politicalKnowledge', 1.5);
      raise(s, 'articulation', 1.5);
      s.player.partyRel.leadershipTrust = grow(s.player.partyRel.leadershipTrust, 2);
      return 'Gabinete: conhecimento +1,5, articulação +1,5, confiança da direção +2.';
    },
  },

  // ---------------- Partido ----------------
  {
    id: 'atividade_partidaria', label: 'Participar da vida partidária', category: 'Partido', cost: 1,
    description: 'Reuniões do diretório, núcleos e formação. Melhora a popularidade interna e a fidelidade percebida; a confiança da direção sobe devagar.',
    availability: (s) => (isFiliado(s) ? (s.player.partyRel.disciplinary === 2 ? 'Você está suspenso(a) pelo partido.' : null) : 'Você não é filiado(a).'),
    apply: (s, rng) => {
      const pr = s.player.partyRel;
      const g = 2.5 + s.character.attributes.charisma / 30 + next(rng) * 2;
      pr.internalPopularity = grow(pr.internalPopularity, g);
      pr.perceivedLoyalty = grow(pr.perceivedLoyalty, 2);
      pr.leadershipTrust = grow(pr.leadershipTrust, 1.5);
      pr.mobilization = grow(pr.mobilization, 1);
      raise(s, 'articulation', 0.4);
      return `Popularidade interna +${g.toFixed(1)}, fidelidade percebida +2, confiança da direção +1,5.`;
    },
  },
  {
    id: 'aproximar_faccao', label: 'Aproximar-se de uma facção', category: 'Partido', cost: 1,
    description: 'Conversas com a liderança de um grupo interno. Facções dão apoio em convenções e disputas, mas cada uma tem preferências próprias.',
    availability: (s) => (!isFiliado(s) ? 'hidden' : (s.partyOrgs[s.player.partyId!]?.factions.length ?? 0) < 1 ? 'Seu partido não tem grupos internos relevantes em SP.' : null),
    paramLabel: 'Facção',
    params: (s) => (s.partyOrgs[s.player.partyId!]?.factions ?? []).map((f) => ({ value: f.id, label: `${f.name} (${Math.round(f.share * 100)}% dos delegados)` })),
    apply: (s, rng, param) => {
      const f = s.partyOrgs[s.player.partyId!].factions.find((x) => x.id === param)!;
      const a = s.character.attributes;
      const g = 4 + a.articulation / 20 + a.charisma / 40 + next(rng) * 3;
      adjustRel(s, f.leaderId, PLAYER, { trust: g, affinity: g * 0.6 });
      s.player.partyRel.influence = grow(s.player.partyRel.influence, 1.2);
      // Aproximar-se de uma ala gera ciúme nas rivais.
      for (const o of s.partyOrgs[s.player.partyId!].factions) if (o.id !== f.id && (o.type === 'oposicionista') !== (f.type === 'oposicionista')) adjustRel(s, o.leaderId, PLAYER, { affinity: -2 });
      return `${s.actors[f.leaderId]?.name} (${f.name}) passou a confiar mais em você.`;
    },
  },
  {
    id: 'mobilizar_filiados', label: 'Mobilizar filiados e delegados', category: 'Partido', cost: 1,
    description: 'Encontros nos núcleos e convocação de filiados. Aumenta sua capacidade de mobilização para disputas internas. Custa R$ 1.500.',
    availability: (s) => (!isFiliado(s) ? 'hidden' : s.finances.cash < 1500 ? 'Sem caixa pessoal.' : null),
    apply: (s, rng) => {
      s.finances.cash -= 1500;
      const g = 3 + s.character.attributes.leadership / 25 + next(rng) * 2;
      s.player.partyRel.mobilization = grow(s.player.partyRel.mobilization, g);
      s.player.partyRel.internalPopularity = grow(s.player.partyRel.internalPopularity, 1);
      return `Mobilização +${g.toFixed(1)}.`;
    },
  },
  {
    id: 'criticar_direcao', label: 'Criticar publicamente a direção', category: 'Partido', cost: 1,
    description: 'Ganha espaço com quem está insatisfeito e aparece na imprensa, mas corrói a confiança da direção e a fidelidade percebida. Pode levar a processo disciplinar.',
    availability: (s) => (!isFiliado(s) ? 'hidden' : s.partyOrgs[s.player.partyId!]?.directorate.presidentId === PLAYER ? 'Você preside o diretório.' : null),
    apply: (s) => {
      const pr = s.player.partyRel;
      const org = s.partyOrgs[s.player.partyId!];
      pr.leadershipTrust = Math.max(0, pr.leadershipTrust - 10);
      pr.perceivedLoyalty = Math.max(0, pr.perceivedLoyalty - 8);
      pr.internalPopularity = grow(pr.internalPopularity, 3);
      pr.influence = grow(pr.influence, 2);
      s.player.recognition = grow(s.player.recognition, 1.5);
      adjustRel(s, org.directorate.presidentId, PLAYER, { trust: -12, affinity: -8 }, { kind: 'ataque', text: 'Criticou a direção em público', weight: 4 });
      for (const f of org.factions) if (f.leaderId !== org.directorate.presidentId && f.type !== 'direcao') adjustRel(s, f.leaderId, PLAYER, { affinity: 3 });
      return 'A crítica repercutiu: popularidade interna +3, mas a direção ficou contra você (confiança −10, fidelidade percebida −8).';
    },
  },
  {
    id: 'candidatar_diretorio', fatigue: false, label: 'Disputar a presidência do diretório', category: 'Partido', cost: 1,
    description: 'Candidatura à presidência do diretório municipal. Quem decide são os delegados: facções votam em bloco, e os demais seguem popularidade interna e mobilização.',
    availability: (s) => {
      if (!isFiliado(s)) return 'hidden';
      const c = s.contests.find((x) => x.partyId === s.player.partyId && x.status === 'aberta');
      if (!c) return 'Nenhuma disputa aberta no seu diretório agora.';
      return contestBlock(s, c);
    },
    apply: (s) => {
      const c = s.contests.find((x) => x.partyId === s.player.partyId && x.status === 'aberta')!;
      c.candidates.push(PLAYER);
      s.player.partyRel.influence = grow(s.player.partyRel.influence, 2);
      adjustRel(s, s.partyOrgs[c.partyId].directorate.presidentId, PLAYER, { trust: -6 });
      return `Você lançou sua candidatura à presidência do diretório. Decisão em ${c.decidesAt.month}/${c.decidesAt.year}.`;
    },
  },
  {
    id: 'negociar_faccao', fatigue: false, label: 'Negociar apoio de facção (vaga na executiva)', category: 'Partido', cost: 1,
    description: 'Você promete uma vaga na executiva à liderança da facção em troca dos delegados dela. Promessa fica registrada: se você vencer, ela é cumprida; se não, caduca.',
    availability: (s) => {
      if (!isFiliado(s)) return 'hidden';
      const c = s.contests.find((x) => x.partyId === s.player.partyId && x.status === 'aberta');
      if (!c || !c.candidates.includes(PLAYER)) return 'Só para quem é candidato(a) numa disputa interna aberta.';
      return null;
    },
    paramLabel: 'Facção',
    params: (s) => {
      const c = s.contests.find((x) => x.partyId === s.player.partyId && x.status === 'aberta');
      return (s.partyOrgs[s.player.partyId!]?.factions ?? [])
        .filter((f) => !c?.candidates.includes(f.leaderId) && !s.promises.some((p) => p.status === 'aberta' && p.toActorId === f.leaderId && p.contestId === c?.id))
        .map((f) => ({ value: f.id, label: f.name }));
    },
    apply: (s, rng, param) => {
      const c = s.contests.find((x) => x.partyId === s.player.partyId && x.status === 'aberta')!;
      const f = s.partyOrgs[c.partyId].factions.find((x) => x.id === param)!;
      const leader = s.actors[f.leaderId];
      const chance = clamp(30 + standing(s, f.leaderId, PLAYER) * 0.6 + (leader?.traits.pragmatism ?? 50) * 0.3 + s.character.attributes.negotiation * 0.2, 5, 90) / 100;
      if (next(rng) < chance) {
        s.promises.push({ id: `pm_${c.id}_${f.id}`, toActorId: f.leaderId, kind: 'vaga_executiva', contestId: c.id, text: `Vaga na executiva para ${leader?.name}`, status: 'aberta', madeAt: { ...s.month } });
        adjustRel(s, f.leaderId, PLAYER, { trust: 5 }, { kind: 'acordo', text: 'Acordo de apoio na disputa do diretório', weight: 3 });
        return `Acordo fechado com ${leader?.name}: os delegados da ${f.name} tendem a votar em você.`;
      }
      return `${leader?.name} não aceitou o acordo por enquanto.`;
    },
  },
  {
    id: 'apoiar_candidato_diretorio', fatigue: false, label: 'Declarar apoio na disputa do diretório', category: 'Partido', cost: 1,
    description: 'Apoiar um candidato cria uma promessa: se ele vencer, tende a retribuir (até com vaga na executiva). Se você mudar de lado depois, ele vai lembrar.',
    availability: (s) => {
      if (!isFiliado(s)) return 'hidden';
      const c = s.contests.find((x) => x.partyId === s.player.partyId && x.status === 'aberta');
      if (!c) return 'Nenhuma disputa aberta no seu diretório agora.';
      if (c.candidates.includes(PLAYER)) return 'Você é candidato(a) nesta disputa.';
      return null;
    },
    paramLabel: 'Candidato',
    params: (s) => {
      const c = s.contests.find((x) => x.partyId === s.player.partyId && x.status === 'aberta');
      return (c?.candidates ?? []).filter((id) => id !== PLAYER).map((id) => ({ value: id, label: s.actors[id]?.name ?? id }));
    },
    apply: (s, _rng, param) => {
      const c = s.contests.find((x) => x.partyId === s.player.partyId && x.status === 'aberta')!;
      const prevSupport = s.flags[`apoio_${c.id}`] as string | undefined;
      if (prevSupport && prevSupport !== param) {
        for (const p of s.promises.filter((x) => x.status === 'aberta' && x.contestId === c.id && x.toActorId === prevSupport)) p.status = 'quebrada';
        adjustRel(s, prevSupport, PLAYER, { trust: -35, affinity: -20 }, { kind: 'traicao', text: 'Retirou o apoio prometido na disputa', weight: 9 });
        s.player.partyRel.perceivedLoyalty = Math.max(0, s.player.partyRel.perceivedLoyalty - 10);
      }
      s.flags[`apoio_${c.id}`] = param!;
      s.promises.push({ id: `pa_${c.id}_${param}`, toActorId: param!, kind: 'apoio_disputa', contestId: c.id, text: `Apoio a ${s.actors[param!]?.name} na disputa do diretório`, status: 'aberta', madeAt: { ...s.month } });
      adjustRel(s, param!, PLAYER, { trust: 8, affinity: 5 }, { kind: 'apoio', text: 'Declarou apoio na disputa do diretório', weight: 4 });
      // Os outros candidatos notam.
      for (const other of c.candidates) if (other !== param && other !== PLAYER) adjustRel(s, other, PLAYER, { affinity: -6 });
      return `Você declarou apoio a ${s.actors[param!]?.name}${prevSupport && prevSupport !== param ? ' — e trocou de lado, o que ficará na memória de quem você abandonou' : ''}.`;
    },
  },

  // ---------------- Pré-candidatura ----------------
  {
    id: 'pleitear', fatigue: false, label: 'Pleitear candidatura em 2028', category: 'Pré-candidatura', cost: 1,
    description: 'Avisa a direção que você quer disputar. A decisão sai na convenção (20/07 a 05/08/2028).',
    availability: (s) => {
      if (s.player.candidacy) return 'hidden';
      if (!isFiliado(s)) return 'Exige filiação partidária.';
      if (now(s) < mi(2027, 7)) return 'Disponível a partir de julho de 2027.';
      if (now(s) > mi(2028, 7)) return 'O prazo das convenções passou.';
      return null;
    },
    paramLabel: 'Cargo',
    params: () => [{ value: 'vereador', label: 'Vereador(a)' }, { value: 'prefeito', label: 'Prefeito(a)' }],
    apply: (s, _rng, param) => {
      const office = param === 'prefeito' ? 'prefeito' : 'vereador';
      s.player.candidacy = {
        office, status: 'pretendida', checks: [], coalitionPartyIds: [], campaignPoints: 0,
        account: { fefc: 0, donations: 0, ownFunds: 0, spent: 0 }, irregularities: 0,
      };
      return `Você colocou seu nome como pré-candidato(a) a ${office === 'prefeito' ? 'prefeito(a)' : 'vereador(a)'}.`;
    },
  },
  {
    id: 'desistir', fatigue: false, label: 'Retirar pré-candidatura', category: 'Pré-candidatura', cost: 0,
    description: 'Desiste antes da convenção.',
    availability: (s) => (s.player.candidacy?.status === 'pretendida' ? null : 'hidden'),
    apply: (s) => {
      s.player.candidacy = null;
      return 'Pré-candidatura retirada.';
    },
  },
  {
    id: 'pre_campanha', label: 'Atos de pré-campanha', category: 'Pré-candidatura', cost: 1,
    description: 'Encontros, entrevistas e divulgação de ideias sem pedido explícito de voto (Lei 9.504/97 art. 36-A). Custa R$ 2.000 do caixa pessoal.',
    availability: (s) => {
      if (!s.player.candidacy || s.player.candidacy.status === 'rejeitada_convencao') return 'hidden';
      if (now(s) >= mi(2028, 8)) return 'hidden';
      if (s.finances.cash < 2000) return 'Sem caixa pessoal.';
      return null;
    },
    apply: (s, rng) => {
      s.finances.cash -= 2000;
      const r = 2 + s.character.attributes.communication / 35 + next(rng) * 2;
      s.player.recognition = grow(s.player.recognition, r);
      s.player.base = grow(s.player.base, 1);
      return `Pré-campanha: reconhecimento +${r.toFixed(1)}.`;
    },
  },
  {
    id: 'coligacao', fatigue: false, label: 'Negociar coligação majoritária', category: 'Pré-candidatura', cost: 1,
    description: 'Coligação só vale para prefeito (majoritária). Na eleição de vereador é proibida (CF art. 17 §1º). Federações não se desfazem para coligar: entram por inteiro.',
    availability: (s) => {
      const c = s.player.candidacy;
      if (!c || c.office !== 'prefeito') return 'hidden';
      if (c.status === 'rejeitada_convencao' || c.status === 'indeferida') return 'hidden';
      if (now(s) < mi(2028, 3) || now(s) > mi(2028, 7)) return 'Negociações de coligação: março a julho de 2028.';
      return null;
    },
    paramLabel: 'Partido',
    params: (s) =>
      PARTIES.filter((p) => p.id !== s.player.partyId && !s.player.candidacy!.coalitionPartyIds.includes(p.id) && listIdForParty(p.id) !== listIdForParty(s.player.partyId!))
        .sort((a, b) => partyStrength(s, b.id) - partyStrength(s, a.id))
        .map((p) => ({ value: p.id, label: `${p.acronym}${p.federationId ? ' (federação)' : ''}` })),
    apply: (s, rng, param) => {
      const target = partyById(param!)!;
      const ownS = partyStrength(s, s.player.partyId!);
      const tS = partyStrength(s, target.id);
      // Partidos maiores que o seu raramente aceitam ser coadjuvantes; quem já está na chapa conta a favor.
      const allies = s.player.candidacy!.coalitionPartyIds.length;
      // Distância ideológica entre os partidos (escala de especialistas) pesa contra a aliança.
      const dist = ideologicalDistance(partyIdeology(s.player.partyId!), partyIdeology(target.id)) ?? 0.25;
      let chance = clamp(5 + s.character.attributes.negotiation * 0.35 + s.player.recognition * 0.3 + (ownS - tS) * 2.5 - allies * 6 - dist * 60, 2, 80) / 100;
      if (tS > ownS * 1.5) chance *= 0.3;
      if (next(rng) < chance) {
        const members = target.federationId ? PARTIES.filter((p) => p.federationId === target.federationId).map((p) => p.id) : [target.id];
        for (const m of members) if (!s.player.candidacy!.coalitionPartyIds.includes(m)) s.player.candidacy!.coalitionPartyIds.push(m);
        return `${target.acronym} topou entrar na sua coligação${target.federationId ? ' (com toda a federação)' : ''}.`;
      }
      return `${target.acronym} recusou a coligação por enquanto${dist > 0.3 ? ' — a distância ideológica pesou' : ''}.`;
    },
  },

  // ---------------- Campanha ----------------
  {
    id: 'corpo_a_corpo', label: 'Corpo a corpo nas ruas', category: 'Campanha', cost: 1,
    description: 'Caminhadas, feiras, estações. Custa R$ 5 mil (vereador) ou R$ 50 mil (prefeito) da conta de campanha.',
    availability: (s) => (campaignOn(s) ? null : 'hidden'),
    apply: (s, rng) => {
      const r = spendCampaign(s, 5000, 50000);
      if (typeof r === 'string') return r;
      const pts = 3 + s.character.attributes.charisma / 25 + next(rng) * 2;
      s.player.candidacy!.campaignPoints += pts;
      s.player.base = grow(s.player.base, 1.5);
      return `Corpo a corpo: campanha +${pts.toFixed(1)} (gasto ${brl(r)}).`;
    },
  },
  {
    id: 'propaganda', label: 'Propaganda e impulsionamento', category: 'Campanha', cost: 1,
    description: 'Material, vídeos e impulsionamento de conteúdo (permitido quando contratado pela campanha). R$ 15 mil / R$ 300 mil.',
    availability: (s) => (campaignOn(s) ? null : 'hidden'),
    apply: (s, rng) => {
      const r = spendCampaign(s, 15000, 300000);
      if (typeof r === 'string') return r;
      const pts = 3 + s.character.attributes.communication / 22 + next(rng) * 2;
      s.player.candidacy!.campaignPoints += pts;
      s.player.recognition = grow(s.player.recognition, 3);
      return `Propaganda: campanha +${pts.toFixed(1)}, reconhecimento +3 (gasto ${brl(r)}).`;
    },
  },
  {
    id: 'comicio', label: 'Evento de campanha', category: 'Campanha', cost: 1,
    description: 'Reunião com apoiadores e lideranças locais. R$ 10 mil / R$ 120 mil.',
    availability: (s) => (campaignOn(s) ? null : 'hidden'),
    apply: (s, rng) => {
      const r = spendCampaign(s, 10000, 120000);
      if (typeof r === 'string') return r;
      const pts = 2 + s.character.attributes.leadership / 28 + next(rng) * 2;
      s.player.candidacy!.campaignPoints += pts;
      s.player.base = grow(s.player.base, 2);
      return `Evento: campanha +${pts.toFixed(1)}, base +2 (gasto ${brl(r)}).`;
    },
  },
  {
    id: 'debate', label: 'Participar de debate', category: 'Campanha', cost: 1,
    description: 'Só para prefeito. Bom desempenho rende muito; um tropeço custa caro.',
    availability: (s) => (campaignOn(s) && isMayorRace(s) ? null : 'hidden'),
    apply: (s, rng) => {
      const roll = normal(rng, s.character.attributes.communication + s.character.attributes.politicalKnowledge * 0.4, 18);
      if (roll > 75) {
        s.player.candidacy!.campaignPoints += 8;
        s.player.recognition = grow(s.player.recognition, 5);
        return 'Você foi muito bem no debate. Campanha +8.';
      }
      if (roll < 40) {
        s.player.candidacy!.campaignPoints -= 4;
        raise(s, 'popularity', -2);
        return 'Debate ruim: uma resposta sua viralizou do jeito errado. Campanha −4.';
      }
      s.player.candidacy!.campaignPoints += 3;
      return 'Debate sem grandes momentos. Campanha +3.';
    },
  },
  {
    id: 'arrecadar', label: 'Arrecadar doações de pessoas físicas', category: 'Campanha', cost: 1,
    description: 'Doações só de pessoas físicas, limitadas a 10% da renda do doador (Lei 9.504/97 art. 23). Pessoa jurídica não pode doar.',
    availability: (s) => (campaignOn(s) ? null : 'hidden'),
    apply: (s, rng) => {
      const base = isMayorRace(s) ? 400000 : 25000;
      const v = Math.round(base * (0.4 + s.character.attributes.articulation / 100 + s.player.recognition / 120) * (0.7 + next(rng) * 0.6));
      s.player.candidacy!.account.donations += v;
      return `Você arrecadou ${brl(v)} em doações.`;
    },
  },
  {
    id: 'autofinanciar', fatigue: false, label: 'Usar recursos próprios na campanha', category: 'Campanha', cost: 0,
    description: 'Autofinanciamento limitado a 10% do limite de gastos do cargo (Lei 9.504/97 art. 23 §2º-A). Limite do jogo é provisório.',
    availability: (s) => {
      if (!campaignOn(s)) return 'hidden';
      if (s.finances.cash < 5000) return 'Caixa pessoal insuficiente.';
      return null;
    },
    paramLabel: 'Valor',
    params: () => [5000, 20000, 50000, 200000].map((v) => ({ value: String(v), label: brl(v) })),
    apply: (s, _rng, param) => {
      const limit = (isMayorRace(s) ? GAMEPLAY.spendingLimitPrefeitoSP.value : GAMEPLAY.spendingLimitVereadorSP.value) * GAMEPLAY.ownFundsCapShareOfLimit.value;
      const acc = s.player.candidacy!.account;
      const v = Math.min(Number(param), s.finances.cash, limit - acc.ownFunds);
      if (v <= 0) return `Você já atingiu o teto de autofinanciamento (${brl(limit)}).`;
      s.finances.cash -= v;
      acc.ownFunds += v;
      return `Você transferiu ${brl(v)} do seu caixa pessoal para a conta de campanha.`;
    },
  },

  // ---------------- Mandato de vereador ----------------
  {
    id: 'projeto_lei', label: 'Apresentar projeto de lei', category: 'Mandato de vereador', cost: 1,
    description: 'Somente matérias de interesse local (CF art. 30). Projetos que criam despesa ou mexem na estrutura da prefeitura costumam ser de iniciativa do prefeito.',
    availability: (s) => (inMandate(s, 'vereador') ? (s.player.mandate!.projects.filter((p) => p.status === 'tramitando').length >= 3 ? 'Já há 3 projetos seus tramitando.' : null) : 'hidden'),
    paramLabel: 'Tema',
    params: () => THEMES,
    apply: (s, rng, param) => {
      const theme = THEMES.find((t) => t.value === param) ?? THEMES[0];
      const id = `pl_${s.month.year}_${s.month.month}_${Math.floor(next(rng) * 1e6)}`;
      s.player.mandate!.projects.push({ id, theme: theme.value, title: `PL — ${theme.label}`, monthsLeft: 3 + Math.floor(next(rng) * 4), status: 'tramitando' });
      s.player.recognition = grow(s.player.recognition, 1);
      return `Projeto protocolado: ${theme.label}. Começa a tramitar nas comissões.`;
    },
  },
  {
    id: 'fiscalizar', label: 'Fiscalizar a prefeitura', category: 'Mandato de vereador', cost: 1,
    description: 'Requerimentos de informação, visitas a equipamentos, análise de contratos.',
    availability: (s) => (inMandate(s, 'vereador') ? null : 'hidden'),
    apply: (s, rng) => {
      s.player.recognition = grow(s.player.recognition, 2);
      s.player.mandate!.relationExecutive = clamp(s.player.mandate!.relationExecutive - (s.player.mandate!.stance === 'base' ? 6 : 2));
      if (next(rng) < 0.18 + s.character.attributes.politicalKnowledge / 500) {
        s.pendingEvents.push({ templateId: 'irregularidade_contrato', vars: {} });
        return 'Sua equipe encontrou indícios de irregularidade num contrato da prefeitura.';
      }
      return 'Fiscalização feita. Reconhecimento +2; relação com a prefeitura caiu.';
    },
  },
  {
    id: 'atender_base', label: 'Atender a base nos bairros', category: 'Mandato de vereador', cost: 1,
    description: 'Plantões no bairro, demandas de zeladoria, encaminhamentos.',
    availability: (s) => (inMandate(s, 'vereador') ? null : 'hidden'),
    apply: (s, rng) => {
      s.player.base = grow(s.player.base, 2 + next(rng) * 2);
      s.player.mandate!.approval = clamp(s.player.mandate!.approval + 1.5);
      raise(s, 'popularity', 0.6);
      return 'Atendimento na base: base e aprovação do mandato subiram.';
    },
  },
  {
    id: 'posicionamento', fatigue: false, label: 'Definir posição frente à prefeitura', category: 'Mandato de vereador', cost: 1,
    description: 'Base do governo dá acesso e emendas; oposição dá visibilidade. Independente fica no meio.',
    availability: (s) => (inMandate(s, 'vereador') ? null : 'hidden'),
    paramLabel: 'Posição',
    params: () => [{ value: 'base', label: 'Base do governo' }, { value: 'independente', label: 'Independente' }, { value: 'oposicao', label: 'Oposição' }],
    apply: (s, _rng, param) => {
      const m = s.player.mandate!;
      m.stance = (param as typeof m.stance) ?? 'independente';
      m.relationExecutive = clamp(m.relationExecutive + (m.stance === 'base' ? 20 : m.stance === 'oposicao' ? -20 : 0));
      return `Você agora se declara ${m.stance === 'base' ? 'da base do governo' : m.stance === 'oposicao' ? 'de oposição' : 'independente'}.`;
    },
  },
  {
    id: 'emendas', label: 'Indicar emendas ao orçamento', category: 'Mandato de vereador', cost: 1,
    description: 'Durante a tramitação da lei orçamentária (setembro a dezembro). A execução depende da prefeitura.',
    availability: (s) => (inMandate(s, 'vereador') ? (s.month.month >= 9 ? null : 'Só durante a tramitação do orçamento (set–dez).') : 'hidden'),
    apply: (s, rng) => {
      const exec = s.player.mandate!.relationExecutive / 100;
      if (next(rng) < 0.35 + exec * 0.6) {
        s.player.base = grow(s.player.base, 4);
        s.player.mandate!.approval = clamp(s.player.mandate!.approval + 2);
        return 'Emendas aprovadas e com execução prometida para seus bairros. Base +4.';
      }
      return 'Emendas aprovadas no papel, mas a prefeitura não priorizou a execução.';
    },
  },
  {
    id: 'presidencia_camara', fatigue: false, label: 'Disputar a presidência da Câmara', category: 'Mandato de vereador', cost: 2,
    description: 'Eleição interna entre os 55 vereadores. Na Câmara de SP a Mesa tem mandato de 1 ano: eleição em 1º de janeiro no início da legislatura e em dezembro para o ano seguinte (prática de 2025–2026; confirmar no Regimento Interno).',
    availability: (s) => {
      if (!inMandate(s, 'vereador')) return 'hidden';
      const term = mesaTerm(s);
      if (term === null) return 'Eleição da Mesa: janeiro de 2029 e dezembro de 2029, 2030 e 2031.';
      if (s.flags[`mesa_${term}`]) return 'A Mesa deste período já foi eleita.';
      return null;
    },
    apply: (s, rng) => {
      const term = mesaTerm(s)!;
      const a = s.character.attributes;
      const bancada = s.government.councilSeatsByParty[s.player.partyId!] ?? 1;
      const chance = clamp(-25 + a.articulation * 0.45 + a.negotiation * 0.35 + bancada * 2.5 + (s.player.mandate!.stance === 'base' ? 15 : 0), 2, 85) / 100;
      if (next(rng) < chance) {
        s.flags[`mesa_${term}`] = true;
        s.player.mandate!.councilPresident = true;
        s.government.councilPresident = { personId: 'character_player', name: s.character.name, partyId: s.player.partyId!, real: false, year: term, simulated: false };
        s.player.recognition = grow(s.player.recognition, 10);
        return `Você foi eleito(a) presidente da Câmara Municipal para ${term}! Agora controla a pauta do plenário.`;
      }
      s.player.mandate!.relationExecutive = clamp(s.player.mandate!.relationExecutive - 5);
      const msg = aiElectMesa(s, term, rng);
      return `Você perdeu a eleição da Mesa. ${msg}`;
    },
  },

  // ---------------- Prefeitura ----------------
  {
    id: 'prioridade', fatigue: false, label: 'Definir prioridade de gestão', category: 'Prefeitura', cost: 1,
    description: 'Concentra recursos e atenção numa área de competência municipal.',
    availability: (s) => (inMandate(s, 'prefeito') ? null : 'hidden'),
    paramLabel: 'Área', params: () => THEMES,
    apply: (s, _rng, param) => {
      s.player.mandate!.priorityArea = param ?? null;
      return `Prioridade da gestão: ${THEMES.find((t) => t.value === param)?.label}. Os resultados aparecem ao longo dos meses.`;
    },
  },
  {
    id: 'secretariado', label: 'Compor secretariado com aliados', category: 'Prefeitura', cost: 1,
    description: 'Ceder secretarias a partidos amplia a base na Câmara, mas pode custar aprovação e coesão.',
    availability: (s) => (inMandate(s, 'prefeito') ? (s.player.mandate!.councilBase >= 45 ? 'Sua base já é ampla.' : null) : 'hidden'),
    apply: (s, rng) => {
      const g = 3 + Math.floor(next(rng) * 4 + s.character.attributes.negotiation / 30);
      s.player.mandate!.councilBase = Math.min(55, s.player.mandate!.councilBase + g);
      s.player.mandate!.approval = clamp(s.player.mandate!.approval - 1);
      return `Acordo fechado: +${g} vereadores na base (${s.player.mandate!.councilBase}/55).`;
    },
  },
  {
    id: 'projeto_executivo', label: 'Enviar projeto à Câmara', category: 'Prefeitura', cost: 1,
    description: 'Projetos do Executivo precisam de maioria no plenário. O prefeito não aprova lei sozinho.',
    availability: (s) => (inMandate(s, 'prefeito') ? null : 'hidden'),
    paramLabel: 'Tema', params: () => THEMES,
    apply: (s, rng, param) => {
      const m = s.player.mandate!;
      const theme = THEMES.find((t) => t.value === param) ?? THEMES[0];
      const votes = Math.round(m.councilBase + normal(rng, 0, 3) + (55 - m.councilBase) * 0.2);
      if (votes >= 28) {
        m.approval = clamp(m.approval + 3);
        m.projects.push({ id: `exe_${monthIndex(s.month)}`, theme: theme.value, title: `Projeto do Executivo — ${theme.label}`, monthsLeft: 0, status: 'sancionado' });
        return `Câmara aprovou seu projeto (${theme.label}) por ${Math.min(55, votes)} votos. Aprovação +3.`;
      }
      m.approval = clamp(m.approval - 2);
      return `Projeto derrotado no plenário (${Math.max(0, votes)} votos favoráveis; precisava de maioria). Sua base é insuficiente.`;
    },
  },
  {
    id: 'zeladoria', label: 'Mutirão de zeladoria e obras de bairro', category: 'Prefeitura', cost: 1,
    description: 'Tapa-buraco, poda, iluminação. Efeito rápido na aprovação.',
    availability: (s) => (inMandate(s, 'prefeito') ? null : 'hidden'),
    apply: (s, rng) => {
      const g = 1.5 + s.character.attributes.management / 40 + next(rng);
      s.player.mandate!.approval = clamp(s.player.mandate!.approval + g);
      return `Zeladoria nos bairros: aprovação +${g.toFixed(1)}.`;
    },
  },
  {
    id: 'negociar_estado_uniao', label: 'Negociar convênios com Estado e União', category: 'Prefeitura', cost: 1,
    description: 'Transferências voluntárias para obras e programas. Depende de articulação e de relação política.',
    availability: (s) => (inMandate(s, 'prefeito') ? null : 'hidden'),
    apply: (s, rng) => {
      if (next(rng) < 0.3 + s.character.attributes.articulation / 200) {
        s.player.mandate!.approval = clamp(s.player.mandate!.approval + 3);
        return 'Convênio assinado: recursos para uma obra importante. Aprovação +3.';
      }
      return 'As negociações não avançaram este mês.';
    },
  },

  // ---------------- Secretaria ----------------
  {
    id: 'executar_programa', label: 'Executar programa da pasta', category: 'Secretaria', cost: 1,
    description: 'Entregas da sua secretaria. Depende do orçamento que você conseguiu.',
    availability: (s) => (inMandate(s, 'secretario') ? null : 'hidden'),
    apply: (s, rng) => {
      const m = s.player.mandate!;
      const g = (m.budgetShare / 40 + s.character.attributes.management / 50) * (0.6 + next(rng) * 0.8);
      m.approval = clamp(m.approval + g);
      s.player.recognition = grow(s.player.recognition, 1.5);
      raise(s, 'management', 0.8);
      return `Entregas da pasta: aprovação +${g.toFixed(1)}, reconhecimento +1,5.`;
    },
  },
  {
    id: 'disputar_orcamento', label: 'Disputar orçamento com outras pastas', category: 'Secretaria', cost: 1,
    description: 'Mais recursos para sua pasta, ao custo de atrito com o núcleo do governo.',
    availability: (s) => (inMandate(s, 'secretario') ? null : 'hidden'),
    apply: (s, rng) => {
      const m = s.player.mandate!;
      if (next(rng) < 0.3 + s.character.attributes.negotiation / 180) {
        m.budgetShare = clamp(m.budgetShare + 12);
        m.relationExecutive = clamp(m.relationExecutive - 4);
        return 'Você conseguiu suplementação orçamentária para a pasta.';
      }
      m.relationExecutive = clamp(m.relationExecutive - 8);
      return 'O pedido foi negado e gerou desgaste com a Fazenda.';
    },
  },
  {
    id: 'atender_vereadores', label: 'Atender vereadores e lideranças', category: 'Secretaria', cost: 1,
    description: 'Secretário também é articulador político do governo.',
    availability: (s) => (inMandate(s, 'secretario') ? null : 'hidden'),
    apply: (s) => {
      s.player.mandate!.relationExecutive = clamp(s.player.mandate!.relationExecutive + 5);
      raise(s, 'articulation', 1.5);
      return 'Relação com o prefeito +5; articulação +1,5.';
    },
  },
];

export const PORTFOLIO_OPTIONS = PORTFOLIOS;

export function availableActions(s: GameState) {
  return ACTIONS.map((a) => ({ def: a, status: a.availability(s) })).filter((x) => x.status !== 'hidden');
}

export function performAction(state: GameState, actionId: string, param?: string): GameState {
  const s: GameState = structuredClone(state);
  const def = ACTIONS.find((a) => a.id === actionId);
  if (!def || s.gameOver) return state;
  const status = def.availability(s);
  if (status !== null) return state;
  if (s.actionPoints < def.cost) return state;
  const fat = def.fatigue === false ? { mult: 1, reason: null } : fatigueMultiplier(s, def.id);
  const before = snapshot(s);
  let msg = def.apply(s, s.rng, param);
  const blockedBySpend = msg.startsWith('Saldo de campanha insuficiente');
  if (!blockedBySpend) {
    s.actionPoints -= def.cost;
    if (def.fatigue !== false) {
      dampenGains(s, state, fat.mult);
      registerUse(s, def.id);
      if (fat.mult < 1) msg += ` Ganhos reduzidos a ${Math.round(fat.mult * 100)}% (${fat.reason}).`;
    }
  }
  recomputeNetWorth(s);
  recordDiff(s, before, def.label + (fat.mult < 1 ? ` (rendimento ${Math.round(fat.mult * 100)}%)` : ''));
  s.log.push({ month: { ...s.month }, kind: 'acao', text: `${def.label}: ${msg}` });
  return s;
}
