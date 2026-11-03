// Filiação, desfiliação e troca de partido.
import { monthIndex, monthToIso } from '../calendar';
import { partyById } from '../data/parties';
import type { GameState } from './types';
import { PROFESSIONS } from './create';
import { ideologicalDistance, partyIdeology } from '../data/ideology';
import { defaultPartyRel, seedPlayerPartyRelations } from './partyorg';
import { PLAYER, adjustRel } from './relations';

const mi = (y: number, m: number) => y * 12 + (m - 1);

/** Janela partidária para vereadores: 30 dias antes do prazo de filiação, no último ano do mandato (Lei 9.096/95 art. 22-A, III). */
export function inPartyWindowForCouncillor(s: GameState): boolean {
  return monthIndex(s.month) === mi(2032, 3);
}

export function partyChangeBlock(s: GameState, targetId: string | null): string | null {
  if (targetId && targetId === s.player.partyId) return 'Você já é filiado(a) a este partido.';
  if (s.player.mandate?.office === 'vereador' && !inPartyWindowForCouncillor(s)) {
    return 'Mandato proporcional pertence ao partido: sair fora da janela partidária (março de 2032) sem justa causa leva à perda do mandato (Lei 9.096/95 art. 22-A).';
  }
  return null;
}

export function changeParty(state: GameState, targetId: string | null, opts: { expelled?: boolean } = {}): GameState {
  if (!opts.expelled && partyChangeBlock(state, targetId)) return state;
  const s: GameState = structuredClone(state);
  const date = monthToIso(s.month, 15);
  const prev = s.player.partyId;
  for (const h of s.player.partyHistory) if (h.to === null) h.to = date;
  if (s.player.candidacy && s.player.candidacy.status !== 'pretendida') {
    s.log.push({ month: { ...s.month }, kind: 'eleicao', text: 'Ao trocar de partido, sua candidatura foi cancelada.' });
    s.player.candidacy = null;
  } else if (s.player.candidacy) {
    s.player.candidacy = null;
  }
  if (s.player.job === 'assessor') {
    s.player.job = 'profissao';
    s.finances.monthlyIncome = PROFESSIONS[s.character.profession].income;
    s.log.push({ month: { ...s.month }, kind: 'acao', text: 'Você deixou o cargo de assessor ao sair do partido.' });
  }
  if (prev && s.partyOrgs[prev]) {
    // A direção do partido que você deixou lembra da saída.
    adjustRel(s, s.partyOrgs[prev].directorate.presidentId, PLAYER, { trust: -15, affinity: -10 }, { kind: 'ataque', text: 'Deixou o partido', weight: 4 });
    s.partyOrgs[prev].directorate.executive = s.partyOrgs[prev].directorate.executive.filter((e) => e.actorId !== PLAYER);
    if (s.partyOrgs[prev].directorate.presidentId === PLAYER) s.partyOrgs[prev].directorate.presidentId = s.partyOrgs[prev].factions[0].leaderId;
    for (const pr of s.promises) if (pr.status === 'aberta') pr.status = 'caducou';
  }
  if (targetId) {
    s.player.partyId = targetId;
    s.player.filiationDate = date;
    const d = ideologicalDistance(s.character.ideology, partyIdeology(targetId));
    // Quem chega de outro partido começa com pouca confiança e fidelidade percebida mais baixa.
    s.player.partyRel = { ...defaultPartyRel(), leadershipTrust: Math.max(0, Math.round(8 + (d === null ? 0 : 8 - d * 30))), internalPopularity: 5, influence: 3, perceivedLoyalty: prev ? 40 : 50 };
    seedPlayerPartyRelations(s, s.rng);
    s.player.partyHistory.push({ partyId: targetId, from: date, to: null });
    s.log.push({ month: { ...s.month }, kind: 'partido', text: `Você se filiou ao ${partyById(targetId)!.acronym}${prev ? ` (saindo do ${partyById(prev)!.acronym})` : ''}. Filiação registrada em ${date}.` });
  } else {
    s.player.partyId = null;
    s.player.filiationDate = null;
    s.player.partyRel = defaultPartyRel();
    s.log.push({ month: { ...s.month }, kind: 'partido', text: opts.expelled ? `Você foi expulso(a) do ${partyById(prev!)!.acronym}.` : `Você se desfiliou do ${partyById(prev!)!.acronym}.` });
  }
  return s;
}
