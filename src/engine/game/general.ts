// Eleições gerais e mundo estadual/federal (Fase 5.5).
//
// REGRA REAL usada: cadeiras (Alesp 94, Câmara SP 70 — CF art. 27; LC 78/93), renovação do Senado
// (1/3 em 2030, 2/3 em 2034 — CF art. 46 §2º), maioria absoluta e 2º turno para governador e presidente
// (CF arts. 28 e 77), sistema proporcional (Código Eleitoral arts. 106–111, mesmo motor da Câmara Municipal),
// datas de posse (EC 111/2021: presidente 5/1, governador 6/1).
// DADOS REAIS (fatos públicos de 2026): presidente, governador e senadores em exercício e bancadas eleitas em 2026.
// SIMPLIFICAÇÃO/FICÇÃO: a partir de 2030 todos os candidatos majoritários são personagens fictícios — o jogo
// não decide se pessoas reais vão concorrer, nem quem venceria. Os votos são gerados por modelo de gameplay.

import { rememberVotes } from './careers';
import { GAMEPLAY, genRulepack } from '../data/rulepack';
import { PARTIES, allListIds, listIdForParty, listMembers, listName, partyById } from '../data/parties';
import { allocateProportional, type PropList } from '../rules/proportional';
import { firstRound, runoff, type MajRoundResult } from '../rules/majoritarian';
import { ideologicalDistance, partyIdeology } from '../data/ideology';
import { next, normal, pareto, type RngState } from '../rng';
import { apportion } from '../util/apportion';
import { ballotName, fictionalName, randomBirthDate } from './names';
import { campaignFactor } from './campaign';
import { estimateVereadorVotes, playerElectoralScore } from './elections';
import { PLAYER } from './relations';
import { genCycle, mi } from './cycle';
import type { GameState, GeneralElectionRecord, RaceCandidate, StateHolder, StateWorld } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

export const STATE_SOURCES = {
  alesp: 'Alesp — composição eleita em 04/10/2026 (PL 27, PT 16, PSOL 9, PSD 9, Podemos 6, Republicanos 6, MDB 5, PP 5, União 4, PSB 3, Missão 1, PSDB 1, Novo 1, PRD 1)',
  camara: 'Bancada paulista eleita em 2026 (PL 19, Fed. PT-PCdoB-PV 11, Podemos 6, PSD 6, Republicanos 6, PSOL 6, MDB 4, PP 3, União 2, Novo 2, PSB 2, PRD 1, PSDB 1, Missão 1). As 11 vagas da federação ficaram com o PT (Metrópoles, 05/10/2026; Orlando Silva, do PCdoB, não se reelegeu).',
  vereadores2026: 'Câmara Municipal de SP (05/10/2026): Lucas Pavanato, Sargento Nantes, Ana Carolina Oliveira, Luna Zarattini, Sidney Cruz e Dra. Sandra Tadeu eleitos deputados federais; Thammy Miranda, Marina Bragante e Keit Lima, deputados estaduais. Carlos Bezerra Jr. (suplente em exercício) também foi eleito, mas não consta da composição de 2024 usada pelo jogo. Os suplentes que assumem no jogo são personagens fictícios do mesmo partido.',
  executivos: 'TSE 2026: Lula (PT) reeleito presidente; Tarcísio de Freitas (Republicanos) reeleito governador no 1º turno; Guilherme Derrite (PP) e André do Prado (PL) eleitos senadores; Marcos Pontes (PL) tem mandato até janeiro de 2031.',
};

const pid = (acr: string) => PARTIES.find((p) => p.acronym === acr)!.id;

export function initStateWorld(): StateWorld {
  const seats = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [pid(k), v]));
  return {
    president: { id: 'real_pres_lula', name: 'Luiz Inácio Lula da Silva', partyId: pid('PT'), real: true, since: 2027, until: 2030, consecutiveTerms: 2 },
    governor: { id: 'real_gov_tarcisio', name: 'Tarcísio de Freitas', partyId: pid('REPUBLICANOS'), real: true, since: 2027, until: 2030, consecutiveTerms: 2 },
    senators: [
      { id: 'real_sen_pontes', name: 'Marcos Pontes', partyId: pid('PL'), real: true, since: 2023, until: 2030, consecutiveTerms: 1 },
      { id: 'real_sen_derrite', name: 'Guilherme Derrite', partyId: pid('PP'), real: true, since: 2027, until: 2034, consecutiveTerms: 1 },
      { id: 'real_sen_andre', name: 'André do Prado', partyId: pid('PL'), real: true, since: 2027, until: 2034, consecutiveTerms: 1 },
    ],
    alespSeats: seats({ PL: 27, PT: 16, PSOL: 9, PSD: 9, PODE: 6, REPUBLICANOS: 6, MDB: 5, PP: 5, 'UNIÃO': 4, PSB: 3, 'MISSÃO': 1, PSDB: 1, NOVO: 1, PRD: 1 }),
    camaraSeats: seats({ PL: 19, PT: 11, PODE: 6, PSD: 6, REPUBLICANOS: 6, PSOL: 6, MDB: 4, PP: 3, 'UNIÃO': 2, NOVO: 2, PSB: 2, PRD: 1, PSDB: 1, 'MISSÃO': 1 }),
    governorApproval: 55,
    presidentApproval: 48,
    governorCoalition: [pid('REPUBLICANOS'), pid('PL'), pid('PSD'), pid('PP'), pid('UNIÃO'), pid('MDB'), pid('PODE')],
    presidentCoalition: [pid('PT'), pid('PCdoB'), pid('PV'), pid('PSB'), pid('PSOL'), pid('REDE'), pid('PDT')],
    // Vereadores de SP eleitos deputados em 04/10/2026 (fato público, Câmara Municipal de SP): saem na posse.
    pendingDepartures: [
      ...['lucas_pavanato', 'sargento_nantes', 'ana_carolina_oliveira', 'luna_zarattini', 'sidney_cruz', 'dra_sandra_tadeu'].map((id) => ({ councillorId: `real_ver_${id}`, office: 'deputado_federal' as const, posseMonth: mi(2027, 2), real2026: true })),
      ...['thammy_miranda', 'marina_bragante', 'keit_lima'].map((id) => ({ councillorId: `real_ver_${id}`, office: 'deputado_estadual' as const, posseMonth: mi(2027, 3), real2026: true })),
    ],
    governorRace: null,
    senateRace: null,
    councillorRuns: [],
  };
}

// ---------------- Forças estaduais ----------------

/** Força de um partido no estado: bancada (Alesp + Câmara) e momento. PROPOSTA. */
export function stateStrength(s: GameState, partyId: string): number {
  const w = s.stateWorld;
  const seats = (w.alespSeats[partyId] ?? 0) / 94 + (w.camaraSeats[partyId] ?? 0) / 70;
  const m = s.parties[partyId]?.momentum ?? 0;
  return Math.max(0.03, (seats * 50 + 0.5) * (1 + m));
}
export function stateListStrength(s: GameState, listId: string): number {
  return listMembers(listId).reduce((a, id) => a + stateStrength(s, id), 0);
}

/** Alinhamento político entre dois partidos: 1 = mesmo partido/federação, 0 = adversários distantes. */
export function partyAlignment(a: string | null, b: string | null, coalition: string[] = []): number {
  if (!a || !b) return 0.3;
  if (listIdForParty(a) === listIdForParty(b)) return 1;
  if (coalition.includes(a)) return 0.8;
  const d = ideologicalDistance(partyIdeology(a), partyIdeology(b));
  return d === null ? 0.4 : clamp(1 - d * 2.2, 0, 0.7);
}

/** Alinhamento da prefeitura com Estado e União (afeta convênios e transferências voluntárias — PROPOSTA). */
export function cityAlignment(s: GameState): { governor: number; president: number } {
  const mayorParty = s.government.mayor.partyId;
  return {
    governor: partyAlignment(mayorParty, s.stateWorld.governor.partyId, s.stateWorld.governorCoalition),
    president: partyAlignment(mayorParty, s.stateWorld.president.partyId, s.stateWorld.presidentCoalition),
  };
}

// ---------------- Ambições da IA: vereadores candidatos a deputado ----------------

export interface CouncillorRun { id: string; office: 'deputado_estadual' | 'deputado_federal' }

/** Em março do ano de eleição geral, parte dos vereadores (IA) decide disputar a Assembleia ou a Câmara. Ficção de gameplay. */
export function pickCouncillorCandidates(s: GameState, rng: RngState): CouncillorRun[] {
  const out: CouncillorRun[] = [];
  const cs = s.government.councillors.filter((c) => c.id !== PLAYER && !c.real).sort((a, b) => b.votes - a.votes);
  cs.forEach((c, i) => {
    const p = i < 10 ? 0.22 : i < 25 ? 0.1 : 0.04;
    if (next(rng) < p) out.push({ id: c.id, office: next(rng) < 0.7 ? 'deputado_estadual' : 'deputado_federal' });
  });
  return out.slice(0, 9);
}

// ---------------- Corridas majoritárias ----------------

export function createStateRace(s: GameState, rng: RngState, kind: 'governador' | 'senador' | 'presidente'): RaceCandidate[] {
  const ranked = allListIds().map((id) => ({ id, s: stateListStrength(s, id) })).sort((a, b) => b.s - a.s);
  const n = kind === 'senador' ? 6 : kind === 'governador' ? 5 : 5;
  const runners = [...ranked.slice(0, n - 1), ranked[7] ?? ranked[n]];
  return runners.filter(Boolean).map((r) => ({
    id: `${kind}_${r.id}_${s.month.year}`,
    name: fictionalName(rng),
    label: listName(r.id),
    partyId: listMembers(r.id)[0],
    listId: r.id,
    baseStrength: Math.pow(r.s, 1.1) * Math.max(0.4, 1 + normal(rng, 0, 0.25)),
    birthDate: randomBirthDate(rng, kind === 'senador' ? 1955 : 1958, kind === 'senador' ? 1990 : 1994),
    isPlayer: false,
  }));
}

function playerMajStrength(s: GameState): number {
  const c = s.player.candidacy!;
  const coalition = [s.player.partyId!, ...c.coalitionPartyIds];
  const cs = coalition.reduce((a, id) => a + stateStrength(s, id), 0);
  const score = playerElectoralScore(s);
  // Fora da capital o jogador é menos conhecido: o reconhecimento pesa mais que na disputa municipal (PROPOSTA).
  return Math.pow(cs, 1.05) * (0.22 + 0.9 * Math.pow(score / 100, 1.7)) * Math.max(0.8, Math.min(1.25, campaignFactor(s)));
}

function activeField(s: GameState, race: RaceCandidate[], kind: 'governador' | 'senador'): (RaceCandidate & { strength: number })[] {
  const c = s.player.candidacy;
  const playerIn = !!c && c.office === kind && c.status === 'registrada';
  const coalitionLists = new Set(playerIn ? [s.player.partyId!, ...c!.coalitionPartyIds].map(listIdForParty) : []);
  const out = race
    .filter((r) => !(playerIn && coalitionLists.has(r.listId)))
    .map((r) => {
      const m = listMembers(r.listId).reduce((a, id) => a + (s.parties[id]?.momentum ?? 0), 0) / listMembers(r.listId).length;
      return { ...r, strength: r.baseStrength * (1 + m) };
    });
  if (playerIn) {
    out.push({ id: PLAYER, name: s.character.name, label: [s.player.partyId!, ...c!.coalitionPartyIds].map((id) => partyById(id)!.acronym).join(' / '), partyId: s.player.partyId!, listId: listIdForParty(s.player.partyId!), baseStrength: 0, birthDate: s.character.birthDate, isPlayer: true, strength: playerMajStrength(s) });
  }
  return out;
}

export function stateRaceShares(s: GameState, kind: 'governador' | 'senador') {
  const field = activeField(s, (kind === 'governador' ? s.stateWorld.governorRace : s.stateWorld.senateRace) ?? [], kind);
  const total = field.reduce((a, c) => a + c.strength, 0) || 1;
  return field.map((c) => ({ id: c.id, name: c.name, label: c.label, share: c.strength / total }));
}

// ---------------- Proporcional estadual ----------------

function playerDeputyVotes(s: GameState, rng: RngState, office: 'deputado_estadual' | 'deputado_federal'): number {
  const reach = GAMEPLAY.deputyStateReach.value[office];
  return Math.round(estimateVereadorVotes(playerElectoralScore(s)) * reach * campaignFactor(s) * Math.max(0.5, 1 + normal(rng, 0, 0.15)));
}

function simulateHouse(s: GameState, rng: RngState, house: 'alesp' | 'camara', runs: CouncillorRun[], candidatePartyById: Record<string, string>) {
  const rp = genRulepack(s.month.year);
  const seats = house === 'alesp' ? rp.seats.alesp.value : rp.seats.camaraSP.value;
  const office = house === 'alesp' ? 'deputado_estadual' : 'deputado_federal';
  const valid = Math.round(rp.stateElectorate.value * GAMEPLAY.validVoteRateProportional.value * (1 + Math.max(-0.02, Math.min(0.02, normal(rng, 0, 0.01)))));
  const listIds = allListIds();
  const strengths = listIds.map((id) => {
    const seatsNow = listMembers(id).reduce((a, p) => a + ((house === 'alesp' ? s.stateWorld.alespSeats : s.stateWorld.camaraSeats)[p] ?? 0), 0);
    const m = listMembers(id).reduce((a, p) => a + (s.parties[p]?.momentum ?? 0), 0) / listMembers(id).length;
    return Math.max(0.05, (seatsNow + 0.7) * (1 + m)) * Math.max(0.3, 1 + normal(rng, 0, 0.14));
  });
  const listVotes = apportion(valid, strengths);
  const c = s.player.candidacy;
  const playerRunning = !!c && c.office === office && c.status === 'registrada';
  const pIdx = playerRunning ? listIds.indexOf(listIdForParty(s.player.partyId!)) : -1;
  let playerVotes = 0;
  if (playerRunning) {
    const desired = playerDeputyVotes(s, rng, office);
    const pull = Math.round(desired * GAMEPLAY.candidatePullShare.value);
    const others = listVotes.map((v, i) => (i === pIdx ? 0 : v));
    const taken = apportion(Math.min(pull, valid - listVotes[pIdx]), others);
    for (let i = 0; i < listVotes.length; i++) if (i !== pIdx) listVotes[i] -= taken[i];
    listVotes[pIdx] += taken.reduce((a, b) => a + b, 0);
    playerVotes = Math.min(desired, Math.round(listVotes[pIdx] * (1 - GAMEPLAY.legendVoteShare.value) * 0.9));
  }
  const councillors = new Map(s.government.councillors.map((x) => [x.id, x]));
  const myRuns = runs.filter((r) => r.office === office);
  const lists: PropList[] = listIds.map((listId, i) => {
    const legend = Math.round(listVotes[i] * GAMEPLAY.legendVoteShare.value);
    const nominal = listVotes[i] - legend;
    const members = listMembers(listId);
    const listSeats = members.reduce((a, p) => a + ((house === 'alesp' ? s.stateWorld.alespSeats : s.stateWorld.camaraSeats)[p] ?? 0), 0);
    const size = Math.min(seats + 1, Math.max(12, Math.round(18 + listSeats * 3)));
    const pool: { id: string; name: string; birthDate: string | null; partyId: string; w: number }[] = [];
    for (const r of myRuns) {
      const cc = councillors.get(r.id);
      if (cc && members.includes(cc.partyId)) pool.push({ id: cc.id, name: cc.name, birthDate: cc.birthDate, partyId: cc.partyId, w: Math.min(14, 2.5 + cc.votes / 15000) * (0.7 + next(rng) * 0.6) });
    }
    while (pool.length < size - (i === pIdx ? 1 : 0)) {
      const ws = members.map((p) => stateStrength(s, p));
      let roll = next(rng) * ws.reduce((a, b) => a + b, 0);
      let partyId = members[members.length - 1];
      for (let j = 0; j < members.length; j++) { roll -= ws[j]; if (roll <= 0) { partyId = members[j]; break; } }
      pool.push({ id: `${house}_${listId}_${pool.length}`, name: ballotName(rng), birthDate: randomBirthDate(rng, 1950, 2004), partyId, w: Math.min(16, pareto(rng, 1.5)) * (0.85 + next(rng) * 0.3) });
    }
    const split = apportion(nominal - (i === pIdx ? playerVotes : 0), pool.map((x) => x.w));
    const candidates = pool.map((x, k) => { candidatePartyById[x.id] = x.partyId; return { id: x.id, name: x.name, votes: split[k], birthDate: x.birthDate }; });
    if (i === pIdx) {
      candidatePartyById[PLAYER] = s.player.partyId!;
      candidates.push({ id: PLAYER, name: s.character.name, votes: playerVotes, birthDate: s.character.birthDate });
    }
    return { listId, label: listName(listId), legendVotes: legend, candidates };
  });
  const result = allocateProportional(lists, {
    seats,
    nominalMinPhase1: rp.proportional.nominalMinPhase1.value,
    partyMinPhase2: rp.proportional.partyMinPhase2.value,
    candidateMinPhase2: rp.proportional.candidateMinPhase2.value,
    phase3OpenToAllParties: rp.proportional.phase3OpenToAllParties.value,
  });
  const runVotes = new Map<string, number>();
  for (const l of lists) for (const cand of l.candidates) if (myRuns.some((r) => r.id === cand.id)) runVotes.set(cand.id, cand.votes);
  return { result, playerVotes: playerRunning ? playerVotes : null, runVotes };
}

// ---------------- Majoritárias ----------------

function simulateMaj(_s: GameState, rng: RngState, field: (RaceCandidate & { strength: number })[], electorate: number) {
  const valid = Math.round(electorate * GAMEPLAY.validVoteRateMajoritarian.value);
  const noisy = field.map((c) => ({ ...c, strength: c.strength * Math.max(0.6, 1 + normal(rng, 0, 0.08)) }));
  const votes = apportion(valid, noisy.map((c) => c.strength));
  return noisy.map((c, i) => ({ ...c, votes: votes[i] }));
}

function resolveRunoff(rng: RngState, a: { id: string; name: string; label: string; votes: number; strength: number; birthDate: string }, b: typeof a, rest: number, boostA = 1, boostB = 1): MajRoundResult {
  const wa = a.strength * boostA * Math.max(0.5, 1 + normal(rng, 0, 0.1));
  const wb = b.strength * boostB * Math.max(0.5, 1 + normal(rng, 0, 0.1));
  return runoff([{ ...a, votes: Math.round(a.votes + rest * 0.85 * (wa / (wa + wb))) }, { ...b, votes: Math.round(b.votes + rest * 0.85 * (wb / (wa + wb))) }]);
}

/** Dia da eleição geral (1º turno). Retorna o registro e notas para o log. */
export function runGeneralElection(s: GameState, rng: RngState, runs: CouncillorRun[]): { record: GeneralElectionRecord; notes: string[] } {
  const year = s.month.year;
  const rp = genRulepack(year);
  const notes: string[] = [];
  const candidatePartyById: Record<string, string> = {};
  const alesp = simulateHouse(s, rng, 'alesp', runs, candidatePartyById);
  const camara = simulateHouse(s, rng, 'camara', runs, candidatePartyById);
  const el = rp.stateElectorate.value;
  const w = s.stateWorld;
  if (!w.governorRace) w.governorRace = createStateRace(s, rng, 'governador');
  if (!w.senateRace) w.senateRace = createStateRace(s, rng, 'senador');
  // Governador incumbente fictício em 1º mandato concorre à reeleição (premissa da simulação).
  const gField = activeField(s, w.governorRace, 'governador');
  if (!w.governor.real && !w.governor.isPlayer && w.governor.consecutiveTerms < 2) {
    const own = gField.find((r) => listIdForParty(r.partyId) === listIdForParty(w.governor.partyId));
    if (own) { own.name = w.governor.name; own.id = w.governor.id; own.strength *= 1 + (w.governorApproval - 45) / 80; }
  }
  const gCands = simulateMaj(s, rng, gField, el);
  const g1 = firstRound(gCands, el, 200000);
  const sField = activeField(s, w.senateRace, 'senador');
  const sCands = simulateMaj(s, rng, sField, el * (rp.seats.senadoSP.value === 2 ? 2 : 1));
  const senate = firstRound(sCands, el, Number.MAX_SAFE_INTEGER); // maioria simples (CF art. 46)
  const senateSeats = rp.seats.senadoSP.value;
  const senateWinners = senate.ranking.slice(0, senateSeats).map((r) => ({ id: r.id, name: r.name, partyId: sCands.find((c) => c.id === r.id)!.partyId, isPlayer: r.id === PLAYER }));
  senate.explanation = `Senado: eleição majoritária por maioria simples; ${senateSeats === 1 ? 'uma vaga (renovação de 1/3)' : 'duas vagas (renovação de 2/3 — cada eleitor vota em dois nomes)'}.`;
  // Presidente: simulação de fundo com candidatos fictícios (o jogador não disputa — escopo do jogo é SP).
  const presRace = createStateRace(s, rng, 'presidente');
  const pField = presRace.map((r) => ({ ...r, strength: r.baseStrength * (listIdForParty(r.partyId) === listIdForParty(w.president.partyId) ? 0.8 + w.presidentApproval / 100 : 1) }));
  const pCands = simulateMaj(s, rng, pField, 156_000_000);
  const p1 = firstRound(pCands, 156_000_000, 200000);
  let p2: MajRoundResult | null = null;
  if (p1.needsRunoff && p1.runoffIds) {
    const [a, b] = p1.runoffIds.map((id) => pCands.find((c) => c.id === id)!);
    p2 = resolveRunoff(rng, a, b, pCands.filter((c) => c !== a && c !== b).reduce((x, c) => x + c.votes, 0));
  }
  const pWin = pCands.find((c) => c.id === (p2 ? p2.winnerId : p1.winnerId))!;

  const c = s.player.candidacy;
  const office = c?.status === 'registrada' ? c.office : null;
  const record: GeneralElectionRecord = {
    year, alesp: alesp.result, camara: camara.result, senate, senateSeats, governorFirst: g1, governorRunoff: null,
    presidentFirst: p1, presidentRunoff: p2, candidatePartyById,
    playerOffice: office, playerVotes: null, playerElected: false,
    governorWinner: null, presidentWinner: { id: pWin.id, name: pWin.name, partyId: pWin.partyId }, senateWinners, councillorRuns: [], runoffPending: null,
  };
  for (const x of [...gCands, ...sCands]) candidatePartyById[x.id] = x.partyId;
  for (const r of runs) {
    const cc = s.government.councillors.find((x) => x.id === r.id);
    if (!cc) continue;
    const res = r.office === 'deputado_estadual' ? alesp : camara;
    const elected = (r.office === 'deputado_estadual' ? alesp.result : camara.result).elected.some((e) => e.candidateId === r.id);
    record.councillorRuns.push({ id: r.id, name: cc.name, partyId: cc.partyId, office: r.office, votes: res.runVotes.get(r.id) ?? 0, elected });
  }
  if (office === 'deputado_estadual' || office === 'deputado_federal') {
    const res = office === 'deputado_estadual' ? alesp : camara;
    record.playerVotes = res.playerVotes;
    record.playerElected = res.result.elected.some((e) => e.candidateId === PLAYER);
    notes.push(record.playerElected
      ? `VOCÊ FOI ELEITO(A) ${office === 'deputado_estadual' ? 'DEPUTADO(A) ESTADUAL' : 'DEPUTADO(A) FEDERAL'} com ${record.playerVotes!.toLocaleString('pt-BR')} votos!`
      : `Você teve ${record.playerVotes!.toLocaleString('pt-BR')} votos para ${office === 'deputado_estadual' ? 'a Alesp' : 'a Câmara dos Deputados'}, mas não foi eleito(a).`);
  }
  if (office === 'senador') {
    record.playerVotes = sCands.find((x) => x.id === PLAYER)?.votes ?? 0;
    record.playerElected = senateWinners.some((x) => x.isPlayer);
    notes.push(record.playerElected ? `VOCÊ FOI ELEITO(A) SENADOR(A) POR SÃO PAULO com ${record.playerVotes.toLocaleString('pt-BR')} votos!` : `Você teve ${record.playerVotes.toLocaleString('pt-BR')} votos para o Senado, mas não ficou entre os eleitos.`);
  }
  if (g1.needsRunoff && g1.runoffIds) {
    const [a, b] = g1.runoffIds.map((id) => gCands.find((x) => x.id === id)!);
    const rest = gCands.filter((x) => x !== a && x !== b).reduce((acc, x) => acc + x.votes, 0);
    const pick = (x: typeof a) => ({ id: x.id, name: x.name, label: x.label, partyId: x.partyId, votes: x.votes, strength: x.strength, birthDate: x.birthDate, isPlayer: x.isPlayer });
    if (a.isPlayer || b.isPlayer) {
      record.runoffPending = { a: pick(a), b: pick(b), rest };
      notes.push(`Governo de SP: você está no 2º turno contra ${a.isPlayer ? b.name : a.name}! Mais um mês de campanha.`);
    } else {
      record.governorRunoff = resolveRunoff(rng, a, b, rest);
      const win = record.governorRunoff.winnerId === a.id ? a : b;
      record.governorWinner = { id: win.id, name: win.name, partyId: win.partyId, isPlayer: false };
      if (office === 'governador') notes.push('Você não chegou ao 2º turno para governador.');
    }
  } else {
    const win = gCands.find((x) => x.id === g1.winnerId)!;
    record.governorWinner = { id: win.id, name: win.name, partyId: win.partyId, isPlayer: win.isPlayer };
    if (office === 'governador') { record.playerVotes = gCands.find((x) => x.isPlayer)?.votes ?? 0; record.playerElected = win.isPlayer; }
    if (win.isPlayer) notes.push('VOCÊ FOI ELEITO(A) GOVERNADOR(A) DE SÃO PAULO NO 1º TURNO!');
  }
  if (office === 'governador' && record.playerVotes === null) record.playerVotes = gCands.find((x) => x.isPlayer)?.votes ?? 0;
  notes.push(`Eleições gerais ${year} (simulação): ${record.governorWinner ? `${record.governorWinner.isPlayer ? 'você' : record.governorWinner.name} (${partyById(record.governorWinner.partyId)?.acronym}) eleito(a) governador(a)` : 'governo vai ao 2º turno'}; Senado: ${senateWinners.map((x) => `${x.isPlayer ? 'você' : x.name} (${partyById(x.partyId)?.acronym})`).join(', ')}; presidência: ${p2 ? '2º turno' : '1º turno'} — ${pWin.name} (${partyById(pWin.partyId)?.acronym}, personagem fictício) eleito(a).`);
  // Compactação do save: o mapa de partidos só precisa dos eleitos, do jogador e dos majoritários.
  const keep = new Set([...alesp.result.elected, ...camara.result.elected].map((e) => e.candidateId).concat([PLAYER], gCands.map((x) => x.id), sCands.map((x) => x.id)));
  record.candidatePartyById = Object.fromEntries(Object.entries(candidatePartyById).filter(([id]) => keep.has(id)));
  const runsElected = record.councillorRuns.filter((r) => r.elected);
  if (runsElected.length) notes.push(`${runsElected.length} vereador(es) de SP foram eleitos deputados: ${runsElected.map((r) => `${r.name} (${r.office === 'deputado_estadual' ? 'Alesp' : 'Câmara'})`).join(', ')}. Os suplentes assumem as vagas na Câmara Municipal na posse.`);
  if (record.playerVotes) rememberVotes(s, record.playerVotes, 'estado');
  return { record, notes };
}

export function resolveGovernorRunoff(s: GameState, rng: RngState): string | null {
  const rec = s.generalElections.find((e) => e.year === s.month.year);
  if (!rec?.runoffPending) return null;
  const { a, b, rest } = rec.runoffPending;
  const boost = (x: typeof a) => (x.isPlayer ? 1 + (s.player.candidacy?.campaignPoints ?? 0) / 180 + (s.character.attributes.negotiation - 50) / 260 - (s.player.candidacy?.irregularities ?? 0) * 0.05 : 1);
  rec.governorRunoff = resolveRunoff(rng, a, b, rest, boost(a), boost(b));
  const win = rec.governorRunoff.winnerId === a.id ? a : b;
  rec.governorWinner = { id: win.id, name: win.name, partyId: win.partyId, isPlayer: win.isPlayer };
  rec.playerElected = win.isPlayer;
  rec.playerVotes = rec.playerVotes ?? (a.isPlayer ? a.votes : b.votes);
  rec.runoffPending = null;
  return win.isPlayer ? 'VOCÊ VENCEU O 2º TURNO E FOI ELEITO(A) GOVERNADOR(A) DE SÃO PAULO!' : `${win.name} venceu o 2º turno para governador. Você não foi eleito(a).`;
}

/** Atualiza bancadas e executivos estaduais/federais após a eleição (aplicado nas datas de posse). */
export function applyGeneralResults(s: GameState, rec: GeneralElectionRecord, stage: 'executivos' | 'federal' | 'alesp') {
  const w = s.stateWorld;
  const tally = (elected: { candidateId: string; listId: string }[]) => {
    const out: Record<string, number> = {};
    for (const e of elected) { const p = rec.candidatePartyById[e.candidateId] ?? listMembers(e.listId)[0]; out[p] = (out[p] ?? 0) + 1; }
    return out;
  };
  if (stage === 'executivos') {
    if (rec.governorWinner) {
      const prev = w.governor;
      const same = !prev.real && prev.id === rec.governorWinner.id;
      w.governor = { id: rec.governorWinner.id, name: rec.governorWinner.isPlayer ? s.character.name : rec.governorWinner.name, partyId: rec.governorWinner.partyId, real: false, since: rec.year + 1, until: rec.year + 4, consecutiveTerms: same ? prev.consecutiveTerms + 1 : 1, isPlayer: rec.governorWinner.isPlayer };
      w.governorApproval = 55;
      w.governorCoalition = coalitionFor(s, rec.governorWinner.partyId, rec.alesp.elected.map((e) => rec.candidatePartyById[e.candidateId]));
    }
    if (rec.presidentWinner) {
      w.president = { id: rec.presidentWinner.id, name: rec.presidentWinner.name, partyId: rec.presidentWinner.partyId, real: false, since: rec.year + 1, until: rec.year + 4, consecutiveTerms: 1 };
      w.presidentApproval = 55;
      w.presidentCoalition = coalitionFor(s, rec.presidentWinner.partyId, []);
    }
  }
  if (stage === 'federal') {
    w.camaraSeats = tally(rec.camara.elected);
    const keep = w.senators.filter((x) => x.until > rec.year);
    w.senators = [...keep, ...rec.senateWinners.map((x) => ({ id: x.id, name: x.isPlayer ? s.character.name : x.name, partyId: x.partyId, real: false, since: rec.year + 1, until: rec.year + 8, consecutiveTerms: 1, isPlayer: x.isPlayer } as StateHolder))];
  }
  if (stage === 'alesp') w.alespSeats = tally(rec.alesp.elected);
}

function coalitionFor(_s: GameState, partyId: string, alespParties: string[]): string[] {
  const own = PARTIES.filter((p) => listIdForParty(p.id) === listIdForParty(partyId)).map((p) => p.id);
  const near = PARTIES.filter((p) => !own.includes(p.id) && partyAlignment(partyId, p.id) >= 0.5 && (alespParties.length === 0 || alespParties.includes(p.id))).map((p) => p.id);
  return [...own, ...near].slice(0, 8);
}

/** Avaliação simulada dos governos estadual e federal (passeio aleatório com reversão — PROPOSTA). */
export function stateWorldMonthly(s: GameState, rng: RngState) {
  const w = s.stateWorld;
  if (!w.governor.isPlayer) w.governorApproval = clamp(w.governorApproval + (50 - w.governorApproval) * 0.03 + normal(rng, 0, 1));
  w.presidentApproval = clamp(w.presidentApproval + (47 - w.presidentApproval) * 0.03 + normal(rng, 0, 1));
}

/** Gatilho de calendário para os mandatos estaduais: quem deixa o cargo e quando. */
export function generalTermEnd(office: string, electedYear: number): string {
  if (office === 'senador') return `${electedYear + 9}-01-31`;
  if (office === 'deputado_estadual') return `${electedYear + 5}-03-14`;
  if (office === 'deputado_federal') return `${electedYear + 5}-01-31`;
  return `${electedYear + 5}-01-05`; // governador: posse em 6/1 (EC 111/2021)
}

export const genCycleNow = (s: GameState) => genCycle(s.month.year * 12 + s.month.month - 1);
export { mi };
