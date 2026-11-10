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
import { STATE_AREAS } from './upper';
import { becomeMinister, ministryById, type MinistryId } from './federal';
import { addGoodwill } from './campaign';
import { REGIONS } from '../data/regions';
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

const inCampaign = (s: GameState) => { const y = s.player.candidacy?.year ?? 2028; return s.player.candidacy?.status === 'registrada' && monthIndex(s.month) >= y * 12 + 7 && monthIndex(s.month) <= y * 12 + 8; };

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
    id: 'fornecedor_vantagem',
    title: () => 'Proposta de um fornecedor',
    body: () => 'Um empresário (personagem do jogo) que presta serviços à prefeitura procura você, no gabinete, oferecendo "uma ajuda" se você conseguir que o gabinete indique a obra dele numa emenda.',
    weight: 0.06,
    condition: (s) => !!s.player.staff && !s.player.mandate,
    options: () => [
      { label: 'Recusar e encerrar a conversa', apply: (st) => { st.player.staff!.trust = Math.min(100, st.player.staff!.trust + 2); return 'Você recusou. Nada mais aconteceu.'; } },
      {
        label: 'Aceitar a vantagem', hint: 'Corrupção é crime; o jogo registra o risco',
        apply: (st, rng) => {
          st.finances.cash += 30000;
          st.flags.vantagemIndevida = Number(st.flags.vantagemIndevida ?? 0) + 1;
          if (next(rng) < 0.35) {
            st.character.attributes.popularity = clamp(st.character.attributes.popularity - 10);
            st.player.recognition = grow(st.player.recognition, 4);
            if (st.player.staff) st.player.staff.trust = 0;
            return 'A conversa foi gravada e vazou. O gabinete afastou você imediatamente e o caso foi ao Ministério Público. Popularidade −10.';
          }
          return 'Você recebeu R$ 30 mil por fora. Ninguém soube — por enquanto.';
        },
      },
      { label: 'Denunciar à Corregedoria da Câmara', apply: (st) => { st.player.recognition = grow(st.player.recognition, 4); if (st.player.staff) st.player.staff.contacts = Math.max(0, st.player.staff.contacts - 6); return 'Você denunciou. Ganhou respeito público, mas parte dos bastidores passou a desconfiar de você.'; } },
    ],
  },
  {
    id: 'vazamento_imprensa',
    title: () => 'Jornalista pede informação de bastidor',
    body: () => 'Uma repórter do Diário Paulistano (veículo fictício) pede detalhes de uma negociação reservada da pauta da Câmara. Em troca, promete "lembrar de você".',
    weight: 0.06,
    condition: (s) => !!s.player.staff && !s.player.mandate && s.player.staff.contacts >= 20,
    options: () => [
      { label: 'Recusar', apply: () => 'Você manteve a discrição.' },
      { label: 'Passar informação em off', apply: (st, rng) => { st.player.recognition = grow(st.player.recognition, 2); if (next(rng) < 0.4 && st.player.staff) { st.player.staff.trust = clamp(st.player.staff.trust - 15); return 'O gabinete descobriu de onde veio o vazamento. Confiança −15.'; } return 'A reportagem saiu e a repórter passou a te procurar. Ninguém descobriu a fonte.'; } },
    ],
  },
  {
    id: 'campanha_expediente',
    title: () => 'Campanha no horário de trabalho',
    body: () => 'A coordenação de campanha do partido pede que você use o horário de expediente no gabinete para panfletar e organizar eventos. Servidor não pode fazer campanha durante o expediente (Lei 9.504/97, art. 73, III).',
    weight: 0.25,
    condition: (s) => !!s.player.staff && !!s.player.candidacy && s.month.year === (s.player.candidacy.year ?? 2028) && s.month.month >= 8 && s.month.month <= 9 && !s.flags[`expediente_${s.month.year}`],
    options: () => [
      { label: 'Tirar licença para fazer campanha', apply: (st) => { st.flags[`expediente_${st.month.year}`] = true; st.finances.cash -= Math.round(st.finances.monthlyIncome * 0.5); return 'Você tirou licença não remunerada parcial e fez campanha fora do expediente.'; } },
      { label: 'Fazer campanha no expediente', hint: 'Conduta vedada', apply: (st) => { st.flags[`expediente_${st.month.year}`] = true; if (st.player.candidacy) { st.player.candidacy.campaignPoints += 6; st.player.candidacy.irregularities += 1; } return 'Você ganhou tempo de campanha, mas cometeu conduta vedada. Se denunciada, pesa na prestação de contas e em ações eleitorais.'; } },
    ],
  },
  {
    id: 'convite_secretaria',
    title: () => 'Convite para a prefeitura',
    body: (s) => `O(a) prefeito(a) eleito(a), ${String(s.flags.prefeitoEleitoNome ?? s.government.mayor.name)}, convida você para chefiar uma secretaria municipal a partir de janeiro. É cargo de livre nomeação e exoneração, não eletivo. Por que você: ${String(s.flags.conviteMotivo ?? '')}`,
    weight: 0,
    condition: () => false,
    options: (s) => [
      ...offeredPortfolios(s, 3).map((p) => ({
        label: `Aceitar: Secretaria de ${p.name}`,
        hint: `Orçamento (ordem de grandeza simulada): R$ ${p.budget.toLocaleString('pt-BR')} mi/ano. Indicadores: ${p.indicators.map((i) => i.label.toLowerCase()).join('; ')}.`,
        apply: (st: GameState) => {
          st.flags.secretariaAceita = p.id;
          return `Você aceitou a Secretaria de ${p.name}. Toma posse em janeiro de ${st.month.year + 1}.`;
        },
      })),
      { label: 'Recusar', apply: () => 'Você recusou o convite.' },
    ],
  },
  {
    id: 'convite_secretaria_estadual',
    title: () => 'Convite para o governo do Estado',
    body: (s) => `O(a) governador(a) eleito(a), ${String(s.flags.conviteEstadualGov ?? '')} (personagem do jogo), convida você para uma secretaria estadual a partir de 6 de janeiro. Cargo de livre nomeação: o mandato no secretariado é abstrato nesta versão (programas por área e relação com o governador).`,
    weight: 0,
    condition: () => false,
    options: () => [
      ...STATE_AREAS.slice(0, 4).map((a) => ({
        label: `Aceitar: ${a.label}`,
        hint: s0(a.id),
        apply: (st: GameState) => {
          if (st.player.mandate && ['vereador', 'deputado_estadual', 'deputado_federal', 'senador'].includes(st.player.mandate.office)) {
            st.flags.secEstadualAceita = a.id;
            return `Você aceitou. Para assumir, deixará o mandato atual (o suplente assume a vaga). Posse em 6 de janeiro.`;
          }
          st.flags.secEstadualAceita = a.id;
          return `Você aceitou a secretaria estadual (${a.label}). Posse em 6 de janeiro.`;
        },
      })),
      { label: 'Recusar', apply: () => 'Você recusou o convite.' },
    ],
  },
  {
    id: 'convite_ministerio',
    title: () => 'Convite para o ministério',
    body: (s) => `O(a) presidente ${String(s.flags.conviteMinisterioPres ?? '')} (personagem do jogo) convida você para um ministério. Ministros são de livre nomeação e exoneração (CF art. 87).${['deputado_federal', 'senador'].includes(s.player.mandate?.office ?? '') ? ' Como parlamentar, você se licencia sem perder o mandato e o suplente assume (CF art. 56, I).' : ''}`,
    weight: 0,
    condition: () => false,
    options: (s) => [
      ...String(s.flags.conviteMinisterio ?? '').split(',').filter(Boolean).map((id) => ({
        label: `Aceitar: ${ministryById(id)?.name ?? id}`,
        hint: 'Agenda própria da pasta, orçamento e relação com o(a) presidente',
        apply: (st: GameState) => { delete st.flags.conviteMinisterio; return becomeMinister(st, id as MinistryId); },
      })),
      { label: 'Recusar', apply: (st: GameState) => { delete st.flags.conviteMinisterio; return 'Você agradeceu e recusou o convite.'; } },
    ],
  },
  {
    id: 'convite_vice',
    title: () => 'Convite para vice na chapa presidencial',
    body: (s) => { const [, name, pid] = String(s.flags.conviteVice ?? '').split('|'); return `${name} (${partyById(pid)?.acronym ?? ''}, personagem do jogo) convida você para ser vice-presidente na chapa. Presidente e vice são eleitos juntos (CF art. 77 §1º); você precisa ter 35 anos e estar filiado(a). Aceitar substitui qualquer pré-candidatura que você tenha.`; },
    weight: 0,
    condition: () => false,
    options: () => [
      {
        label: 'Aceitar a vaga de vice', hint: 'Sua projeção soma à chapa; se ganhar, você é vice a partir de 5/1',
        apply: (st: GameState) => {
          const [list, name] = String(st.flags.conviteVice ?? '').split('|');
          delete st.flags.conviteVice;
          st.player.candidacy = { office: 'vice_presidente', year: st.month.year, status: 'pretendida', checks: [], coalitionPartyIds: [], campaignPoints: 0, account: { fefc: 0, donations: 0, ownFunds: 0, spent: 0 }, irregularities: 0, runningMateList: list, runningMateName: name };
          return `Você aceitou ser vice na chapa de ${name}. As convenções homologam a chapa em agosto.`;
        },
      },
      { label: 'Recusar', apply: (st: GameState) => { delete st.flags.conviteVice; return 'Você recusou o convite para vice.'; } },
    ],
  },
  {
    id: 'enchente_regiao',
    title: (_s, v) => `Enchente atinge a região ${String(v.regiao ?? '')}`,
    body: (s, v) => `Chuvas fortes deixaram famílias desalojadas na região ${String(v.regiao ?? '')}. ${s.communityPromises.some((p) => p.region === v.regionId && (p.status === 'aberta' || p.status === 'em_andamento')) ? 'Moradores lembram que você fez uma promessa pública para esta região.' : 'Lideranças locais pedem ajuda e visibilidade.'} Como você reage?`,
    weight: 0.05,
    condition: (s) => s.player.recognition >= 15 && (s.month.month <= 3 || s.month.month === 12),
    options: (s, v) => [
      {
        label: 'Ir ao local e coordenar ajuda', hint: 'Custa tempo e dinheiro pessoal (R$ 5 mil); rende confiança',
        apply: (st, rng) => {
          st.finances.cash -= 5000;
          addGoodwill(st, String(v.regionId), 6 + next(rng) * 4);
          st.player.base = grow(st.player.base, 2);
          if (st.player.mandate) st.player.mandate.approval = clamp(st.player.mandate.approval + 1);
          return 'Você passou o dia no local, ajudou a organizar abrigos e doações. A região reconhece a presença.';
        },
      },
      {
        label: 'Postar nas redes e cobrar o poder público',
        apply: (st, rng) => {
          st.player.recognition = grow(st.player.recognition, 2);
          if (next(rng) < 0.35) { addGoodwill(st, String(v.regionId), -4); return 'O post rendeu alcance, mas moradores reclamaram de quem "só aparece no celular".'; }
          return 'O post circulou e pressionou a prefeitura.';
        },
      },
      ...(s.player.mandate && ['prefeito', 'governador'].includes(s.player.mandate.office) ? [{
        label: 'Decretar emergência e liberar recursos', hint: 'R$ 80 mi do caixa',
        apply: (st: GameState) => {
          if (st.player.mandate!.office === 'prefeito') st.city.cash -= 80;
          addGoodwill(st, String(v.regionId), 10);
          st.player.mandate!.approval = clamp(st.player.mandate!.approval + 2);
          return 'Situação de emergência decretada; equipes e recursos chegaram em 48 horas.';
        },
      }] : []),
      { label: 'Não se envolver', apply: (st) => { addGoodwill(st, String(v.regionId), -3); return 'Você não apareceu. Alguém notou.'; } },
    ],
  },
];

const s0 = (area: string) => `Área estadual: ${area}`;

export function eventById(id: string) {
  return EVENTS.find((e) => e.id === id);
}

export function rollEvent(s: GameState, rng: RngState): PendingEvent | null {
  for (const e of EVENTS) {
    if (e.weight > 0 && e.condition(s) && next(rng) < e.weight) {
      if (e.id === 'enchente_regiao') {
        const r = REGIONS[Math.floor(next(rng) * REGIONS.length)];
        return { templateId: e.id, vars: { regiao: r.name, regionId: r.id } };
      }
      return { templateId: e.id, vars: {} };
    }
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
