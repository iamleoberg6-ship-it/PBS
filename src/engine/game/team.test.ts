import { describe, expect, it } from 'vitest';
import { createGame } from './create';
import { advanceMonth } from './turn';
import { performAction, availableActions } from './actions';
import { newMandate } from './careers';
import { newUpper } from './upper';
import { loadSave, serialize } from './save';
import { TEAM_LIMITS, exposeRachadinha, rachadinhaAcceptance, refreshPool, teamMonthlyStep, type TeamMember } from './team';
import { computeEnding } from './endings';
import type { GameState } from './types';

const base = { name: 'T', birthDate: '1985-01-01', gender: 'x', education: 's', bio: '', attributeBonus: { articulation: 15, communication: 15 } };
const mk = (seed = 3) => createGame({ ...base, profession: 'advogado', startStatus: 'militante', startPartyId: 'party_real_psd', seed });
const withVereador = (seed = 3) => {
  const s = mk(seed);
  s.player.mandate = newMandate('vereador', '2025-01-01', '2028-12-31');
  refreshPool(s, s.rng, true);
  return s;
};

describe('Equipe do gabinete do jogador', () => {
  it('sem mandato legislativo não há equipe; com mandato chegam currículos com ficha', () => {
    const s0 = mk();
    expect(availableActions(s0).some((a) => a.def.id.startsWith('eq_'))).toBe(false);
    const s = withVereador();
    const pool = s.player.team!.pool;
    expect(pool.length).toBeGreaterThanOrEqual(5);
    expect(pool.filter((c) => c.role === 'chefe').length).toBe(2);
    for (const c of pool) {
      expect(c.honestyEstimate).toBeGreaterThanOrEqual(0);
      expect(Object.values(c.skills).every((v) => v >= 10 && v <= 97)).toBe(true);
      expect(c.salary).toBeGreaterThanOrEqual(TEAM_LIMITS.vereador.salary[0]);
    }
    expect(availableActions(s).some((a) => a.def.id.startsWith('eq_'))).toBe(false); // painel próprio, fora da lista geral
  });

  it('nomear, definir tarefa e produzir no mês sem gastar a agenda', () => {
    let s = withVereador();
    const c = s.player.team!.pool.find((x) => x.role === 'assessor')!;
    const ap = s.actionPoints;
    s = performAction(s, 'eq_nomear', `${c.id}|ativo`);
    expect(s.player.team!.members.length).toBe(1);
    expect(s.actionPoints).toBe(ap);
    s = performAction(s, 'eq_tarefa', `${c.id}|redes`);
    expect(s.player.team!.members[0].task).toBe('redes');
    const before = Object.values(s.player.social.networks).reduce((a, b) => a + b, 0);
    teamMonthlyStep(s, s.rng);
    const after = Object.values(s.player.social.networks).reduce((a, b) => a + b, 0);
    expect(after).toBeGreaterThan(before);
    expect(s.player.team!.members[0].lastOutput).toMatch(/seguidores/);
  });

  it('respeita vagas, verba e um único chefe', () => {
    let s = withVereador();
    const chefes = s.player.team!.pool.filter((x) => x.role === 'chefe');
    s = performAction(s, 'eq_nomear', `${chefes[0].id}|ativo`);
    const msg = performAction(s, 'eq_nomear', `${chefes[1].id}|ativo`);
    expect(msg.player.team!.members.filter((m) => m.role === 'chefe').length).toBe(1);
    // Verba: força um salário acima do saldo.
    const t = s.player.team!;
    const extra = t.pool.find((x) => x.role === 'assessor')!;
    extra.salary = TEAM_LIMITS.vereador.budget;
    const s2 = performAction(s, 'eq_nomear', `${extra.id}|ativo`);
    expect(s2.player.team!.members.some((m) => m.id === extra.id)).toBe(false);
  });

  it('honestidade governa a aceitação da rachadinha', () => {
    const m = (h: number): TeamMember => ({ id: 'x', name: 'X', role: 'assessor', origin: 'mercado', salary: 8000, skills: { communication: 50, politicalKnowledge: 50, articulation: 50, management: 50 }, honesty: h, honestyEstimate: h, loyalty: 50, task: 'redes', taskParam: null, status: 'ativo', rachadinha: 0, progress: 0, hiredAt: { year: 2027, month: 1 }, lastOutput: '' });
    expect(rachadinhaAcceptance(m(10), 0.3)).toBeGreaterThan(0.6);
    expect(rachadinhaAcceptance(m(90), 0.3)).toBeLessThan(0.1);
    expect(rachadinhaAcceptance(m(40), 0.8)).toBeLessThan(rachadinhaAcceptance(m(40), 0.3));
  });

  it('rachadinha rende dinheiro todo mês e, se descoberta, vira crise verdadeira e mancha o final', () => {
    let s = withVereador();
    const c = s.player.team!.pool.find((x) => x.role === 'assessor')!;
    c.honesty = 3; c.loyalty = 90;
    s = performAction(s, 'eq_nomear', `${c.id}|ativo`);
    let tries = 0;
    while (!s.player.team!.members[0]?.rachadinha && tries++ < 10) { s.actionPoints = 5; s = performAction(s, 'eq_rachadinha', `${c.id}|0.5`); }
    expect(s.player.team!.members[0].rachadinha).toBe(0.5);
    const cash = s.finances.cash;
    s.flags.rachadinhaInvestigada = true; // isola o teste do sorteio de investigação
    teamMonthlyStep(s, s.rng);
    expect(s.finances.cash - cash).toBe(Math.round(c.salary * 0.5));
    delete s.flags.rachadinhaInvestigada;
    const pop = s.character.attributes.popularity;
    exposeRachadinha(s, s.rng, 'teste');
    expect(s.crises.some((x) => x.topic === 'rachadinha' && x.truth === 'verdadeira')).toBe(true);
    expect(s.character.attributes.popularity).toBeLessThan(pop);
    expect(s.player.team!.members[0].rachadinha).toBe(0);
    expect(['escandalo', 'cassado']).toContain(computeEnding(s, 'fim').id);
  });

  it('funcionário fantasma não produz; exigir expediente o põe para trabalhar', () => {
    let s = withVereador();
    const c = s.player.team!.pool.find((x) => x.role === 'assessor')!;
    s = performAction(s, 'eq_nomear', `${c.id}|fantasma`);
    expect(s.player.team!.members[0].status).toBe('fantasma');
    expect(Number(s.flags.fantasmasNomeados)).toBe(1);
    teamMonthlyStep(s, s.rng);
    expect(s.player.team!.members[0].lastOutput).toMatch(/fantasma/);
    s = performAction(s, 'eq_regularizar', c.id);
    expect(s.player.team!.members[0].status).toBe('ativo');
  });

  it('minutas da assessoria viram projeto do deputado; equipe é exonerada no fim do mandato', () => {
    let s = mk(5);
    s.player.mandate = { ...newMandate('deputado_federal', '2027-02-01', '2031-01-31'), upper: newUpper('deputado_federal') };
    refreshPool(s, s.rng, true);
    const c = s.player.team!.pool.find((x) => x.role === 'assessor')!;
    c.skills.politicalKnowledge = 95;
    s = performAction(s, 'eq_nomear', `${c.id}|ativo`);
    s = performAction(s, 'eq_tarefa', `${c.id}|legislativo|saude`);
    const n0 = s.player.mandate!.upper!.bills.length;
    for (let i = 0; i < 6; i++) teamMonthlyStep(s, s.rng);
    expect(s.player.mandate!.upper!.bills.length).toBeGreaterThan(n0);
    s.player.mandate = null;
    const notes = teamMonthlyStep(s, s.rng);
    expect(notes.join(' ')).toMatch(/exonerada/);
    expect(s.player.team!.members.length).toBe(0);
  });

  it('a equipe passa pelo ciclo do mês e sobrevive a salvar/carregar', () => {
    let s = withVereador(7);
    const c = s.player.team!.pool.find((x) => x.role === 'assessor')!;
    s = performAction(s, 'eq_nomear', `${c.id}|ativo`);
    s = advanceMonth(s);
    const back = loadSave(serialize(s)).state as GameState;
    expect(back.player.team?.members.length ?? 0).toBe(s.player.team?.members.length ?? 0);
  });
});
