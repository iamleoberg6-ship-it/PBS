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

/**
 * Pacote municipal de um ciclo. 2028 é o ciclo-base; 2032, 2036… são PROJEÇÕES: aplicam a legislação
 * vigente na data dos dados (30/10/2026). Reformas eleitorais posteriores não são modeladas.
 */
export function buildMunicipalRulepack(year: number): MunicipalRulePack {
  const ELECTION = firstSunday(year, 10);
  const RUNOFF = lastSunday(year, 10);
  const SIX_MONTHS_BEFORE = addMonthsIso(ELECTION, -6);
  const proj = year === 2028 ? '' : ` — projeção para ${year} com a lei vigente em 2026`;
  return {
    id: year === 2028 ? 'BR-2028-MUN-v0.1' : `BR-${year}-MUN-proj`,
    label: year === 2028 ? 'Eleições Municipais 2028 (pacote protótipo)' : `Eleições Municipais ${year} (projeção da lei vigente)`,
    dataSnapshot: '2026-10-30',
    electionDate: derived(ELECTION, 'CF art. 29, II; Lei 9.504/97 art. 1º — primeiro domingo de outubro' + proj),
    runoffDate: derived(RUNOFF, 'CF art. 29, II; Lei 9.504/97 art. 3º §2º — último domingo de outubro' + proj),
    filiationDeadline: derived(SIX_MONTHS_BEFORE, 'Lei 9.504/97 art. 9º — filiação deferida até seis meses antes do pleito'),
    domicileDeadline: derived(SIX_MONTHS_BEFORE, 'Lei 9.504/97 art. 9º — domicílio eleitoral seis meses antes do pleito'),
    conventionsStart: derived(`${year}-07-20`, 'Lei 9.504/97 art. 8º — convenções de 20 de julho a 5 de agosto'),
    conventionsEnd: derived(`${year}-08-05`, 'Lei 9.504/97 art. 8º'),
    registrationDeadline: derived(`${year}-08-15`, 'Lei 9.504/97 art. 11 — registro até 19h de 15 de agosto'),
    campaignStart: derived(`${year}-08-16`, 'Lei 9.504/97 art. 36 — propaganda após 15 de agosto'),
    diplomaDeadline: derived(`${year}-12-19`, `Calendário eleitoral (aproximação; confirmar resolução TSE ${year})`),
    posseDate: real(`${year + 1}-01-01`, 'CF art. 29, III — posse em 1º de janeiro'),
    minAge: {
      vereador: real({ age: 18, checkedAt: 'registration' }, 'CF art. 14 §3º VI "d"; Lei 9.504/97 art. 11 §2º (18 anos na data-limite do registro)'),
      prefeito: real({ age: 21, checkedAt: 'posse' }, 'CF art. 14 §3º VI "c"; Lei 9.504/97 art. 11 §2º (idade aferida na posse)'),
      vicePrefeito: real({ age: 21, checkedAt: 'posse' }, 'CF art. 14 §3º VI "c"'),
    },
    proportional: PROPORTIONAL_RULES,
    runoffElectorateThreshold: real(200000, 'CF art. 29, II — segundo turno em municípios com mais de 200 mil eleitores'),
    maxConsecutiveTermsExecutive: real(2, 'CF art. 14 §5º — uma única reeleição para o período subsequente'),
    mandateYears: real(4, 'CF art. 29, I'),
    coalitionsAllowedProportional: real(false, 'CF art. 17 §1º (EC 97/2017)'),
    pollRegistration: real('registro até 5 dias antes da divulgação', 'Lei 9.504/97 art. 33 — pesquisas no ano eleitoral'),
    councilMesaTermYears: derived(1, 'Câmara Municipal de SP: Mesa eleita em 01/01/2025 e 15/12/2025, mandato anual; confirmar no Regimento Interno'),
  };
}

const PROPORTIONAL_RULES: MunicipalRulePack['proportional'] = {
  nominalMinPhase1: real(0.1, 'Código Eleitoral art. 108 — votação nominal mínima de 10% do QE'),
  partyMinPhase2: real(0.8, 'Código Eleitoral art. 109 §2º (Lei 14.211/2021) — 80% do QE para concorrer às sobras'),
  candidateMinPhase2: real(0.2, 'Código Eleitoral art. 109, I (Lei 14.211/2021) — candidato com 20% do QE'),
  phase3OpenToAllParties: real(true, 'STF, julgamento das ADIs sobre sobras eleitorais (28/02/2024) — todos os partidos participam da última fase'),
  candidatesPerListFactor: real('vagas + 1', 'Lei 9.504/97 art. 10 (Lei 14.211/2021)'),
};

export const RULEPACK_BR_2028_MUN: MunicipalRulePack = buildMunicipalRulepack(2028);

const munCache = new Map<number, MunicipalRulePack>([[2028, RULEPACK_BR_2028_MUN]]);
export function munRulepack(year: number): MunicipalRulePack {
  if (!munCache.has(year)) munCache.set(year, buildMunicipalRulepack(year));
  return munCache.get(year)!;
}

// ---------------- Eleições gerais (presidente, governador, Senado, deputados) ----------------

export type GeneralOffice = 'deputado_estadual' | 'deputado_federal' | 'senador' | 'governador' | 'presidente' | 'vice_presidente';

export interface GeneralRulePack {
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
  desincompatibilizacao: Sourced<string>;
  posse: Record<GeneralOffice, Sourced<string>>;
  minAge: Record<GeneralOffice, Sourced<{ age: number; checkedAt: 'registration' | 'posse' }>>;
  seats: { alesp: Sourced<number>; camaraSP: Sourced<number>; senadoSP: Sourced<number> };
  mandateYears: Record<GeneralOffice, Sourced<number>>;
  proportional: MunicipalRulePack['proportional'];
  maxConsecutiveTermsExecutive: Sourced<number>;
  stateElectorate: Sourced<number>;
  desincompatibilizacaoRules: { cargo: string; prazo: string; source: string; status: ParamStatus }[];
}

export function buildGeneralRulepack(year: number): GeneralRulePack {
  const ELECTION = firstSunday(year, 10);
  const SIX = addMonthsIso(ELECTION, -6);
  const proj = ` — projeção para ${year} com a lei vigente em 2026`;
  return {
    id: `BR-${year}-GER-proj`,
    label: `Eleições Gerais ${year} (projeção da lei vigente)`,
    dataSnapshot: '2026-10-30',
    electionDate: derived(ELECTION, 'CF art. 77 e art. 28; Lei 9.504/97 art. 1º — primeiro domingo de outubro' + proj),
    runoffDate: derived(lastSunday(year, 10), 'CF art. 77 §3º e art. 28 — último domingo de outubro (presidente e governador)'),
    filiationDeadline: derived(SIX, 'Lei 9.504/97 art. 9º — filiação até seis meses antes do pleito'),
    domicileDeadline: derived(SIX, 'Lei 9.504/97 art. 9º — domicílio eleitoral na circunscrição (o estado) seis meses antes'),
    conventionsStart: derived(`${year}-07-20`, 'Lei 9.504/97 art. 8º'),
    conventionsEnd: derived(`${year}-08-05`, 'Lei 9.504/97 art. 8º'),
    registrationDeadline: derived(`${year}-08-15`, 'Lei 9.504/97 art. 11'),
    campaignStart: derived(`${year}-08-16`, 'Lei 9.504/97 art. 36'),
    desincompatibilizacao: derived(SIX, 'CF art. 14 §6º — chefes do Executivo renunciam até seis meses antes para concorrer a outros cargos'),
    posse: {
      presidente: real(`${year + 1}-01-05`, 'CF art. 82 (redação da EC 111/2021) — posse em 5 de janeiro'),
      vice_presidente: real(`${year + 1}-01-05`, 'CF art. 82 (redação da EC 111/2021) — posse em 5 de janeiro, com o presidente'),
      governador: real(`${year + 1}-01-06`, 'CF art. 28 (redação da EC 111/2021) — posse em 6 de janeiro'),
      senador: derived(`${year + 1}-02-01`, 'CF art. 57 §4º — sessões preparatórias a partir de 1º de fevereiro'),
      deputado_federal: derived(`${year + 1}-02-01`, 'CF art. 57 §4º — sessões preparatórias a partir de 1º de fevereiro'),
      deputado_estadual: real(`${year + 1}-03-15`, 'Alesp — deputados estaduais de SP tomam posse em 15 de março (prática confirmada nas legislaturas de 2019 e 2023)'),
    },
    minAge: {
      deputado_estadual: real({ age: 21, checkedAt: 'posse' }, 'CF art. 14 §3º VI "c"; Lei 9.504/97 art. 11 §2º'),
      deputado_federal: real({ age: 21, checkedAt: 'posse' }, 'CF art. 14 §3º VI "c"; Lei 9.504/97 art. 11 §2º'),
      governador: real({ age: 30, checkedAt: 'posse' }, 'CF art. 14 §3º VI "b"'),
      senador: real({ age: 35, checkedAt: 'posse' }, 'CF art. 14 §3º VI "a"'),
      presidente: real({ age: 35, checkedAt: 'posse' }, 'CF art. 14 §3º VI "a"'),
      vice_presidente: real({ age: 35, checkedAt: 'posse' }, 'CF art. 14 §3º VI "a"'),
    },
    seats: {
      alesp: real(94, 'CF art. 27 — triplo da representação federal até 36, mais 1 por deputado federal acima de 12 (36 + 58 = 94)'),
      camaraSP: real(70, 'LC 78/1993 — máximo de 70 deputados federais por estado'),
      senadoSP: real((year - 2030) % 8 === 0 ? 1 : 2, 'CF art. 46 §2º — renovação alternada de 1/3 e 2/3 a cada quatro anos (2026: 2/3; 2030: 1/3)'),
    },
    mandateYears: {
      deputado_estadual: real(4, 'CF art. 27 §1º'),
      deputado_federal: real(4, 'CF art. 44, parágrafo único'),
      senador: real(8, 'CF art. 46 §1º'),
      governador: real(4, 'CF art. 28'),
      presidente: real(4, 'CF art. 82'),
      vice_presidente: real(4, 'CF art. 82'),
    },
    proportional: PROPORTIONAL_RULES,
    maxConsecutiveTermsExecutive: real(2, 'CF art. 14 §5º'),
    stateElectorate: real(34_100_000, 'TSE — eleitorado do estado de SP em 2026 (mais de 34,1 milhões); mantido constante na projeção'),
    desincompatibilizacaoRules: [
      { cargo: 'Prefeito(a) para qualquer outro cargo', prazo: 'renúncia 6 meses antes', source: 'CF art. 14 §6º', status: 'REGRA_REAL' },
      { cargo: 'Secretário(a) municipal para governador, senador ou deputado', prazo: 'afastamento definitivo 6 meses antes', source: 'LC 64/90 art. 1º, III, "b", 3 (aplicado aos incisos V e VI) — confirmar jurisprudência do TSE', status: 'DERIVADA' },
      { cargo: 'Servidor comissionado (assessor) para qualquer cargo', prazo: 'afastamento 3 meses antes', source: 'LC 64/90 art. 1º, II, "l"', status: 'REGRA_REAL' },
      { cargo: 'Vereador(a) ou deputado(a) para outro cargo', prazo: 'não precisa se afastar', source: 'CF art. 14 §6º só alcança chefes do Executivo', status: 'REGRA_REAL' },
      { cargo: 'Ministro(a) de Estado para qualquer cargo', prazo: 'deixar o cargo 6 meses antes', source: 'LC 64/90 art. 1º, II, "a", 1', status: 'REGRA_REAL' },
      { cargo: 'Presidente para outro cargo', prazo: 'renúncia 6 meses antes', source: 'CF art. 14 §6º', status: 'REGRA_REAL' },
      { cargo: 'Presidente para a reeleição', prazo: 'não precisa sair', source: 'CF art. 14 §5º (EC 16/1997)', status: 'REGRA_REAL' },
    ],
  };
}

const genCache = new Map<number, GeneralRulePack>();
export function genRulepack(year: number): GeneralRulePack {
  if (!genCache.has(year)) genCache.set(year, buildGeneralRulepack(year));
  return genCache.get(year)!;
}

// Parâmetros de gameplay (fictícios) usados pelo simulador nesta versão.
export const GAMEPLAY = {
  actionPointsPerMonth: proposal(5, 'Compromissos de agenda por mês (parâmetro de jogo; era 3 até a v0.5)'),
  officePointsPerMonth: proposal({ assessor: 3, vereador: 4, secretario: 4, deputado_estadual: 4, deputado_federal: 4, senador: 4, secretario_estadual: 4, prefeito: 5, governador: 5, presidente: 6, vice_presidente: 4, ministro: 5 } as Record<string, number>, 'Agenda do cargo: compromissos extras só para ações do próprio cargo (os 5 compromissos pessoais ficam livres para o resto)'),
  validVoteRateProportional: proposal(0.62, 'Calibrado com SP 2024 (~5,8 mi votos válidos para ~9,3 mi eleitores)'),
  validVoteRateMajoritarian: proposal(0.6),
  legendVoteShare: proposal(0.08, 'Fração aproximada de votos de legenda; ajustável'),
  candidatePullShare: proposal(0.5, 'Efeito puxador: metade dos votos do jogador é voto novo para a lista (retirado das demais); a outra metade vem de dentro da própria lista'),
  ownFundsCapShareOfLimit: real(0.1, 'Lei 9.504/97 art. 23 §2º-A — autofinanciamento até 10% do limite de gastos'),
  assetMonthlyReturn: proposal(0.003, 'Valorização média mensal dos bens pessoais (parâmetro de jogo)'),
  debtMonthlyInterest: proposal(0.02, 'Juros mensais sobre dívida pessoal (parâmetro de jogo)'),
  cashReserveMonths: proposal(2, 'Meses de despesas mantidos em caixa antes de amortizar dívida'),
  spendingLimitVereadorSP: derived(2_423_000, 'Limite real de 2024 em SP (R$ 2.071.008,63, TSE Portaria 593/2024) corrigido pela inflação projetada do jogo (4% a.a.); o TSE divulga o de 2028 até 20/07/2028'),
  spendingLimitPrefeitoSP: derived(78_713_000, 'Limite real de 2024 em SP para o 1º turno (R$ 67.276.114,60) corrigido pela inflação projetada do jogo'),
  spendingLimitPrefeitoRunoffSP: derived(31_485_000, 'Limite real de 2024 em SP para o 2º turno (R$ 26.910.445,80) corrigido pela inflação projetada do jogo'),
  spendingLimitDepEstadual: derived(1_740_000, 'Limite nacional de 2022 para deputado estadual (R$ 1.270.629,01) corrigido pela inflação projetada do jogo (4% a.a.) até 2030; confirmar resolução TSE do ciclo'),
  spendingLimitDepFederal: derived(4_350_000, 'Limite nacional de 2022 para deputado federal (R$ 3.176.572,53) corrigido pela inflação projetada do jogo até 2030; confirmar resolução TSE do ciclo'),
  spendingLimitSenadorSP: proposal(12_000_000, 'Valor de jogo: o limite real para senador é fixado pelo TSE por estado a cada ciclo'),
  spendingLimitPresidente: proposal(88_944_030, 'Referência: limite do 1º turno para presidente em 2022 (TSE, R$ 88,9 mi); o valor de cada ciclo é fixado pelo TSE e não foi atualizado aqui'),
  spendingLimitGovernadorSP: proposal(60_000_000, 'Valor de jogo: o limite real para governador é fixado pelo TSE por estado a cada ciclo'),
  deputyStateReach: proposal({ deputado_estadual: 0.75, deputado_federal: 0.7 }, 'Multiplicador dos votos do jogador fora da capital (base eleitoral concentrada na cidade de SP)'),
};
