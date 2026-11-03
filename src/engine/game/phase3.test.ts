import { describe, expect, it } from 'vitest';
import { createGame } from './create';
import { advanceMonth } from './turn';
import { resolveEvent } from './events';
import { availableActions, performAction } from './actions';
import { initLegislature, blocCounts, legislatureMonthlyStep } from './legislature';
import {
  adjustDraft, baseLoa2027, closeFiscalYear, debtRatio, draftChecks, educationRatio, healthRatio, loaBalance, openDraft, personnelRatio,
  requestCredit, raiseSalaries, resetSecretariatForNewMayor, secretariatOf, totalExpense, totalRevenue,
} from './municipality';
import { personnelStatus, taxEffectiveYear, inPersonnelFreeze } from '../rules/fiscal';
import { EXEC_2025, LDO_2027_TOTAL } from '../data/spfinance';
import { loadSave, serialize } from './save';
import type { GameState } from './types';

const base = { name: 'T', birthDate: '1980-01-01', gender: 'x', education: 's', bio: '', attributeBonus: { management: 10 } };
const mk = (seed = 1) => createGame({ ...base, profession: 'economista', startStatus: 'militante', startPartyId: 'party_real_psd', seed });
const month = (s: GameState, n = 1) => { for (let i = 0; i < n; i++) { while (s.pendingEvents.length) s = resolveEvent(s, 0); s = advanceMonth(s); } return s; };
function asMayor(s: GameState): GameState {
  s.month = { year: 2029, month: 1 };
  s.player.mandate = { office: 'prefeito', since: '2029-01-01', until: '2032-12-31', stance: 'base', approval: 55, relationExecutive: 50, councilBase: 0, projects: [], councilPresident: false, priorityArea: null, portfolio: null, budgetShare: 40 };
  s.government.mayor = { personId: 'character_player', name: s.character.name, partyId: 'party_real_psd', real: false };
  s.government.mayorCoalition = ['party_real_psd', 'party_real_mdb', 'party_real_pp', 'party_real_uniao', 'party_real_pl'];
  initLegislature(s, s.rng);
  resetSecretariatForNewMayor(s, s.rng);
  s.player.mandate.councilBase = blocCounts(s).base;
  return s;
}

describe('Fase 3 — orçamento de base', () => {
  it('LOA 2027 fecha no total real da LDO 2027 e respeita os limites de partida', () => {
    const l = baseLoa2027();
    expect(totalRevenue(l)).toBe(LDO_2027_TOTAL);
    expect(Math.abs(loaBalance(l))).toBeLessThan(2);
    const s = mk();
    expect(personnelRatio(s)).toBeGreaterThan(0.25);
    expect(personnelRatio(s)).toBeLessThan(0.32); // real 2025: 28,1%
    expect(educationRatio(s)).toBeGreaterThanOrEqual(0.31);
    expect(healthRatio(s)).toBeGreaterThanOrEqual(0.15);
    expect(debtRatio(s)).toBeLessThan(0.3);
    expect(EXEC_2025.rcl).toBe(100653);
  });
  it('execução mensal acumula e o exercício fecha com histórico e nova LOA', () => {
    let s = mk(2);
    s = month(s, 12);
    expect(s.city.history.length).toBe(1);
    expect(s.city.history[0].year).toBe(2027);
    expect(s.city.loa.year).toBe(2028);
    expect(s.city.ytd.months).toBe(0);
    const h = s.city.history[0];
    expect(h.revenue).toBeGreaterThan(130000);
    expect(h.revenue).toBeLessThan(150000);
  }, 30_000);
  it('a IA envia LDO em abril e LOA em setembro, e a Câmara vota a LOA até dezembro', () => {
    let s = mk(3);
    s = month(s, 12);
    const loa = s.legislature.bills.find((b) => b.payload?.tipo === 'loa' && Number(b.payload.year) === 2028);
    expect(loa).toBeTruthy();
    expect(s.city.ldo['2028']).toBeTruthy();
    expect(['aprovada', 'prorrogada']).toContain(s.city.loa.status);
  }, 30_000);
});

describe('Fase 3 — regras fiscais', () => {
  it('limites de pessoal da LRF', () => {
    expect(personnelStatus(0.5)).toBe('ok');
    expect(personnelStatus(0.55)).toBe('alerta');
    expect(personnelStatus(0.58)).toBe('prudencial');
    expect(personnelStatus(0.61)).toBe('excedido');
  });
  it('anterioridade: lei até setembro vale no ano seguinte; depois, noventena empurra (exceto base do IPTU)', () => {
    expect(taxEffectiveYear(2029, 6)).toBe(2030);
    expect(taxEffectiveYear(2029, 11)).toBe(2031);
    expect(taxEffectiveYear(2029, 11, true)).toBe(2030);
  });
  it('LRF art. 21 bloqueia reajuste nos 180 dias finais do mandato', () => {
    expect(inPersonnelFreeze(2032, 7, 2032)).toBe(true);
    const s = asMayor(mk(4));
    s.month = { year: 2032, month: 8 };
    expect(raiseSalaries(s, 0.03)).toContain('LRF art. 21');
  });
  it('operação de crédito respeita 16% da RCL', () => {
    const s = asMayor(mk(5));
    expect(requestCredit(s, 3000, 'saude')).toContain('Liberação prevista');
    expect(requestCredit(s, 50000, 'saude')).toContain('16% da RCL');
  });
  it('rascunho que não fecha ou fere mínimos não pode ser enviado', () => {
    let s = asMayor(mk(6));
    s.month = { year: 2029, month: 8 };
    s = openDraft(s);
    expect(draftChecks(s, s.city.draft!).ok).toBe(true);
    for (let i = 0; i < 6; i++) s = adjustDraft(s, 'educacao', -0.05);
    const chk = draftChecks(s, s.city.draft!);
    expect(chk.ok).toBe(false);
    expect(chk.issues.join(' ')).toContain('31%');
    expect(availableActions(s).find((a) => a.def.id === 'enviar_ploa')!.status).not.toBeNull();
    for (let i = 0; i < 10; i++) s = adjustDraft(s, 'mobilidade', 0.05);
    expect(totalExpense(s.city.draft!)).toBeGreaterThan(0);
  });
});

describe('Fase 3 — governo do jogador', () => {
  it('LOA enviada vira projeto na Câmara e, aprovada, define o orçamento do ano seguinte', () => {
    let s = asMayor(mk(7));
    s.month = { year: 2029, month: 8 };
    s = openDraft(s);
    s = adjustDraft(s, 'saude', 0.05);
    s = adjustDraft(s, 'other', -0.05);
    expect(draftChecks(s, s.city.draft!).ok).toBe(true);
    const saude = s.city.draft!.areas.saude;
    s = performAction(s, 'enviar_ploa');
    const b = s.legislature.bills.find((x) => x.payload?.tipo === 'loa')!;
    expect(b.title).toContain('PPA');
    for (let i = 0; i < 6 && b && s.legislature.bills.find((x) => x.id === b.id)!.stage !== 'lei'; i++) { s.month.month = Math.min(12, s.month.month + 1); legislatureMonthlyStep(s, s.rng); s.legislature.bills.forEach((x) => { if (x.stage === 'plenario') x.scheduled = true; }); }
    const bb = s.legislature.bills.find((x) => x.id === b.id)!;
    if (bb.stage === 'lei') {
      expect(s.city.nextLoa?.year).toBe(2030);
      expect(s.city.nextLoa!.areas.saude).toBeGreaterThanOrEqual(saude);
      expect(s.city.ppa?.status).toBe('aprovado');
    }
  });
  it('Programa de Metas e nomeação de secretário', () => {
    let s = asMayor(mk(8));
    s = performAction(s, 'programa_metas', 'social');
    expect(s.city.metas?.areas).toContain('saude');
    s = performAction(s, 'nomear_secretario', 'educacao|tecnico|');
    expect(s.city.secretaries.educacao.kind).toBe('tecnico');
    expect(secretariatOf(s, 'educacao')).toBeTruthy();
  });
  it('fechamento sem LOA aprovada prorroga o orçamento corrigido', () => {
    const s = mk(9);
    s.month = { year: 2027, month: 12 };
    s.city.nextLoa = null;
    const notes = closeFiscalYear(s, s.rng);
    expect(s.city.loa.status).toBe('prorrogada');
    expect(notes.join(' ')).toContain('Sem LOA aprovada');
    expect(educationRatio(s)).toBeGreaterThanOrEqual(0.31);
  });
  it('save v5 (sem Prefeitura) migra para v6', () => {
    const s = mk(10);
    const raw = JSON.parse(serialize(s));
    delete raw.city;
    raw.saveVersion = 5;
    const { state, report } = loadSave(JSON.stringify(raw));
    expect(report.migratedFrom).toBe(5);
    expect(state.city.loa.year).toBe(2027);
    expect(loadSave(serialize(state)).report.repairs).toEqual([]);
  });
});
