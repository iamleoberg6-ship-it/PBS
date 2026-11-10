import { describe, expect, it } from 'vitest';
import { createGame } from './create';
import { availableActions, performAction } from './actions';
import { campaignAreas, campaignFactor, currentPlan, distributeVotes, ensurePlan, isNationalCampaign } from './campaign';
import type { GameState } from './types';

const base = { name: 'T', birthDate: '1970-01-01', gender: 'x', education: 's', bio: '', attributeBonus: { management: 15, politicalKnowledge: 15, negotiation: 10 } };
const mk = () => createGame({ ...base, profession: 'medico', startStatus: 'militante', startPartyId: 'party_real_psd', seed: 9 });
const cand = (s: GameState, office: 'presidente' | 'vice_presidente' | 'prefeito' | 'deputado_federal') => {
  s.month = { year: 2030, month: 9 };
  s.player.candidacy = { office, year: 2030, status: 'registrada', checks: [], coalitionPartyIds: [], campaignPoints: 0, account: { fefc: 50_000_000, donations: 0, ownFunds: 0, spent: 0 }, irregularities: 0 };
  s.actionPoints = 5;
};

describe('Campanha presidencial — painel nacional', () => {
  it('o plano da presidencial usa as 5 grandes regiões, com peso pelo eleitorado', () => {
    const s = mk();
    cand(s, 'presidente');
    expect(isNationalCampaign(s)).toBe(true);
    const plan = ensurePlan(s)!;
    expect(Object.keys(plan.regions).sort()).toEqual(['br_centro_oeste', 'br_nordeste', 'br_norte', 'br_sudeste', 'br_sul']);
    const areas = campaignAreas(s);
    expect(areas.reduce((a, r) => a + r.weight, 0)).toBeCloseTo(1, 6);
    expect(areas.find((r) => r.id === 'br_sudeste')!.weight).toBeGreaterThan(0.4);
    const votes = distributeVotes(s, 1_000_000);
    expect(Object.values(votes).reduce((a, b) => a + b, 0)).toBe(1_000_000);
    expect(Object.keys(votes).every((k) => k.startsWith('br_'))).toBe(true);
  });
  it('ações de campanha oferecem regiões do país e o plano é refeito se o cargo muda', () => {
    const s = mk();
    cand(s, 'prefeito');
    expect(Object.keys(ensurePlan(s)!.regions).some((k) => k.startsWith('br_'))).toBe(false);
    s.player.candidacy!.office = 'presidente';
    expect(Object.keys(currentPlan(s)!.regions)[0].startsWith('br_')).toBe(true);
    const act = availableActions(s).find((a) => a.def.id === 'corpo_a_corpo');
    expect(act).toBeTruthy();
    expect(act!.def.params!(s).every((p) => p.value.startsWith('br_'))).toBe(true);
    const before = currentPlan(s)!.regions.br_nordeste.knowledge;
    const after = performAction(s, 'corpo_a_corpo', 'br_nordeste');
    expect(currentPlan(after)!.regions.br_nordeste.knowledge).toBeGreaterThan(before);
    expect(Number.isFinite(campaignFactor(after))).toBe(true);
  });
  it('vice de chapa também faz campanha nacional, mas não vai a debate', () => {
    const s = mk();
    cand(s, 'vice_presidente');
    expect(isNationalCampaign(s)).toBe(true);
    expect(availableActions(s).some((a) => a.def.id === 'debate')).toBe(false);
  });
});
