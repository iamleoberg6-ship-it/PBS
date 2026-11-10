// Partidos como organizações vivas (Plano §4): diretório municipal de São Paulo, executiva, facções
// simuladas, disputas internas por delegados, promessas e convenções.
// Tudo aqui é SIMULAÇÃO: dirigentes e facções são fictícios; a estrutura real de cada partido é
// definida pelo seu estatuto, que o jogo ainda não modela partido a partido (simplificação documentada).

import { addMonths, monthIndex, sameMonth } from '../calendar';
import { int, next, normal, pick, type RngState } from '../rng';
import { PARTIES, partyById, listIdForParty } from '../data/parties';
import { EXPERT_SCALE, generalPosition } from '../data/ideology';
import { newActor } from './actors';
import { PLAYER, adjustRel, rel, standing } from './relations';
import type { Faction, FactionType, GameState, InternalContest, PartyOrg, PlayerPartyRel } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

export const FACTION_LABEL: Record<FactionType, string> = {
  direcao: 'Grupo da direção',
  pragmatica: 'Ala pragmática',
  ideologica: 'Corrente programática',
  governista: 'Ala governista',
  oposicionista: 'Ala de oposição',
  regional: 'Grupo regional (zona leste)',
};

export const FACTION_TRAITS: Record<FactionType, string> = {
  direcao: 'Defende a estabilidade e quem já comanda o partido.',
  pragmatica: 'Quer cargos, recursos e vitórias; negocia com facilidade.',
  ideologica: 'Cobra coerência com o programa; desconfia de quem muda de posição.',
  governista: 'Quer o partido dentro do governo municipal.',
  oposicionista: 'Quer o partido na oposição à prefeitura.',
  regional: 'Defende a base territorial e lideranças de bairro.',
};

/** Mandato do diretório municipal: 2 anos (PROPOSTA; o prazo real varia conforme o estatuto de cada partido). */
export const DIRECTORATE_TERM_MONTHS = 24;
/** Filiação mínima para disputar cargo interno: 6 meses (PROPOSTA; depende do estatuto). */
export const MIN_MEMBERSHIP_MONTHS = 6;

export function defaultPartyRel(): PlayerPartyRel {
  return { internalPopularity: 0, leadershipTrust: 0, influence: 0, perceivedLoyalty: 50, mobilization: 0, disciplinary: 0, executiveRole: null };
}

function partySize(s: GameState, partyId: string): number {
  return s.government.councilSeatsByParty[partyId] ?? 0;
}

/** Cria a organização de cada partido em SP (determinística pela seed). */
export function buildPartyOrgs(s: GameState, rng: RngState): void {
  for (const p of PARTIES) {
    const seats = partySize(s, p.id);
    const inMayorBase = s.government.mayorCoalition.includes(p.id);
    const types: FactionType[] = seats >= 5 ? ['direcao', inMayorBase ? 'governista' : 'oposicionista', 'ideologica', 'regional']
      : seats >= 2 ? ['direcao', 'pragmatica', 'ideologica']
        : seats >= 1 ? ['direcao', 'pragmatica'] : ['direcao'];
    const raw = types.map((t) => (t === 'direcao' ? 0.45 : 0.2 + next(rng) * 0.25));
    const sum = raw.reduce((a, b) => a + b, 0);
    const factions: Faction[] = types.map((t, i) => {
      const leaderId = `actor_${p.id}_lider_${t}`;
      s.actors[leaderId] = newActor(rng, leaderId, i === 0 ? 'dirigente' : 'lider_faccao', p.id, { factionId: `fac_${p.id}_${t}` });
      return {
        id: `fac_${p.id}_${t}`, partyId: p.id, name: FACTION_LABEL[t], type: t, leaderId,
        share: raw[i] / sum, influence: int(rng, 35, 75),
        ideologyShift: t === 'ideologica' ? (pick(rng, [-1, 1]) as number) * 0.6 : t === 'pragmatica' ? 0 : normal(rng, 0, 0.2),
        mobilization: int(rng, 30, 70),
      };
    });
    const exec: { role: string; actorId: string }[] = [{ role: 'Presidência', actorId: factions[0].leaderId }];
    const roles = ['Vice-presidência', 'Secretaria-geral', 'Tesouraria'];
    roles.forEach((role, i) => {
      const f = factions[i + 1];
      const id = f ? f.leaderId : `actor_${p.id}_exec_${i}`;
      if (!f) s.actors[id] = newActor(rng, id, 'dirigente', p.id, { factionId: factions[0].id });
      exec.push({ role, actorId: id });
    });
    // Vereadores do partido entram no jogo interno com alinhamento SIMULADO a uma facção.
    for (const c of s.government.councillors) {
      if (c.partyId === p.id && s.actors[c.id]) s.actors[c.id].factionId = pick(rng, factions).id;
    }
    const org: PartyOrg = {
      partyId: p.id,
      directorate: {
        presidentId: factions[0].leaderId,
        executive: exec,
        delegates: 40 + seats * 12,
        members: Math.round((seats + 0.6) * 3500 * (0.8 + next(rng) * 0.4)),
        termEnds: addMonths(s.month, int(rng, 3, DIRECTORATE_TERM_MONTHS)),
      },
      factions,
      history: [],
    };
    s.partyOrgs[p.id] = org;
  }
}

/** Relação inicial do jogador com a direção e as facções, conforme afinidade ideológica e trajetória. */
export function seedPlayerPartyRelations(s: GameState, rng: RngState): void {
  const pid = s.player.partyId;
  if (!pid) return;
  const org = s.partyOrgs[pid];
  const pos = s.player.partyRel;
  for (const f of org.factions) {
    const fIdeo = (EXPERT_SCALE[pid]?.value ?? 5) + f.ideologyShift * 2;
    const myIdeo = generalPosition(s.character.ideology) ?? 5;
    const closeness = 1 - Math.min(1, Math.abs(fIdeo - myIdeo) / 5);
    adjustRel(s, f.leaderId, PLAYER, { trust: Math.round(pos.leadershipTrust * 0.5 + normal(rng, 0, 5)), affinity: Math.round((closeness - 0.5) * 30) });
  }
}

export function playerFaction(s: GameState): Faction | null {
  const pid = s.player.partyId;
  if (!pid) return null;
  const org = s.partyOrgs[pid];
  let best: Faction | null = null;
  let bestV = 15;
  for (const f of org.factions) {
    const v = standing(s, f.leaderId, PLAYER);
    if (v > bestV) { best = f; bestV = v; }
  }
  return best;
}

export function monthsAsMember(s: GameState): number {
  if (!s.player.filiationDate) return 0;
  const [y, m] = s.player.filiationDate.split('-').map(Number);
  return monthIndex(s.month) - (y * 12 + m - 1);
}

/** Por que o jogador NÃO pode disputar a presidência do diretório (null = pode). */
export function contestBlock(s: GameState, c: InternalContest): string | null {
  if (c.partyId !== s.player.partyId) return 'A disputa é de outro partido.';
  if (c.candidates.includes(PLAYER)) return 'Você já é candidato(a).';
  if (monthsAsMember(s) < MIN_MEMBERSHIP_MONTHS) return `Exige ${MIN_MEMBERSHIP_MONTHS} meses de filiação (regra de estatuto simulada).`;
  if (s.player.partyRel.disciplinary === 2) return 'Você está suspenso(a) pelo partido.';
  if (s.player.partyRel.influence < 25) return 'Influência interna precisa ser ≥ 25.';
  return null;
}

// ---------- Disputas internas ----------

export function openContests(s: GameState, rng: RngState): string[] {
  const notes: string[] = [];
  for (const org of Object.values(s.partyOrgs)) {
    const d = org.directorate;
    const opensAt = addMonths(d.termEnds, -3);
    if (!sameMonth(opensAt, s.month)) continue;
    if (s.contests.some((c) => c.partyId === org.partyId && c.status === 'aberta')) continue;
    const incumbent = d.presidentId;
    const candidates = [incumbent];
    // Lideranças ambiciosas desafiam a direção (o mundo se move sem o jogador).
    for (const f of org.factions) {
      const a = s.actors[f.leaderId];
      if (f.leaderId !== incumbent && a && (a.goal === 'presidir_diretorio' || (a.traits.ambition > 60 && next(rng) < 0.5))) candidates.push(f.leaderId);
    }
    if (candidates.length === 1 && org.factions.length > 1 && next(rng) < 0.35) candidates.push(pick(rng, org.factions.filter((f) => f.leaderId !== incumbent)).leaderId);
    const contest: InternalContest = { id: `ct_${org.partyId}_${monthIndex(s.month)}`, partyId: org.partyId, kind: 'presidencia_diretorio', decidesAt: { ...d.termEnds }, candidates, status: 'aberta' };
    s.contests.push(contest);
    if (org.partyId === s.player.partyId) notes.push(`Aberta a disputa pela presidência do diretório municipal (decisão em ${d.termEnds.month}/${d.termEnds.year}). Candidatos até agora: ${candidates.map((id) => s.actors[id]?.name).join(', ')}.`);
  }
  return notes;
}

/** Pontua o apoio de uma facção a um candidato (determinístico, sem ruído — o ruído entra na apuração). */
export function factionScore(s: GameState, f: Faction, candidateId: string, contest: InternalContest): number {
  if (candidateId === f.leaderId) return 1000;
  const org = s.partyOrgs[contest.partyId];
  let v = standing(s, f.leaderId, candidateId);
  if (f.type === 'direcao' && candidateId === org.directorate.presidentId) v += 20;
  if (candidateId === PLAYER) {
    const pr = s.player.partyRel;
    if (f.type === 'ideologica') v += (pr.perceivedLoyalty - 50) * 0.4;
    if (f.type === 'pragmatica') v += pr.influence * 0.25 + s.player.recognition * 0.15;
    if (f.type === 'regional') v += s.player.base * 0.3;
    if (f.type === 'governista') v += s.player.mandate?.stance === 'base' ? 15 : 0;
    if (f.type === 'oposicionista') v += s.player.mandate?.stance === 'oposicao' ? 15 : 0;
    const promised = s.promises.some((p) => p.status === 'aberta' && p.kind === 'vaga_executiva' && p.toActorId === f.leaderId && p.contestId === contest.id);
    if (promised) v += 30;
  } else {
    const a = s.actors[candidateId];
    v += (a?.influence ?? 30) * 0.2;
  }
  return v;
}

export function projectContest(s: GameState, c: InternalContest, rng?: RngState) {
  const org = s.partyOrgs[c.partyId];
  const D = org.directorate.delegates;
  const votes: Record<string, number> = Object.fromEntries(c.candidates.map((id) => [id, 0]));
  const byFaction: { factionId: string; candidateId: string; delegates: number }[] = [];
  let cohesiveTotal = 0;
  for (const f of org.factions) {
    let best = c.candidates[0];
    let bestV = -Infinity;
    for (const cand of c.candidates) {
      const v = factionScore(s, f, cand, c) + (rng ? normal(rng, 0, 6) : 0);
      if (v > bestV) { bestV = v; best = cand; }
    }
    const cohesive = Math.round(D * f.share * (0.55 + f.mobilization / 250));
    cohesiveTotal += cohesive;
    votes[best] += cohesive;
    byFaction.push({ factionId: f.id, candidateId: best, delegates: cohesive });
  }
  // Delegados não alinhados votam por popularidade interna e capacidade de mobilização.
  const free = Math.max(0, D - cohesiveTotal);
  const appeal = c.candidates.map((id) => (id === PLAYER ? 10 + s.player.partyRel.internalPopularity * 0.7 + s.player.partyRel.mobilization * 0.5 : 20 + (s.actors[id]?.influence ?? 30) * 0.6));
  const tot = appeal.reduce((a, b) => a + b, 0) || 1;
  const unaligned: Record<string, number> = {};
  c.candidates.forEach((id, i) => { const v = Math.round((free * appeal[i]) / tot); votes[id] += v; unaligned[id] = v; });
  return { votes, byFaction, unaligned };
}

/** Decide as disputas cujo prazo chegou. Retorna mensagens para o log do jogador. */
export function resolveContests(s: GameState, rng: RngState): string[] {
  const notes: string[] = [];
  for (const c of s.contests) {
    if (c.status !== 'aberta' || !sameMonth(c.decidesAt, s.month)) continue;
    const org = s.partyOrgs[c.partyId];
    const r = projectContest(s, c, rng);
    const winnerId = Object.entries(r.votes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    c.status = 'decidida';
    c.result = { winnerId, ...r };
    const prevPresident = org.directorate.presidentId;
    org.directorate.presidentId = winnerId;
    org.directorate.termEnds = addMonths(s.month, DIRECTORATE_TERM_MONTHS);
    const winnerName = winnerId === PLAYER ? s.character.name : s.actors[winnerId]?.name;
    org.history.push({ month: { ...s.month }, text: `${winnerName} venceu a disputa pela presidência do diretório (${r.votes[winnerId]} de ${org.directorate.delegates} delegados).` });
    // A facção vencedora ganha força; as derrotadas perdem um pouco.
    for (const bf of r.byFaction) {
      const f = org.factions.find((x) => x.id === bf.factionId)!;
      f.influence = clamp(f.influence + (bf.candidateId === winnerId ? 6 : -4));
    }
    if (c.partyId === s.player.partyId) notes.push(...applyContestToPlayer(s, c, prevPresident));
  }
  return notes;
}

function applyContestToPlayer(s: GameState, c: InternalContest, prevPresident: string): string[] {
  const notes: string[] = [];
  const res = c.result!;
  const org = s.partyOrgs[c.partyId];
  const pr = s.player.partyRel;
  const winner = res.winnerId;
  const supported = s.flags[`apoio_${c.id}`] as string | undefined;
  if (winner === PLAYER) {
    pr.executiveRole = 'Presidência';
    pr.leadershipTrust = 85;
    pr.influence = clamp(pr.influence + 25);
    org.directorate.executive = org.directorate.executive.filter((e) => e.role !== 'Presidência');
    org.directorate.executive.unshift({ role: 'Presidência', actorId: PLAYER });
    notes.push(`VOCÊ VENCEU a eleição para a presidência do diretório municipal com ${res.votes[PLAYER]} delegados.`);
    adjustRel(s, prevPresident, PLAYER, { trust: -20, affinity: -15 }, { kind: 'derrota_imposta', text: 'Perdeu a presidência do diretório para você', weight: 6 });
    // Promessas de vaga na executiva são cumpridas pela nova presidência.
    for (const p of s.promises.filter((x) => x.status === 'aberta' && x.kind === 'vaga_executiva' && x.contestId === c.id)) {
      p.status = 'cumprida';
      const idx = org.directorate.executive.findIndex((e) => e.role !== 'Presidência' && e.actorId !== p.toActorId);
      if (idx >= 0) org.directorate.executive[idx] = { role: org.directorate.executive[idx].role, actorId: p.toActorId };
      adjustRel(s, p.toActorId, PLAYER, { trust: 15, affinity: 8 }, { kind: 'promessa_cumprida', text: 'Recebeu a vaga prometida na executiva', weight: 5 });
      notes.push(`Promessa cumprida: ${s.actors[p.toActorId]?.name} entrou na executiva.`);
    }
  } else if (c.candidates.includes(PLAYER)) {
    pr.leadershipTrust = clamp(pr.leadershipTrust - 15);
    pr.influence = clamp(pr.influence + 4);
    adjustRel(s, winner, PLAYER, { trust: -10 }, { kind: 'ataque', text: 'Disputou a presidência contra ele(a)', weight: 3 });
    notes.push(`Você perdeu a disputa do diretório (${res.votes[PLAYER]} delegados contra ${res.votes[winner]} de ${s.actors[winner]?.name}). A nova direção desconfia de você.`);
    for (const p of s.promises.filter((x) => x.status === 'aberta' && x.contestId === c.id && x.kind === 'vaga_executiva')) p.status = 'caducou';
  } else if (supported) {
    if (supported === winner) {
      pr.influence = clamp(pr.influence + 8);
      pr.leadershipTrust = clamp(pr.leadershipTrust + 10);
      adjustRel(s, winner, PLAYER, { trust: 12, owed: 1 }, { kind: 'apoio', text: 'Apoiou na disputa do diretório', weight: 6 });
      if (!pr.executiveRole && rel(s, winner, PLAYER).owed >= 1) {
        pr.executiveRole = 'Vogal da executiva';
        notes.push('Seu candidato venceu e retribuiu: você ganhou uma vaga de vogal na executiva municipal.');
      } else notes.push('Seu candidato venceu a disputa do diretório. Sua influência cresceu.');
    } else {
      pr.leadershipTrust = clamp(pr.leadershipTrust - 8);
      notes.push(`Seu candidato perdeu a disputa do diretório para ${s.actors[winner]?.name}.`);
    }
  }
  // Promessas de apoio a candidato: verificadas pelo que o jogador fez.
  for (const p of s.promises.filter((x) => x.status === 'aberta' && x.kind === 'apoio_disputa' && x.contestId === c.id)) {
    const kept = supported === p.toActorId && !c.candidates.includes(PLAYER);
    p.status = kept ? 'cumprida' : 'quebrada';
    if (kept) adjustRel(s, p.toActorId, PLAYER, { trust: 10 }, { kind: 'promessa_cumprida', text: 'Cumpriu o apoio prometido', weight: 4 });
    else {
      adjustRel(s, p.toActorId, PLAYER, { trust: -40, affinity: -25 }, { kind: 'traicao', text: 'Prometeu apoio e não cumpriu', weight: 10 });
      pr.perceivedLoyalty = clamp(pr.perceivedLoyalty - 12);
      notes.push(`Você descumpriu a promessa de apoio a ${s.actors[p.toActorId]?.name}. Ele(a) vai lembrar disso.`);
    }
  }
  return notes;
}

// ---------- Convenção (escolha de candidaturas por delegados) ----------

export interface ConventionResult {
  approved: boolean;
  text: string;
  votes?: Record<string, number>;
  byFaction?: { factionId: string; candidateId: string; delegates: number }[];
}

const OFFICE_PT: Record<string, string> = { vereador: 'vereador(a)', prefeito: 'prefeito(a)', deputado_estadual: 'deputado(a) estadual', deputado_federal: 'deputado(a) federal', senador: 'senador(a)', governador: 'governador(a)', presidente: 'presidente da República', vice_presidente: 'vice-presidente da República' };

export function conventionVote(s: GameState, rng: RngState, office: string): ConventionResult {
  const pid = s.player.partyId!;
  const party = partyById(pid)!;
  const org = s.partyOrgs[pid];
  const pr = s.player.partyRel;
  const label = OFFICE_PT[office] ?? office;
  if (office === 'vice_presidente') return { approved: true, text: `Convenções homologaram a chapa presidencial com você como vice (acordo entre os partidos da chapa — Lei 9.504/97 art. 8º).` };
  if (office === 'vereador' || office === 'deputado_estadual' || office === 'deputado_federal') {
    // Lista de até vagas+1 nomes: a direção decide; facção aliada pode garantir a vaga.
    // Para deputado (PROPOSTA): a lista estadual é mais disputada; quem já tem mandato leva vantagem.
    const backing = Math.max(0, ...org.factions.map((f) => (standing(s, f.leaderId, PLAYER) > 20 ? f.share * 100 : 0)));
    const mandateBonus = s.player.mandate ? 10 : 0;
    const bar = office === 'vereador' ? 28 : office === 'deputado_estadual' ? 34 : 38;
    const score = pr.leadershipTrust * 0.8 + backing * 0.6 + s.player.recognition * 0.3 + pr.mobilization * 0.2 - pr.disciplinary * 20 + (office === 'vereador' ? 0 : mandateBonus);
    const approved = score + normal(rng, 0, 8) >= bar;
    return {
      approved,
      text: approved
        ? `Convenção do ${party.acronym} aprovou sua candidatura a ${label}.`
        : `Convenção do ${party.acronym} não incluiu seu nome na lista de ${label}: faltou confiança da direção ou apoio de alguma facção.`,
    };
  }
  if (org.directorate.presidentId === PLAYER && office === 'prefeito') return { approved: true, text: `Como presidente do diretório, você garantiu a candidatura a ${label} na convenção do ${party.acronym}.` };
  // Majoritária: disputa de delegados contra o nome preferido da direção.
  const rival = (office === 'prefeito' ? s.mayorRace?.find((r) => r.listId === listIdForParty(pid))?.name : null) ?? 'nome indicado pela direção';
  const pseudo: InternalContest = { id: `conv_${pid}_${s.month.year}`, partyId: pid, kind: 'presidencia_diretorio', decidesAt: { ...s.month }, candidates: [PLAYER, org.directorate.presidentId], status: 'aberta' };
  const r = projectContest(s, pseudo, rng);
  // O jogador pré-candidato ganha peso extra se aparece bem nas pesquisas.
  const lastPoll = s.polls[s.polls.length - 1];
  const myPoll = lastPoll?.results.find((x) => x.id === PLAYER)?.share ?? 0;
  r.votes[PLAYER] += Math.round(org.directorate.delegates * myPoll * 0.8);
  // Cargos estaduais (PROPOSTA): a direção estadual exige nome conhecido; mandato e reconhecimento pesam.
  if (office === 'governador' || office === 'senador') {
    const weight = (s.player.recognition - 45) / 100 + (s.player.mandate ? 0.12 : -0.15);
    r.votes[PLAYER] = Math.max(0, Math.round(r.votes[PLAYER] * (1 + weight)));
  }
  const approved = r.votes[PLAYER] > r.votes[org.directorate.presidentId];
  return {
    approved,
    votes: r.votes,
    byFaction: r.byFaction,
    text: approved
      ? `Convenção do ${party.acronym} escolheu você para ${label}: ${r.votes[PLAYER]} delegados contra ${r.votes[org.directorate.presidentId]} do grupo que apoiava ${rival}.`
      : `Convenção do ${party.acronym} preferiu ${rival}: ${r.votes[org.directorate.presidentId]} delegados contra ${r.votes[PLAYER]} seus.`,
  };
}

// ---------- Dinâmica mensal e disciplina ----------

export function partyMonthlyStep(s: GameState, rng: RngState): string[] {
  const notes: string[] = [];
  notes.push(...resolveContests(s, rng));
  notes.push(...openContests(s, rng));
  // Facções: mobilização e influência oscilam; participação se ajusta lentamente.
  for (const org of Object.values(s.partyOrgs)) {
    for (const f of org.factions) {
      f.mobilization = clamp(f.mobilization + normal(rng, 0, 2));
      f.influence = clamp(f.influence + normal(rng, 0, 1.5));
      f.share = Math.max(0.05, f.share * (1 + (f.mobilization - 50) / 2000));
    }
    const sum = org.factions.reduce((a, f) => a + f.share, 0);
    for (const f of org.factions) f.share = f.share / sum;
  }
  // Indicadores do jogador voltam devagar ao equilíbrio quando não há atividade.
  const pr = s.player.partyRel;
  if (s.player.partyId) {
    pr.internalPopularity = clamp(pr.internalPopularity - (pr.internalPopularity > 20 ? 0.6 : 0.2));
    pr.mobilization = clamp(pr.mobilization - 0.8);
    pr.perceivedLoyalty = clamp(pr.perceivedLoyalty + (50 - pr.perceivedLoyalty) * 0.02);
    // Processo disciplinar: baixa fidelidade percebida + direção desconfiada.
    if (pr.perceivedLoyalty < 18 && pr.leadershipTrust < 20 && pr.executiveRole !== 'Presidência' && next(rng) < 0.25) {
      s.pendingEvents.push({ templateId: 'processo_disciplinar', vars: {} });
    }
  }
  return notes;
}
