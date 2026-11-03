// Catálogo de ações mensais. Cada ação custa pontos de agenda (PROPOSTA: 3 por mês).
// availability() explica por que uma ação está bloqueada; apply() altera o estado.

import { GAMEPLAY } from '../data/rulepack';
import { PARTIES, listIdForParty, partyById } from '../data/parties';
import { monthIndex } from '../calendar';
import { next, normal, pick, type RngState } from '../rng';
import { partyStrength } from './elections';
import { ABSOLUTE_MAJORITY, BLOC_LABEL, CPI_SIGNATURES, STAGE_LABEL, articulateVotes, blocCounts, collectSignatures, computeBlocs, fileBill, fileExecutiveBill, isActive, mayorDecide, mesaWindow, negotiateMesaVote, playerCommittee, publicHearing, requestRapporteur, schedule, startCpi } from './legislature';
import { METAS_PACKAGES, appointSecretary, draftChecks, personnelRatio, presentMetas, raiseSalaries, requestCredit, sendLdo, sendPloa, sendTaxBill, setContingency } from './municipality';
import { AREA_KEYS } from '../data/spfinance';
import { applyEffects, PORTFOLIOS, freeBudget, disputeBudget, manageCrisis, meetCouncillors, portfolioById, pressConference, specialAction, startProgram, superviseProgram, trainTeam } from './secretariat';
import { PLAYER, adjustRel, standing } from './relations';
import { contestBlock } from './partyorg';
import { fatigueMultiplier, registerUse, dampenGains } from './fatigue';
import { snapshot, recordDiff } from './ledger';
import { REGIONS, SEGMENTS } from '../data/regions';
import { TEAM_ROLES, spendingLimit, addCategory, attackOpponent, ensurePlan, hireRole, internalPoll, mediaPush, recruitLeader, requestPartyFund, visitRegion, type TeamRole } from './campaign';
import { askPromotion, demandChance, fulfillDemand, hireAsStaff, leaveStaff, staffBossOptions, staffInitiative, switchOffice } from './assessor';
import { PROFESSIONS } from './create';
import { recomputeNetWorth } from './finance';
import { NETWORKS, produceContent } from './social';
import { ideologicalDistance, partyIdeology } from '../data/ideology';
import { isMunYear, nextElection } from './cycle';
import { cityAlignment } from './general';
import { STATE_AREAS, UPPER_THEMES, articulateGov, isLegislatorUpper, oversight, seekCommittee, startStateProgram, transferToCity, upperAmendment, upperBill, visitBase } from './upper';
import { RESPONSE_LABEL, lapseCampaignPromises, makePromise, promiseCapacity, respondCrisis, workOnPromise } from './livingworld';
import { computeEnding } from './endings';
import { resignForCandidacy } from './careers';
import type { AttributeKey, Bill, CrisisResponse, GameState } from './types';

export type ActionCategory = 'Vida e carreira' | 'Assessoria' | 'Partido' | 'Pré-candidatura' | 'Campanha' | 'Mandato de vereador' | 'Prefeitura' | 'Secretaria' | 'Mandato estadual/federal' | 'Governo do Estado' | 'Imagem e compromissos';

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


const isFiliado = (s: GameState) => s.player.partyId !== null;
const inMandate = (s: GameState, office: string) => s.player.mandate?.office === office;
const campaignOn = (s: GameState) => {
  const c = s.player.candidacy;
  if (!c || c.status !== 'registrada') return false;
  const t = now(s);
  const y = c.year ?? 2028;
  if (t === mi(y, 8) || t === mi(y, 9)) return true;
  const runoffPlayer = (isMunYear(y) ? s.elections.find((e) => e.year === y) : s.generalElections.find((e) => e.year === y))?.runoffPending;
  return t === mi(y, 10) && !!runoffPlayer;
};
const campaignBalance = (s: GameState) => {
  const a = s.player.candidacy?.account;
  return a ? a.fefc + a.donations + a.ownFunds + (a.fundoPartidario ?? 0) - a.spent : 0;
};
const isMayorRace = (s: GameState) => ['prefeito', 'governador', 'senador'].includes(s.player.candidacy?.office ?? '');

function spendCampaign(s: GameState, vereadorCost: number, mayorCost: number, category = 'outros'): number | string {
  // Deputado: campanha estadual custa mais que a de vereador (PROPOSTA: 1,6×).
  const office = s.player.candidacy?.office;
  const cost = isMayorRace(s) ? mayorCost : Math.round(vereadorCost * (office === 'deputado_estadual' || office === 'deputado_federal' ? 1.6 : 1));
  if (campaignBalance(s) < cost) return `Saldo de campanha insuficiente (precisa de ${brl(cost)}).`;
  s.player.candidacy!.account.spent += cost;
  addCategory(s.player.candidacy!.account, category, cost);
  ensurePlan(s);
  return cost;
}
function setPlanOption(s: GameState, param: string): string {
  const plan = ensurePlan(s)!;
  const [k, v] = param.split('|');
  const toggle = (arr: string[], val: string, max: number) => { const i = arr.indexOf(val); if (i >= 0) { arr.splice(i, 1); return 'removido'; } if (arr.length >= max) arr.shift(); arr.push(val); return 'incluído'; };
  if (k === 'foco') return `Região ${REGIONS.find((r) => r.id === v)?.name}: ${toggle(plan.focus, v, 3)} nas prioridades.`;
  if (k === 'tema') return `Tema ${THEMES.find((t) => t.value === v)?.label}: ${toggle(plan.themes, v, 3)}.`;
  if (k === 'seg') return `Segmento ${SEGMENTS.find((g) => g.id === v)?.name}: ${toggle(plan.segments, v, 2)}.`;
  if (k === 'tom') { plan.tone = v as typeof plan.tone; return `Tom da campanha: ${v}.`; }
  return 'Opção inválida.';
}
const regionOptions = () => REGIONS.map((r) => ({ value: r.id, label: r.name }));
const preOrCampaign = (s: GameState) => {
  const c = s.player.candidacy;
  if (!c || ['rejeitada_convencao', 'indeferida'].includes(c.status)) return false;
  return now(s) <= mi(c.year ?? 2028, 9) || campaignOn(s);
};

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
    description: 'Trabalhar no gabinete de um(a) vereador(a) do seu partido ou federação. Cargo em comissão, de livre nomeação e exoneração.',
    availability: (s) => {
      if (s.player.staff || s.player.mandate) return 'hidden';
      if (!isFiliado(s)) return 'Exige filiação partidária (indicação política).';
      if (!staffBossOptions(s).length) return 'Seu partido não tem vereadores na Câmara.';
      if (s.player.partyRel.leadershipTrust < 30) return 'Confiança da direção precisa ser ≥ 30.';
      return null;
    },
    paramLabel: 'Gabinete',
    params: (s) => staffBossOptions(s),
    apply: (s, rng, param) => {
      if (next(rng) < 0.25 + s.player.partyRel.leadershipTrust / 150 + s.character.attributes.articulation / 400) {
        const job = hireAsStaff(s, param ?? staffBossOptions(s)[0].value)!;
        s.player.careerHistory.push({ office: `Assessor(a) parlamentar — gabinete de ${job.bossName}`, from: `${s.month.year}-${String(s.month.month).padStart(2, '0')}`, to: null, note: 'Cargo em comissão' });
        return `Você foi nomeado(a) assessor(a) no gabinete de ${job.bossName}. Veja as demandas na página Gabinete parlamentar.`;
      }
      return 'Não havia vaga no gabinete este mês. Tente de novo.';
    },
  },
  {
    id: 'cumprir_demanda', label: 'Cumprir demanda do gabinete', category: 'Assessoria', cost: 1,
    description: 'Tarefas pedidas pelo gabinete: pareceres, minutas de projeto, agenda nos bairros, articulação, imprensa. Entregar aumenta a confiança; deixar vencer derruba.',
    availability: (s) => (s.player.staff && !s.player.mandate ? (s.player.staff.demands.length ? null : 'Nenhuma demanda aberta neste mês.') : 'hidden'),
    paramLabel: 'Demanda',
    params: (s) => (s.player.staff?.demands ?? []).map((d) => ({ value: d.id, label: `${d.label} — chance ${Math.round(demandChance(s, d) * 100)}%${d.monthsLeft > 1 ? ` (prazo ${d.monthsLeft} meses)` : ''}` })),
    apply: (s, rng, param) => fulfillDemand(s, rng, param!),
  },
  {
    id: 'iniciativa_gabinete', label: 'Iniciativa própria no gabinete', category: 'Assessoria', cost: 1,
    description: 'Estudar a pauta, construir rede de bastidores, trabalhar a própria base (o gabinete pode não gostar) ou, como chefe de gabinete, representar o mandato.',
    availability: (s) => (s.player.staff && !s.player.mandate ? null : 'hidden'),
    paramLabel: 'Iniciativa',
    params: (s) => [
      { value: 'estudar_pauta', label: 'Estudar a pauta da Câmara' },
      { value: 'bastidores', label: 'Rede de bastidores com outros gabinetes' },
      { value: 'base_propria', label: 'Trabalhar a própria base' },
      ...(s.player.staff?.rank === 'chefe_gabinete' ? [{ value: 'representar', label: 'Representar o mandato em reuniões' }] : []),
    ],
    apply: (s, rng, param) => staffInitiative(s, rng, param ?? 'estudar_pauta'),
  },
  {
    id: 'pedir_promocao', fatigue: false, label: 'Pedir promoção', category: 'Assessoria', cost: 1,
    description: 'Assessor(a) → assessor(a) especial (confiança ≥ 65 e 6 entregas) → chefe de gabinete (confiança ≥ 80 e 14 entregas).',
    availability: (s) => {
      const j = s.player.staff;
      if (!j || s.player.mandate || j.rank === 'chefe_gabinete') return 'hidden';
      const need = j.rank === 'assessor' ? { trust: 65, done: 6 } : { trust: 80, done: 14 };
      return j.trust >= need.trust && j.completed >= need.done ? null : `Pede confiança ≥ ${need.trust} e ${need.done} entregas (hoje: ${Math.round(j.trust)} e ${j.completed}).`;
    },
    apply: (s, rng) => askPromotion(s, rng),
  },
  {
    id: 'trocar_gabinete', fatigue: false, label: 'Trocar de gabinete', category: 'Assessoria', cost: 1,
    description: 'Ir para o gabinete de outro(a) vereador(a) do partido ou da federação. Você leva a rede de contatos, mas recomeça como assessor(a).',
    availability: (s) => (s.player.staff && !s.player.mandate ? (staffBossOptions(s).filter((o) => o.value !== s.player.staff!.bossId).length ? null : 'Não há outro gabinete do seu campo.') : 'hidden'),
    paramLabel: 'Gabinete',
    params: (s) => staffBossOptions(s).filter((o) => o.value !== s.player.staff?.bossId),
    apply: (s, rng, param) => switchOffice(s, rng, param!),
  },
  {
    id: 'deixar_gabinete', fatigue: false, label: 'Deixar o gabinete', category: 'Assessoria', cost: 0,
    description: 'Pedir exoneração e voltar à profissão.',
    availability: (s) => (s.player.staff && !s.player.mandate ? null : 'hidden'),
    apply: (s) => {
      leaveStaff(s, 'Você pediu exoneração do gabinete.');
      s.finances.monthlyIncome = PROFESSIONS[s.character.profession].income;
      return 'Você voltou à profissão.';
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
    id: 'pleitear', fatigue: false, label: 'Pleitear candidatura na próxima eleição', category: 'Pré-candidatura', cost: 1,
    description: 'Avisa a direção que você quer disputar. Eleições municipais (vereador, prefeito) em 2028, 2032…; gerais (deputado estadual e federal, senador, governador) em 2030, 2034… A decisão sai na convenção (20/07 a 05/08).',
    availability: (s) => {
      if (s.player.candidacy) return 'hidden';
      if (!isFiliado(s)) return 'Exige filiação partidária.';
      const ne = nextElection(now(s));
      if (now(s) < mi(ne.year - 1, 7)) return `Próxima eleição: ${ne.year} (${ne.kind}). Disponível a partir de julho de ${ne.year - 1}.`;
      return null;
    },
    paramLabel: 'Cargo',
    params: (s) => {
      const ne = nextElection(now(s));
      if (ne.kind === 'municipal') return [{ value: 'vereador', label: `Vereador(a) — ${ne.year}` }, { value: 'prefeito', label: `Prefeito(a) — ${ne.year}` }];
      const opts = [{ value: 'deputado_estadual', label: `Deputado(a) estadual — ${ne.year}` }, { value: 'deputado_federal', label: `Deputado(a) federal — ${ne.year}` }, { value: 'senador', label: `Senador(a) — ${ne.year}` }, { value: 'governador', label: `Governador(a) — ${ne.year}` }];
      void s;
      return opts;
    },
    apply: (s, _rng, param) => {
      const ne = nextElection(now(s));
      const allowed = ne.kind === 'municipal' ? ['vereador', 'prefeito'] : ['deputado_estadual', 'deputado_federal', 'senador', 'governador'];
      const office = (allowed.includes(param ?? '') ? param : allowed[0]) as 'vereador';
      s.player.candidacy = {
        office, year: ne.year, status: 'pretendida', checks: [], coalitionPartyIds: [], campaignPoints: 0,
        account: { fefc: 0, donations: 0, ownFunds: 0, spent: 0 }, irregularities: 0,
      };
      const label = ({ vereador: 'vereador(a)', prefeito: 'prefeito(a)', deputado_estadual: 'deputado(a) estadual', deputado_federal: 'deputado(a) federal', senador: 'senador(a)', governador: 'governador(a)' } as Record<string, string>)[office];
      const desinc = ne.kind === 'geral' && ['prefeito', 'secretario', 'secretario_estadual', 'governador'].includes(s.player.mandate?.office ?? '')
        ? ` ATENÇÃO: no seu cargo atual é preciso se desincompatibilizar até seis meses antes da eleição (início de abril de ${ne.year}) — use "Renunciar para concorrer" até março.` : '';
      return `Você colocou seu nome como pré-candidato(a) a ${label} em ${ne.year}.${desinc}`;
    },
  },
  {
    id: 'desistir', fatigue: false, label: 'Retirar pré-candidatura', category: 'Pré-candidatura', cost: 0,
    description: 'Desiste antes da convenção.',
    availability: (s) => (s.player.candidacy?.status === 'pretendida' ? null : 'hidden'),
    apply: (s) => {
      lapseCampaignPromises(s, s.player.candidacy!.year ?? 2028);
      s.player.candidacy = null;
      return 'Pré-candidatura retirada. Promessas feitas para esta campanha deixam de valer.';
    },
  },
  {
    id: 'pre_campanha', label: 'Atos de pré-campanha', category: 'Pré-candidatura', cost: 1,
    description: 'Encontros, entrevistas e divulgação de ideias sem pedido explícito de voto (Lei 9.504/97 art. 36-A). Custa R$ 2.000 do caixa pessoal.',
    availability: (s) => {
      if (!s.player.candidacy || s.player.candidacy.status === 'rejeitada_convencao') return 'hidden';
      if (now(s) >= mi(s.player.candidacy.year ?? 2028, 8)) return 'hidden';
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
      if (!c || !['prefeito', 'governador', 'senador'].includes(c.office)) return 'hidden';
      if (c.status === 'rejeitada_convencao' || c.status === 'indeferida') return 'hidden';
      const y = c.year ?? 2028;
      if (now(s) < mi(y, 3) || now(s) > mi(y, 7)) return `Negociações de coligação: março a julho de ${y}.`;
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
    id: 'corpo_a_corpo', label: 'Agenda de rua numa região', category: 'Campanha', cost: 1,
    description: 'Caminhadas, feiras e estações numa região. Aumenta presença e conhecimento do seu nome ali. R$ 5 mil (vereador) / R$ 50 mil (prefeito).',
    availability: (s) => (campaignOn(s) ? null : 'hidden'),
    paramLabel: 'Região', params: regionOptions,
    apply: (s, rng, param) => {
      const r = spendCampaign(s, 5000, 50000, 'eventos');
      if (typeof r === 'string') return r;
      s.player.base = grow(s.player.base, 1);
      return `${visitRegion(s, rng, param ?? s.player.homeRegion)} (gasto ${brl(r)}).`;
    },
  },
  {
    id: 'comunicacao', label: 'Comunicação de campanha', category: 'Campanha', cost: 1,
    description: 'Escolha o canal: redes/impulsionamento (jovens, estudantes), material impresso (informais, baixa renda), rádio e TV (aposentados). O alcance depende dos segmentos-alvo do plano.',
    availability: (s) => (campaignOn(s) ? null : 'hidden'),
    paramLabel: 'Canal',
    params: () => [{ value: 'digital', label: 'Redes e impulsionamento (R$ 15 mil / R$ 300 mil)' }, { value: 'impresso', label: 'Material impresso e carro de som (R$ 12 mil / R$ 200 mil)' }, { value: 'tv', label: 'Produção para o horário eleitoral (R$ 20 mil / R$ 600 mil)' }],
    apply: (s, rng, param) => {
      const ch = (param ?? 'digital') as 'digital' | 'impresso' | 'tv';
      const cost = ch === 'digital' ? [15000, 300000] : ch === 'impresso' ? [12000, 200000] : [20000, 600000];
      const r = spendCampaign(s, cost[0], cost[1], ch === 'digital' ? 'impulsionamento' : ch === 'tv' ? 'producao_audiovisual' : 'material_impresso');
      if (typeof r === 'string') return r;
      s.player.candidacy!.campaignPoints += 2 + s.character.attributes.communication / 30;
      s.player.recognition = grow(s.player.recognition, 2);
      return `${mediaPush(s, rng, ch)} (gasto ${brl(r)}).`;
    },
  },
  {
    id: 'lideranca_local', label: 'Buscar apoio de lideranças locais', category: 'Pré-candidatura', cost: 1,
    description: 'Lideranças comunitárias (personagens do jogo) dão capilaridade numa região. Vale na pré-campanha e na campanha.',
    availability: (s) => (preOrCampaign(s) ? null : 'hidden'),
    paramLabel: 'Região', params: regionOptions,
    apply: (s, rng, param) => { ensurePlan(s); return recruitLeader(s, rng, param ?? s.player.homeRegion); },
  },
  {
    id: 'plano_campanha', fatigue: false, label: 'Ajustar o plano de campanha', category: 'Pré-candidatura', cost: 0,
    description: 'Regiões prioritárias (até 3), temas (até 3), segmentos-alvo (até 2) e tom. Também na página Campanha.',
    availability: (s) => (preOrCampaign(s) ? null : 'hidden'),
    paramLabel: 'Escolha',
    params: (s) => {
      const plan = s.player.candidacy?.plan;
      return [
        ...REGIONS.map((r) => ({ value: `foco|${r.id}`, label: `${plan?.focus.includes(r.id) ? 'Tirar' : 'Priorizar'} região: ${r.name}` })),
        ...THEMES.map((t) => ({ value: `tema|${t.value}`, label: `${plan?.themes.includes(t.value) ? 'Tirar' : 'Incluir'} tema: ${t.label}` })),
        ...SEGMENTS.map((g) => ({ value: `seg|${g.id}`, label: `${plan?.segments.includes(g.id) ? 'Tirar' : 'Mirar'} segmento: ${g.name}` })),
        ...(['propositivo', 'contraste', 'ataque'] as const).map((t) => ({ value: `tom|${t}`, label: `Tom: ${t}` })),
      ];
    },
    apply: (s, _rng, param) => setPlanOption(s, param ?? ''),
  },
  {
    id: 'montar_equipe', fatigue: false, label: 'Contratar equipe de campanha', category: 'Campanha', cost: 1,
    description: 'Coordenação, marketing, jurídico e contabilidade. Pago com recursos da campanha (a partir do registro).',
    availability: (s) => (campaignOn(s) ? ((Object.keys(TEAM_ROLES) as TeamRole[]).every((k) => s.player.candidacy?.plan?.team[k]) ? 'Equipe completa.' : null) : 'hidden'),
    paramLabel: 'Função',
    params: (s) => (Object.keys(TEAM_ROLES) as TeamRole[]).filter((k) => !s.player.candidacy?.plan?.team[k]).map((k) => ({ value: k, label: `${TEAM_ROLES[k].label} — ${brl(isMayorRace(s) ? TEAM_ROLES[k].costP : TEAM_ROLES[k].costV)}` })),
    apply: (s, _rng, param) => {
      const r = hireRole(s, (param ?? 'coordenacao') as TeamRole);
      return typeof r === 'string' ? r : `${TEAM_ROLES[param as TeamRole].label} contratada (${brl(r)}). ${TEAM_ROLES[param as TeamRole].note}`;
    },
  },
  {
    id: 'contraste', label: 'Campanha de contraste com adversários', category: 'Campanha', cost: 1,
    description: 'Pode tirar votos do adversário, mas aumenta a sua rejeição; mal feita, vira "baixaria".',
    availability: (s) => (campaignOn(s) ? null : 'hidden'),
    apply: (s, rng) => attackOpponent(s, rng),
  },
  {
    id: 'pesquisa_interna', label: 'Encomendar pesquisa interna', category: 'Campanha', cost: 1,
    description: 'Intenção por região e rejeição. Pesquisa interna não divulgada não precisa de registro (Lei 9.504/97, art. 33). R$ 20 mil / R$ 250 mil.',
    availability: (s) => (campaignOn(s) ? null : 'hidden'),
    apply: (s, rng) => {
      const r = spendCampaign(s, 20000, 250000, 'pesquisas');
      if (typeof r === 'string') return r;
      return internalPoll(s, rng);
    },
  },
  {
    id: 'fundo_partidario', fatigue: false, label: 'Pedir repasse do Fundo Partidário', category: 'Campanha', cost: 1,
    description: 'Recurso do partido, distribuído por critério interno da direção (além do FEFC).',
    availability: (s) => (campaignOn(s) ? ((s.player.candidacy!.account.fundoPartidario ?? 0) > 0 ? 'Repasse já feito.' : null) : 'hidden'),
    apply: (s, rng) => requestPartyFund(s, rng),
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
      const limit = spendingLimit(s.player.candidacy!.office) * GAMEPLAY.ownFundsCapShareOfLimit.value;
      const acc = s.player.candidacy!.account;
      const v = Math.min(Number(param), s.finances.cash, limit - acc.ownFunds);
      if (v <= 0) return `Você já atingiu o teto de autofinanciamento (${brl(limit)}).`;
      s.finances.cash -= v;
      acc.ownFunds += v;
      return `Você transferiu ${brl(v)} do seu caixa pessoal para a conta de campanha.`;
    },
  },

  // ---------------- Mandato de vereador (Câmara) ----------------
  {
    id: 'projeto_lei', label: 'Apresentar projeto de lei', category: 'Mandato de vereador', cost: 1,
    description: 'Só matérias de interesse local (CF art. 30). Passa pela CCJ, comissão de mérito, Finanças (se criar despesa), plenário e sanção. Criar programa com estrutura/cargos é iniciativa privativa do prefeito: risco de vício de iniciativa, maior com pouco conhecimento político.',
    availability: (s) => (inMandate(s, 'vereador') ? (s.legislature.bills.filter((b) => b.author === PLAYER && isActive(b)).length >= 4 ? 'Você já tem 4 projetos tramitando.' : null) : 'hidden'),
    paramLabel: 'Tema e tipo',
    params: () => [
      ...THEMES.flatMap((t) => [
        { value: `${t.value}|regulacao`, label: `${t.label} — regulação/serviço` },
        { value: `${t.value}|programa`, label: `${t.label} — cria programa (despesa)` },
      ]),
      { value: 'cultura|denominacao', label: 'Denominação de logradouro ou data comemorativa' },
    ],
    apply: (s, rng, param) => {
      const [theme, kind] = (param ?? 'zeladoria|regulacao').split('|') as [string, 'regulacao' | 'programa' | 'denominacao'];
      const b = fileBill(s, rng, theme, kind);
      s.player.recognition = grow(s.player.recognition, kind === 'denominacao' ? 0.3 : 1);
      const warn = b.executiveInitiativeOnly && s.character.attributes.politicalKnowledge >= 45 ? ' Sua assessoria alerta: o texto pode invadir competência privativa do prefeito.' : '';
      return `${b.number} protocolado: ${b.title}. Começa pela Comissão de Constituição e Justiça.${warn}`;
    },
  },
  {
    id: 'pedir_relatoria', label: 'Pedir a relatoria de um projeto', category: 'Mandato de vereador', cost: 1,
    description: 'O presidente da comissão designa o relator. Relatar dá visibilidade e controle do parecer.',
    availability: (s) => {
      if (!inMandate(s, 'vereador')) return 'hidden';
      return billsInMyCommittee(s).length ? null : 'Nenhum projeto aguardando parecer na sua comissão.';
    },
    paramLabel: 'Projeto',
    params: (s) => billsInMyCommittee(s).map((b) => ({ value: b.id, label: `${b.number} — ${b.title}` })),
    apply: (s, rng, param) => requestRapporteur(s, rng, param!),
  },
  {
    id: 'articular_votos', label: 'Articular votos', category: 'Mandato de vereador', cost: 1,
    description: 'Conversa com vereadores indecisos para fechar compromissos de voto. Quem ajuda cobra reciprocidade depois.',
    availability: (s) => {
      if (!inMandate(s, 'vereador') && !inMandate(s, 'prefeito')) return 'hidden';
      return articulable(s).length ? null : 'Nenhum projeto seu (ou do seu governo) em votação próxima.';
    },
    paramLabel: 'Projeto',
    params: (s) => articulable(s).map((b) => ({ value: b.id, label: `${b.number} — ${b.title} (${STAGE_LABEL[b.stage]})` })),
    apply: (s, rng, param) => articulateVotes(s, rng, param!),
  },
  {
    id: 'audiencia_publica', label: 'Convocar audiência pública', category: 'Mandato de vereador', cost: 1,
    description: 'Dá repercussão a um projeto em tramitação: aumenta a pressão pública sobre os vereadores.',
    availability: (s) => (inMandate(s, 'vereador') ? (s.legislature.bills.some(isActive) ? null : 'Nenhum projeto em tramitação.') : 'hidden'),
    paramLabel: 'Projeto',
    params: (s) => s.legislature.bills.filter((b) => isActive(b) && b.stage !== 'sancao').sort((a, b) => Number(b.author === PLAYER) - Number(a.author === PLAYER) || b.salience - a.salience).slice(0, 15).map((b) => ({ value: b.id, label: `${b.number} — ${b.title}` })),
    apply: (s, rng, param) => publicHearing(s, rng, param!),
  },
  {
    id: 'indicacao', label: 'Enviar indicação ao Executivo', category: 'Mandato de vereador', cost: 1,
    description: 'Indicação é a sugestão formal do vereador à prefeitura (ex.: reforma de praça). Não obriga o Executivo; base do governo é mais atendida.',
    availability: (s) => (inMandate(s, 'vereador') ? null : 'hidden'),
    paramLabel: 'Tema', params: () => THEMES,
    apply: (s, rng, param) => {
      const m = s.player.mandate!;
      const p = 0.2 + m.relationExecutive / 160 + (m.stance === 'base' ? 0.2 : 0);
      const theme = THEMES.find((t) => t.value === param)?.label ?? 'zeladoria';
      if (next(rng) < p) {
        s.player.base = grow(s.player.base, 3);
        m.approval = clamp(m.approval + 1);
        return `A prefeitura atendeu sua indicação (${theme.toLowerCase()}). Base +3.`;
      }
      s.player.base = grow(s.player.base, 0.8);
      return `Indicação enviada (${theme.toLowerCase()}); a prefeitura ainda não atendeu.`;
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
        s.flags.cpiTopic = pick(rng, ['contrato de manutenção com indícios de sobrepreço', 'convênios de creches com repasses irregulares', 'contratos emergenciais de zeladoria', 'fila de cirurgias e contratos de OS na saúde']);
        s.pendingEvents.push({ templateId: 'irregularidade_contrato', vars: {} });
        return 'Sua equipe encontrou indícios de irregularidade num contrato da prefeitura.';
      }
      return 'Fiscalização feita. Reconhecimento +2; relação com a prefeitura caiu.';
    },
  },
  {
    id: 'propor_cpi', fatigue: false, label: 'Protocolar pedido de CPI', category: 'Mandato de vereador', cost: 1,
    description: 'Exige fato determinado (descoberto na fiscalização) e 19 assinaturas (1/3 da Câmara).',
    availability: (s) => {
      if (!inMandate(s, 'vereador')) return 'hidden';
      if (s.legislature.cpis.some((c) => c.status === 'coleta' || c.status === 'instalada')) return 'Já há uma CPI sua em andamento.';
      return typeof s.flags.cpiTopic === 'string' ? null : 'Precisa de um fato determinado: fiscalize a prefeitura até achar indícios.';
    },
    apply: (s) => {
      const cpi = startCpi(s, String(s.flags.cpiTopic));
      delete s.flags.cpiTopic;
      return `Pedido de CPI protocolado: ${cpi.topic}. Agora colete assinaturas (1 de ${CPI_SIGNATURES}).`;
    },
  },
  {
    id: 'colher_assinaturas', label: 'Colher assinaturas para CPI', category: 'Mandato de vereador', cost: 1,
    description: 'Oposição assina com facilidade; a base do governo raramente. O pedido caduca em 3 meses (parâmetro).',
    availability: (s) => (inMandate(s, 'vereador') ? (s.legislature.cpis.some((c) => c.status === 'coleta') ? null : 'hidden') : 'hidden'),
    apply: (s, rng) => collectSignatures(s, rng, s.legislature.cpis.find((c) => c.status === 'coleta')!.id),
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
    description: 'Base: acesso, indicações atendidas e emendas executadas. Oposição: visibilidade e assinaturas de CPI. Mudar de lado tem custo nas relações.',
    availability: (s) => (inMandate(s, 'vereador') ? null : 'hidden'),
    paramLabel: 'Posição',
    params: () => (Object.keys(BLOC_LABEL) as (keyof typeof BLOC_LABEL)[]).map((k) => ({ value: k, label: BLOC_LABEL[k] })),
    apply: (s, _rng, param) => {
      const m = s.player.mandate!;
      const prev = m.stance;
      m.stance = (param as typeof m.stance) ?? 'independente';
      const delta = { base: 20, independente: 0, oposicao: -20, oposicao_radical: -35 }[m.stance] - ({ base: 20, independente: 0, oposicao: -20, oposicao_radical: -35 }[prev] ?? 0);
      m.relationExecutive = clamp(m.relationExecutive + delta * 0.8);
      s.legislature.blocs[PLAYER] = m.stance;
      return `Você agora se declara: ${BLOC_LABEL[m.stance].toLowerCase()}.`;
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
    id: 'lancar_mesa', fatigue: false, label: 'Lançar candidatura à presidência da Câmara', category: 'Mandato de vereador', cost: 1,
    description: 'A Mesa da CMSP tem mandato de 1 ano: eleição em 1º/01 no início da legislatura e em dezembro para o ano seguinte. O resultado sai no fechamento do mês; negocie com as bancadas antes.',
    availability: (s) => {
      if (!inMandate(s, 'vereador')) return 'hidden';
      const term = mesaWindow(s);
      if (term === null) return 'Eleição da Mesa: janeiro do 1º ano da legislatura e dezembro dos anos seguintes (exceto o último).';
      if (s.flags[`mesa_${term}`]) return 'A Mesa deste período já foi eleita.';
      return s.legislature.mesaCandidates.includes(PLAYER) ? 'Candidatura já lançada.' : null;
    },
    apply: (s) => {
      s.legislature.mesaCandidates.push(PLAYER);
      s.player.recognition = grow(s.player.recognition, 1);
      return `Candidatura lançada. Precisa de ${ABSOLUTE_MAJORITY} votos no 1º escrutínio. Use "Negociar apoio de bancada à Mesa".`;
    },
  },
  {
    id: 'negociar_mesa', label: 'Negociar apoio de bancada à Mesa', category: 'Mandato de vereador', cost: 1,
    description: 'Oferece um cargo na Mesa em troca dos votos da bancada. Se você perder, a promessa caduca.',
    availability: (s) => (inMandate(s, 'vereador') && s.legislature.mesaCandidates.includes(PLAYER) && mesaWindow(s) !== null ? null : 'hidden'),
    paramLabel: 'Bancada',
    params: (s) => Object.entries(s.government.councilSeatsByParty).filter(([p]) => p !== s.player.partyId && !s.legislature.mesaDeals.includes(p)).sort((a, b) => b[1] - a[1]).map(([p, n]) => ({ value: p, label: `${partyById(p)?.acronym} (${n})${s.government.mayorCoalition.includes(p) ? ' — base do governo' : ''}` })),
    apply: (s, rng, param) => negotiateMesaVote(s, rng, param!),
  },
  {
    id: 'pautar', fatigue: false, label: 'Pautar projeto no plenário', category: 'Mandato de vereador', cost: 1,
    description: 'Prerrogativa da Presidência: definir a Ordem do Dia.',
    availability: (s) => (inMandate(s, 'vereador') && s.legislature.presidentId === PLAYER ? (plenaryQueue(s).length ? null : 'Nenhum projeto pronto para o plenário.') : 'hidden'),
    paramLabel: 'Projeto',
    params: (s) => plenaryQueue(s).map((b) => ({ value: b.id, label: `${b.number} — ${b.title}` })),
    apply: (s, _rng, param) => schedule(s, param!),
  },


  // ---------------- Fase 5: desincompatibilização, promessas, crises, fim de carreira ----------------
  {
    id: 'renunciar_concorrer', fatigue: false, label: 'Renunciar/afastar-se para concorrer', category: 'Pré-candidatura', cost: 0,
    description: 'Desincompatibilização: prefeito(a) e governador(a) renunciam seis meses antes para disputar outro cargo (CF art. 14 §6º); secretário(a) se afasta no mesmo prazo (LC 64/90 art. 1º). Vereador(a) e deputado(a) não precisam sair.',
    availability: (s) => {
      const c = s.player.candidacy;
      const off = s.player.mandate?.office ?? '';
      if (!c || !['prefeito', 'secretario', 'secretario_estadual', 'governador'].includes(off)) return 'hidden';
      if (isMunYear(c.year ?? 2028) && off !== 'secretario_estadual' && !(off === 'governador')) return 'hidden';
      if (off === 'governador' && c.office === 'governador') return 'hidden';
      if (now(s) > mi(c.year ?? 2028, 3)) return 'O prazo de desincompatibilização (seis meses antes da eleição) já passou.';
      return null;
    },
    apply: (s) => resignForCandidacy(s),
  },
  {
    id: 'promessa_comunidade', label: 'Fazer promessa pública a uma comunidade', category: 'Imagem e compromissos', cost: 1,
    description: 'Compromisso público com uma região e um tema. Rende boa vontade imediata; vence no fim do mandato em disputa (ou do atual). Cumprida, fortalece; quebrada, a região cobra na próxima eleição.',
    availability: (s) => {
      const open = s.communityPromises.filter((p) => p.status === 'aberta' || p.status === 'em_andamento').length;
      if (!s.player.candidacy && !s.player.mandate) return 'hidden';
      return open >= 6 ? 'Você já tem seis promessas em aberto.' : null;
    },
    paramLabel: 'Região e tema',
    params: (s) => REGIONS.flatMap((r) => THEMES.slice(0, 4).map((t) => ({ value: `${r.id}|${t.value}`, label: `${r.name} — ${t.label}` }))).filter((o) => !s.communityPromises.some((p) => `${p.region}|${p.theme}` === o.value && (p.status === 'aberta' || p.status === 'em_andamento'))),
    apply: (s, rng, param) => makePromise(s, rng, param!),
  },
  {
    id: 'cumprir_promessa', label: 'Trabalhar para cumprir uma promessa', category: 'Imagem e compromissos', cost: 1,
    description: 'O que dá para fazer depende do cargo: prefeito usa o caixa; secretário, o orçamento livre da pasta; vereador, indicações e emendas; deputado e senador, emendas individuais; governador, convênios.',
    availability: (s) => (s.communityPromises.some((p) => p.status === 'aberta' || p.status === 'em_andamento') ? (s.player.mandate ? null : 'Sem cargo, não há como entregar.') : 'hidden'),
    paramLabel: 'Promessa',
    params: (s) => s.communityPromises.filter((p) => p.status === 'aberta' || p.status === 'em_andamento').map((p) => { const c = promiseCapacity(s, p); return { value: p.id, label: `${p.text} — ${p.progress}%${c.block ? ` (${c.block})` : ` (+~${c.gain}%: ${c.cost})`}` }; }),
    apply: (s, rng, param) => workOnPromise(s, rng, param!),
  },
  {
    id: 'responder_crise', fatigue: false, label: 'Responder a uma crise de imagem', category: 'Imagem e compromissos', cost: 1,
    description: 'Você sabe se a acusação é verdadeira, falsa ou distorcida; o público não. Negar algo verdadeiro pode virar a história principal. Direito de resposta: Lei 13.188/2015.',
    availability: (s) => (s.crises.some((c) => c.status === 'ativa' && c.targetId === PLAYER) ? null : 'hidden'),
    paramLabel: 'Resposta',
    params: (s) => s.crises.filter((c) => c.status === 'ativa' && c.targetId === PLAYER).flatMap((c) => (Object.keys(RESPONSE_LABEL) as CrisisResponse[]).filter((r) => r !== 'ignorar').map((r) => ({ value: `${c.id}|${r}`, label: `"${c.headline.slice(0, 50)}…" — ${RESPONSE_LABEL[r]}` }))),
    apply: (s, rng, param) => respondCrisis(s, rng, param!),
  },
  {
    id: 'encerrar_carreira', fatigue: false, label: 'Encerrar a carreira política', category: 'Vida e carreira', cost: 0,
    description: 'Termina a partida agora e mostra o desfecho da sua trajetória.',
    availability: (s) => (s.player.candidacy?.status === 'registrada' ? 'Não é possível durante uma candidatura registrada.' : null),
    apply: (s) => {
      s.ending = computeEnding(s, 'aposentadoria');
      s.gameOver = true;
      return `Fim de carreira: ${s.ending.title}.`;
    },
  },

  // ---------------- Fase 5: mandatos estaduais e federais ----------------
  {
    id: 'up_projeto', label: 'Apresentar projeto (Alesp/Congresso)', category: 'Mandato estadual/federal', cost: 1,
    description: 'Tramitação abstrata (simplificação): prazo de 6 a 14 meses e chance de aprovação pela relação com o governo, articulação e cargos em comissão.',
    availability: (s) => (isLegislatorUpper(s.player.mandate?.office) ? null : 'hidden'),
    paramLabel: 'Tema', params: () => UPPER_THEMES,
    apply: (s, rng, param) => upperBill(s, rng, param!),
  },
  {
    id: 'up_emenda', label: 'Indicar emenda individual', category: 'Mandato estadual/federal', cost: 1,
    description: 'Emendas individuais ao orçamento são impositivas (CF art. 166 §§9º–11), mas o ritmo de pagamento depende do Executivo. Valores de jogo.',
    availability: (s) => (isLegislatorUpper(s.player.mandate?.office) ? ((s.player.mandate!.upper?.amendmentBudget ?? 0) > 0 ? null : 'Saldo de emendas do ano esgotado.') : 'hidden'),
    paramLabel: 'Região e área',
    params: () => REGIONS.flatMap((r) => ['saúde', 'educação', 'infraestrutura'].map((t) => ({ value: `${r.id}|${t}`, label: `${r.name} — ${t}` }))),
    apply: (s, rng, param) => upperAmendment(s, rng, param!),
  },
  {
    id: 'up_articular', label: 'Articular com o governo', category: 'Mandato estadual/federal', cost: 1,
    description: 'Melhora a relação com o Executivo de referência (governador para a Alesp; presidente para o Congresso).',
    availability: (s) => (isLegislatorUpper(s.player.mandate?.office) || s.player.mandate?.office === 'secretario_estadual' ? null : 'hidden'),
    apply: (s, rng) => articulateGov(s, rng),
  },
  {
    id: 'up_comissao', fatigue: false, label: 'Disputar cargo em comissão', category: 'Mandato estadual/federal', cost: 1,
    description: 'Presidência ou relatoria dá peso aos seus projetos.',
    availability: (s) => (isLegislatorUpper(s.player.mandate?.office) ? (s.player.mandate!.upper?.committeeRole ? 'hidden' : null) : 'hidden'),
    apply: (s, rng) => seekCommittee(s, rng),
  },
  {
    id: 'up_fiscalizar', label: 'Fiscalizar o Executivo', category: 'Mandato estadual/federal', cost: 1,
    description: 'Requerimentos de informação e convocações. Dá visibilidade e desgasta a relação com o governo.',
    availability: (s) => (isLegislatorUpper(s.player.mandate?.office) ? null : 'hidden'),
    apply: (s, rng) => oversight(s, rng),
  },
  {
    id: 'up_base', label: 'Agenda na base eleitoral', category: 'Mandato estadual/federal', cost: 1,
    description: 'Visitas e atendimento na capital. Para quem está em Brasília, compensa a distância da base.',
    availability: (s) => (isLegislatorUpper(s.player.mandate?.office) || s.player.mandate?.office === 'governador' ? null : 'hidden'),
    paramLabel: 'Região', params: () => regionOptions(),
    apply: (s, rng, param) => visitBase(s, rng, param!),
  },
  {
    id: 'gov_programa', label: 'Lançar programa estadual', category: 'Governo do Estado', cost: 1,
    description: 'Programa abstrato por área (simplificação: sem orçamento estadual detalhado). Sem maioria na Alesp, atrasa.',
    availability: (s) => (inMandate(s, 'governador') || inMandate(s, 'secretario_estadual') ? null : 'hidden'),
    paramLabel: 'Área',
    params: (s) => STATE_AREAS.filter((a) => !inMandate(s, 'secretario_estadual') || a.id === s.player.mandate?.portfolio).map((a) => ({ value: a.id, label: a.label })),
    apply: (s, rng, param) => startStateProgram(s, rng, param!),
  },
  {
    id: 'gov_alesp', label: 'Negociar base na Alesp', category: 'Governo do Estado', cost: 1,
    description: 'Maioria simples: 48 dos 94 deputados.',
    availability: (s) => (inMandate(s, 'governador') ? null : 'hidden'),
    apply: (s, rng) => articulateGov(s, rng),
  },
  {
    id: 'gov_convenio', label: 'Convênio com a Prefeitura de São Paulo', category: 'Governo do Estado', cost: 1,
    description: 'Transferência voluntária para obras na capital. Prefeito aliado divide o crédito; de oposição, disputa.',
    availability: (s) => (inMandate(s, 'governador') ? null : 'hidden'),
    apply: (s, rng) => transferToCity(s, rng),
  },

  // ---------------- Prefeitura ----------------
  {
    id: 'programa_metas', fatigue: false, label: 'Apresentar o Programa de Metas', category: 'Prefeitura', cost: 1,
    description: 'Obrigatório até 90 dias após a posse (LOM art. 69-A): prioridades, indicadores e metas. As pastas escolhidas serão cobradas até o fim do mandato.',
    availability: (s) => (inMandate(s, 'prefeito') ? (s.city.metas ? 'Programa de Metas já apresentado.' : null) : 'hidden'),
    paramLabel: 'Prioridades',
    params: () => Object.entries(METAS_PACKAGES).map(([k, v]) => ({ value: k, label: v.label })),
    apply: (s, _rng, param) => presentMetas(s, param ?? 'social'),
  },
  {
    id: 'nomear_secretario', label: 'Nomear secretário(a)', category: 'Prefeitura', cost: 1,
    description: 'Perfil técnico entrega mais; indicação política agrada partidos e amplia a base na Câmara, com menos competência.',
    availability: (s) => (inMandate(s, 'prefeito') ? null : 'hidden'),
    paramLabel: 'Pasta e perfil',
    params: (s) => AREA_KEYS.flatMap((k) => {
      const cur = s.city.secretaries[k];
      const name = portfolioById(k)!.name;
      const opts = [{ value: `${k}|tecnico|`, label: `${name} — perfil técnico${cur?.kind === 'interino' ? ' (hoje: interino)' : ''}` }];
      const parties = Object.entries(s.government.councilSeatsByParty).filter(([p, n]) => n > 0 && p !== s.player.partyId).sort((a, b) => b[1] - a[1]).slice(0, 4);
      for (const [p] of [[s.player.partyId ?? '', 0] as [string, number], ...parties]) if (p) opts.push({ value: `${k}|politico|${p}`, label: `${name} — indicação do ${partyById(p)?.acronym}${s.government.mayorCoalition.includes(p) ? '' : ' (traz o partido para a base)'}` });
      return opts;
    }),
    apply: (s, rng, param) => {
      const [k, kind, party] = (param ?? 'saude|tecnico|').split('|');
      if (kind === 'politico' && party && !s.government.mayorCoalition.includes(party)) {
        const d = ideologicalDistance(s.character.ideology, partyIdeology(party)) ?? 0.3;
        if (next(rng) > 0.45 + s.character.attributes.negotiation / 200 - d * 0.9) return `O ${partyById(party)?.acronym} recusou a pasta: distância política grande demais.`;
      }
      const msg = appointSecretary(s, rng, k, kind as 'tecnico' | 'politico', party || null);
      s.legislature.blocs = computeBlocs(s, rng);
      s.player.mandate!.councilBase = blocCounts(s).base;
      return `${msg} Base na Câmara: ${s.player.mandate!.councilBase}/55.`;
    },
  },
  {
    id: 'enviar_ldo', fatigue: false, label: 'Enviar a LDO à Câmara', category: 'Prefeitura', cost: 1,
    description: 'Diretrizes e metas fiscais do ano seguinte. Prazo: 15 de abril (LOM art. 138).',
    availability: (s) => {
      if (!inMandate(s, 'prefeito')) return 'hidden';
      if (s.city.ldo[String(s.month.year + 1)]) return 'LDO do próximo ano já enviada.';
      return s.month.month <= 4 ? null : 'A LDO é enviada até 15 de abril.';
    },
    paramLabel: 'Meta fiscal',
    params: () => [{ value: 'equilibrio', label: 'Equilíbrio' }, { value: 'expansionista', label: 'Expansão do investimento (déficit financiado por crédito)' }, { value: 'austero', label: 'Superávit e redução da dívida' }],
    apply: (s, rng, param) => sendLdo(s, rng, (param ?? 'equilibrio') as 'equilibrio'),
  },
  {
    id: 'enviar_ploa', fatigue: false, label: 'Enviar o projeto de LOA à Câmara', category: 'Prefeitura', cost: 1,
    description: 'Monte o orçamento na página Prefeitura (de julho a setembro). Prazo: 30 de setembro; a Câmara vota até 31/12. No 1º ano do mandato vai junto o Plano Plurianual.',
    availability: (s) => {
      if (!inMandate(s, 'prefeito')) return 'hidden';
      if (s.legislature.bills.some((b) => b.payload?.tipo === 'loa' && Number(b.payload.year) === s.month.year + 1)) return 'LOA do próximo ano já enviada.';
      if (s.month.month < 7 || s.month.month > 9) return 'O projeto de LOA é preparado de julho a setembro.';
      if (!s.city.draft) return 'Abra o rascunho do orçamento na página Prefeitura.';
      const chk = draftChecks(s, s.city.draft);
      return chk.ok ? null : chk.issues[0];
    },
    apply: (s, rng) => sendPloa(s, rng),
  },
  {
    id: 'reajustar_iptu', label: 'Propor mudança no IPTU', category: 'Prefeitura', cost: 1,
    description: 'Atualização da planta genérica de valores. Precisa passar na Câmara; vale a partir do ano seguinte (anterioridade, CF art. 150). Aumento é impopular.',
    availability: (s) => (inMandate(s, 'prefeito') ? (s.legislature.bills.some((b) => b.kind === 'tributo' && isActive(b)) ? 'Já há um projeto tributário tramitando.' : null) : 'hidden'),
    paramLabel: 'Mudança',
    params: () => [{ value: '0.05', label: '+5% na arrecadação' }, { value: '0.1', label: '+10% na arrecadação' }, { value: '-0.05', label: '−5% (redução)' }],
    apply: (s, rng, param) => sendTaxBill(s, rng, 'iptu', Number(param ?? 0.05)),
  },
  {
    id: 'reajustar_iss', label: 'Propor mudança no ISS', category: 'Prefeitura', cost: 1,
    description: 'Alíquotas entre 2% e 5% (LC 116/2003). Vale no ano seguinte e 90 dias após a publicação. Empresas reagem; aumento pesa na atividade.',
    availability: (s) => (inMandate(s, 'prefeito') ? (s.legislature.bills.some((b) => b.kind === 'tributo' && isActive(b)) ? 'Já há um projeto tributário tramitando.' : null) : 'hidden'),
    paramLabel: 'Mudança',
    params: () => [{ value: '0.04', label: '+4% na arrecadação' }, { value: '-0.04', label: '−4% (redução)' }],
    apply: (s, rng, param) => sendTaxBill(s, rng, 'iss', Number(param ?? 0.04)),
  },
  {
    id: 'contingenciar', fatigue: false, label: 'Decretar contingenciamento', category: 'Prefeitura', cost: 1,
    description: 'Bloqueia parte do custeio e dos investimentos (LRF art. 9º). Melhora o caixa; piora os serviços e a avaliação.',
    availability: (s) => (inMandate(s, 'prefeito') ? null : 'hidden'),
    paramLabel: 'Bloqueio',
    params: (s) => [0, 0.05, 0.1, 0.2].filter((v) => v !== s.city.contingency).map((v) => ({ value: String(v), label: v === 0 ? 'Suspender o contingenciamento' : `${v * 100}% do custeio e investimento` })),
    apply: (s, _rng, param) => setContingency(s, Number(param ?? 0)),
  },
  {
    id: 'operacao_credito', label: 'Contratar operação de crédito', category: 'Prefeitura', cost: 1,
    description: 'Empréstimo para investimento (crédito adicional na área). Limites: 16% da RCL no ano e dívida até 1,2 vez a RCL (Senado). Vira dívida e serviço da dívida.',
    availability: (s) => (inMandate(s, 'prefeito') ? null : 'hidden'),
    paramLabel: 'Valor e destino',
    params: () => (['saude', 'educacao', 'mobilidade', 'habitacao', 'subprefeituras'] as const).flatMap((a) => [1000, 3000].map((v) => ({ value: `${v}|${a}`, label: `R$ ${v.toLocaleString('pt-BR')} mi — ${portfolioById(a)!.name}` }))),
    apply: (s, _rng, param) => { const [v, a] = (param ?? '1000|saude').split('|'); return requestCredit(s, Number(v), a); },
  },
  {
    id: 'reajuste_servidores', label: 'Conceder reajuste aos servidores', category: 'Prefeitura', cost: 1,
    description: 'Melhora as equipes e agrada o funcionalismo; aumenta a despesa com pessoal. Vedado acima do limite prudencial e nos 180 dias finais do mandato (LRF arts. 21 e 22).',
    availability: (s) => (inMandate(s, 'prefeito') ? null : 'hidden'),
    paramLabel: 'Reajuste',
    params: () => [{ value: '0.03', label: '3%' }, { value: '0.06', label: '6%' }],
    apply: (s, _rng, param) => raiseSalaries(s, Number(param ?? 0.03)),
  },
  {
    id: 'projeto_executivo', label: 'Enviar projeto do Executivo à Câmara', category: 'Prefeitura', cost: 1,
    description: 'Tramita como qualquer projeto (comissões, Finanças, plenário). Com urgência ganha prioridade na pauta. O prefeito não aprova lei sozinho.',
    availability: (s) => (inMandate(s, 'prefeito') ? (s.legislature.bills.filter((b) => b.author === 'executivo' && isActive(b)).length >= 3 ? 'Já há 3 projetos do Executivo tramitando.' : null) : 'hidden'),
    paramLabel: 'Tema', params: () => THEMES,
    apply: (s, rng, param) => {
      const b = fileExecutiveBill(s, rng, param ?? 'zeladoria');
      return `${b.number} enviado à Câmara: ${b.title}${b.urgent ? ' (com pedido de urgência)' : ''}. Base atual: ${blocCounts(s).base}/55.`;
    },
  },
  {
    id: 'sancionar_vetar', fatigue: false, label: 'Sancionar ou vetar projeto aprovado', category: 'Prefeitura', cost: 0,
    description: 'Prazo de 15 dias (LOM-SP art. 42). Sem decisão, há sanção tácita. A Câmara pode derrubar o veto com 28 votos.',
    availability: (s) => (inMandate(s, 'prefeito') ? (s.legislature.bills.some((b) => b.stage === 'sancao') ? null : 'hidden') : 'hidden'),
    paramLabel: 'Decisão',
    params: (s) => s.legislature.bills.filter((b) => b.stage === 'sancao').flatMap((b) => [
      { value: `${b.id}|sancionar`, label: `Sancionar ${b.number} — ${b.title}` },
      { value: `${b.id}|vetar`, label: `Vetar ${b.number} — ${b.title}` },
    ]),
    apply: (s, _rng, param) => {
      const [id, d] = param!.split('|');
      return mayorDecide(s, id, d as 'sancionar' | 'vetar');
    },
  },
  {
    id: 'zeladoria', label: 'Mutirão de zeladoria e obras de bairro', category: 'Prefeitura', cost: 1,
    description: 'Tapa-buraco, poda, iluminação. Efeito rápido na aprovação.',
    availability: (s) => (inMandate(s, 'prefeito') ? null : 'hidden'),
    apply: (s, rng) => {
      const g = 0.8 + s.character.attributes.management / 90 + next(rng) * 0.6;
      s.player.mandate!.approval = clamp(s.player.mandate!.approval + g);
      s.city.cash -= 150;
      const sub = s.city.secretariats.subprefeituras;
      if (sub) applyEffects(sub, { buracos: 1.5, pedidos: -1 });
      return `Mutirão de zeladoria (R$ 150 mi do caixa): aprovação +${g.toFixed(1)}.`;
    },
  },
  {
    id: 'negociar_estado_uniao', label: 'Negociar convênios com Estado e União', category: 'Prefeitura', cost: 1,
    description: 'Transferências voluntárias para obras e programas. Depende de articulação e de relação política.',
    availability: (s) => (inMandate(s, 'prefeito') ? (personnelRatio(s) > 0.6 ? 'Bloqueado: pessoal acima do limite impede transferências voluntárias (LRF art. 23 §3º).' : null) : 'hidden'),
    apply: (s, rng) => {
      // Fase 5: alinhamento com governador e presidente pesa nas transferências voluntárias (PROPOSTA).
      const al = cityAlignment(s);
      if (next(rng) < 0.18 + s.character.attributes.articulation / 200 + (al.governor + al.president) * 0.12) {
        const v = Math.round(200 + next(rng) * 600);
        s.city.cash += v;
        s.city.loa.areas.subprefeituras += v;
        s.player.mandate!.approval = clamp(s.player.mandate!.approval + 1.5);
        return `Convênio assinado: R$ ${v} mi em transferência voluntária para obras de bairro. Aprovação +1,5.`;
      }
      return 'As negociações não avançaram este mês.';
    },
  },

  // ---------------- Secretaria ----------------
  {
    id: 'lancar_programa', label: 'Lançar programa da pasta', category: 'Secretaria', cost: 1,
    description: 'Planejamento → licitação (Lei 14.133/2021) → execução → entrega. Custa orçamento livre; atrasos e aditivos dependem da capacidade da equipe.',
    availability: (s) => (inMandate(s, 'secretario') && s.player.mandate!.secretariat ? (programOptions(s).length ? null : 'Todos os programas da pasta já foram lançados.') : 'hidden'),
    paramLabel: 'Programa',
    params: (s) => [...programOptions(s)].sort((a, b) => a.cost - b.cost).map((p) => ({ value: p.id, label: `${p.label} — R$ ${p.cost} mi, ~${p.plan + p.lic + p.exec} meses${p.cost > freeBudget(s.player.mandate!.secretariat!) ? ' (sem orçamento livre)' : ''}` })),
    apply: (s, _rng, param) => startProgram(s, param!),
  },
  {
    id: 'acompanhar_programa', label: 'Acompanhar e destravar programa', category: 'Secretaria', cost: 1,
    description: 'Reuniões técnicas, cobrança de empreiteiras e respostas ao Tribunal de Contas. Pode encurtar prazos.',
    availability: (s) => (inMandate(s, 'secretario') && s.player.mandate!.secretariat ? (runningPrograms(s).length ? null : 'Nenhum programa em andamento.') : 'hidden'),
    paramLabel: 'Programa',
    params: (s) => runningPrograms(s).map((p) => ({ value: p.id, label: `${p.label} (${p.phase}, ${p.monthsLeft} mês(es))` })),
    apply: (s, rng, param) => superviseProgram(s, rng, param!),
  },
  ...PORTFOLIOS.map((pf): ActionDef => ({
    id: `pasta_${pf.special.id}`, label: pf.special.label, category: 'Secretaria', cost: 1,
    description: `${pf.special.description} Custa R$ ${pf.special.cost} mi do orçamento livre.${pf.special.risk ? ' ' + pf.special.risk : ''}`,
    availability: (s) => (inMandate(s, 'secretario') && s.player.mandate!.secretariat?.portfolio === pf.id ? null : 'hidden'),
    apply: (s, rng) => specialAction(s, rng),
  })),
  {
    id: 'gerenciar_crise', fatigue: false, label: 'Montar gabinete de crise', category: 'Secretaria', cost: 1,
    description: 'Responde à crise em curso na pasta. Sucesso depende de gestão e da equipe.',
    availability: (s) => (inMandate(s, 'secretario') && s.player.mandate!.secretariat?.crisis ? null : 'hidden'),
    apply: (s, rng) => manageCrisis(s, rng),
  },
  {
    id: 'disputar_orcamento', label: 'Pedir suplementação à Fazenda', category: 'Secretaria', cost: 1,
    description: 'Mais orçamento livre para a pasta, ao custo de atrito com o núcleo do governo. Bons indicadores ajudam.',
    availability: (s) => (inMandate(s, 'secretario') && s.player.mandate!.secretariat ? null : 'hidden'),
    apply: (s, rng) => disputeBudget(s, rng),
  },
  {
    id: 'atender_vereadores', label: 'Receber vereadores e lideranças', category: 'Secretaria', cost: 1,
    description: 'Secretário também é articulador do governo: atender pedidos da Câmara melhora a relação com o Legislativo.',
    availability: (s) => (inMandate(s, 'secretario') && s.player.mandate!.secretariat ? null : 'hidden'),
    apply: (s) => meetCouncillors(s),
  },
  {
    id: 'treinar_equipe', label: 'Reforçar a equipe técnica', category: 'Secretaria', cost: 1,
    description: 'Nomear quadros técnicos e reorganizar a secretaria. Menos atrasos e melhores entregas.',
    availability: (s) => (inMandate(s, 'secretario') && s.player.mandate!.secretariat ? null : 'hidden'),
    apply: (s) => trainTeam(s),
  },
  {
    id: 'coletiva', label: 'Dar coletiva de imprensa', category: 'Secretaria', cost: 1,
    description: 'Apresenta resultados. Se os indicadores pioraram ou há crise, a imprensa cobra.',
    availability: (s) => (inMandate(s, 'secretario') && s.player.mandate!.secretariat ? null : 'hidden'),
    apply: (s, rng) => pressConference(s, rng),
  },
];

function billsInMyCommittee(s: GameState) {
  const c = playerCommittee(s);
  if (!c) return [];
  return s.legislature.bills.filter((b) => ['ccj', 'merito', 'financas'].includes(b.stage) && b.committeeId === c.id && b.rapporteurId !== PLAYER);
}
function articulable(s: GameState) {
  const mine = (b: Bill) => b.author === PLAYER || (b.author === 'executivo' && inMandate(s, 'prefeito'));
  return s.legislature.bills.filter((b) => isActive(b) && b.stage !== 'sancao' && (mine(b) || (inMandate(s, 'vereador') && (b.stage === 'plenario' || b.stage === 'veto') && b.salience >= 40)));
}
function plenaryQueue(s: GameState) {
  return s.legislature.bills.filter((b) => b.stage === 'plenario' && !b.scheduled);
}
function programOptions(s: GameState) {
  const sec = s.player.mandate?.secretariat;
  if (!sec) return [];
  return (portfolioById(sec.portfolio)?.programs ?? []).filter((p) => !sec.programs.some((x) => x.id === p.id && x.phase !== 'cancelado'));
}
function runningPrograms(s: GameState) {
  return s.player.mandate?.secretariat?.programs.filter((p) => ['planejamento', 'licitacao', 'execucao'].includes(p.phase)) ?? [];
}



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
