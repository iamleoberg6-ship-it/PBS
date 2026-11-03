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

describe('Correções pós-Fase 5', () => {
  it('vereadores reais eleitos deputados em 2026 saem em fev/mar de 2027 e suplentes fictícios do mesmo partido assumem', () => {
    let s = mk(20);
    s = run(s, 2027, 4);
    const ids = s.government.councillors.map((c) => c.id);
    for (const id of ['real_ver_lucas_pavanato', 'real_ver_luna_zarattini', 'real_ver_keit_lima', 'real_ver_thammy_miranda']) expect(ids).not.toContain(id);
    expect(s.government.councillors).toHaveLength(55);
    expect(s.government.councillors.filter((c) => c.real)).toHaveLength(46);
    expect(s.government.councilSeatsByParty.party_real_pl).toBe(mk(20).government.councilSeatsByParty.party_real_pl);
  });
  it('vaquinha antes do registro fica retida e é liberada no registro; caixa dois vira irregularidade', () => {
    let s = mk(21);
    s.month = { year: 2028, month: 5 };
    s.player.candidacy = { office: 'vereador', year: 2028, status: 'pretendida', checks: [], coalitionPartyIds: [], campaignPoints: 0, account: { fefc: 0, donations: 0, ownFunds: 0, spent: 0 }, irregularities: 0 };
    s = performAction(s, 'vaquinha');
    expect(s.player.candidacy!.account.crowdPending).toBeGreaterThan(0);
    expect(s.player.candidacy!.account.donations).toBe(0);
    s.month = { year: 2028, month: 8 };
    s.player.candidacy!.status = 'registrada';
    s.character.attributes.negotiation = 60;
    s = performAction(s, 'jantar_arrecadacao', 'por_fora');
    expect(s.player.candidacy!.irregularities).toBe(1);
  });
});

describe('Trabalho de cargo sem desgaste', () => {
  it('ações de assessoria e de mandato não perdem rendimento ao repetir; ações de vida/campanha continuam perdendo', async () => {
    const { ACTIONS, usesFatigue } = await import('./actions');
    const byId = (id: string) => ACTIONS.find((a) => a.id === id)!;
    for (const id of ['cumprir_demanda', 'iniciativa_gabinete', 'atender_base', 'projeto_lei', 'zeladoria', 'acompanhar_programa', 'up_emenda', 'gov_programa']) expect(usesFatigue(byId(id)), id).toBe(false);
    for (const id of ['comunidade', 'redes', 'corpo_a_corpo', 'pre_campanha']) expect(usesFatigue(byId(id)), id).toBe(true);
  });
});

describe('Emendas com valores reais', () => {
  it('cota anual real e regra de metade para a saúde no Congresso', async () => {
    const { AMENDMENT_BUDGET, newUpper } = await import('./upper');
    expect(AMENDMENT_BUDGET.deputado_estadual).toBe(13);
    expect(AMENDMENT_BUDGET.deputado_federal).toBe(40);
    expect(AMENDMENT_BUDGET.senador).toBe(73);
    let s = mk(30);
    s.month = { year: 2031, month: 2 };
    s.player.mandate = { ...newMandate('deputado_federal', '2031-02-01', '2035-01-31'), upper: newUpper('deputado_federal') };
    s = performAction(s, 'up_emenda', 'leste1|educação|20');
    expect(s.player.mandate!.upper!.amendmentBudget).toBe(20);
    const before = s.player.mandate!.upper!.amendmentBudget;
    s = performAction(s, 'up_emenda', 'leste1|educação|1'); // passaria da metade fora da saúde: opção nem é oferecida
    expect(s.player.mandate!.upper!.amendmentBudget).toBe(before);
    s = performAction(s, 'up_emenda', 'leste1|saúde|20');
    expect(s.player.mandate!.upper!.amendmentBudget).toBe(0);
  });
});

describe('Outras fontes de recursos', () => {
  const dep = (seed: number, office: 'deputado_estadual' | 'deputado_federal', party: string) => {
    const s = mk(seed, party);
    s.month = { year: 2031, month: 2 };
    s.player.mandate = { ...newMandate(office, '2031-02-01', '2035-01-31') };
    return s;
  };
  it('indicações saem mais para a base do governo; bancada e comissão no Congresso', async () => {
    const { newUpper, requestIndication, claimBancada } = await import('./upper');
    let base = 0, opo = 0;
    for (let i = 0; i < 40; i++) {
      const a = dep(100 + i, 'deputado_estadual', 'party_real_republicanos'); a.player.mandate!.upper = newUpper('deputado_estadual');
      a.stateWorld.governor.partyId = 'party_real_republicanos';
      if (requestIndication(a, a.rng, 'leste1|saúde|5').includes('atendeu sua indicação')) base++;
      const b = dep(200 + i, 'deputado_estadual', 'party_real_psol'); b.player.mandate!.upper = newUpper('deputado_estadual');
      b.stateWorld.governor.partyId = 'party_real_republicanos';
      if (requestIndication(b, b.rng, 'leste1|saúde|5').includes('atendeu sua indicação')) opo++;
    }
    expect(base).toBeGreaterThan(opo);
    const f = dep(300, 'deputado_federal', 'party_real_pl'); f.player.mandate!.upper = newUpper('deputado_federal');
    claimBancada(f, f.rng, 'sul1|saúde');
    expect(f.player.mandate!.upper!.amendments.some((a) => a.kind === 'bancada' && a.value > 0)).toBe(true);
  });
  it('esquema com emendas gera dinheiro e acaba em investigação', async () => {
    const { newUpper, amendmentScheme, schemeInvestigation } = await import('./upper');
    const s = dep(400, 'deputado_estadual', 'party_real_pl'); s.player.mandate!.upper = newUpper('deputado_estadual');
    s.player.mandate!.upper!.amendments.push({ region: 'leste1', theme: 'saúde', value: 13, month: { ...s.month }, paid: false, kind: 'individual' });
    const cash = s.finances.cash;
    amendmentScheme(s, s.rng, 'bolso');
    expect(s.finances.cash).toBeGreaterThan(cash + 500_000);
    for (let i = 0; i < 6; i++) amendmentScheme(s, s.rng, 'caixa');
    let months = 0;
    while (!s.flags.esquemaInvestigado && months++ < 400) schemeInvestigation(s, s.rng);
    expect(s.flags.esquemaInvestigado).toBe(true);
    expect(s.crises.some((c) => c.topic === 'esquema' && c.truth === 'verdadeira')).toBe(true);
  });
});

describe('Votações do mês', () => {
  it('deputado recebe matérias todo mês, o voto tem consequência e quem não vota segue a bancada', async () => {
    const { newUpper } = await import('./upper');
    const { setFloorVote } = await import('./pauta');
    let s = mk(500, 'party_real_pl');
    s.month = { year: 2031, month: 4 };
    s.player.mandate = { ...newMandate('deputado_estadual', '2031-03-15', '2035-03-14'), upper: newUpper('deputado_estadual') };
    s = advanceMonth(s);
    const open = s.floorVotes.filter((v) => !v.result);
    expect(open.length).toBeGreaterThanOrEqual(1);
    const v = open[0];
    const contra: 'S' | 'N' = v.partyOrientation === 'S' ? 'N' : 'S';
    s = setFloorVote(s, v.id, contra);
    const loyal0 = s.player.partyRel.perceivedLoyalty;
    s.pendingEvents = [];
    s = advanceMonth(s);
    const r = s.floorVotes.find((x) => x.id === v.id)!;
    expect(r.result).not.toBeNull();
    if (v.partyOrientation !== 'A') expect(s.player.partyRel.perceivedLoyalty).toBeLessThan(loyal0);
    expect(s.floorVotes.filter((x) => !x.result).length).toBeGreaterThanOrEqual(1);
  });
  it('vereador tem ao menos uma votação de plenário pautada por mês', async () => {
    let s = mk(501);
    s.month = { year: 2029, month: 3 };
    s.player.mandate = newMandate('vereador', '2029-01-01', '2032-12-31');
    s.government.councillors[0] = { ...s.government.councillors[0], id: PLAYER, name: s.character.name, partyId: s.player.partyId!, real: false };
    for (let i = 0; i < 4; i++) {
      s.pendingEvents = [];
      s = advanceMonth(s);
      expect(s.legislature.bills.some((b) => b.stage === 'plenario' && b.scheduled)).toBe(true);
    }
  });
});
