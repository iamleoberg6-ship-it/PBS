import { describe, expect, it } from 'vitest';
import { checkEligibility, isEligible, type EligibilityInput } from './eligibility';
import { RULEPACK_BR_2028_MUN as rp } from '../data/rulepack';
import { firstRound } from './majoritarian';

const base: EligibilityInput = {
  office: 'vereador', birthDate: '2000-05-10', brazilian: true, politicalRightsOk: true,
  domicileMunicipalityId: 'SP', domicileSince: '2010-01-01', targetMunicipalityId: 'SP',
  filiationDate: '2027-03-01', consecutiveTermsSameOffice: 0, chosenInConvention: true,
};

describe('calendário 2028 derivado da lei', () => {
  it('eleição no 1º domingo e 2º turno no último domingo de outubro', () => {
    expect(rp.electionDate.value).toBe('2028-10-01');
    expect(rp.runoffDate.value).toBe('2028-10-29');
    expect(rp.filiationDeadline.value).toBe('2028-04-01');
  });
});

describe('elegibilidade', () => {
  it('candidato regular passa', () => {
    expect(isEligible(checkEligibility(base, rp))).toBe(true);
  });
  it('vereador: 18 anos na data-limite do registro', () => {
    expect(isEligible(checkEligibility({ ...base, birthDate: '2010-08-15' }, rp))).toBe(true);
    expect(isEligible(checkEligibility({ ...base, birthDate: '2010-08-16' }, rp))).toBe(false);
  });
  it('prefeito: 21 anos na posse', () => {
    expect(isEligible(checkEligibility({ ...base, office: 'prefeito', birthDate: '2008-01-01' }, rp))).toBe(true);
    expect(isEligible(checkEligibility({ ...base, office: 'prefeito', birthDate: '2008-01-02' }, rp))).toBe(false);
  });
  it('filiação depois do prazo bloqueia', () => {
    const r = checkEligibility({ ...base, filiationDate: '2028-04-02' }, rp);
    expect(r.find((c) => c.id === 'filiacao')!.ok).toBe(false);
  });
  it('terceiro mandato consecutivo de prefeito é vedado', () => {
    const r = checkEligibility({ ...base, office: 'prefeito', consecutiveTermsSameOffice: 2 }, rp);
    expect(r.find((c) => c.id === 'reeleicao')!.ok).toBe(false);
  });
});

describe('majoritário', () => {
  const cands = [
    { id: 'a', name: 'A', label: 'A', votes: 45, birthDate: '1970-01-01' },
    { id: 'b', name: 'B', label: 'B', votes: 35, birthDate: '1970-01-01' },
    { id: 'c', name: 'C', label: 'C', votes: 20, birthDate: '1970-01-01' },
  ];
  it('segundo turno acima de 200 mil eleitores', () => {
    const r = firstRound(cands, 300000, 200000);
    expect(r.needsRunoff).toBe(true);
    expect(r.runoffIds).toEqual(['a', 'b']);
  });
  it('maioria simples até 200 mil eleitores', () => {
    const r = firstRound(cands, 200000, 200000);
    expect(r.winnerId).toBe('a');
  });
});
