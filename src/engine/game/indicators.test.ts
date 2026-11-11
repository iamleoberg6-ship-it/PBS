import { describe, expect, it } from 'vitest';
import { createGame } from './create';
import { advanceMonth } from './turn';
import { performAction } from './actions';
import { newMandate } from './careers';
import { loadSave, serialize } from './save';
import { INDICATORS, addImpulse, indicatorValue, indicatorsMonthlyStep, playerEffect, regionalValue } from './indicators';
import type { GameState } from './types';

const mk = () => createGame({ name: 'Ana Lima', birthDate: '1980-01-01', gender: 'Feminino', education: 's', bio: '', attributeBonus: { articulation: 15 }, profession: 'medico', startStatus: 'militante', startPartyId: 'party_real_psd', seed: 4 });

describe('Indicadores sociais', () => {
  it('começam nos dados reais de partida', () => {
    const s = mk();
    expect(indicatorValue(s, 'c_mortinf')).toBeCloseTo(10.0, 0);
    expect(indicatorValue(s, 'b_pobreza')).toBeCloseTo(23.1, 0);
    expect(indicatorValue(s, 'b_desemp')).toBe(5.6);
    for (const d of INDICATORS) expect(Number.isFinite(indicatorValue(s, d.id))).toBe(true);
    expect(regionalValue(s, 'c_mortinf', 'leste2')).toBeGreaterThan(regionalValue(s, 'c_mortinf', 'oeste'));
  });
  it('indicação atendida do vereador melhora a saúde da região aos poucos e rende aprovação', () => {
    const s = mk();
    s.player.mandate = newMandate('vereador', '2025-01-01', '2028-12-31');
    s.player.homeRegion = 'leste2';
    const before = regionalValue(s, 'c_mortinf', 'leste2');
    addImpulse(s, 'cidade', 'saude', 2, 4, 'teste', 'leste2');
    const ap = s.player.mandate.approval;
    for (let i = 0; i < 4; i++) indicatorsMonthlyStep(s);
    expect(regionalValue(s, 'c_mortinf', 'leste2')).toBeLessThan(before);
    expect(playerEffect(s, 'c_mortinf')).toBeLessThan(0);
    expect(s.player.mandate.approval).toBeGreaterThan(ap);
  });
  it('emenda executada e lei sancionada viram impulsos automaticamente', () => {
    const s = mk();
    s.player.mandate = newMandate('vereador', '2025-01-01', '2028-12-31');
    s.month = { year: 2027, month: 10 };
    s.actionPoints = 5; s.officePoints = 5;
    s.player.mandate.relationExecutive = 100;
    let n = s;
    for (let i = 0; i < 6 && !(n.indicators?.pending.length); i++) n = performAction(n, 'emendas', 'educacao');
    expect(n.indicators!.pending.some((p) => p.ind === 'c_ideb')).toBe(true);
  });
  it('rodam no turno e sobrevivem ao save', () => {
    let s: GameState = mk();
    for (let i = 0; i < 13; i++) { s = advanceMonth(s); s.pendingEvents = []; }
    expect(s.indicators!.history.length).toBeGreaterThan(0);
    delete (s as Partial<GameState>).indicators;
    const { state } = loadSave(serialize(s));
    expect(state.indicators).toBeTruthy();
  });
});

import { aiGovernmentsStep, governments, mayorProfile, profileForParty } from './govprofile';
import { regionBaseReal, subprefValue } from './indicators';

describe('Fase 9b — perfil ideológico dos governos da IA e dados por subprefeitura', () => {
  it('partidos à esquerda e à direita geram perfis de governo opostos', () => {
    const left = profileForParty('party_real_psol');
    const right = profileForParty('party_real_novo');
    expect(left.tax).toBe('aumentar');
    expect(left.fiscal).toBe('expansao');
    expect(right.tax).toBe('reduzir');
    expect(right.fiscal).toBe('ajuste');
    expect(left.priority.social).toBeGreaterThan(right.priority.social);
    expect(right.priority.seguranca).toBeGreaterThan(left.priority.seguranca);
  });
  it('pessoa real no cargo não é simulada; personagem do jogo segue o perfil', () => {
    const s = mk();
    expect(governments(s).cidade.real).toBe(true);
    expect(mayorProfile(s)).toBeNull();
    s.government.mayor = { personId: 'ai_mayor', name: 'Prefeito Fictício', partyId: 'party_real_novo', real: false };
    expect(mayorProfile(s)?.tax).toBe('reduzir');
    s.stateWorld.governor = { ...s.stateWorld.governor, real: false, isPlayer: false, partyId: 'party_real_psol', name: 'Governadora Fictícia' };
    for (let i = 0; i < 24; i++) aiGovernmentsStep(s, s.rng);
    const gi = s.stateWorld.govIndices!;
    expect(gi.habitacao).toBeGreaterThan(gi.seguranca);
  });
  it('regiões usam os dados reais das subprefeituras e da pesquisa de mobilidade', () => {
    const s = mk();
    expect(regionBaseReal('c_mortinf', 'oeste')!).toBeLessThan(regionBaseReal('c_mortinf', 'norte2')!);
    expect(subprefValue(s, 'c_mortinf', 'Freguesia-Brasilândia', 'norte2')).toBeCloseTo(15.8, 0);
    expect(regionBaseReal('c_desloc', 'sul2')).toBe(166);
    expect(indicatorValue(s, 'b_transito')).toBeGreaterThan(17);
  });
});
