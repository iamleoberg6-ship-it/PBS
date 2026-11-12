import { describe, it, expect } from 'vitest';
import { createGame, initNational, demographyMonthlyStep, ufPop, ufPopBase, rgPop, rgPopBase, type GameState } from '../index';

const mk = (): GameState => { const s = createGame({ name: 'T Mig', birthDate: '1985-01-01', gender: 'M', education: 'superior', profession: 'economista', startStatus: 'militante', startPartyId: 'party_real_pt', bio: '', seed: 9, attributeBonus: {} } as never); s.national ??= initNational(); return s; };
const months = (s: GameState, n: number) => { for (let i = 0; i < n; i++) { s.month = { year: s.month.year + (s.month.month === 12 ? 1 : 0), month: s.month.month === 12 ? 1 : s.month.month + 1 }; demographyMonthlyStep(s); } };

describe('Fase 16b — migração', () => {
  it('renda subindo numa região atrai gente; sem mudanças, o fluxo entre estados soma zero', () => {
    const a = mk(); months(a, 12);
    const net = Object.values(a.migration!.uf).reduce((x, y) => x + y, 0) - a.migration!.intl;
    expect(Math.abs(net)).toBeLessThan(5);
    const s = mk(); s.national!.regions.nordeste.income *= 1.15; months(s, 24);
    expect(ufPop(s, 'BA')).toBeGreaterThan(ufPopBase(s, 'BA'));
    expect(ufPop(s, 'RS')).toBeLessThan(ufPopBase(s, 'RS'));
  });
  it('desemprego nacional alto leva gente para fora do país', () => {
    const s = mk(); s.federal!.economy.unemployment += 3; months(s, 12);
    expect(s.migration!.intl).toBeLessThan(-100_000);
  });
  it('investimento numa região de SP atrai moradores das outras', () => {
    const s = mk(); s.flags['invRG_3505'] = 30000; months(s, 24);
    expect(rgPop(s, '3505')).toBeGreaterThan(rgPopBase(s, '3505'));
  });
});
