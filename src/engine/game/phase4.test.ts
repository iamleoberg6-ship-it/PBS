import { describe, expect, it } from 'vitest';
import { createGame } from './create';
import { advanceMonth } from './turn';
import { resolveEvent } from './events';
import { REGIONS, SP_POP_2022, regionPop, regionWeights } from '../data/regions';
import {
  attackOpponent, campaignFactor, distributeVotes, enrichMayorPoll, initPlan, judgeAccounts, mayorRegionalShares, spendingLimit, visitRegion,
} from './campaign';
import { demandChance, fulfillDemand, hireAsStaff, staffBossOptions, staffMonthlyStep } from './assessor';
import { makeMayorPoll } from './polls';
import { createMayorRace } from './elections';
import { pressureOf } from './secretariat';
import { loadSave, serialize } from './save';
import { availableActions } from './actions';
import { PLAYER } from './relations';
import type { GameState } from './types';

const base = { name: 'T', birthDate: '1988-01-01', gender: 'x', education: 's', bio: '', attributeBonus: { articulation: 15, communication: 15 } };
const mk = (seed = 1, party = 'party_real_mdb') => createGame({ ...base, profession: 'advogado', startStatus: 'militante', startPartyId: party, seed });
function candidate(s: GameState, office: 'vereador' | 'prefeito' = 'vereador') {
  s.player.candidacy = { office, status: 'registrada', checks: [], coalitionPartyIds: [], campaignPoints: 10, account: { fefc: 500000, donations: 0, ownFunds: 0, spent: 0 }, irregularities: 0 };
  s.player.candidacy.plan = initPlan(s);
  return s;
}

describe('Fase 4 — território', () => {
  it('8 regiões somam a população do Censo 2022 e os pesos somam 1', () => {
    expect(REGIONS.length).toBe(8);
    expect(REGIONS.reduce((a, r) => a + r.subprefeituras.length, 0)).toBe(32);
    expect(REGIONS.reduce((a, r) => a + regionPop(r), 0)).toBe(SP_POP_2022);
    const w = regionWeights();
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });
  it('fator territorial: ~1 sem trabalho regional, sobe com agenda e lideranças, cai com ataques', () => {
    const s = candidate(mk(2));
    const f0 = campaignFactor(s);
    expect(f0).toBeGreaterThan(0.85);
    expect(f0).toBeLessThan(1.3);
    for (const r of REGIONS.slice(0, 2)) visitRegion(s, s.rng, r.id);
    const f1 = campaignFactor(s);
    expect(f1).toBeGreaterThan(f0);
    for (let i = 0; i < 6; i++) attackOpponent(s, s.rng);
    expect(campaignFactor(s)).toBeLessThan(f1);
  });
  it('votos por região somam o total e se concentram onde a campanha trabalhou', () => {
    const s = candidate(mk(3));
    for (let i = 0; i < 5; i++) visitRegion(s, s.rng, 'leste2');
    const d = distributeVotes(s, 25000);
    expect(Object.values(d).reduce((a, b) => a + b, 0)).toBe(25000);
    const w = regionWeights();
    expect(d.leste2 / 25000).toBeGreaterThan(w.leste2);
  });
  it('pesquisa de prefeito traz rejeição, conhecimento, avaliação do governo e cortes regionais normalizados', () => {
    const s = mk(4);
    s.month = { year: 2028, month: 5 };
    s.mayorRace = createMayorRace(s, s.rng);
    const p = makeMayorPoll(s, s.rng)!;
    enrichMayorPoll(s, s.rng, p);
    expect(Object.keys(p.rejection!).length).toBe(p.results.length);
    expect(p.govEval!.good + p.govEval!.bad + p.govEval!.regular).toBeCloseTo(1, 6);
    expect(Object.keys(p.byRegion!).length).toBe(8);
    const reg = mayorRegionalShares(s, p.results.map((r) => ({ id: r.id, name: r.name, share: r.share })));
    for (const r of REGIONS) expect(reg[r.id].reduce((a, x) => a + x.share, 0)).toBeCloseTo(1, 6);
  });
});

describe('Fase 4 — financiamento e contas', () => {
  it('limites de gasto derivados dos valores reais de 2024', () => {
    expect(spendingLimit('vereador')).toBeGreaterThan(2_071_008);
    expect(spendingLimit('prefeito')).toBeGreaterThan(67_276_114);
  });
  it('gasto acima do limite: multa de 100% do excesso e contas desaprovadas', () => {
    const s = candidate(mk(5));
    s.player.candidacy!.account.spent = spendingLimit('vereador') + 100000;
    const cash = s.finances.cash;
    const msg = judgeAccounts(s, s.rng)!;
    expect(msg).toContain('DESAPROVADAS');
    expect(cash - s.finances.cash).toBe(100000);
  });
  it('ações de campanha territorial aparecem durante a campanha', () => {
    const s = candidate(mk(6));
    s.month = { year: 2028, month: 8 };
    const ids = availableActions(s).map((a) => a.def.id);
    for (const id of ['corpo_a_corpo', 'comunicacao', 'lideranca_local', 'montar_equipe', 'pesquisa_interna', 'plano_campanha']) expect(ids).toContain(id);
  });
});

describe('Fase 4 — assessoria parlamentar', () => {
  it('assessor recebe demandas; entregar sobe a confiança; deixar vencer derruba', () => {
    const s = mk(7);
    const boss = staffBossOptions(s)[0].value;
    hireAsStaff(s, boss);
    const job = s.player.staff!;
    expect(job.demands.length).toBeGreaterThanOrEqual(1);
    const d = job.demands[0];
    expect(demandChance(s, d)).toBeGreaterThan(0.1);
    const t0 = job.trust;
    s.character.attributes[d.attr] = 100;
    job.contacts = 100;
    fulfillDemand(s, s.rng, d.id);
    expect(s.player.staff!.trust).not.toBe(t0);
    // Demandas vencidas
    const before = s.player.staff!.trust;
    s.player.staff!.demands.forEach((x) => (x.monthsLeft = 1));
    const notes = staffMonthlyStep(s, s.rng);
    if (s.player.staff) expect(s.player.staff.trust).toBeLessThan(before + 1);
    expect(notes.join(' ')).toMatch(/não entregues|^$/);
  });
  it('minuta redigida vira projeto da bancada do(a) chefe, com crédito ao jogador', () => {
    const s = mk(8);
    hireAsStaff(s, staffBossOptions(s)[0].value);
    s.player.staff!.demands = [{ id: 'x', kind: 'minuta', label: 'Redigir minuta', attr: 'politicalKnowledge', difficulty: 0, monthsLeft: 2, theme: 'saude' }];
    s.character.attributes.politicalKnowledge = 100;
    let msg = '';
    for (let i = 0; i < 5 && !msg.includes('protocolou'); i++) { s.player.staff!.demands = [{ id: `x${i}`, kind: 'minuta', label: 'Redigir minuta', attr: 'politicalKnowledge', difficulty: 0, monthsLeft: 2, theme: 'saude' }]; msg = fulfillDemand(s, s.rng, `x${i}`); }
    expect(msg).toContain('protocolou');
    const b = s.legislature.bills.find((x) => s.player.staff!.draftedBills.includes(x.id))!;
    expect(b.author).toBe(`bancada:${s.player.staff!.bossPartyId}`);
    expect(b.author).not.toBe(PLAYER);
  });
  it('promoção só aparece com confiança e entregas suficientes', () => {
    const s = mk(9);
    hireAsStaff(s, staffBossOptions(s)[0].value);
    expect(availableActions(s).find((a) => a.def.id === 'pedir_promocao')!.status).not.toBeNull();
    s.player.staff!.trust = 70; s.player.staff!.completed = 7;
    expect(availableActions(s).find((a) => a.def.id === 'pedir_promocao')!.status).toBeNull();
  });
  it('gabinete gera notas e continua ao longo dos meses', () => {
    let s = mk(10);
    hireAsStaff(s, staffBossOptions(s)[0].value);
    for (let i = 0; i < 3; i++) { while (s.pendingEvents.length) s = resolveEvent(s, 0); s = advanceMonth(s); }
    expect(s.player.staff === null || s.player.staff.demands.length > 0).toBe(true);
  }, 20_000);
});

describe('Fase 4 — balanceamento das secretarias e save', () => {
  it('pastas de alta cobrança têm pressão maior', () => {
    expect(pressureOf('saude')).toBeGreaterThan(pressureOf('cultura'));
    expect(pressureOf('educacao')).toBeGreaterThan(1);
  });
  it('save v6 migra para v7 com região de moradia e gabinete', () => {
    const s = mk(11);
    const raw = JSON.parse(serialize(s));
    delete raw.player.homeRegion;
    delete raw.player.staff;
    raw.player.job = 'assessor';
    raw.saveVersion = 6;
    const { state, report } = loadSave(JSON.stringify(raw));
    expect(report.migratedFrom).toBe(6);
    expect(REGIONS.map((r) => r.id)).toContain(state.player.homeRegion);
    expect(state.player.staff).not.toBeNull();
    expect(loadSave(serialize(state)).report.repairs).toEqual([]);
  });
});
