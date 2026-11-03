import { describe, expect, it } from 'vitest';
import { createGame } from './create';
import { simulateCouncil, simulateMayor, createMayorRace } from './elections';
import { apportion } from '../util/apportion';
import { allocateProportional } from '../rules/proportional';
import type { GameState } from './types';

const base = { name: 'T', birthDate: '1990-01-01', gender: 'x', education: 's', bio: '', attributeBonus: {} };
function candidate(s: GameState, office: 'vereador' | 'prefeito', strength: number) {
  s.player.recognition = strength; s.player.base = strength;
  s.player.candidacy = { office, status: 'registrada', checks: [], coalitionPartyIds: [], campaignPoints: strength / 3, account: { fefc: 0, donations: 0, ownFunds: 0, spent: strength * 10000 }, irregularities: 0 };
}
const sumAll = (r: NonNullable<ReturnType<typeof simulateCouncil>['record']['proportional']>) => r.lists.reduce((x, l) => x + l.totalVotes, 0);

describe('apportion (maiores restos)', () => {
  it('soma exata e proporcional', () => {
    const out = apportion(1001, [1, 1, 1]);
    expect(out.reduce((a, b) => a + b, 0)).toBe(1001);
    expect(Math.max(...out) - Math.min(...out)).toBeLessThanOrEqual(1);
    expect(apportion(10, [0, 0])).toEqual([10, 0]);
  });
});

describe('Fase 0-A: conservação de votos na eleição proporcional', () => {
  for (const [label, party, prof, strength] of [
    ['partido grande, jogador forte', 'party_real_pt', 'influenciador', 95],
    ['partido pequeno, jogador forte', 'party_real_novo', 'influenciador', 95],
    ['partido nanico, jogador médio', 'party_real_pco', 'professor', 50],
    ['sem candidatura do jogador', 'party_real_mdb', 'professor', 0],
  ] as const) {
    it(label, () => {
      for (let seed = 1; seed <= 8; seed++) {
        const s = createGame({ ...base, profession: prof, startStatus: 'filiado', startPartyId: party, seed });
        if (strength > 0) candidate(s, 'vereador', strength);
        const rng = { ...s.rng };
        const out = simulateCouncil(s, rng).record;
        const r = out.proportional!;
        // 1) Votos apurados = soma de nominais + legenda de todas as listas.
        expect(sumAll(r)).toBe(r.validVotes);
        // 2) Total dentro da faixa esperada (sem inflar com os votos do jogador).
        expect(r.validVotes).toBeGreaterThan(5_600_000);
        expect(r.validVotes).toBeLessThan(5_960_000);
        // 3) Votos do jogador nunca excedem os nominais da própria lista.
        if (strength > 0) {
          const pl = r.lists.find((l) => l.listId === (party === 'party_real_pt' ? 'fed_febrasil' : party))!;
          expect(out.playerVotes!).toBeLessThanOrEqual(pl.nominalVotes);
        }
        // 4) 55 eleitos, sem duplicidade.
        expect(r.elected).toHaveLength(55);
        expect(new Set(r.elected.map((e) => e.candidateId)).size).toBe(55);
        // 5) Nenhum eleito na 1ª fase abaixo de 10% do QE; nas sobras 80/20, abaixo de 20%.
        for (const e of r.elected) {
          if (e.phase === 'QP') expect(e.candidateVotes).toBeGreaterThanOrEqual(r.nominalMinPhase1Votes);
          if (e.phase === 'SOBRAS_80_20') expect(e.candidateVotes).toBeGreaterThanOrEqual(r.candidateMinPhase2Votes);
        }
        // 6) Cadeiras por lista na 1ª fase nunca passam do QP.
        for (const l of r.lists) expect(l.seatsQP).toBeLessThanOrEqual(l.partyQuotient);
      }
    });
  }
});

describe('Fase 0-A: majoritário', () => {
  it('soma dos votos dos candidatos = votos válidos', () => {
    const s = createGame({ ...base, profession: 'professor', startStatus: 'filiado', startPartyId: 'party_real_psd', seed: 4 });
    s.mayorRace = createMayorRace(s, s.rng);
    const m = simulateMayor(s, s.rng);
    expect(m.field.reduce((a, c) => a + c.votes, 0)).toBe(m.r1.validVotes);
  });
});

describe('Fase 0-D: desempate sem data de nascimento', () => {
  it('usa fallback identificado na auditoria', () => {
    const r = allocateProportional([
      { listId: 'A', label: 'A', legendVotes: 0, candidates: [{ id: 'x', name: 'X', votes: 500, birthDate: null }, { id: 'y', name: 'Y', votes: 500, birthDate: '1960-01-01' }] },
    ], { seats: 1, nominalMinPhase1: 0.1, partyMinPhase2: 0.8, candidateMinPhase2: 0.2, phase3OpenToAllParties: true });
    expect(r.audit.some((a) => a.text.includes('fallback'))).toBe(true);
  });
});
