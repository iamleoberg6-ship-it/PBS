import { describe, it, expect } from 'vitest';
import { createGame, newUpper, chooseCommittee, legState, legislativoMonthlyStep, giveParecer, collectCpi, cpiReport, disputeLeadership, govInvestRegion, governorRegionsStep, resolveFloorVotes, UPPER_COMMITTEES, type GameState } from '../index';

const base = (office: string): GameState => {
  const s = createGame({ name: 'Teste Leg', birthDate: '1980-01-01', gender: 'F', education: 'superior', profession: 'economista', startStatus: 'militante', startPartyId: 'party_real_psol', bio: '', seed: 7, attributeBonus: { articulation: 20, negotiation: 10 } } as never);
  s.month = { year: 2031, month: 2 };
  s.player.mandate = { office, since: '2031-02', until: '2035-01', approval: 50, upper: newUpper(office) } as never;
  return s;
};

describe('Fase 15 — trabalho legislativo', () => {
  it('comissões reais por casa e pedido de vaga', () => {
    expect(UPPER_COMMITTEES.camara.length).toBeGreaterThanOrEqual(10);
    expect(UPPER_COMMITTEES.alesp.some((c) => c.sigla === 'CCJR')).toBe(true);
    const s = chooseCommittee(base('deputado_federal'), 'CSAUDE');
    expect(legState(s)!.committee).not.toBeNull();
    expect(chooseCommittee(s, 'CE')).toBe(s); // um pedido por mês
  });

  it('relatoria → parecer → votação em plenário com crédito ao relator', () => {
    let s = chooseCommittee(base('deputado_federal'), 'CSAUDE');
    for (let i = 0; i < 12 && !legState(s)!.relatorias.some((r) => r.status === 'pendente'); i++) { s.month = { year: 2031, month: 2 + (i % 10) }; legislativoMonthlyStep(s, s.rng); }
    const r = legState(s)!.relatorias.find((x) => x.status === 'pendente')!;
    expect(r).toBeTruthy();
    const ap = s.actionPoints;
    const t = giveParecer(s, r.id, 'substitutivo');
    expect(t.actionPoints).toBe(ap - 1);
    const fv = t.floorVotes.find((v) => v.relatorPlayer)!;
    expect(fv.parecer).toBe('substitutivo');
    expect(fv.boost).toBeGreaterThan(0);
    const notes = resolveFloorVotes(t, t.rng);
    expect(notes.length).toBeGreaterThan(0);
    expect(fv.effects).toMatch(/parecer/);
  });

  it('CPI exige 1/3 da casa e termina com relatório', () => {
    const s = base('senador');
    for (let i = 0; i < 30 && legState(s)?.cpi?.status !== 'instalada'; i++) collectCpi(s, s.rng, 'saude');
    const c = legState(s)!.cpi!;
    expect(c.needed).toBe(27);
    expect(c.status).toBe('instalada');
    c.relator = true;
    for (let i = 0; i < 4; i++) legislativoMonthlyStep(s, s.rng);
    expect(legState(s)!.cpi!.status).toBe('relatorio');
    const t = cpiReport(s, 'duro');
    expect(legState(t)!.cpi!.status).toBe('encerrada');
  });

  it('líder define a orientação da bancada', () => {
    const s = base('deputado_estadual');
    for (let i = 0; i < 40 && !legState(s)!.leaderUntil; i++) { legState(s)!.lastLeaderTry = 0; disputeLeadership(s, s.rng); }
    expect(legState(s)!.leaderUntil).toBeGreaterThan(2031 * 12);
  });

  it('governador investe por região e a aprovação regional sobe', () => {
    const s = base('governador');
    const before = s.player.mandate!.approval;
    govInvestRegion(s, s.rng, '3505');
    expect(s.player.mandate!.upper!.regionInvest!['3505']).toBe(500);
    expect(s.player.mandate!.upper!.regionApproval!['3505']).toBeGreaterThan(before);
    governorRegionsStep(s);
    expect(s.player.mandate!.approval).toBeGreaterThanOrEqual(before);
  });
});
