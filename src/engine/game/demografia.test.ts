import { describe, it, expect } from 'vitest';
import { createGame, advanceMonth, rgPop, ufPop, brPop, rgIdhm, ufIdhm, capitalAreaPop, STATE_REGION_STATS, UF_STATS, type GameState } from '../index';

const mk = (): GameState => createGame({ name: 'Teste Demo', birthDate: '1985-01-01', gender: 'M', education: 'superior', profession: 'economista', startStatus: 'militante', startPartyId: 'party_real_pt', bio: '', seed: 3, attributeBonus: {} } as never);

describe('Fase 16 — números que andam com o tempo', () => {
  it('população projeta o Censo 2022 com a taxa 2010–2022', () => {
    const s = mk();
    s.month = { year: 2022, month: 8 };
    expect(ufPop(s, 'SP')).toBe(UF_STATS.SP.pop);
    expect(rgPop(s, '3510')).toBe(STATE_REGION_STATS['3510'].pop);
    s.month = { year: 2032, month: 8 };
    expect(rgPop(s, '3510')).toBeGreaterThan(STATE_REGION_STATS['3510'].pop * 1.09); // Campinas: ~1%/ano
    expect(ufPop(s, 'RR')).toBeGreaterThan(UF_STATS.RR.pop * 1.3); // Roraima: ~2,9%/ano
    expect(capitalAreaPop(s, 100000)).toBeGreaterThan(100000);
    expect(brPop(s)).toBeGreaterThan(203_000_000);
  });

  it('IDHM estimado parte de 2010 e muda com a simulação', () => {
    let s = mk();
    const start = ufIdhm(s, 'BA')!;
    expect(Math.abs(start.idhm - UF_STATS.BA.idhm)).toBeLessThan(0.01);
    for (let i = 0; i < 36; i++) s = advanceMonth(s);
    const later = ufIdhm(s, 'BA')!;
    expect(later.idhm).not.toBe(start.idhm);
    expect(Math.abs(later.idhm - start.idhm)).toBeLessThan(0.08);
  }, 60000);

  it('investimento regional melhora o componente mais fraco', () => {
    const s = mk();
    const a = rgIdhm(s, '3502')!;
    s.flags['invRG_3502'] = 20000;
    const b = rgIdhm(s, '3502')!;
    expect(b.idhm).toBeGreaterThan(a.idhm);
  });
});
