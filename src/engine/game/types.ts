import type { GameMonth } from '../calendar';
import type { RngState } from '../rng';
import type { ElectiveOffice, EligibilityCheck } from '../rules/eligibility';
import type { ProportionalResult } from '../rules/proportional';
import type { MajRoundResult } from '../rules/majoritarian';

export const SAVE_VERSION = 8;

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
  fundoPartidario?: number;
  /** Vaquinha virtual arrecadada antes do registro: só é liberada com a candidatura registrada (Lei 9.504/97 art. 22-A §3º). */
  crowdPending?: number;
  /** Doadores pessoas físicas captados (para o jantar de arrecadação). */
  donorsPF?: number;
  byCategory?: Record<string, number>; // despesas por categoria (prestação de contas)
}

export interface RegionCampaign {
  presence: number; // estrutura e visitas na região 0–100
  knowledge: number; // conhecimento do nome na região 0–100
  rejection: number; // rejeição na região 0–100
  leaders: number; // lideranças locais que apoiam (0–5)
}

export interface CampaignPlan {
  regions: Record<string, RegionCampaign>;
  focus: string[]; // até 3 regiões prioritárias
  themes: string[]; // até 3 temas
  segments: string[]; // até 2 segmentos-alvo
  tone: 'propositivo' | 'contraste' | 'ataque';
  team: { coordenacao: boolean; marketing: boolean; juridico: boolean; contabilidade: boolean };
  internalPolls: { month: GameMonth; byRegion: Record<string, number>; overall: number; rejection: number }[];
  accountability: { status: 'pendente' | 'aprovadas' | 'aprovadas_ressalvas' | 'desaprovadas'; notes: string[] } | null;
}

export type CandidacyStatus = 'pretendida' | 'aprovada_convencao' | 'rejeitada_convencao' | 'registrada' | 'indeferida';

export interface Candidacy {
  office: ElectiveOffice;
  /** Ano da eleição disputada (Fase 5: 2028, 2030, 2032…). Ausente em saves antigos = 2028. */
  year?: number;
  status: CandidacyStatus;
  checks: EligibilityCheck[];
  coalitionPartyIds: string[];
  campaignPoints: number;
  account: CampaignAccount;
  irregularities: number;
  plan?: CampaignPlan;
}

export interface StaffDemand {
  id: string;
  kind: 'parecer' | 'minuta' | 'agenda_bairro' | 'atendimento' | 'articulacao' | 'redes' | 'imprensa';
  label: string;
  attr: AttributeKey;
  difficulty: number; // 0–100
  monthsLeft: number;
  theme?: string;
  region?: string;
  billId?: string;
}

export interface StaffJob {
  bossId: string;
  bossName: string;
  bossPartyId: string;
  bossReal: boolean;
  rank: 'assessor' | 'assessor_especial' | 'chefe_gabinete';
  trust: number; // confiança do(a) vereador(a) 0–100 (simulada)
  contacts: number; // rede de bastidores na Câmara 0–100
  specialty: string | null; // tema em que o jogador se especializou
  demands: StaffDemand[];
  completed: number;
  failed: number;
  draftedBills: string[];
  since: GameMonth;
}

export type OfficeHeld = 'vereador' | 'prefeito' | 'secretario' | 'assessor' | 'deputado_estadual' | 'deputado_federal' | 'senador' | 'governador' | 'secretario_estadual';

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
  stance: Stance;
  approval: number; // aprovação pública do mandato/governo 0..100
  relationExecutive: number; // relação com a prefeitura 0..100 (vereador/secretário)
  councilBase: number; // prefeito: nº de vereadores na base
  projects: Project[];
  councilPresident: boolean;
  priorityArea: string | null;
  portfolio: string | null; // secretário: pasta
  budgetShare: number; // secretário: 0..100
  secretariat?: Secretariat | null;
  /** Mandatos estaduais/federais (Fase 5): estado abstrato — SIMPLIFICAÇÃO documentada em upper.ts. */
  upper?: UpperMandate | null;
}

export interface UpperMandate {
  /** Projetos apresentados e o que aconteceu com eles. */
  bills: { id: string; title: string; theme: string; status: 'tramitando' | 'aprovado' | 'arquivado'; monthsLeft: number }[];
  /** Emendas individuais destinadas a regiões da capital (R$ mi, valores de jogo). */
  amendments: { region: string; theme: string; value: number; month: GameMonth; paid: boolean }[];
  amendmentBudget: number; // saldo anual de emendas (R$ mi)
  committeeRole: string | null;
  /** Relação com o Executivo da esfera do mandato (governador ou presidente). */
  relationGov: number;
  /** Governador: base na Alesp, programas e indicadores agregados. */
  assemblyBase?: number;
  stateIndicators?: Record<string, number>;
  programs?: { id: string; label: string; monthsLeft: number; area: string }[];
  /** Ponto de agenda gasto em Brasília/capital no mês (deputado federal/senador) — ausência da base. */
  awayFromBase: number;
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
  staff: StaffJob | null;
  homeRegion: string;
  /** Mandatos consecutivos de governador (CF art. 14 §5º). */
  consecutiveTermsGovernador?: number;
  /** Boa vontade por região da capital (Fase 5): emendas, promessas cumpridas/quebradas. */
  regionalGoodwill?: Record<string, number>;
  /** Credibilidade pessoal diante da imprensa (Fase 5): cai quando o jogador nega algo verdadeiro e é desmentido. */
  credibility?: number;
}

export type Stance = 'base' | 'independente' | 'oposicao' | 'oposicao_radical';
export type VoteChoice = 'S' | 'N' | 'A';

export interface Committee {
  id: string;
  name: string;
  themes: string[];
  seats: number;
  members: string[];
  presidentId: string | null;
}

export interface RollCall {
  yes: number;
  no: number;
  abst: number;
  byMember: Record<string, VoteChoice>;
  outcome: 'aprovado' | 'rejeitado';
  quorum: string;
}

export type BillKind = 'regulacao' | 'programa' | 'denominacao' | 'executivo' | 'orcamento' | 'tributo';
export type BillStage = 'ccj' | 'merito' | 'financas' | 'plenario' | 'sancao' | 'veto' | 'lei' | 'arquivado' | 'rejeitado' | 'veto_mantido';

export interface Bill {
  id: string;
  number: string;
  title: string;
  theme: string;
  /** Autor: 'character_player', 'executivo' ou 'bancada:<partyId>' (projetos da IA não são atribuídos a pessoas reais). */
  author: string;
  kind: BillKind;
  executiveInitiativeOnly: boolean; // texto invade matéria de iniciativa privativa do prefeito (vício de iniciativa)
  publicSupport: number; // −1..+1: como a opinião pública vê o projeto (simulado)
  scheduled: boolean; // pautado pela Presidência para votação neste mês
  urgent: boolean;
  parecer: 'favoravel' | 'contrario' | null; // parecer do relator na etapa atual
  slant: number; // −1 (progressista/estatal) .. +1 (conservador/mercado) — posição do texto
  salience: number; // 0–100 pressão pública
  stage: BillStage;
  monthsInStage: number;
  committeeId: string;
  rapporteurId: string | null;
  executivePosition: 'favor' | 'contra' | 'neutro';
  commitments: string[]; // vereadores que se comprometeram com o jogador a votar a favor
  vote: RollCall | null;
  vetoVote: RollCall | null;
  history: { month: GameMonth; text: string }[];
  /** Dados de projetos fiscais (LDO, LOA, tributos): aplicados quando viram lei. */
  payload?: Record<string, string | number>;
}

export interface Cpi {
  id: string;
  topic: string;
  signatures: string[];
  status: 'coleta' | 'instalada' | 'concluida' | 'arquivada';
  startedAt: GameMonth;
  endsAt: GameMonth | null;
  proposer: string;
}

export interface MesaSeat { role: string; actorId: string }

export interface Legislature {
  committees: Committee[];
  bills: Bill[];
  billSeq: number;
  blocs: Record<string, Stance>;
  cpis: Cpi[];
  mesa: MesaSeat[];
  mesaCandidates: string[];
  mesaDeals: string[]; // bancadas (partyId) que fecharam apoio à chapa do jogador em troca de cargo na Mesa
  mesaYear: number | null;
  presidentId: string | null;
  playerVotes: Record<string, VoteChoice>; // voto que o jogador registrou para a próxima votação de cada projeto
  voteHistory: { billId: string; month: GameMonth; title: string; player: VoteChoice | null; outcome: string }[];
}

export interface SecIndicator {
  key: string;
  label: string;
  unit: string;
  value: number;
  better: 'up' | 'down';
  start: number;
}

export interface SecProgram {
  id: string;
  label: string;
  phase: 'planejamento' | 'licitacao' | 'execucao' | 'entregue' | 'cancelado';
  monthsLeft: number;
  cost: number; // R$ milhões
  effects: Record<string, number>; // efeito total por indicador, aplicado gradualmente na entrega
  delayed: boolean;
}

export interface Secretariat {
  portfolio: string; // id da pasta
  name: string;
  budget: number; // R$ milhões/ano (ordem de grandeza simulada)
  executed: number; // R$ milhões executados no ano
  extraSpent: number; // ações pontuais pagas com o orçamento livre no ano
  capacity: number; // equipe técnica 0–100
  relationCouncil: number; // relação com vereadores da área 0–100
  indicators: SecIndicator[];
  programs: SecProgram[];
  monthsInOffice: number;
  crisis: { id: string; label: string; monthsLeft: number; severity: number } | null;
  lowMonths: number; // meses seguidos com relação/aprovação críticas (risco de exoneração)
  approval?: number; // aprovação da pasta quando chefiada pela IA
  lastActionNote: string | null;
}

export interface LoaBudget {
  year: number;
  revenue: { iptu: number; iss: number; itbi: number; transf: number; outras: number; credito: number; capitalOutras: number };
  personnel: number; // pessoal ativo + inativo (R$ mi)
  debtService: number; // juros + amortização
  areas: Record<string, number>; // orçamento total de cada área (inclui o pessoal lotado nela)
  other: number; // demais órgãos: obras, administração, Câmara, encargos gerais
  reserve: number; // reserva de contingência (LRF art. 5º, III)
  status: 'base' | 'aprovada' | 'prorrogada' | 'rascunho';
  source: string;
}

export interface CitySecretary {
  portfolio: string;
  name: string;
  partyId: string | null;
  kind: 'tecnico' | 'politico' | 'interino';
  competence: number; // 0–100 (simulado)
  since: GameMonth;
}

export interface YearResult {
  year: number;
  revenue: number;
  expense: number;
  result: number;
  rcl: number;
  personnelRatio: number;
  educationRatio: number;
  healthRatio: number;
  debtRatio: number;
  creditOps: number;
  mayorWasPlayer: boolean;
}

export interface TcmOpinion {
  year: number;
  opinion: 'favoravel' | 'favoravel_ressalvas' | 'contrario';
  reasons: string[];
  judgment: 'pendente' | 'aprovadas' | 'rejeitadas';
  votes?: number;
}

export interface City {
  loa: LoaBudget;
  nextLoa: LoaBudget | null;
  draft: LoaBudget | null;
  ytd: { revenue: number; correntes: number; impostos: number; expense: number; personnel: number; byArea: Record<string, number>; credit: number; months: number };
  activity: number; // índice de atividade econômica (1 = tendência)
  priceLevel: number; // nível de preços relativo a 2027
  iptuIndex: number; // multiplicador da arrecadação do IPTU (planta genérica)
  issIndex: number; // multiplicador da arrecadação do ISS (alíquotas)
  pendingTaxes: { tax: 'iptu' | 'iss'; change: number; effectiveYear: number }[];
  debt: number; // dívida consolidada bruta (R$ mi)
  cash: number; // disponibilidade de caixa (R$ mi)
  contingency: number; // 0–0,3: fração do custeio/investimento contingenciada
  pendingCredit: { amount: number; area: string; readyAt: GameMonth }[];
  secretaries: Record<string, CitySecretary>;
  secretariats: Record<string, Secretariat>; // pastas chefiadas pela IA
  history: YearResult[];
  tcm: TcmOpinion[];
  ldo: Record<string, { target: 'equilibrio' | 'expansionista' | 'austero'; status: 'enviada' | 'aprovada' | 'rejeitada' }>;
  metas: { pkg: string; areas: string[]; start: Record<string, number>; presentedAt: GameMonth } | null;
  ppa: { period: string; status: 'enviado' | 'aprovado' } | null;
  approval: number; // avaliação do governo (simulada) quando o prefeito é da IA
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
  kind: 'apoio_disputa' | 'vaga_executiva' | 'cargo_mesa';
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
  /** Cargo pesquisado (ausente = prefeito, saves antigos). */
  race?: 'prefeito' | 'governador' | 'senador';
  rejection?: Record<string, number>; // id → fração que não votaria de jeito nenhum
  knowledge?: Record<string, number>; // id → fração que conhece o candidato
  govEval?: { good: number; regular: number; bad: number };
  byRegion?: Record<string, { id: string; share: number }[]>;
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
  playerOffice: ElectiveOffice | null;
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
  playerVotesByRegion?: Record<string, number>;
  mayorByRegion?: Record<string, { id: string; name: string; share: number }[]>;
}

// ---------------- Fase 5: mundo estadual e federal ----------------

export interface StateHolder {
  id: string;
  name: string;
  partyId: string;
  /** true = pessoa real (apenas fatos públicos: cargo, partido, mandato). */
  real: boolean;
  since: number; // ano de início
  until: number; // ano de término
  consecutiveTerms: number;
  isPlayer?: boolean;
}

export interface StateWorld {
  president: StateHolder;
  governor: StateHolder;
  /** As três cadeiras de SP no Senado. */
  senators: StateHolder[];
  alespSeats: Record<string, number>;
  camaraSeats: Record<string, number>;
  /** Avaliação simulada (personagens reais: número de jogo, não pesquisa real). */
  governorApproval: number;
  presidentApproval: number;
  governorCoalition: string[];
  presidentCoalition: string[];
  /** Vereadores que trocaram de mandato (eleitos deputados) e aguardam posse. */
  pendingDepartures: { councillorId: string; office: 'deputado_estadual' | 'deputado_federal'; posseMonth: number; real2026?: boolean }[];
  governorRace: RaceCandidate[] | null;
  senateRace: RaceCandidate[] | null;
  /** Vereadores (IA) que anunciaram candidatura a deputado no ciclo corrente. */
  councillorRuns: { id: string; office: 'deputado_estadual' | 'deputado_federal' }[];
}

export interface GeneralElectionRecord {
  year: number;
  alesp: ProportionalResult;
  camara: ProportionalResult;
  senate: MajRoundResult;
  senateSeats: number;
  governorFirst: MajRoundResult;
  governorRunoff: MajRoundResult | null;
  presidentFirst: MajRoundResult;
  presidentRunoff: MajRoundResult | null;
  candidatePartyById: Record<string, string>;
  playerOffice: ElectiveOffice | null;
  playerVotes: number | null;
  playerElected: boolean;
  playerVotesByRegion?: Record<string, number>;
  governorWinner: { id: string; name: string; partyId: string; isPlayer: boolean } | null;
  presidentWinner: { id: string; name: string; partyId: string } | null;
  senateWinners: { id: string; name: string; partyId: string; isPlayer: boolean }[];
  /** Vereadores de SP (IA) que disputaram e o resultado. */
  councillorRuns: { id: string; name: string; partyId: string; office: 'deputado_estadual' | 'deputado_federal'; votes: number; elected: boolean }[];
  runoffPending: {
    a: { id: string; name: string; label: string; partyId: string; votes: number; strength: number; birthDate: string; isPlayer: boolean };
    b: { id: string; name: string; label: string; partyId: string; votes: number; strength: number; birthDate: string; isPlayer: boolean };
    rest: number;
  } | null;
}

/** Crise de imagem (Fase 5.2). O jogador sabe se a acusação é verdadeira; o público não. */
export interface ImageCrisis {
  id: string;
  targetId: string; // 'character_player' ou personagem fictício
  targetName: string;
  topic: string;
  headline: string;
  truth: 'verdadeira' | 'falsa' | 'distorcida';
  outletId: string;
  severity: number; // 0–100
  month: GameMonth;
  deadline: number; // índice do mês até o qual a resposta conta
  status: 'ativa' | 'respondida' | 'esquecida';
  response: CrisisResponse | null;
  outcome: string | null;
  /** Origem: ato real do jogador (flag) ou boato/ataque. */
  origin: string;
}

export type CrisisResponse = 'desmentir' | 'explicar' | 'desculpas' | 'direito_resposta' | 'ignorar';

/** Estado dinâmico de um veículo fictício (credibilidade muda com o que ele publica). */
export interface OutletState {
  id: string;
  credibility: number; // 0–100 (simulado)
  falseStories: number;
  correctedStories: number;
}

/** Promessa pública feita a uma comunidade (Fase 5.3). */
export interface CommunityPromise {
  id: string;
  region: string;
  theme: string;
  text: string;
  madeAt: GameMonth;
  /** Mandato a que a promessa se refere: vence no fim desse mandato (ou 24 meses se feita sem cargo em vista). */
  dueMonth: number;
  status: 'aberta' | 'cumprida' | 'quebrada' | 'em_andamento' | 'caducou';
  progress: number; // 0–100
  context: string; // ex.: 'campanha 2028 (vereador)'
}

export interface Achievement {
  id: string;
  month: GameMonth;
}

export interface Ending {
  id: string;
  title: string;
  text: string;
  score: number;
  month: GameMonth;
}

export interface LogEntry {
  month: GameMonth;
  kind: 'acao' | 'evento' | 'eleicao' | 'partido' | 'mandato' | 'sistema' | 'financas' | 'camara' | 'secretaria';
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
  /** Agenda do cargo (Fase 5): compromissos só para o trabalho do mandato/gabinete. */
  officePoints?: number;
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
  legislature: Legislature;
  city: City;
  stateWorld: StateWorld;
  generalElections: GeneralElectionRecord[];
  crises: ImageCrisis[];
  outlets: OutletState[];
  communityPromises: CommunityPromise[];
  achievements: Achievement[];
  ending: Ending | null;
  pendingEvents: PendingEvent[];
  log: LogEntry[];
  flags: Record<string, boolean | number | string>;
  gameOver: boolean;
}
