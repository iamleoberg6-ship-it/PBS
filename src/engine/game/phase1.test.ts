import { describe, expect, it } from 'vitest';
import { createGame } from './create';
import { advanceMonth } from './turn';
import { availableActions, performAction } from './actions';
import { resolveEvent } from './events';
import { changeParty } from './party';
import { fatigueMultiplier } from './fatigue';
import { causesFor } from './ledger';
import { PLAYER, rel, standing } from './relations';
import { conventionVote, projectContest } from './partyorg';
import { addMonths } from '../calendar';
import { loadSave, serialize } from './save';
import type { GameState } from './types';

const base = { name: 'T', birthDate: '1990-01-01', gender: 'x', education: 's', bio: '', attributeBonus: { articulation: 20, negotiation: 20 } };
const mk = (seed = 1, party = 'party_real_pt', status: 'militante' | 'filiado' | 'independente' = 'militante') =>
  createGame({ ...base, profession: 'sindicalista', startStatus: status, startPartyId: status === 'independente' ? null : party, seed });
const can = (s: GameState, id: string) => availableActions(s).find((a) => a.def.id === id)?.status === null;
function act(s: GameState, id: string, param?: string) {
  const a = availableActions(s).find((x) => x.def.id === id);
  return performAction(s, id, param ?? a?.def.params?.(s)[0]?.value);
}
function month(s: GameState, n = 1) {
  for (let i = 0; i < n; i++) { while (s.pendingEvents.length) s = resolveEvent(s, 0); s = advanceMonth(s); }
  return s;
}
/** Abre a disputa do diretório do jogador no próximo mês. */
function openContestSoon(s: GameState) {
  s.partyOrgs[s.player.partyId!].directorate.termEnds = addMonths(s.month, 4);
  return month(s, 1);
}

describe('Fase 1 — estrutura', () => {
  it('cada partido tem diretório, executiva e facções com participação somando 1', () => {
    const s = mk();
    expect(Object.keys(s.partyOrgs)).toHaveLength(30);
    for (const org of Object.values(s.partyOrgs)) {
      expect(org.factions.length).toBeGreaterThanOrEqual(1);
      expect(Math.abs(org.factions.reduce((a, f) => a + f.share, 0) - 1)).toBeLessThan(1e-9);
      expect(s.actors[org.directorate.presidentId]).toBeDefined();
      expect(org.directorate.executive.length).toBeGreaterThanOrEqual(3);
    }
    // Vereadores reais viraram atores, sem duplicidade e marcados como reais.
    const reais = Object.values(s.actors).filter((a) => a.real);
    expect(reais).toHaveLength(55);
  });
  it('relação com o partido tem 5 indicadores independentes', () => {
    const s = mk();
    expect(Object.keys(s.player.partyRel)).toEqual(expect.arrayContaining(['internalPopularity', 'leadershipTrust', 'influence', 'perceivedLoyalty', 'mobilization']));
  });
});

describe('Fase 1 — critérios de conclusão (Plano §4.6)', () => {
  it('1–2: entra num partido e constrói influência', () => {
    let s = createGame({ ...base, profession: 'sindicalista', startStatus: 'independente', startPartyId: null, seed: 2 });
    s = changeParty(s, 'party_real_psb');
    expect(s.player.partyId).toBe('party_real_psb');
    const before = { ...s.player.partyRel };
    s = act(s, 'atividade_partidaria'); s = act(s, 'aproximar_faccao'); s = month(s);
    expect(s.player.partyRel.internalPopularity).toBeGreaterThan(before.internalPopularity);
    expect(s.player.partyRel.influence).toBeGreaterThan(before.influence);
  });

  it('3–5: disputa a presidência do diretório com acordo de facção e o resultado vem dos delegados', () => {
    let s = mk(3);
    s.player.partyRel.influence = 40; s.player.filiationDate = '2025-01-01';
    s = openContestSoon(s);
    const c = s.contests.find((x) => x.partyId === s.player.partyId && x.status === 'aberta');
    expect(c).toBeDefined();
    expect(can(s, 'candidatar_diretorio')).toBe(true);
    s = act(s, 'candidatar_diretorio');
    s = act(s, 'negociar_faccao');
    const proj = projectContest(s, s.contests.find((x) => x.id === c!.id)!);
    expect(Object.values(proj.votes).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    s = month(s, 4);
    const done = s.contests.find((x) => x.id === c!.id)!;
    expect(done.status).toBe('decidida');
    expect(done.result!.byFaction.length).toBe(s.partyOrgs[s.player.partyId!].factions.length);
  });

  it('6–7: perde espaço ao atacar a direção e recupera com trabalho partidário', () => {
    let s = mk(4);
    const t0 = s.player.partyRel.leadershipTrust;
    s = act(s, 'criticar_direcao');
    expect(s.player.partyRel.leadershipTrust).toBeLessThan(t0);
    const low = s.player.partyRel.leadershipTrust;
    for (let i = 0; i < 6; i++) { s = month(s); s = act(s, 'atividade_partidaria'); s = act(s, 'aproximar_faccao'); }
    expect(s.player.partyRel.leadershipTrust).toBeGreaterThan(low);
  });

  it('8: convenção escolhe ou preteri conforme confiança e apoio interno', () => {
    const strong = mk(5); strong.player.partyRel.leadershipTrust = 80; strong.player.recognition = 40;
    const weak = mk(5); weak.player.partyRel.leadershipTrust = 0; weak.player.partyRel.disciplinary = 2;
    for (const org of Object.values(weak.partyOrgs)) for (const f of org.factions) weak.relations[`${f.leaderId}|${PLAYER}`] = { trust: -60, affinity: -60, owed: 0, memory: [] };
    let okStrong = 0, okWeak = 0;
    for (let i = 0; i < 20; i++) {
      if (conventionVote(structuredClone(strong), { seed: i, state: i * 7919 }, 'vereador').approved) okStrong++;
      if (conventionVote(structuredClone(weak), { seed: i, state: i * 7919 }, 'vereador').approved) okWeak++;
    }
    expect(okStrong).toBeGreaterThan(15);
    expect(okWeak).toBeLessThan(5);
  });

  it('9: trajetória independente — pode sair, ficar sem partido e entrar em outro', () => {
    let s = mk(6);
    s = changeParty(s, null);
    expect(s.player.partyId).toBeNull();
    s = month(s, 2);
    s = changeParty(s, 'party_real_novo');
    expect(s.player.partyId).toBe('party_real_novo');
    // A direção do partido antigo lembra da saída.
    const oldPres = s.partyOrgs['party_real_pt'].directorate.presidentId;
    expect(rel(s, oldPres, PLAYER).memory.some((m) => m.text.includes('Deixou o partido'))).toBe(true);
  });
});

describe('Fase 1 — memória e promessas', () => {
  it('trocar de lado numa disputa é lembrado como traição', () => {
    let s = mk(7);
    s.player.filiationDate = '2025-01-01';
    s = openContestSoon(s);
    const c = s.contests.find((x) => x.partyId === s.player.partyId && x.status === 'aberta')!;
    if (c.candidates.length < 2) c.candidates.push(s.partyOrgs[s.player.partyId!].factions.at(-1)!.leaderId);
    const [a, b] = c.candidates;
    s = performAction(s, 'apoiar_candidato_diretorio', a);
    s = month(s);
    s = performAction(s, 'apoiar_candidato_diretorio', b);
    expect(rel(s, a, PLAYER).memory.some((m) => m.kind === 'traicao')).toBe(true);
    expect(standing(s, a, PLAYER)).toBeLessThan(0);
  });
});

describe('Fase 1 — o mundo se move sem o jogador', () => {
  it('disputas internas acontecem em vários partidos ao longo da partida', () => {
    const s = month(mk(8, 'party_real_pt', 'independente'), 30);
    const decided = s.contests.filter((c) => c.status === 'decidida');
    expect(decided.length).toBeGreaterThan(10);
    expect(new Set(decided.map((c) => c.partyId)).size).toBeGreaterThan(8);
  }, 20_000);
});

describe('Fase 1 — desgaste por repetição', () => {
  it('repetir a mesma ação no mês e em meses seguidos rende menos', () => {
    let s = mk(9);
    expect(fatigueMultiplier(s, 'comunidade').mult).toBe(1);
    const r0 = s.player.base; s = act(s, 'comunidade'); const g1 = s.player.base - r0;
    const r1 = s.player.base; s = act(s, 'comunidade'); const g2 = s.player.base - r1;
    expect(g2).toBeLessThan(g1 * 0.75);
    for (let i = 0; i < 4; i++) { s = month(s); s = act(s, 'comunidade'); }
    s = month(s);
    expect(fatigueMultiplier(s, 'comunidade').mult).toBeLessThan(0.8);
    s = month(s, 2); // pular meses zera a sequência
    expect(fatigueMultiplier(s, 'comunidade').mult).toBe(1);
  });
  it('custos não são reduzidos pelo desgaste', () => {
    let s = mk(10); s.finances.cash = 100000;
    s = act(s, 'mobilizar_filiados'); const c1 = s.finances.cash;
    s = act(s, 'mobilizar_filiados');
    expect(c1 - s.finances.cash).toBe(1500);
  });
});

describe('Fase 1 — livro de causas', () => {
  it('cada variação de indicador tem causa registrada', () => {
    let s = mk(11);
    s = act(s, 'criticar_direcao');
    const c = causesFor(s, 'leadershipTrust');
    expect(c.length).toBeGreaterThan(0);
    expect(c[0].cause).toContain('Criticar publicamente');
    s = month(s);
    expect(causesFor(s, 'recognition').some((e) => e.cause.includes('Esquecimento') || e.cause.includes('redes'))).toBe(true);
  });
});

describe('Fase 1 — saves', () => {
  it('migra save v3 (indicador único de relação) para v4', () => {
    const s = JSON.parse(serialize(mk(12)));
    s.saveVersion = 3;
    s.player.partyStanding = 42;
    delete s.player.partyRel; delete s.player.actionUse; delete s.actors; delete s.partyOrgs; delete s.relations; delete s.contests; delete s.promises; delete s.ledger;
    for (const c of s.government.councillors) { delete c.birthDate; delete c.birthPrecision; }
    const { state, report } = loadSave(JSON.stringify(s));
    expect(report.migratedFrom).toBe(3);
    expect(state.player.partyRel.leadershipTrust).toBe(42);
    expect(Object.keys(state.partyOrgs)).toHaveLength(30);
    expect(state.government.councillors.find((c) => c.name === 'Lucas Pavanato')?.birthPrecision).toBe('exata');
    const after = month(state, 6);
    expect(after.month.year).toBeGreaterThanOrEqual(2027);
  });
  it('reprodutível com seed (mesmas decisões, mesmo resultado)', () => {
    const run = () => { let s = mk(13); for (let i = 0; i < 20; i++) { s = act(s, 'atividade_partidaria'); s = act(s, 'aproximar_faccao'); s = month(s); } return s; };
    const a = run(); const b = run();
    expect(JSON.stringify(a.contests)).toBe(JSON.stringify(b.contests));
    expect(a.player.partyRel).toEqual(b.player.partyRel);
  });
});
