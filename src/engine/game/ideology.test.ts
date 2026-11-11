import { describe, it, expect } from 'vitest';
import { axisPosition, partyIdeology, ROLLCALL_VOTES, ROLLCALL_POSITIONS } from '../index';

describe('Fase 10 — ideologia por votações nominais', () => {
  it('tem votações com placar e sentido definidos', () => {
    expect(ROLLCALL_VOTES.length).toBeGreaterThanOrEqual(10);
    for (const v of ROLLCALL_VOTES) { expect(v.sim + v.nao).toBeGreaterThan(300); expect([1, -1]).toContain(v.dir); }
  });
  it('esquerda negativa e direita positiva nos eixos calibrados', () => {
    for (const ax of ['economia', 'fiscal', 'social', 'seguranca', 'ambiente'] as const) {
      expect(axisPosition('party_real_pt', ax).value!).toBeLessThan(-40);
      expect(axisPosition('party_real_pl', ax).value!).toBeGreaterThan(40);
    }
    expect(axisPosition('party_real_psol', 'trabalho').value!).toBeLessThan(-40);
    expect(axisPosition('party_real_novo', 'economia').value!).toBeGreaterThan(40);
  });
  it('mistura 75/25 com 2+ votações', () => {
    const rc = ROLLCALL_POSITIONS['party_real_pt']?.seguranca;
    const r = axisPosition('party_real_pt', 'seguranca');
    expect(rc && rc.n >= 2).toBe(true);
    expect(r.basis).toBe('votacoes+escala');
    expect(r.votes).toBe(rc!.n);
  });
  it('eixos sem dado ficam nulos e valores dentro de [-100,100]', () => {
    const v = partyIdeology('party_real_pt');
    for (const x of Object.values(v)) if (x !== null) { expect(x).toBeGreaterThanOrEqual(-100); expect(x).toBeLessThanOrEqual(100); }
  });
});
