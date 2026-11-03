import { createRng } from '../rng';
import { PARTIES } from '../data/parties';
import { GAMEPLAY, RULEPACK_BR_2028_MUN } from '../data/rulepack';
import { initStateWorld } from './general';
import { initOutlets } from './livingworld';
import { REAL_FIGURES, SAO_PAULO } from '../data/world';
import { fictionalName } from './names';
import { initialCouncillors, seatsByParty } from './council';
import { electMesa, emptyLegislature, initLegislature } from './legislature';
import { initCity } from './municipality';
import { pickHomeRegion } from './campaign';
import { initialSocial } from './social';
import { recomputeNetWorth } from './finance';
import { councillorActors } from './actors';
import { buildPartyOrgs, defaultPartyRel, seedPlayerPartyRelations } from './partyorg';
import type { PlayerPartyRel } from './types';

export function initialPartyRel(status: StartStatus, member: boolean): PlayerPartyRel {
  const r = defaultPartyRel();
  if (!member) return r;
  const base: Record<StartStatus, Partial<PlayerPartyRel>> = {
    independente: {},
    filiado: { leadershipTrust: 20, internalPopularity: 10, influence: 10, perceivedLoyalty: 55, mobilization: 5 },
    militante: { leadershipTrust: 35, internalPopularity: 30, influence: 20, perceivedLoyalty: 60, mobilization: 25 },
    herdeiro: { leadershipTrust: 40, internalPopularity: 20, influence: 30, perceivedLoyalty: 50, mobilization: 15 },
  };
  return { ...r, ...base[status] };
}
import { ideologicalDistance, neutralIdeology, partyIdeology, type AxisId } from '../data/ideology';
import type { Attributes, Character, GameState, ProfessionId, StartStatus } from './types';
import { SAVE_VERSION } from './types';

// Origens profissionais (PROPOSTA de balanceamento). Nenhuma bloqueia caminhos.
// Origens profissionais (PROPOSTA de balanceamento). Cada uma tem pontos fortes e fracos;
// nenhuma bloqueia caminhos. Valores somados à base de 35 (conhecimento político: 30; articulação: 25).
/** Coligação "Caminho Seguro para São Paulo" (2024), 12 partidos — registro público da eleição. */
export const NUNES_2024_COALITION = ['party_real_mdb', 'party_real_pl', 'party_real_psd', 'party_real_uniao', 'party_real_republicanos', 'party_real_pp', 'party_real_pode', 'party_real_solidariedade', 'party_real_avante', 'party_real_mobiliza', 'party_real_agir', 'party_real_prd'];

export const PROFESSIONS: Record<ProfessionId, { label: string; income: number; cash: number; mods: Partial<Attributes>; recognition: number; base: number; note?: string }> = {
  empresario: { label: 'Empresário(a)', income: 22000, cash: 120000, mods: { management: 12, negotiation: 8, charisma: -4, politicalKnowledge: -4 }, recognition: 3, base: 2 },
  advogado: { label: 'Advogado(a)', income: 15000, cash: 50000, mods: { politicalKnowledge: 12, communication: 6, charisma: -4, management: -2 }, recognition: 2, base: 2 },
  professor: { label: 'Professor(a)', income: 6500, cash: 12000, mods: { communication: 10, charisma: 4, negotiation: -4 }, recognition: 2, base: 6 },
  lider_comunitario: { label: 'Líder comunitário(a)', income: 3500, cash: 4000, mods: { charisma: 10, articulation: 8, management: -6, politicalKnowledge: -4 }, recognition: 4, base: 14 },
  jornalista: { label: 'Jornalista', income: 8000, cash: 15000, mods: { communication: 14, politicalKnowledge: 4, negotiation: -4, management: -4 }, recognition: 6, base: 1 },
  servidor: { label: 'Servidor(a) público(a)', income: 9000, cash: 25000, mods: { management: 8, politicalKnowledge: 8, charisma: -6 }, recognition: 1, base: 3 },
  medico: { label: 'Médico(a)', income: 25000, cash: 90000, mods: { management: 6, charisma: 6, politicalKnowledge: -6, articulation: -2 }, recognition: 3, base: 5 },
  economista: { label: 'Economista', income: 14000, cash: 40000, mods: { management: 10, politicalKnowledge: 6, charisma: -8, communication: -2 }, recognition: 1, base: 1 },
  engenheiro: { label: 'Engenheiro(a)', income: 13000, cash: 35000, mods: { management: 12, communication: -6, charisma: -4 }, recognition: 1, base: 1 },
  policial: { label: 'Policial', income: 8500, cash: 15000, mods: { leadership: 10, charisma: 4, negotiation: -6, politicalKnowledge: -2 }, recognition: 3, base: 5 },
  sindicalista: { label: 'Sindicalista', income: 6000, cash: 8000, mods: { articulation: 12, negotiation: 6, management: -4, communication: -2 }, recognition: 3, base: 10 },
  influenciador: {
    label: 'Influenciador(a) digital / YouTuber', income: 12000, cash: 30000,
    mods: { communication: 20, charisma: 14, politicalKnowledge: -22, articulation: -14, management: -12, negotiation: -8, leadership: -4 },
    recognition: 16, base: 2,
    note: 'Fama rápida e ótima comunicação, mas quase nenhum conhecimento institucional e pouca rede política. Conteúdo nas redes rende mais e erra menos.',
  },
  agricultor: { label: 'Agricultor(a)', income: 4500, cash: 20000, mods: { leadership: 6, articulation: 4, communication: -4 }, recognition: 1, base: 6 },
  estudante: { label: 'Estudante', income: 1500, cash: 2000, mods: { politicalKnowledge: 6, communication: 4, management: -8, articulation: -4 }, recognition: 1, base: 3 },
  autonomo: { label: 'Trabalhador(a) autônomo(a)', income: 4000, cash: 5000, mods: { negotiation: 6, charisma: 4, politicalKnowledge: -4 }, recognition: 1, base: 4 },
  desempregado: { label: 'Desempregado(a)', income: 0, cash: 1500, mods: { charisma: 4, management: -4 }, recognition: 0, base: 3 },
};

export const START_STATUS: Record<StartStatus, { label: string; detail: string }> = {
  independente: { label: 'Cidadão independente', detail: 'Sem partido, mandato ou experiência eleitoral.' },
  filiado: { label: 'Filiado', detail: 'Já integra uma legenda, sem cargo.' },
  militante: { label: 'Militante', detail: 'Experiência em campanhas e organização partidária.' },
  herdeiro: { label: 'Herdeiro de capital político', detail: 'Família com conexões políticas; sem garantia de apoio.' },
};

export interface NewGameInput {
  name: string;
  birthDate: string;
  gender: string;
  education: string;
  profession: ProfessionId;
  startStatus: StartStatus;
  startPartyId: string | null;
  bio: string;
  /** Pontos distribuídos pelo jogador (somados à base). */
  attributeBonus: Partial<Attributes>;
  ideology?: Partial<Record<AxisId, number>>;
  seed?: number;
  /** Região onde o personagem mora e tem base (Fase 4). */
  homeRegion?: string;
}

export const BASE_ATTRIBUTES: Attributes = {
  communication: 35, charisma: 35, negotiation: 35, leadership: 35,
  management: 35, politicalKnowledge: 30, popularity: 2, articulation: 25,
};

export const FREE_POINTS = 40;

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

export function createGame(input: NewGameInput): GameState {
  const seed = input.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = createRng(seed);
  const prof = PROFESSIONS[input.profession];
  const attrs = { ...BASE_ATTRIBUTES };
  for (const [k, v] of Object.entries(prof.mods)) attrs[k as keyof Attributes] += v ?? 0;
  for (const [k, v] of Object.entries(input.attributeBonus)) attrs[k as keyof Attributes] += v ?? 0;
  const statusMods: Record<StartStatus, Partial<Attributes>> = {
    independente: {}, filiado: { politicalKnowledge: 4 }, militante: { articulation: 8, politicalKnowledge: 6 }, herdeiro: { articulation: 12, popularity: 3 },
  };
  for (const [k, v] of Object.entries(statusMods[input.startStatus])) attrs[k as keyof Attributes] += v ?? 0;
  for (const k of Object.keys(attrs) as (keyof Attributes)[]) attrs[k] = clamp(attrs[k]);

  const character: Character = {
    id: 'character_player',
    name: input.name.trim() || 'Sem Nome',
    birthDate: input.birthDate,
    gender: input.gender,
    municipalityId: SAO_PAULO.id,
    domicileSince: '2020-01-01',
    education: input.education,
    profession: input.profession,
    startStatus: input.startStatus,
    bio: input.bio,
    attributes: attrs,
    ideology: { ...neutralIdeology(), ...(input.ideology ?? {}) },
  };

  const startDate = '2027-01-01';
  const joinsParty = input.startStatus !== 'independente' && input.startPartyId;
  const filiationDate = joinsParty ? '2025-06-01' : null;

  const parties: GameState['parties'] = {};
  for (const party of PARTIES) parties[party.id] = { momentum: 0, leaderName: fictionalName(rng) };

  const nunes = REAL_FIGURES.find((f) => f.id === 'real_ricardo_nunes')!;
  const vice = REAL_FIGURES.find((f) => f.id === 'real_mello_araujo')!;

  const state: GameState = {
    saveVersion: SAVE_VERSION,
    rulepackId: RULEPACK_BR_2028_MUN.id,
    dataSnapshot: RULEPACK_BR_2028_MUN.dataSnapshot,
    createdAt: new Date().toISOString(),
    rng,
    month: { year: 2027, month: 1 },
    actionPoints: GAMEPLAY.actionPointsPerMonth.value,
    officePoints: 0,
    character,
    finances: {
      cash: prof.cash * (input.startStatus === 'herdeiro' ? 2 : 1),
      monthlyIncome: prof.income,
      monthlyExpenses: Math.round(Math.max(1200, prof.income * 0.65)),
      assets: prof.cash * 2 * (input.startStatus === 'herdeiro' ? 3 : 1),
      netWorth: 0,
      debts: 0,
    },
    player: {
      partyId: joinsParty ? input.startPartyId : null,
      filiationDate,
      partyHistory: joinsParty ? [{ partyId: input.startPartyId!, from: filiationDate!, to: null }] : [],
      partyRel: initialPartyRel(input.startStatus, !!joinsParty),
      actionUse: {},
      recognition: clamp(prof.recognition + (input.startStatus === 'herdeiro' ? 8 : 0)),
      base: clamp(prof.base + (input.startStatus === 'militante' ? 5 : 0)),
      job: input.profession === 'desempregado' ? null : 'profissao',
      candidacy: null,
      mandate: null,
      consecutiveTermsPrefeito: 0,
      careerHistory: [],
      social: initialSocial(input.profession, rng),
      staff: null,
      credibility: 60,
      consecutiveTermsGovernador: 0,
      regionalGoodwill: {},
      homeRegion: input.homeRegion ?? pickHomeRegion(rng),
    },
    parties,
    government: {
      councillors: initialCouncillors(),
      mayor: { personId: nunes.id, name: nunes.name, partyId: nunes.partyId, real: true },
      viceMayor: { personId: vice.id, name: vice.name, partyId: vice.partyId, real: true },
      councilSeatsByParty: seatsByParty(initialCouncillors()),
      councilPresident: null,
      // Coligação "Caminho Seguro para São Paulo" (2024): 12 partidos, registro público da eleição.
      mayorCoalition: [...NUNES_2024_COALITION],
      mandateUntil: '2028-12-31',
    },
    elections: [],
    mayorRace: null,
    polls: [],
    news: [],
    actors: {},
    relations: {},
    partyOrgs: {},
    contests: [],
    promises: [],
    ledger: [],
    legislature: emptyLegislature(),
    city: null as unknown as GameState['city'],
    stateWorld: initStateWorld(),
    generalElections: [],
    crises: [],
    outlets: initOutlets(),
    communityPromises: [],
    achievements: [],
    ending: null,
    pendingEvents: [],
    log: [{ month: { year: 2027, month: 1 }, kind: 'sistema', text: `Partida iniciada em ${startDate}. Pacote de regras: ${RULEPACK_BR_2028_MUN.label} (ciclos seguintes até 2036 projetam a lei vigente). Dados reais congelados em 30/10/2026.` }],
    flags: { seed, saidas2026: true, cotaEmendas2026: true },
    gameOver: false,
  };
  if (joinsParty) {
    // Afinidade ideológica com o partido ajusta a relação inicial com a direção.
    const d = ideologicalDistance(character.ideology, partyIdeology(input.startPartyId!));
    if (d !== null) state.player.partyRel.leadershipTrust = Math.max(0, Math.round(state.player.partyRel.leadershipTrust + 10 - d * 40));
  }
  councillorActors(state, rng);
  buildPartyOrgs(state, rng);
  seedPlayerPartyRelations(state, rng);
  recomputeNetWorth(state);
  initLegislature(state, rng);
  state.city = initCity(state, rng);
  const mesa = electMesa(state, 2027, rng);
  state.log.push({ month: state.month, kind: 'sistema', text: `${mesa} A eleição real da Mesa de 2027 acontece em dezembro de 2026, depois do retrato de dados do jogo.` });
  if (joinsParty) {
    state.log.push({ month: state.month, kind: 'partido', text: `Você é filiado(a) desde 01/06/2025.` });
  }
  return state;
}
