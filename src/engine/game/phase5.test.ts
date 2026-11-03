import { describe, expect, it } from 'vitest';
import { createGame } from './create';
import { advanceMonth } from './turn';
import { eventById, resolveEvent } from './events';
import { genCycle, munCycle, munTerm, nextElection, mi } from './cycle';
import { buildGeneralRulepack, munRulepack } from '../data/rulepack';
import { applyGeneralResults, initStateWorld, runGeneralElection } from './general';
import { initPlan } from './campaign';
import { makePromise, promisesMonthlyStep, resolveCrisis, workOnPromise, councillorWindowSwitches } from './livingworld';
import { ACHIEVEMENTS, checkAchievements, computeEnding } from './endings';
import { performAction } from './actions';
import { createMayorRace, runEligibility } from './elections';
import { newMandate } from './careers';
import { loadSave, serialize } from './save';
import { PLAYER } from './relations';
import type { GameState, ImageCrisis } from './types';

const base = { name: 'T', birthDate: '1985-01-01', gender: 'x', education: 's', bio: '', attributeBonus: { articulation: 15, communication: 15 } };
const mk = (seed = 1, party = 'party_real_psd') => createGame({ ...base, profession: 'advogado', startStatus: 'militante', startPartyId: party, seed });
const run = (s: GameState, toYear: number, toMonth: number) => {
  while (!s.gameOver && s.month.year * 12 + s.month.month < toYear * 12 + toMonth) {
    while (s.pendingEvents.length) { const ev = s.pendingEvents[0]; const n = eventById(ev.templateId)?.options(s, ev.vars).length ?? 1; s = resolveEvent(s, ev.templateId.startsWith('convite') ? n - 1 : 0); }
    s = advanceMonth(s);
  }
  return s;
};

describe('Fase 5.4 — ciclos eleitorais e pacotes de regras', () => {
  it('ciclos municipais e gerais se alternam e a partida segue até 2036', () => {
    expect(munCycle(mi(2027, 1))).toBe(2028);
    expect(munCycle(mi(2029, 1))).toBe(2028);
    expect(munCycle(mi(2029, 2))).toBe(2032);
    expect(genCycle(mi(2031, 3))).toBe(2030);
    expect(genCycle(mi(2031, 4))).toBe(2034);
    expect(nextElection(mi(2028, 8))).toEqual({ year: 2030, kind: 'geral' });
    expect(nextElection(mi(2031, 1))).toEqual({ year: 2032, kind: 'municipal' });
    expect(munTerm(mi(2027, 5))).toEqual({ from: 2025, to: 2028 });
    expect(munTerm(mi(2033, 5))).toEqual({ from: 2033, to: 2036 });
  });
  it('pacotes 2032 e 2030/2034 aplicam a lei vigente (datas derivadas, posse pela EC 111)', () => {
    const m32 = munRulepack(2032);
    expect(m32.electionDate.value).toBe('2032-10-03');
    expect(m32.posseDate.value).toBe('2033-01-01');
    expect(m32.id).toBe('BR-2032-MUN-proj');
    const g30 = buildGeneralRulepack(2030);
    expect(g30.electionDate.value).toBe('2030-10-06');
    expect(g30.posse.presidente.value).toBe('2031-01-05');
    expect(g30.posse.governador.value).toBe('2031-01-06');
    expect(g30.seats.alesp.value).toBe(94);
    expect(g30.seats.camaraSP.value).toBe(70);
    expect(g30.seats.senadoSP.value).toBe(1);
    expect(buildGeneralRulepack(2034).seats.senadoSP.value).toBe(2);
    expect(g30.minAge.senador.value.age).toBe(35);
    expect(g30.minAge.governador.value.age).toBe(30);
  });
});

describe('Fase 5.5 — mundo estadual e eleições gerais', () => {
  it('estado inicial com dados reais de 2026 (Alesp 94, bancada federal 70)', () => {
    const w = initStateWorld();
    expect(Object.values(w.alespSeats).reduce((a, b) => a + b, 0)).toBe(94);
    expect(Object.values(w.camaraSeats).reduce((a, b) => a + b, 0)).toBe(70);
    expect(w.governor.name).toBe('Tarcísio de Freitas');
    expect(w.governor.consecutiveTerms).toBe(2);
    expect(w.senators).toHaveLength(3);
  });
  it('eleição geral preenche 94 + 70 vagas, Senado e governo; resultados viram bancadas na posse', () => {
    const s = mk(3);
    s.month = { year: 2030, month: 10 };
    const { record } = runGeneralElection(s, s.rng, []);
    expect(record.alesp.elected).toHaveLength(94);
    expect(record.camara.elected).toHaveLength(70);
    expect(record.senateWinners).toHaveLength(1);
    expect(record.presidentWinner).not.toBeNull();
    // Governador: ou venceu no 1º turno, ou houve 2º turno entre dois fictícios.
    expect(record.governorWinner).not.toBeNull();
    applyGeneralResults(s, record, 'alesp');
    expect(Object.values(s.stateWorld.alespSeats).reduce((a, b) => a + b, 0)).toBe(94);
    applyGeneralResults(s, record, 'executivos');
    expect(s.stateWorld.governor.real).toBe(false);
  });
  it('vereador forte pode se eleger deputado estadual e deixa a Câmara Municipal na posse', () => {
    let s = mk(5);
    s.month = { year: 2030, month: 9 };
    s.player.mandate = newMandate('vereador', '2029-01-01', '2032-12-31');
    s.government.councillors[0] = { ...s.government.councillors[0], id: PLAYER, name: s.character.name, partyId: s.player.partyId!, real: false };
    s.player.recognition = 80; s.player.base = 70; s.character.attributes.popularity = 70;
    s.player.candidacy = { office: 'deputado_estadual', year: 2030, status: 'registrada', checks: [], coalitionPartyIds: [], campaignPoints: 25, account: { fefc: 800000, donations: 0, ownFunds: 0, spent: 600000 }, irregularities: 0 };
    s.player.candidacy.plan = initPlan(s);
    s = advanceMonth(s); // outubro: eleição
    const rec = s.generalElections.find((e) => e.year === 2030)!;
    expect(rec.playerOffice).toBe('deputado_estadual');
    expect(rec.playerVotes).toBeGreaterThan(20000);
    if (rec.playerElected) {
      s = run(s, 2031, 4);
      expect(s.player.mandate?.office).toBe('deputado_estadual');
      expect(s.government.councillors.some((c) => c.id === PLAYER)).toBe(false);
      expect(s.player.mandate?.until).toBe('2035-03-14');
    }
  });
  it('desincompatibilização: prefeito que não renuncia até março tem o registro indeferido', () => {
    const s = mk(6);
    s.month = { year: 2030, month: 4 };
    s.player.mandate = newMandate('prefeito', '2029-01-01', '2032-12-31');
    s.player.candidacy = { office: 'senador', year: 2030, status: 'aprovada_convencao', checks: [], coalitionPartyIds: [], campaignPoints: 0, account: { fefc: 0, donations: 0, ownFunds: 0, spent: 0 }, irregularities: 0 };
    s.flags.cargoAbril_2030 = 'prefeito';
    const checks = runEligibility(s);
    expect(checks.find((c) => c.id === 'desincompatibilizacao')?.ok).toBe(false);
    expect(checks.find((c) => c.id === 'idade')?.label).toContain('35');
  });
  it('renúncia para concorrer: o vice assume e o registro fica livre do impedimento', () => {
    let s = mk(7);
    s.month = { year: 2030, month: 2 };
    s.player.mandate = newMandate('prefeito', '2029-01-01', '2032-12-31');
    s.government.mayor = { personId: PLAYER, name: s.character.name, partyId: s.player.partyId!, real: false };
    s.player.candidacy = { office: 'governador', year: 2030, status: 'pretendida', checks: [], coalitionPartyIds: [], campaignPoints: 0, account: { fefc: 0, donations: 0, ownFunds: 0, spent: 0 }, irregularities: 0 };
    s = performAction(s, 'renunciar_concorrer');
    expect(s.player.mandate).toBeNull();
    expect(s.government.mayor.personId).not.toBe(PLAYER);
    expect(s.flags.desincomp_2030).toBe(true);
  });
});

describe('Fase 5.1 — ambições da IA', () => {
  it('na janela, só vereadores fictícios trocam de partido', () => {
    const s = mk(8);
    const before = s.government.councillors.map((c) => `${c.id}:${c.partyId}`);
    councillorWindowSwitches(s, s.rng);
    const after = s.government.councillors.map((c) => `${c.id}:${c.partyId}`);
    expect(after).toEqual(before); // em 2027 todos são reais
    s.government.councillors = s.government.councillors.map((c, i) => (i < 30 ? { ...c, real: false } : c));
    for (let k = 0; k < 15; k++) councillorWindowSwitches(s, s.rng);
    const reals = s.government.councillors.filter((c) => c.real).map((c) => `${c.id}:${c.partyId}`);
    expect(reals).toEqual(before.slice(30));
  });
  it('prefeito(a) fictício(a) em 1º mandato disputa a reeleição', () => {
    const s = mk(9);
    s.month = { year: 2032, month: 3 };
    s.government.mayor = { personId: 'mayor_x', name: 'Fulana Prefeita', partyId: 'party_real_mdb', real: false };
    s.flags.mayorTerms = 1;
    const race = createMayorRace(s, s.rng);
    expect(race.some((r) => r.name === 'Fulana Prefeita' && r.label.includes('reeleição'))).toBe(true);
    s.flags.mayorTerms = 2;
    expect(createMayorRace(s, s.rng).some((r) => r.name === 'Fulana Prefeita')).toBe(false);
  });
});

describe('Fase 5.2 — crises de imagem', () => {
  const crisis = (s: GameState, truth: ImageCrisis['truth'], outletId = 'diariopaulistano'): ImageCrisis => {
    const c: ImageCrisis = { id: `t_${truth}`, targetId: PLAYER, targetName: 'T', topic: 'x', headline: 'Teste', truth, outletId, severity: 60, month: { ...s.month }, deadline: 99999, status: 'ativa', response: null, outcome: null, origin: 'teste' };
    s.crises.push(c);
    return c;
  };
  it('desmentir notícia falsa recupera imagem e derruba a credibilidade do veículo', () => {
    const s = mk(10);
    const p0 = s.character.attributes.popularity;
    const cred0 = s.outlets.find((o) => o.id === 'diariopaulistano')!.credibility;
    resolveCrisis(s, s.rng, crisis(s, 'falsa'), 'desmentir');
    expect(s.character.attributes.popularity).toBeGreaterThan(p0);
    expect(s.outlets.find((o) => o.id === 'diariopaulistano')!.credibility).toBeLessThan(cred0);
  });
  it('admitir algo verdadeiro custa popularidade mas aumenta a credibilidade pessoal; negar pode virar mentira exposta', () => {
    const s = mk(11);
    resolveCrisis(s, s.rng, crisis(s, 'verdadeira'), 'desculpas');
    expect(s.player.credibility).toBe(66);
    let caught = 0;
    for (let i = 0; i < 20; i++) { const t = mk(100 + i); resolveCrisis(t, t.rng, crisis(t, 'verdadeira'), 'desmentir'); if (Number(t.flags.mentirasExpostas ?? 0) > 0) caught++; }
    expect(caught).toBeGreaterThan(8);
  });
  it('crises aparecem ao longo da partida e só atingem o jogador ou personagens fictícios', () => {
    const s = run(mk(12), 2031, 1);
    const reals = new Set(s.government.councillors.filter((c) => c.real).map((c) => c.id));
    expect(s.crises.every((c) => c.targetId === PLAYER || !reals.has(c.targetId))).toBe(true);
    expect(s.crises.every((c) => !c.targetId.startsWith('real_'))).toBe(true);
  });
});

describe('Fase 5.3 — promessas públicas', () => {
  it('prefeito cumpre promessa com o caixa; promessa vencida vira quebrada e a região cobra', () => {
    const s = mk(13);
    s.player.mandate = newMandate('prefeito', '2029-01-01', '2032-12-31');
    s.month = { year: 2029, month: 3 };
    makePromise(s, s.rng, 'leste1|saude');
    makePromise(s, s.rng, 'sul2|educacao');
    const [a, b] = s.communityPromises;
    expect(a.dueMonth).toBe(mi(2032, 12));
    s.city.cash = 1000;
    workOnPromise(s, s.rng, a.id);
    workOnPromise(s, s.rng, a.id);
    expect(a.status).toBe('cumprida');
    s.month = { year: 2033, month: 1 };
    promisesMonthlyStep(s, s.rng);
    expect(b.status).toBe('quebrada');
    expect(s.player.regionalGoodwill!.sul2).toBeLessThan(0);
  });
});

describe('Fase 5.7 — conquistas, finais e save', () => {
  it('conquistas e final refletem a trajetória', () => {
    const s = mk(14);
    s.player.careerHistory.push({ office: 'Governador(a) de São Paulo', from: '2031-01', to: null, note: '' });
    checkAchievements(s);
    expect(s.achievements.some((a) => a.id === 'governador')).toBe(true);
    expect(computeEnding(s, 'fim').id).toBe('estadista');
    s.flags.cassado = true;
    expect(computeEnding(s, 'fim').id).toBe('cassado');
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(20);
  });
  it('partida completa vai até 2036 com 3 eleições municipais, 2 gerais e um desfecho', () => {
    const s = run(mk(15), 2040, 1);
    expect(s.gameOver).toBe(true);
    expect(s.month.year).toBe(2036);
    expect(s.elections.map((e) => e.year)).toEqual([2028, 2032, 2036]);
    expect(s.generalElections.map((e) => e.year)).toEqual([2030, 2034]);
    expect(s.ending).not.toBeNull();
    expect(s.flags.mesa_2033).toBe(true);
  }, 60_000);
  it('save v7 migra para v8 com o mundo estadual', () => {
    const s = mk(16);
    const raw = JSON.parse(serialize(s));
    raw.saveVersion = 7;
    delete raw.stateWorld; delete raw.generalElections; delete raw.crises; delete raw.outlets; delete raw.communityPromises; delete raw.achievements; delete raw.ending;
    const { state, report } = loadSave(JSON.stringify(raw));
    expect(state.stateWorld.governor.name).toBe('Tarcísio de Freitas');
    expect(state.outlets.length).toBeGreaterThan(5);
    expect(report.repairs.some((r) => r.includes('Fase 5'))).toBe(true);
  });
});
