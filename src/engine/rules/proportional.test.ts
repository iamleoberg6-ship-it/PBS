import { describe, expect, it } from 'vitest';
import { allocateProportional, electoralQuotient, type PropList } from './proportional';

const params = { seats: 10, nominalMinPhase1: 0.1, partyMinPhase2: 0.8, candidateMinPhase2: 0.2, phase3OpenToAllParties: true };
const c = (id: string, votes: number, birthDate = '1980-01-01') => ({ id, name: id, votes, birthDate });

describe('quociente eleitoral (art. 106)', () => {
  it('despreza fração ≤ 0,5 e arredonda para cima se > 0,5', () => {
    expect(electoralQuotient(100, 3)).toBe(33);
    expect(electoralQuotient(101, 2)).toBe(50); // 50,5 -> 50
    expect(electoralQuotient(107, 4)).toBe(27); // 26,75 -> 27
    expect(electoralQuotient(105, 4)).toBe(26); // 26,25 -> 26
  });
});

describe('distribuição de cadeiras', () => {
  // Exemplo calculado à mão: 100.000 votos válidos, 10 vagas, QE = 10.000.
  const lists: PropList[] = [
    { listId: 'A', label: 'A', legendVotes: 4500, candidates: [c('a1', 20000), c('a2', 12000), c('a3', 8000), c('a4', 500)] },
    { listId: 'B', label: 'B', legendVotes: 2000, candidates: [c('b1', 15000), c('b2', 9000), c('b3', 4000)] },
    { listId: 'C', label: 'C', legendVotes: 2000, candidates: [c('c1', 9000), c('c2', 4000)] },
    { listId: 'D', label: 'D', legendVotes: 0, candidates: [c('d1', 6000), c('d2', 1000)] },
    { listId: 'E', label: 'E', legendVotes: 0, candidates: [c('e1', 3000)] },
  ];
  const r = allocateProportional(lists, params);
  const seats = (id: string) => r.lists.find((l) => l.listId === id)!.totalSeats;

  it('calcula QE e totais', () => {
    expect(r.validVotes).toBe(100000);
    expect(r.electoralQuotient).toBe(10000);
  });

  it('1ª fase: QP limitado pela votação nominal mínima de 10%', () => {
    const a = r.lists.find((l) => l.listId === 'A')!;
    expect(a.partyQuotient).toBe(4);
    expect(a.seatsQP).toBe(3); // a4 tem 500 votos < 1.000
  });

  it('2ª fase: maiores médias só entre quem tem 80% do QE e candidato com 20%', () => {
    // B empata com C na média (7.500), mas não tem mais candidato com 20% do QE -> a vaga vai para C.
    expect(r.elected[7]).toMatchObject({ candidateId: 'c2', phase: 'SOBRAS_80_20' });
  });

  it('3ª fase: aberta a todos, sem votação mínima individual (STF 2024)', () => {
    expect(r.elected[8]).toMatchObject({ candidateId: 'a4', phase: 'SOBRAS_FINAL' });
    // D não atingiu 80% do QE, mas concorre na última fase.
    expect(r.elected[9]).toMatchObject({ candidateId: 'd1', phase: 'SOBRAS_FINAL' });
  });

  it('resultado final', () => {
    expect([seats('A'), seats('B'), seats('C'), seats('D'), seats('E')]).toEqual([4, 3, 2, 1, 0]);
    expect(r.elected).toHaveLength(10);
  });

  it('não é ranking simples: e1 (3.000) fica de fora e a4 (500) entra', () => {
    const ids = r.elected.map((e) => e.candidateId);
    expect(ids).not.toContain('e1');
    expect(ids).toContain('a4');
  });

  it('é determinístico', () => {
    expect(allocateProportional(lists, params)).toEqual(r);
  });
});

describe('art. 111 — ninguém atinge o QE', () => {
  it('elege os mais votados', () => {
    const lists: PropList[] = Array.from({ length: 10 }, (_, i) => ({
      listId: `L${i}`, label: `L${i}`, legendVotes: 0, candidates: [c(`x${i}`, 10 + i)],
    }));
    const r = allocateProportional(lists, { ...params, seats: 2 });
    expect(r.elected.map((e) => e.candidateId)).toEqual(['x9', 'x8']);
    expect(r.elected.every((e) => e.phase === 'MAIS_VOTADOS_ART111')).toBe(true);
  });
});

describe('desempate entre candidatos (art. 110)', () => {
  it('elege o mais idoso', () => {
    const lists: PropList[] = [
      { listId: 'A', label: 'A', legendVotes: 0, candidates: [c('jovem', 500, '1995-01-01'), c('idoso', 500, '1960-01-01')] },
    ];
    const r = allocateProportional(lists, { ...params, seats: 1 });
    expect(r.elected[0].candidateId).toBe('idoso');
  });
});
