// Simulação das eleições municipais. O cálculo de cadeiras/turnos usa as regras reais (rules/*);
// a geração dos votos é um modelo de gameplay (PROPOSTA), agregado e fictício.

import { GAMEPLAY, RULEPACK_BR_2028_MUN as RP } from '../data/rulepack';
import { PARTIES, allListIds, listIdForParty, listMembers, listName, partyById } from '../data/parties';
import { SAO_PAULO } from '../data/world';
import { allocateProportional, type PropList } from '../rules/proportional';
import { firstRound, runoff } from '../rules/majoritarian';
import { checkEligibility, isEligible } from '../rules/eligibility';
import { next, normal, pareto, type RngState } from '../rng';
import { monthToIso } from '../calendar';
import { ballotName, fictionalName, randomBirthDate } from './names';
import type { ElectionRecord, GameState, RaceCandidate } from './types';
import { digitalScore } from './social';
import { apportion } from '../util/apportion';
import { conventionVote } from './partyorg';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

/** Força relativa de cada partido no município (base: bancadas eleitas + momento). */
export function partyStrength(state: GameState, partyId: string): number {
  const seats = state.government.councilSeatsByParty[partyId] ?? 0;
  const m = state.parties[partyId]?.momentum ?? 0;
  return Math.max(0.05, (seats + 0.6) * (1 + m));
}

export function listStrength(state: GameState, listId: string): number {
  return listMembers(listId).reduce((s, id) => s + partyStrength(state, id), 0);
}

/** Pontuação 0..100 da candidatura do jogador (PROPOSTA). */
export function playerElectoralScore(state: GameState): number {
  const a = state.character.attributes;
  const p = state.player;
  const c = p.candidacy;
  const spent = c ? c.account.spent : 0;
  const moneyScore = Math.min(18, Math.log10(1 + spent / 1000) * 6);
  const mandateBonus = p.mandate && (p.mandate.office === 'vereador' || p.mandate.office === 'prefeito') ? 6 : 0;
  const score =
    0.32 * p.recognition +
    0.22 * p.base +
    0.12 * a.popularity +
    0.06 * a.communication +
    0.05 * a.charisma +
    (c ? Math.min(22, c.campaignPoints * 0.9) : 0) +
    moneyScore +
    digitalScore(state.player.social) +
    mandateBonus -
    (c ? c.irregularities * 4 : 0);
  return clamp(score);
}

export function estimateVereadorVotes(score: number): number {
  const valid = SAO_PAULO.electorate * GAMEPLAY.validVoteRateProportional.value;
  const share = 0.00002 * Math.exp(Math.min(95, score) / 12.5);
  return Math.round(valid * share);
}

// ---------- Convenção ----------

export function resolveConvention(state: GameState, rng: RngState): { approved: boolean; text: string } {
  const c = state.player.candidacy;
  if (!c || !state.player.partyId) return { approved: false, text: '' };
  return conventionVote(state, rng, c.office === 'prefeito' ? 'prefeito' : 'vereador');
}

export function runEligibility(state: GameState) {
  const c = state.player.candidacy!;
  return checkEligibility({
    office: c.office,
    birthDate: state.character.birthDate,
    brazilian: true,
    politicalRightsOk: true,
    domicileMunicipalityId: state.character.municipalityId,
    domicileSince: state.character.domicileSince,
    targetMunicipalityId: SAO_PAULO.id,
    filiationDate: state.player.filiationDate,
    consecutiveTermsSameOffice: c.office === 'prefeito' ? state.player.consecutiveTermsPrefeito : 0,
    chosenInConvention: c.status === 'aprovada_convencao' || c.status === 'registrada',
  }, RP);
}

export function previewEligibility(state: GameState, office: 'vereador' | 'prefeito') {
  return checkEligibility({
    office,
    birthDate: state.character.birthDate,
    brazilian: true,
    politicalRightsOk: true,
    domicileMunicipalityId: state.character.municipalityId,
    domicileSince: state.character.domicileSince,
    targetMunicipalityId: SAO_PAULO.id,
    filiationDate: state.player.filiationDate,
    consecutiveTermsSameOffice: office === 'prefeito' ? state.player.consecutiveTermsPrefeito : 0,
    chosenInConvention: true,
  }, RP).filter((c) => c.id !== 'convencao');
}

export { isEligible };

// ---------- Eleição proporcional ----------

export function simulateCouncil(state: GameState, rng: RngState): { record: Pick<ElectionRecord, 'proportional' | 'playerCandidateId' | 'playerVotes' | 'candidatePartyById'>; } {
  // Total de votos válidos (nominais + legenda) da eleição: é a restrição que nunca pode ser violada.
  const valid = Math.round(SAO_PAULO.electorate * GAMEPLAY.validVoteRateProportional.value * (1 + normal(rng, 0, 0.01)));
  const listIds = allListIds();
  const strengths = listIds.map((id) => listStrength(state, id) * Math.max(0.3, 1 + normal(rng, 0, 0.12)));
  const listVotes = apportion(valid, strengths);
  const playerRunning = state.player.candidacy?.office === 'vereador' && state.player.candidacy.status === 'registrada';
  const playerList = playerRunning ? listIdForParty(state.player.partyId!) : null;
  const pIdx = playerList ? listIds.indexOf(playerList) : -1;
  let playerVotes = 0;
  if (playerRunning) {
    const desired = Math.round(estimateVereadorVotes(playerElectoralScore(state)) * Math.max(0.5, 1 + normal(rng, 0, 0.15)));
    // Efeito "puxador" (PROPOSTA): parte dos votos do jogador é voto novo para a lista, retirado das demais listas.
    const pull = Math.round(desired * GAMEPLAY.candidatePullShare.value);
    const others = listVotes.map((v, i) => (i === pIdx ? 0 : v));
    const taken = apportion(Math.min(pull, valid - listVotes[pIdx]), others);
    for (let i = 0; i < listVotes.length; i++) if (i !== pIdx) listVotes[i] -= taken[i];
    listVotes[pIdx] += taken.reduce((x, y) => x + y, 0);
    // O jogador não pode ter mais votos nominais do que a própria lista comporta.
    const nominalCap = Math.round(listVotes[pIdx] * (1 - GAMEPLAY.legendVoteShare.value) * 0.9);
    playerVotes = Math.min(desired, nominalCap);
  }
  // Vereadores em exercício concorrem à reeleição (premissa da simulação), com peso pela votação anterior.
  const incumbents = state.government.councillors.filter((c) => c.id !== 'character_player');

  const candidatePartyById: Record<string, string> = {};
  const lists: PropList[] = listIds.map((listId, i) => {
    const legend = Math.round(listVotes[i] * GAMEPLAY.legendVoteShare.value);
    const nominal = listVotes[i] - legend;
    const members = listMembers(listId);
    const inc = incumbents.filter((c) => members.includes(c.partyId));
    const size = strengths[i] > 3 ? SAO_PAULO.councilSeats + 1 : Math.max(12, Math.round(20 + strengths[i] * 8));
    const nNew = Math.max(0, Math.min(SAO_PAULO.councilSeats + 1 - (i === pIdx ? 1 : 0), size) - inc.length);
    const pool: { id: string; name: string; birthDate: string | null; birthPrecision?: 'exata' | 'ano' | 'estimada'; partyId: string; w: number }[] = [];
    for (const c of inc) {
      // Data de nascimento: exata, só o ano ou estimada (marcada); null se não houver.
      pool.push({ id: c.id, name: c.name, birthDate: c.birthDate ?? null, birthPrecision: c.birthPrecision ?? undefined, partyId: c.partyId, w: Math.min(12, 3 + c.votes / 12000) * (0.7 + next(rng) * 0.5) });
    }
    for (let k = 0; k < nNew; k++) {
      // Em federação, o candidato pertence a um dos partidos, com peso pela força de cada um no município.
      const ws = members.map((id) => partyStrength(state, id));
      let roll = next(rng) * ws.reduce((a, b) => a + b, 0);
      let partyId = members[members.length - 1];
      for (let j = 0; j < members.length; j++) { roll -= ws[j]; if (roll <= 0) { partyId = members[j]; break; } }
      pool.push({ id: `cand_${listId}_${k}`, name: ballotName(rng), birthDate: randomBirthDate(rng, 1955, 2004), partyId, w: Math.min(12, pareto(rng, 1.7)) * (0.85 + next(rng) * 0.3) });
    }
    // Votos nominais dos demais candidatos = nominal da lista menos os do jogador (soma exata).
    const othersNominal = nominal - (i === pIdx ? playerVotes : 0);
    const split = apportion(othersNominal, pool.map((c) => c.w));
    const candidates = pool.map((c, k) => {
      candidatePartyById[c.id] = c.partyId;
      return { id: c.id, name: c.name, votes: split[k], birthDate: c.birthDate, birthPrecision: c.birthPrecision };
    });
    if (i === pIdx) {
      candidatePartyById['character_player'] = state.player.partyId!;
      candidates.push({ id: 'character_player', name: state.character.name, votes: playerVotes, birthDate: state.character.birthDate, birthPrecision: 'exata' });
    }
    return { listId, label: listName(listId), legendVotes: legend, candidates };
  });

  const result = allocateProportional(lists, {
    seats: SAO_PAULO.councilSeats,
    nominalMinPhase1: RP.proportional.nominalMinPhase1.value,
    partyMinPhase2: RP.proportional.partyMinPhase2.value,
    candidateMinPhase2: RP.proportional.candidateMinPhase2.value,
    phase3OpenToAllParties: RP.proportional.phase3OpenToAllParties.value,
  });
  return { record: { proportional: result, playerCandidateId: playerRunning ? 'character_player' : null, playerVotes: playerRunning ? playerVotes : null, candidatePartyById } };
}

// ---------- Eleição majoritária ----------

/** Cria a disputa de prefeito (pré-candidatos), persistente para as pesquisas. A IA lança nomes das 5 maiores agremiações e de 2 pequenas. */
export function createMayorRace(state: GameState, rng: RngState): RaceCandidate[] {
  const ranked = allListIds().map((id) => ({ id, s: listStrength(state, id) })).sort((a, b) => b.s - a.s);
  const runners = [...ranked.slice(0, 5), ...ranked.slice(8, 10)];
  return runners.map((r) => ({
    id: `mayor_${r.id}`,
    name: fictionalName(rng),
    label: listName(r.id),
    partyId: listMembers(r.id)[0],
    listId: r.id,
    baseStrength: Math.pow(r.s, 1.1) * Math.max(0.4, 1 + normal(rng, 0, 0.22)),
    birthDate: randomBirthDate(rng, 1958, 1990),
    isPlayer: false,
    followers: Math.round(Math.pow(10, 4 + next(rng) * 2.3)),
  }));
}

function playerInMayorRace(state: GameState): boolean {
  const c = state.player.candidacy;
  return !!c && c.office === 'prefeito' && ['pretendida', 'aprovada_convencao', 'registrada'].includes(c.status);
}

/** Candidatos ativos e força atual de cada um. */
export function activeMayorField(state: GameState): (RaceCandidate & { strength: number })[] {
  const race = state.mayorRace ?? [];
  const playerIn = playerInMayorRace(state);
  const c = state.player.candidacy;
  const official = playerIn && c!.status !== 'pretendida';
  const coalition = new Set(playerIn ? [state.player.partyId!, ...c!.coalitionPartyIds] : []);
  const coalitionLists = new Set([...coalition].map(listIdForParty));
  const playerList = playerIn ? listIdForParty(state.player.partyId!) : null;
  const out: (RaceCandidate & { strength: number })[] = [];
  for (const r of race) {
    if (official && coalitionLists.has(r.listId)) continue; // aliados não lançam candidato próprio
    if (playerIn && !official && r.listId !== playerList && coalitionLists.has(r.listId)) continue;
    const m = listMembers(r.listId).reduce((s, id) => s + (state.parties[id]?.momentum ?? 0), 0) / listMembers(r.listId).length;
    out.push({ ...r, strength: r.baseStrength * (1 + m) });
  }
  if (playerIn) {
    const score = playerElectoralScore(state);
    const coalitionStrength = [...coalition].reduce((s, id) => s + partyStrength(state, id), 0);
    out.push({
      id: 'character_player', name: state.character.name,
      label: [...coalition].map((id) => partyById(id)!.acronym).join(' / '),
      partyId: state.player.partyId!, listId: playerList!, birthDate: state.character.birthDate, isPlayer: true, baseStrength: 0,
      strength: Math.pow(coalitionStrength, 1.05) * (0.3 + 0.85 * Math.pow(score / 100, 1.5)),
    });
  }
  return out;
}

export function currentMayorShares(state: GameState) {
  const field = activeMayorField(state);
  const total = field.reduce((s, c) => s + c.strength, 0) || 1;
  return field.map((c) => ({ id: c.id, name: c.name, label: c.label, share: c.strength / total }));
}

export function simulateMayor(state: GameState, rng: RngState) {
  if (!state.mayorRace) state.mayorRace = createMayorRace(state, rng);
  const field = activeMayorField(state).map((c) => ({ ...c, strength: c.strength * Math.max(0.6, 1 + normal(rng, 0, 0.07)) }));
  const valid = Math.round(SAO_PAULO.electorate * GAMEPLAY.validVoteRateMajoritarian.value);
  const mv = apportion(valid, field.map((c) => c.strength));
  const cands = field.map((c, i) => ({ ...c, votes: mv[i] }));
  const r1 = firstRound(cands, SAO_PAULO.electorate, RP.runoffElectorateThreshold.value);
  let r2 = null;
  if (r1.needsRunoff && r1.runoffIds) {
    const [a, b] = r1.runoffIds.map((id) => cands.find((c) => c.id === id)!);
    const rest = cands.filter((c) => c.id !== a.id && c.id !== b.id).reduce((s, c) => s + c.votes, 0);
    const wa = a.strength * Math.max(0.5, 1 + normal(rng, 0, 0.1));
    const wb = b.strength * Math.max(0.5, 1 + normal(rng, 0, 0.1));
    const va = Math.round(a.votes + rest * 0.85 * (wa / (wa + wb)));
    const vb = Math.round(b.votes + rest * 0.85 * (wb / (wa + wb)));
    r2 = runoff([{ ...a, votes: va }, { ...b, votes: vb }]);
  }
  const winnerId = r2 ? r2.winnerId : r1.winnerId;
  const winner = cands.find((c) => c.id === winnerId)!;
  return { r1, r2, winner, field: cands };
}

export function electionDateIso(): string {
  return RP.electionDate.value;
}

export function dateOfMonth(state: GameState): string {
  return monthToIso(state.month, 15);
}

export { PARTIES };
