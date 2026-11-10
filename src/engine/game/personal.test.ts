import { describe, expect, it } from 'vitest';
import { createGame } from './create';
import { advanceMonth } from './turn';
import { availableActions, officePointsFor, performAction } from './actions';
import { newMandate } from './careers';
import { loadSave, serialize } from './save';
import { computeExposure, exposeNepotism, launchHeir, partner, personalMonthlyStep, reflexBlock, startLeave } from './personal';
import { seatHeirs, switchToHeir } from './personalActions';
import { computeEnding } from './endings';
import type { GameState } from './types';

const base = { name: 'Rita Moraes', birthDate: '1975-01-01', gender: 'Feminino', education: 's', bio: '', attributeBonus: { articulation: 15, communication: 15 } };
const mk = (seed = 3, family?: Parameters<typeof createGame>[0]['family']) =>
  createGame({ ...base, profession: 'advogado', startStatus: 'militante', startPartyId: 'party_real_psd', seed, family });
const familyA = { marital: 'casado' as const, partnerName: 'Paulo Moraes', partnerGender: 'M' as const, children: [{ name: 'Lia', age: 24 }, { name: 'Téo', age: 8 }], parentsAlive: true };

describe('Vida pessoal — criação e família', () => {
  it('a família escolhida na criação vira personagens com humor e perfil', () => {
    const s = mk(3, familyA);
    const p = s.personal!;
    expect(p.marital).toBe('casado');
    expect(partner(s)?.name).toBe('Paulo Moraes');
    expect(p.family.filter((m) => m.relation === 'filho').map((m) => m.name)).toEqual(['Lia Moraes', 'Téo Moraes']);
    expect(p.family.some((m) => m.relation === 'mae')).toBe(true);
  });
  it('sem tempo em casa, o humor do cônjuge cai; tempo com a família recupera e baixa o estresse', () => {
    let s = mk(3, familyA);
    for (let i = 0; i < 5; i++) s = advanceMonth(s);
    s.pendingEvents = [];
    const mood = partner(s)!.mood;
    expect(mood).toBeLessThan(65);
    s.personal!.stress = 60;
    s.actionPoints = 5;
    const n = performAction(s, 'pv_familia');
    expect(partner(n)!.mood).toBeGreaterThan(mood);
    expect(n.personal!.stress).toBeLessThan(60);
  });
  it('save antigo sem vida pessoal ganha o módulo ao carregar', () => {
    const s = mk();
    delete (s as Partial<GameState>).personal;
    const { state } = loadSave(serialize(s));
    expect(state.personal?.marital).toBe('solteiro');
  });
});

describe('Exposição, ameaças e licença', () => {
  it('a exposição cresce com o cargo e gera ameaças com evento de resposta', () => {
    const s = mk();
    const e0 = computeExposure(s);
    s.player.mandate = newMandate('prefeito', '2029-01-01', '2032-12-31');
    s.player.recognition = 80;
    expect(computeExposure(s)).toBeGreaterThan(e0 + 30);
    let threats = 0;
    for (let i = 0; i < 40; i++) { personalMonthlyStep(s); threats = s.personal!.threats.length; }
    expect(threats).toBeGreaterThan(0);
    expect(s.pendingEvents.some((e) => e.templateId === 'ameaca')).toBe(true);
  });
  it('licença de vereador: sem agenda do cargo, sem trabalho de mandato, limite de 120 dias por ano', () => {
    const s = mk();
    s.player.mandate = newMandate('vereador', '2025-01-01', '2028-12-31');
    s.officePoints = officePointsFor(s);
    expect(s.officePoints).toBeGreaterThan(0);
    const msg = startLeave(s, 6, 'ameaca');
    expect(msg).toContain('4 meses');
    expect(officePointsFor(s)).toBe(0);
    expect(s.finances.monthlyIncome).toBe(0);
    const work = availableActions(s).find((a) => a.def.id === 'projeto_lei');
    expect(work?.status).toBe('Você está de licença do cargo.');
    let n = s;
    for (let i = 0; i < 4; i++) { n = advanceMonth(n); n.pendingEvents = []; }
    expect(n.personal!.leave).toBeNull();
    expect(n.officePoints).toBeGreaterThan(0);
    expect(startLeave(n, 1, 'interesse')).toContain('120 dias');
  });
});

describe('Regras reais: nepotismo e inelegibilidade reflexa', () => {
  it('nepotismo exposto derruba credibilidade e pesa no final', () => {
    const s = mk(3, familyA);
    s.player.mandate = newMandate('vereador', '2025-01-01', '2028-12-31');
    const lia = s.personal!.family.find((m) => m.name.startsWith('Lia'))!;
    lia.employedByPlayer = 'direto';
    const c0 = s.player.credibility ?? 60;
    expect(exposeNepotism(s, lia)).toContain('Súmula Vinculante 13');
    expect(s.player.credibility).toBeLessThan(c0);
    expect(Number(s.flags.nepotismo)).toBe(1);
  });
  it('filho de prefeito não disputa vereador na cidade; o de vereador pode', () => {
    const s = mk(3, familyA);
    s.month = { year: 2028, month: 3 };
    const lia = s.personal!.family.find((m) => m.name.startsWith('Lia'))!;
    lia.politicalInterest = 80;
    s.player.mandate = newMandate('prefeito', '2025-01-01', '2028-12-31');
    expect(reflexBlock(s, 'vereador', lia)).toContain('CF art. 14 §7º');
    expect(launchHeir(s, `${lia.id}|vereador`)).toContain('Inelegibilidade reflexa');
    s.player.mandate = newMandate('vereador', '2025-01-01', '2028-12-31');
    expect(launchHeir(s, `${lia.id}|vereador`)).toContain('Câmara Municipal');
    expect(lia.politics?.status).toBe('pre');
  });
});

describe('Herdeiro e finais', () => {
  it('passar o bastão continua a partida com o(a) filho(a), herdando parte do capital político', () => {
    const s = mk(3, familyA);
    s.player.recognition = 60;
    const lia = s.personal!.family.find((m) => m.name.startsWith('Lia'))!;
    lia.politicalInterest = 80;
    expect(availableActions(s).find((a) => a.def.id === 'pv_bastao')?.status).toBeNull();
    const msg = switchToHeir(s, s.rng, lia.id);
    expect(msg).toContain('Lia Moraes');
    expect(s.character.name).toBe('Lia Moraes');
    expect(s.player.recognition).toBeLessThan(60);
    expect(s.personal!.generation).toBe(2);
    expect(s.personal!.family.some((m) => m.name === 'Rita Moraes' && m.relation === 'mae')).toBe(true);
    const e = computeEnding(s, 'fim');
    expect(e.text).toContain('2ª geração');
  });
  it('deixar a vida pública pela família encerra a partida com final próprio', () => {
    const s = mk(3, familyA);
    const n = performAction(s, 'pv_sair_pela_familia');
    expect(n.gameOver).toBe(true);
    expect(n.ending?.id).toBe('familia');
  });
});

describe('Fase 8b — herdeiro com mandato, parente na equipe, nascimento', () => {
  it('parente eleito vereador toma posse na Câmara e o bastão passa com o mandato', () => {
    const s = mk(3, familyA);
    const lia = s.personal!.family.find((m) => m.name.startsWith('Lia'))!;
    lia.politicalInterest = 80;
    lia.politics = { office: 'vereador', year: 2028, status: 'eleito', since: 2029 * 12, until: 2032 * 12 + 11, seated: false };
    s.month = { year: 2029, month: 2 };
    s.government.councillors[10].real = false;
    const msgs = seatHeirs(s);
    expect(msgs[0]).toContain('tomou posse');
    expect(s.government.councillors.some((c) => c.id === `heir_${lia.id}` && c.name === 'Lia Moraes')).toBe(true);
    expect(s.government.councillors.length).toBe(55);
    const msg = switchToHeir(s, s.rng, lia.id);
    expect(msg).toContain('mandato de vereador');
    expect(s.player.mandate?.office).toBe('vereador');
    expect(s.player.mandate?.until).toBe('2032-12-31');
    expect(s.government.councillors.some((c) => c.id === 'character_player')).toBe(true);
    const n = advanceMonth(s);
    expect(n.player.mandate?.office).toBe('vereador');
  });
  it('herdeiro deputado estadual: bastão inclui o mandato na Alesp', () => {
    const s = mk(3, familyA);
    const lia = s.personal!.family.find((m) => m.name.startsWith('Lia'))!;
    lia.politicalInterest = 80;
    lia.politics = { office: 'deputado_estadual', year: 2030, status: 'eleito', since: 2031 * 12 + 2, until: 2035 * 12 + 2 };
    s.month = { year: 2031, month: 6 };
    switchToHeir(s, s.rng, lia.id);
    expect(s.player.mandate?.office).toBe('deputado_estadual');
    expect(s.player.mandate?.upper).toBeTruthy();
  });
  it('parente nomeado na equipe ocupa vaga; ao vir a público, sai da equipe', () => {
    const s = mk(3, familyA);
    s.player.mandate = newMandate('vereador', '2025-01-01', '2028-12-31');
    const lia = s.personal!.family.find((m) => m.name.startsWith('Lia'))!;
    const opt = availableActions(s).find((a) => a.def.id === 'eq_parente');
    expect(opt).toBeUndefined(); // ação de painel, fora da lista geral
    const n = performAction(s, 'eq_parente', lia.id);
    const member = n.player.team!.members.find((m) => m.relativeId === lia.id)!;
    expect(member.origin).toBe('parente');
    const liaN = n.personal!.family.find((m) => m.id === lia.id)!;
    expect(liaN.employedByPlayer).toBe('direto');
    exposeNepotism(n, liaN);
    expect(n.player.team!.members.some((m) => m.relativeId === lia.id)).toBe(false);
  });
  it('bebê planejado nasce e vira filho(a) na família', () => {
    const s = mk(3, familyA);
    const before = s.personal!.family.length;
    s.personal!.babyDue = 2027 * 12 + 2;
    s.personal!.babyBy = 'player';
    s.month = { year: 2027, month: 3 };
    const out = personalMonthlyStep(s);
    expect(out.some((x) => x.startsWith('Nasceu'))).toBe(true);
    expect(s.personal!.family.length).toBe(before + 1);
    expect(s.pendingEvents.some((e) => e.templateId === 'nascimento')).toBe(true);
    s.player.mandate = newMandate('vereador', '2025-01-01', '2028-12-31');
    expect(startLeave(s, 4, 'nascimento')).toContain('nascimento');
    expect(s.personal!.leave?.paid).toBe(true);
  });
});
