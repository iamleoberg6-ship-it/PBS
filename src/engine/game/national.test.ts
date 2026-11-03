import { describe, expect, it } from 'vitest';
import { createGame } from './create';
import { performAction, availableActions } from './actions';
import { newMandate, startUpperMandate } from './careers';
import { advanceMonth } from './turn';
import { BR_REGIONS, initNational, nationalIndex, nationalVoteEffects } from './national';
import { upperMonthlyStep } from './upper';
import { loadSave, serialize } from './save';
import type { GameState } from './types';

const base = { name: 'T', birthDate: '1980-01-01', gender: 'x', education: 's', bio: '', attributeBonus: {} };
const mk = () => createGame({ ...base, profession: 'advogado', startStatus: 'militante', startPartyId: 'party_real_psd', seed: 4 });
const fed = () => { const s = mk(); s.player.recognition = 60; startUpperMandate(s, 'deputado_federal', '2031-02-01', '2035-01-31', 'teste'); return s; };

describe('Brasil por regiões', () => {
  it('dados reais: população do Censo 2022 e eleitorado de 2026', () => {
    const n = initNational();
    expect(BR_REGIONS.reduce((a, r) => a + n.regions[r].population, 0)).toBe(203_062_512);
    expect(n.regions.nordeste.electorate).toBe(43_529_845);
    expect(n.regions.sudeste.electorate).toBe(66_329_375);
  });
  it('posse federal cria projeção nacional (maior no Sudeste)', () => {
    const s = fed();
    expect(s.national!.player.sudeste.recognition).toBeGreaterThan(s.national!.player.norte.recognition);
    expect(availableActions(s).some((a) => a.def.id === 'up_agenda_nacional')).toBe(true);
    const v = mk(); v.player.mandate = newMandate('vereador', '2029-01-01', '2032-12-31');
    expect(availableActions(v).some((a) => a.def.id === 'up_agenda_nacional')).toBe(false);
  });
  it('emenda federal pode ir para outra região e rende projeção lá quando paga', () => {
    let s = fed();
    s = performAction(s, 'up_emenda', 'br_nordeste|saúde|10');
    expect(s.player.mandate!.upper!.amendments.at(-1)!.region).toBe('br_nordeste');
    const rec0 = s.national!.player.nordeste.recognition;
    s.player.mandate!.upper!.relationGov = 100;
    for (let i = 0; i < 30 && !s.player.mandate!.upper!.amendments.at(-1)!.paid; i++) upperMonthlyStep(s, s.rng);
    expect(s.national!.funds.nordeste).toBe(10);
    expect(s.national!.player.nordeste.recognition).toBeGreaterThan(rec0);
  });
  it('voto numa matéria regional mexe na aprovação da região afetada', () => {
    const s = fed();
    const before = s.national!.player.nordeste.approval;
    const other = s.national!.player.sul.approval;
    nationalVoteEffects(s, 'Recursos para obras hídricas no semiárido', 'S', 0.4, 50, true);
    expect(s.national!.player.nordeste.approval - before).toBeGreaterThan(s.national!.player.sul.approval - other);
    const ne = s.national!.regions.nordeste.unemployment;
    expect(ne).toBeLessThan(7.1);
  });
  it('agenda nacional aumenta a projeção e o índice nacional; save preserva', () => {
    let s = fed();
    const idx = nationalIndex(s, 'recognition');
    s = performAction(s, 'up_agenda_nacional', 'br_norte');
    expect(nationalIndex(s, 'recognition')).toBeGreaterThan(idx);
    s = advanceMonth(s.pendingEvents.length ? { ...s, pendingEvents: [] } : s);
    const back = loadSave(serialize(s)).state as GameState;
    expect(back.national!.player.norte.recognition).toBeCloseTo(s.national!.player.norte.recognition, 5);
    const raw = JSON.parse(serialize(s)); delete raw.national;
    expect((loadSave(JSON.stringify(raw)).state as GameState).national!.player.sudeste.recognition).toBeGreaterThan(0);
  });
});
