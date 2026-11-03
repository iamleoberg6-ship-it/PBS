// Pacote de regras versionado. Cada save guarda o id do pacote com que foi criado.
// Status de cada parâmetro:
//   REGRA_REAL  = regra da legislação brasileira (fonte indicada; validar no calendário oficial do TSE do ciclo)
//   DERIVADA    = data calculada a partir da lei (ex.: "primeiro domingo de outubro")
//   PROPOSTA    = mecânica/parâmetro de gameplay, fictício e balanceável

import { addMonthsIso, firstSunday, lastSunday } from '../calendar';

export type ParamStatus = 'REGRA_REAL' | 'DERIVADA' | 'PROPOSTA';

export interface Sourced<T> {
  value: T;
  status: ParamStatus;
  source: string;
}

const real = <T>(value: T, source: string): Sourced<T> => ({ value, status: 'REGRA_REAL', source });
const derived = <T>(value: T, source: string): Sourced<T> => ({ value, status: 'DERIVADA', source });
const proposal = <T>(value: T, source = 'Gameplay PBS'): Sourced<T> => ({ value, status: 'PROPOSTA', source });

export interface MunicipalRulePack {
  id: string;
  label: string;
  dataSnapshot: string;
  electionDate: Sourced<string>;
  runoffDate: Sourced<string>;
  filiationDeadline: Sourced<string>;
  domicileDeadline: Sourced<string>;
  conventionsStart: Sourced<string>;
  conventionsEnd: Sourced<string>;
  registrationDeadline: Sourced<string>;
  campaignStart: Sourced<string>;
  diplomaDeadline: Sourced<string>;
  posseDate: Sourced<string>;
  minAge: {
    vereador: Sourced<{ age: number; checkedAt: 'registration' | 'posse' }>;
    prefeito: Sourced<{ age: number; checkedAt: 'registration' | 'posse' }>;
    vicePrefeito: Sourced<{ age: number; checkedAt: 'registration' | 'posse' }>;
  };
  proportional: {
    nominalMinPhase1: Sourced<number>;
    partyMinPhase2: Sourced<number>;
    candidateMinPhase2: Sourced<number>;
    phase3OpenToAllParties: Sourced<boolean>;
    candidatesPerListFactor: Sourced<string>;
  };
  runoffElectorateThreshold: Sourced<number>;
  maxConsecutiveTermsExecutive: Sourced<number>;
  mandateYears: Sourced<number>;
  coalitionsAllowedProportional: Sourced<boolean>;
  pollRegistration: Sourced<string>;
  councilMesaTermYears: Sourced<number>;
}

const ELECTION = firstSunday(2028, 10);
const RUNOFF = lastSunday(2028, 10);
const SIX_MONTHS_BEFORE = addMonthsIso(ELECTION, -6);

export const RULEPACK_BR_2028_MUN: MunicipalRulePack = {
  id: 'BR-2028-MUN-v0.1',
  label: 'Eleições Municipais 2028 (pacote protótipo)',
  dataSnapshot: '2026-10-30',
  electionDate: derived(ELECTION, 'CF art. 29, II; Lei 9.504/97 art. 1º — primeiro domingo de outubro'),
  runoffDate: derived(RUNOFF, 'CF art. 29, II; Lei 9.504/97 art. 3º §2º — último domingo de outubro'),
  filiationDeadline: derived(SIX_MONTHS_BEFORE, 'Lei 9.504/97 art. 9º — filiação deferida até seis meses antes do pleito'),
  domicileDeadline: derived(SIX_MONTHS_BEFORE, 'Lei 9.504/97 art. 9º — domicílio eleitoral seis meses antes do pleito'),
  conventionsStart: derived('2028-07-20', 'Lei 9.504/97 art. 8º — convenções de 20 de julho a 5 de agosto'),
  conventionsEnd: derived('2028-08-05', 'Lei 9.504/97 art. 8º'),
  registrationDeadline: derived('2028-08-15', 'Lei 9.504/97 art. 11 — registro até 19h de 15 de agosto'),
  campaignStart: derived('2028-08-16', 'Lei 9.504/97 art. 36 — propaganda após 15 de agosto'),
  diplomaDeadline: derived('2028-12-19', 'Calendário eleitoral (aproximação; confirmar resolução TSE 2028)'),
  posseDate: real('2029-01-01', 'CF art. 29, III — posse em 1º de janeiro'),
  minAge: {
    vereador: real({ age: 18, checkedAt: 'registration' }, 'CF art. 14 §3º VI "d"; Lei 9.504/97 art. 11 §2º (18 anos na data-limite do registro)'),
    prefeito: real({ age: 21, checkedAt: 'posse' }, 'CF art. 14 §3º VI "c"; Lei 9.504/97 art. 11 §2º (idade aferida na posse)'),
    vicePrefeito: real({ age: 21, checkedAt: 'posse' }, 'CF art. 14 §3º VI "c"'),
  },
  proportional: {
    nominalMinPhase1: real(0.1, 'Código Eleitoral art. 108 — votação nominal mínima de 10% do QE'),
    partyMinPhase2: real(0.8, 'Código Eleitoral art. 109 §2º (Lei 14.211/2021) — 80% do QE para concorrer às sobras'),
    candidateMinPhase2: real(0.2, 'Código Eleitoral art. 109, I (Lei 14.211/2021) — candidato com 20% do QE'),
    phase3OpenToAllParties: real(true, 'STF, julgamento das ADIs sobre sobras eleitorais (28/02/2024) — todos os partidos participam da última fase'),
    candidatesPerListFactor: real('vagas + 1', 'Lei 9.504/97 art. 10 (Lei 14.211/2021)'),
  },
  runoffElectorateThreshold: real(200000, 'CF art. 29, II — segundo turno em municípios com mais de 200 mil eleitores'),
  maxConsecutiveTermsExecutive: real(2, 'CF art. 14 §5º — uma única reeleição para o período subsequente'),
  mandateYears: real(4, 'CF art. 29, I'),
  coalitionsAllowedProportional: real(false, 'CF art. 17 §1º (EC 97/2017)'),
  pollRegistration: real('registro até 5 dias antes da divulgação', 'Lei 9.504/97 art. 33 — pesquisas no ano eleitoral'),
  councilMesaTermYears: derived(1, 'Câmara Municipal de SP: Mesa eleita em 01/01/2025 e 15/12/2025, mandato anual; confirmar no Regimento Interno'),
};

// Parâmetros de gameplay (fictícios) usados pelo simulador nesta versão.
export const GAMEPLAY = {
  actionPointsPerMonth: proposal(3),
  validVoteRateProportional: proposal(0.62, 'Calibrado com SP 2024 (~5,8 mi votos válidos para ~9,3 mi eleitores)'),
  validVoteRateMajoritarian: proposal(0.6),
  legendVoteShare: proposal(0.08, 'Fração aproximada de votos de legenda; ajustável'),
  candidatePullShare: proposal(0.5, 'Efeito puxador: metade dos votos do jogador é voto novo para a lista (retirado das demais); a outra metade vem de dentro da própria lista'),
  ownFundsCapShareOfLimit: real(0.1, 'Lei 9.504/97 art. 23 §2º-A — autofinanciamento até 10% do limite de gastos'),
  assetMonthlyReturn: proposal(0.003, 'Valorização média mensal dos bens pessoais (parâmetro de jogo)'),
  debtMonthlyInterest: proposal(0.02, 'Juros mensais sobre dívida pessoal (parâmetro de jogo)'),
  cashReserveMonths: proposal(2, 'Meses de despesas mantidos em caixa antes de amortizar dívida'),
  spendingLimitVereadorSP: proposal(3_500_000, 'PLACEHOLDER — o TSE fixa o limite por município; substituir pelo valor oficial 2028'),
  spendingLimitPrefeitoSP: proposal(60_000_000, 'PLACEHOLDER — substituir pelo valor oficial 2028'),
};
