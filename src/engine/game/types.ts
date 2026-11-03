import type { GameMonth } from '../calendar';
import type { RngState } from '../rng';
import type { EligibilityCheck, MunicipalOffice } from '../rules/eligibility';
import type { ProportionalResult } from '../rules/proportional';
import type { MajRoundResult } from '../rules/majoritarian';

export const SAVE_VERSION = 4;

export type NetworkId = 'instagram' | 'x' | 'youtube' | 'tiktok';

export interface SocialState {
  focus: NetworkId;
  networks: Record<NetworkId, number>;
}

export interface NewsItem {
  id: string;
  month: GameMonth;
  outletId: string;
  section: 'Eleições' | 'Câmara' | 'Prefeitura' | 'Partidos' | 'Brasil' | 'Cidade' | 'Perfil';
  headline: string;
  lead: string;
  aboutPlayer: boolean;
  tone: 'positivo' | 'neutro' | 'critico';
}

export type AttributeKey =
  | 'communication' | 'charisma' | 'negotiation' | 'leadership'
  | 'management' | 'politicalKnowledge' | 'popularity' | 'articulation';

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  communication: 'Comunicação',
  charisma: 'Carisma',
  negotiation: 'Negociação',
  leadership: 'Liderança',
  management: 'Gestão',
  politicalKnowledge: 'Conhecimento político',
  popularity: 'Popularidade',
  articulation: 'Articulação',
};

export type Attributes = Record<AttributeKey, number>;

export type ProfessionId =
  | 'empresario' | 'advogado' | 'professor' | 'lider_comunitario' | 'jornalista' | 'servidor'
  | 'medico' | 'economista' | 'engenheiro' | 'policial' | 'sindicalista' | 'influenciador'
  | 'agricultor' | 'estudante' | 'autonomo' | 'desempregado';

export type StartStatus = 'independente' | 'filiado' | 'militante' | 'herdeiro';

export interface Character {
  id: string;
  name: string;
  birthDate: string;
  gender: string;
  municipalityId: string;
  domicileSince: string;
  education: string;
  profession: ProfessionId;
  startStatus: StartStatus;
  bio: string;
  attributes: Attributes;
  /** Posições do personagem nas 10 dimensões (−100..+100). */
  ideology: Record<import('../data/ideology').AxisId, number>;
}

export interface Finances {
  cash: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  /** Bens não líquidos (imóveis, veículos, aplicações de longo prazo). */
  assets: number;
  /** Patrimônio líquido = caixa + bens − dívidas. Sempre recalculado por recomputeNetWorth. */
  netWorth: number;
  debts: number;
}

export interface CampaignAccount {
  fefc: number;
  donations: number;
  ownFunds: number;
  spent: number;
}

export type CandidacyStatus = 'pretendida' | 'aprovada_convencao' | 'rejeitada_convencao' | 'registrada' | 'indeferida';

export interface Candidacy {
  office: MunicipalOffice;
  status: CandidacyStatus;
  checks: EligibilityCheck[];
  coalitionPartyIds: string[];
  campaignPoints: number;
  account: CampaignAccount;
  irregularities: number;
}

export type OfficeHeld = 'vereador' | 'prefeito' | 'secretario' | 'assessor';

export interface Project {
  id: string;
  theme: string;
  title: string;
  monthsLeft: number;
  status: 'tramitando' | 'aprovado' | 'rejeitado' | 'vetado' | 'sancionado';
}

export interface Mandate {
  office: OfficeHeld;
  since: string;
  until: string;
  stance: 'base' | 'oposicao' | 'independente';
  approval: number; // aprovação pública do mandato/governo 0..100
  relationExecutive: number; // relação com a prefeitura 0..100 (vereador/secretário)
  councilBase: number; // prefeito: nº de vereadores na base
  projects: Project[];
  councilPresident: boolean;
  priorityArea: string | null;
  portfolio: string | null; // secretário: pasta
  budgetShare: number; // secretário: 0..100
}

export interface PlayerState {
  partyId: string | null;
  filiationDate: string | null;
  partyHistory: { partyId: string; from: string; to: string | null }[];
  /** Relação com o próprio partido: cinco indicadores independentes (não somados numa nota única). */
  partyRel: PlayerPartyRel;
  /** Uso recente de cada ação (desgaste por repetição). */
  actionUse: Record<string, { lastMonth: number; streak: number; thisMonth: number }>;
  recognition: number;
  base: number;
  job: 'profissao' | 'assessor' | null;
  candidacy: Candidacy | null;
  mandate: Mandate | null;
  consecutiveTermsPrefeito: number;
  careerHistory: { office: string; from: string; to: string | null; note: string }[];
  social: SocialState;
}

export interface PlayerPartyRel {
  internalPopularity: number; // como a militância/filiados veem você
  leadershipTrust: number; // confiança da direção
  influence: number; // peso nas decisões internas
  perceivedLoyalty: number; // fidelidade percebida
  mobilization: number; // capacidade de mobilizar filiados e delegados
  disciplinary: 0 | 1 | 2; // 0 nada, 1 advertência, 2 suspensão
  executiveRole: string | null; // cargo na executiva municipal
}

export type ActorRole = 'vereador' | 'dirigente' | 'lider_faccao' | 'figura';

export interface Actor {
  id: string;
  name: string;
  real: boolean;
  role: ActorRole;
  partyId: string | null;
  /** Traços de comportamento: SEMPRE simulados (também para pessoas reais), gerados por metodologia única. */
  traits: { ambition: number; loyalty: number; pragmatism: number; articulation: number; charisma: number };
  ideology: number | null; // 0–10
  influence: number; // 0–100
  goal: 'presidir_diretorio' | 'presidir_camara' | 'fortalecer_faccao' | 'reeleicao' | 'nenhum';
  factionId: string | null;
}

export interface MemoryEntry {
  month: GameMonth;
  kind: 'apoio' | 'traicao' | 'favor' | 'promessa' | 'promessa_cumprida' | 'promessa_quebrada' | 'ataque' | 'acordo' | 'derrota_imposta';
  text: string;
  weight: number;
}

/** Relação dirigida: como `from` enxerga `to`. Chave: `${from}|${to}`. */
export interface Relation {
  trust: number; // −100..100
  affinity: number; // −100..100
  owed: number; // favores que `from` sente dever a `to` (negativo = cobra)
  memory: MemoryEntry[];
}

export type FactionType = 'ideologica' | 'pragmatica' | 'direcao' | 'governista' | 'oposicionista' | 'regional';

export interface Faction {
  id: string;
  partyId: string;
  name: string;
  type: FactionType;
  leaderId: string;
  share: number; // fração dos delegados (soma 1 no partido)
  influence: number; // 0–100
  ideologyShift: number; // −1..+1 em relação à posição do partido
  mobilization: number; // 0–100
}

export interface Directorate {
  presidentId: string;
  executive: { role: string; actorId: string }[];
  delegates: number;
  members: number;
  termEnds: GameMonth;
}

export interface PartyOrg {
  partyId: string;
  directorate: Directorate;
  factions: Faction[];
  history: { month: GameMonth; text: string }[];
}

export interface InternalContest {
  id: string;
  partyId: string;
  kind: 'presidencia_diretorio';
  decidesAt: GameMonth;
  candidates: string[];
  status: 'aberta' | 'decidida';
  result?: { winnerId: string; votes: Record<string, number>; byFaction: { factionId: string; candidateId: string; delegates: number }[]; unaligned: Record<string, number> };
}

export interface PoliticalPromise {
  id: string;
  toActorId: string;
  kind: 'apoio_disputa' | 'vaga_executiva';
  contestId: string | null;
  text: string;
  status: 'aberta' | 'cumprida' | 'quebrada' | 'caducou';
  madeAt: GameMonth;
}

export interface CauseEntry {
  month: GameMonth;
  indicator: string;
  delta: number;
  cause: string;
}

export interface PartyRuntime {
  momentum: number; // -0.5..0.5 variação de força no município
  leaderName: string;
}

export interface OfficeHolder {
  personId: string;
  name: string;
  partyId: string;
  real: boolean;
}

export interface Councillor {
  id: string;
  name: string;
  partyId: string;
  real: boolean;
  votes: number;
  electedIn: number;
  birthDate: string | null;
  birthPrecision: 'exata' | 'ano' | 'estimada' | null;
}

export interface RaceCandidate {
  id: string;
  name: string;
  label: string;
  partyId: string;
  listId: string;
  baseStrength: number;
  birthDate: string;
  isPlayer: boolean;
  /** Seguidores somados nas redes (simulado; só para personagens fictícios). */
  followers?: number;
}

export interface Poll {
  month: GameMonth;
  institute: string;
  registration: string;
  sample: number;
  marginOfError: number; // pontos percentuais, 95%
  undecided: number; // 0..1 brancos/nulos/indecisos
  results: { id: string; name: string; label: string; share: number }[]; // share sobre o total de entrevistados
  scenario: '1º turno' | '2º turno';
}

export interface MunicipalGovernment {
  councillors: Councillor[];
  mayor: OfficeHolder;
  viceMayor: OfficeHolder;
  councilSeatsByParty: Record<string, number>;
  councilPresident: (OfficeHolder & { year: number; simulated: boolean }) | null;
  mayorCoalition: string[];
  mandateUntil: string;
}

export interface ElectionRecord {
  year: number;
  proportional: ProportionalResult | null;
  mayorFirst: MajRoundResult | null;
  mayorRunoff: MajRoundResult | null;
  playerOffice: MunicipalOffice | null;
  playerCandidateId: string | null;
  playerVotes: number | null;
  playerElected: boolean;
  candidatePartyById: Record<string, string>;
  mayorWinner: { id: string; name: string; partyId: string; isPlayer: boolean } | null;
  runoffPending: {
    a: { id: string; name: string; label: string; partyId: string; votes: number; strength: number; birthDate: string; isPlayer: boolean };
    b: { id: string; name: string; label: string; partyId: string; votes: number; strength: number; birthDate: string; isPlayer: boolean };
    rest: number;
  } | null;
}

export interface LogEntry {
  month: GameMonth;
  kind: 'acao' | 'evento' | 'eleicao' | 'partido' | 'mandato' | 'sistema' | 'financas';
  text: string;
}

export interface PendingEvent {
  templateId: string;
  vars: Record<string, string | number>;
}

export interface GameState {
  saveVersion: number;
  rulepackId: string;
  dataSnapshot: string;
  createdAt: string;
  rng: RngState;
  month: GameMonth;
  actionPoints: number;
  character: Character;
  finances: Finances;
  player: PlayerState;
  parties: Record<string, PartyRuntime>;
  government: MunicipalGovernment;
  elections: ElectionRecord[];
  mayorRace: RaceCandidate[] | null;
  polls: Poll[];
  news: NewsItem[];
  actors: Record<string, Actor>;
  relations: Record<string, Relation>;
  partyOrgs: Record<string, PartyOrg>;
  contests: InternalContest[];
  promises: PoliticalPromise[];
  ledger: CauseEntry[];
  pendingEvents: PendingEvent[];
  log: LogEntry[];
  flags: Record<string, boolean | number | string>;
  gameOver: boolean;
}
