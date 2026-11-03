// Eventos dinâmicos (PROPOSTA). Cada evento tem condição baseada no estado da partida,
// escolhas e efeitos. Eventos envolvendo figuras reais só usam fatos de registro público.

import { monthIndex } from '../calendar';
import { next, type RngState } from '../rng';
import { partyById } from '../data/parties';
import { grow } from './actions';
import { collectSignatures, startCpi } from './legislature';
import { offeredPortfolios } from './secretariat';
import { recomputeNetWorth } from './finance';
import { snapshot, recordDiff } from './ledger';
import { changeParty } from './party';
import type { GameState, PendingEvent } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

export interface EventOption {
  label: string;
  hint?: string;
  apply: (s: GameState, rng: RngState, vars: PendingEvent['vars']) => string;
}

export interface EventTemplate {
  id: string;
  title: (s: GameState, vars: PendingEvent['vars']) => string;
  body: (s: GameState, vars: PendingEvent['vars']) => string;
  /** Chance mensal quando a condição é verdadeira (0 = só disparado pelo sistema). */
  weight: number;
  condition: (s: GameState) => boolean;
  options: (s: GameState, vars: PendingEvent['vars']) => EventOption[];
}

const inCampaign = (s: GameState) => s.player.candidacy?.status === 'registrada' && monthIndex(s.month) >= 2028 * 12 + 7 && monthIndex(s.month) <= 2028 * 12 + 8;

export const EVENTS: EventTemplate[] = [
  {
    id: 'radio_comunitaria',
    title: () => 'Convite para entrevista',
    body: () => 'Uma rádio comunitária da zona leste quer entrevistar você sobre os problemas do bairro. É ao vivo.',
    weight: 0.12,
    condition: (s) => s.player.recognition >= 6,
    options: () => [
      {
        label: 'Aceitar', hint: 'Depende de Comunicação',
        apply: (s, rng) => {
          if (next(rng) * 100 < s.character.attributes.communication + 15) {
            s.player.recognition = grow(s.player.recognition, 4);
            return 'A entrevista foi ótima e circulou nos grupos do bairro. Reconhecimento +4.';
          }
          s.character.attributes.popularity = clamp(s.character.attributes.popularity - 1);
          return 'Você se enrolou numa pergunta sobre orçamento. Popularidade −1.';
        },
      },
      { label: 'Recusar', apply: () => 'Você recusou o convite.' },
    ],
  },
  {
    id: 'convite_podcast',
    title: () => 'Convite do videocast “Papo de Plenário” (veículo fictício)',
    body: () => 'Duas horas de conversa ao vivo, sem roteiro, com perguntas sobre orçamento, leis e propostas. Rende muita audiência, mas não perdoa quem não domina o assunto.',
    weight: 0.1,
    condition: (s) => s.player.recognition >= 18 || s.player.social.networks.youtube + s.player.social.networks.instagram > 80_000,
    options: () => [
      {
        label: 'Aceitar', hint: 'Depende de Comunicação e Conhecimento político',
        apply: (s, rng) => {
          const a = s.character.attributes;
          const roll = a.communication * 0.5 + a.politicalKnowledge * 0.6 + (next(rng) - 0.5) * 40;
          if (roll >= 55) {
            s.player.recognition = grow(s.player.recognition, 6);
            s.player.social.networks.youtube += Math.round(5000 + next(rng) * 20000);
            return 'Entrevista elogiada: você mostrou domínio dos temas. Reconhecimento +6 e ganho de inscritos no YouTube.';
          }
          if (roll >= 35) {
            s.player.recognition = grow(s.player.recognition, 3);
            return 'Entrevista morna: carisma ajudou, mas faltou profundidade. Reconhecimento +3.';
          }
          s.player.recognition = grow(s.player.recognition, 3);
          s.character.attributes.popularity = clamp(s.character.attributes.popularity - 3);
          return 'Você errou dados básicos sobre o orçamento da cidade e o trecho viralizou do jeito errado. Popularidade −3.';
        },
      },
      { label: 'Recusar', apply: () => 'Você recusou o convite.' },
    ],
  },
  {
    id: 'lideranca_pede_apoio',
    title: () => 'Liderança comunitária pede ajuda',
    body: () => 'Uma liderança de uma ocupação pede ajuda para organizar um evento de Dia das Crianças. Custaria R$ 3.000 do seu bolso.',
    weight: 0.1,
    condition: (s) => s.player.base >= 10 && s.finances.cash >= 3000 && !inCampaign(s),
    options: () => [
      {
        label: 'Ajudar (R$ 3.000)',
        apply: (s) => {
          s.finances.cash -= 3000;
          s.player.base = grow(s.player.base, 5);
          return 'O evento foi um sucesso e você ganhou aliados. Base +5.';
        },
      },
      { label: 'Recusar educadamente', apply: (s) => { s.player.base = clamp(s.player.base - 1); return 'A liderança ficou chateada. Base −1.'; } },
    ],
  },
  {
    id: 'processo_disciplinar',
    title: (s) => `Processo disciplinar no ${partyById(s.player.partyId!)?.acronym}`,
    body: () => 'A direção abriu processo no conselho de ética do partido por suas críticas e pela falta de alinhamento. As penas possíveis vão de advertência a expulsão, conforme o estatuto (Lei 9.096/95 arts. 23 e 25). Detalhes do rito são simulados.',
    weight: 0,
    condition: () => false,
    options: () => [
      {
        label: 'Defender-se no conselho de ética', hint: 'Depende de Articulação e Conhecimento político',
        apply: (s, rng) => {
          const a = s.character.attributes;
          const pr = s.player.partyRel;
          if (next(rng) * 100 < a.articulation * 0.5 + a.politicalKnowledge * 0.4 + 10) {
            pr.perceivedLoyalty = clamp(pr.perceivedLoyalty + 10);
            pr.leadershipTrust = clamp(pr.leadershipTrust + 5);
            return 'Defesa aceita: processo arquivado. Fidelidade percebida +10.';
          }
          pr.disciplinary = pr.disciplinary === 0 ? 1 : 2;
          return pr.disciplinary === 1 ? 'Você recebeu advertência formal.' : 'Você foi suspenso(a) das atividades partidárias.';
        },
      },
      {
        label: 'Recuar e se retratar',
        apply: (s) => {
          const pr = s.player.partyRel;
          pr.perceivedLoyalty = clamp(pr.perceivedLoyalty + 15);
          pr.leadershipTrust = clamp(pr.leadershipTrust + 8);
          pr.internalPopularity = clamp(pr.internalPopularity - 5);
          pr.influence = clamp(pr.influence - 5);
          return 'Retratação aceita. A direção relaxou, mas parte da base te achou fraco(a).';
        },
      },
      {
        label: 'Manter as críticas e enfrentar a direção', hint: 'Risco de expulsão',
        apply: (s, rng) => {
          const pr = s.player.partyRel;
          pr.internalPopularity = clamp(pr.internalPopularity + 4);
          if (pr.disciplinary >= 1 && next(rng) < 0.5) {
            const acr = partyById(s.player.partyId!)?.acronym;
            s.flags.expulsao = s.player.partyId!;
            return `Você foi EXPULSO(A) do ${acr}.${s.player.mandate?.office === 'vereador' ? ' O jogo mantém seu mandato (a perda por infidelidade se aplica a quem sai sem justa causa; tratamento da expulsão a confirmar na jurisprudência do TSE).' : ''}`;
          }
          pr.disciplinary = 2;
          return 'Você foi suspenso(a), mas virou símbolo para os descontentes. Popularidade interna +4.';
        },
      },
    ],
  },
  {
    id: 'viral',
    title: () => 'Um vídeo seu viralizou',
    body: () => 'Um vídeo em que você confronta um problema do bairro foi compartilhado milhares de vezes.',
    weight: 0.05,
    condition: (s) => s.player.recognition < 60,
    options: () => [
      { label: 'Aproveitar a onda', apply: (s) => { s.player.recognition = grow(s.player.recognition, 7); return 'Reconhecimento +7.'; } },
    ],
  },
  {
    id: 'doacao_suspeita',
    title: () => 'Oferta de dinheiro “por fora”',
    body: (s) => `Um empresário oferece ${s.player.candidacy?.office === 'prefeito' ? 'R$ 500 mil' : 'R$ 40 mil'} em espécie, sem registro na prestação de contas. Doação de pessoa jurídica e caixa dois são ilegais.`,
    weight: 0.25,
    condition: (s) => inCampaign(s),
    options: () => [
      { label: 'Recusar', apply: (s) => { s.character.attributes.popularity = clamp(s.character.attributes.popularity + 0.5); return 'Você recusou. A campanha segue limpa.'; } },
      {
        label: 'Aceitar', hint: 'Ilegal. Pode ter consequências',
        apply: (s) => {
          const c = s.player.candidacy!;
          c.account.donations += c.office === 'prefeito' ? 500000 : 40000;
          c.irregularities += 1;
          return 'Você aceitou o dinheiro. Ele entra na campanha, mas fica registrado como irregularidade.';
        },
      },
    ],
  },
  {
    id: 'irregularidade_contrato',
    title: () => 'Indícios num contrato da prefeitura',
    body: () => 'Sua fiscalização achou sobrepreço num contrato de manutenção. Você pode denunciar publicamente, colher assinaturas para uma CPI ou negociar com o governo.',
    weight: 0,
    condition: () => false,
    options: (s) => [
      {
        label: 'Denunciar publicamente',
        apply: (st) => {
          st.player.recognition = grow(st.player.recognition, 6);
          if (st.player.mandate) st.player.mandate.relationExecutive = clamp(st.player.mandate.relationExecutive - 15);
          return 'A denúncia virou notícia. Reconhecimento +6; relação com a prefeitura −15.';
        },
      },
      {
        label: 'Abrir pedido de CPI e colher assinaturas', hint: 'Precisa de 1/3 dos vereadores (19 de 55)',
        apply: (st, rng) => {
          if (st.player.mandate?.office !== 'vereador') return 'Só vereadores podem requerer CPI.';
          const cpi = startCpi(st, 'contrato de manutenção com indícios de sobrepreço');
          const msg = collectSignatures(st, rng, cpi.id);
          return `Pedido de CPI protocolado. ${msg} Continue com a ação "Colher assinaturas para CPI".`;
        },
      },
      ...(s.player.mandate?.stance === 'base'
        ? [{
            label: 'Levar o caso discretamente ao governo',
            apply: (st: GameState) => {
              if (st.player.mandate) st.player.mandate.relationExecutive = clamp(st.player.mandate.relationExecutive + 12);
              return 'O governo agradeceu e prometeu corrigir o contrato. Relação com a prefeitura +12.';
            },
          }]
        : []),
    ],
  },
  {
    id: 'temporal',
    title: () => 'Temporal alaga bairros',
    body: () => 'Chuvas fortes alagaram vários bairros. A cobrança sobre a prefeitura é imediata.',
    weight: 0.08,
    condition: (s) => s.player.mandate?.office === 'prefeito' && [1, 2, 3, 12].includes(s.month.month),
    options: () => [
      { label: 'Ir pessoalmente aos bairros e liberar verba emergencial', apply: (s) => { s.player.mandate!.approval = clamp(s.player.mandate!.approval + 2); return 'A resposta rápida foi bem avaliada. Aprovação +2.'; } },
      { label: 'Deixar com a Defesa Civil e as subprefeituras', apply: (s) => { s.player.mandate!.approval = clamp(s.player.mandate!.approval - 4); return 'A ausência do prefeito foi criticada. Aprovação −4.'; } },
    ],
  },
  {
    id: 'convite_secretaria',
    title: () => 'Convite para a prefeitura',
    body: (s) => `O(a) prefeito(a) eleito(a), ${s.government.mayor.name}, convida você para chefiar uma secretaria municipal a partir de janeiro. É cargo de livre nomeação e exoneração, não eletivo. Por que você: ${String(s.flags.conviteMotivo ?? '')}`,
    weight: 0,
    condition: () => false,
    options: (s) => [
      ...offeredPortfolios(s, 3).map((p) => ({
        label: `Aceitar: Secretaria de ${p.name}`,
        hint: `Orçamento (ordem de grandeza simulada): R$ ${p.budget.toLocaleString('pt-BR')} mi/ano. Indicadores: ${p.indicators.map((i) => i.label.toLowerCase()).join('; ')}.`,
        apply: (st: GameState) => {
          st.flags.secretariaAceita = p.id;
          return `Você aceitou a Secretaria de ${p.name}. Toma posse em janeiro de 2029.`;
        },
      })),
      { label: 'Recusar', apply: () => 'Você recusou o convite.' },
    ],
  },
];

export function eventById(id: string) {
  return EVENTS.find((e) => e.id === id);
}

export function rollEvent(s: GameState, rng: RngState): PendingEvent | null {
  for (const e of EVENTS) {
    if (e.weight > 0 && e.condition(s) && next(rng) < e.weight) return { templateId: e.id, vars: {} };
  }
  return null;
}

export function resolveEvent(state: GameState, optionIndex: number): GameState {
  const s: GameState = structuredClone(state);
  const pending = s.pendingEvents[0];
  if (!pending) return state;
  const tpl = eventById(pending.templateId);
  if (!tpl) { s.pendingEvents.shift(); return s; }
  const opts = tpl.options(s, pending.vars);
  const opt = opts[optionIndex];
  if (!opt) return state;
  const title = tpl.title(s, pending.vars);
  const before = snapshot(s);
  const msg = opt.apply(s, s.rng, pending.vars);
  s.pendingEvents.shift();
  recomputeNetWorth(s);
  recordDiff(s, before, `Evento: ${title} (${opt.label})`);
  s.log.push({ month: { ...s.month }, kind: 'evento', text: `${title} — ${opt.label}: ${msg}` });
  if (s.flags.expulsao) {
    delete s.flags.expulsao;
    return changeParty(s, null, { expelled: true });
  }
  return s;
}
