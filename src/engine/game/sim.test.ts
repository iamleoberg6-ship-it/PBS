import { describe, expect, it } from 'vitest';
import { createGame } from './create';
import { advanceMonth } from './turn';
import { availableActions, performAction } from './actions';
import { resolveEvent } from './events';
import { estimateVereadorVotes } from './elections';
import type { GameState } from './types';

function bot(state: GameState, office: 'vereador' | 'prefeito'): GameState {
  let s = state;
  let guard = 0;
  while (!s.gameOver && guard++ < 400) {
    while (s.pendingEvents.length) s = resolveEvent(s, 0);
    const prefs = ['pleitear', 'corpo_a_corpo', 'propaganda', 'arrecadar', 'atividade_partidaria', 'pre_campanha', 'comunidade', 'projeto_lei', 'atender_base', 'zeladoria', 'secretariado', 'lancar_programa', 'acompanhar_programa', 'articular_votos'];
    for (const id of prefs) {
      const a = availableActions(s).find((x) => x.def.id === id && x.status === null);
      if (a && s.actionPoints >= a.def.cost) s = performAction(s, id, id === 'pleitear' ? office : a.def.params?.(s)[0]?.value);
    }
    s = advanceMonth(s);
  }
  return s;
}

const input = { name: 'Teste', birthDate: '1990-03-03', gender: 'x', education: 'superior', profession: 'jornalista' as const, startStatus: 'filiado' as const, startPartyId: 'party_real_psd', bio: '', attributeBonus: { communication: 20, articulation: 20 } };

describe('simulação ponta a ponta', () => {
  it('chega ao fim sem erros e é determinística', () => {
    const a = bot(createGame({ ...input, seed: 42 }), 'vereador');
    const b = bot(createGame({ ...input, seed: 42 }), 'vereador');
    expect(a.gameOver).toBe(true);
    expect(JSON.stringify(a.elections)).toBe(JSON.stringify(b.elections));
    const r = a.elections[0].proportional!;
    expect(r.elected).toHaveLength(55);
    expect(r.electoralQuotient).toBeGreaterThan(90000);
  });
  it('escala de votos plausível', () => {
    expect(estimateVereadorVotes(30)).toBeLessThan(2000);
    expect(estimateVereadorVotes(70)).toBeGreaterThan(20000);
    expect(estimateVereadorVotes(70)).toBeLessThan(60000);
  });
  it('vários seeds rodam até o fim (vereador e prefeito)', () => {
    for (let seed = 1; seed <= 6; seed++) {
      for (const office of ['vereador', 'prefeito'] as const) {
        const s = bot(createGame({ ...input, seed }), office);
        expect(s.gameOver).toBe(true);
      }
    }
  }, 60_000);
});

describe('vereadores reais, Mesa e pesquisas', () => {
  it('começa com os 55 vereadores eleitos em 2024 e bancadas corretas', async () => {
    const { SP_COUNCILLORS_2024, SAO_PAULO } = await import('../data/world');
    const s = createGame({ ...input, seed: 3 });
    expect(SP_COUNCILLORS_2024).toHaveLength(55);
    expect(s.government.councillors.every((c) => c.real)).toBe(true);
    expect(s.government.councilSeatsByParty).toEqual(SAO_PAULO.councilSeatsByParty);
    expect(s.government.councilPresident?.simulated).toBe(true);
  });
  it('gera pesquisas com margem de erro e mantém vereadores reais na Câmara de 2029', () => {
    const s = bot(createGame({ ...input, seed: 9 }), 'prefeito');
    const polls = s.polls.filter((p) => p.scenario === '1º turno');
    expect(polls.length).toBeGreaterThanOrEqual(9);
    expect(polls[0].marginOfError).toBeGreaterThan(1.5);
    const realsReelected = s.government.councillors.filter((c) => c.real).length;
    expect(realsReelected).toBeGreaterThan(15);
    expect(realsReelected).toBeLessThan(55);
  });
  it('mesa é anual', () => {
    const s = bot(createGame({ ...input, seed: 4 }), 'vereador');
    for (const y of [2027, 2028, 2029, 2030, 2031, 2032]) expect(s.flags[`mesa_${y}`]).toBe(true);
  }, 20_000);
});

describe('ideologia, redes e notícias', () => {
  it('todos os 30 partidos têm entrada na escala (valor ou não classificado)', async () => {
    const { PARTIES } = await import('../data/parties');
    const { EXPERT_SCALE, categoryLabel } = await import('../data/ideology');
    for (const p of PARTIES) expect(EXPERT_SCALE[p.id], p.acronym).toBeDefined();
    expect(categoryLabel(EXPERT_SCALE.party_real_pt.value)).toBe('Esquerda');
    expect(categoryLabel(EXPERT_SCALE.party_real_mdb.value)).toBe('Centro-direita');
    expect(categoryLabel(EXPERT_SCALE.party_real_missao.value)).toBe('Não classificado');
  });
  it('influenciador começa com redes grandes; profissões comuns, pequenas', () => {
    const inf = createGame({ ...input, profession: 'influenciador', seed: 1 });
    const prof = createGame({ ...input, profession: 'professor', seed: 1 });
    const tot = (g: GameState) => Object.values(g.player.social.networks).reduce((a, b) => a + b, 0);
    expect(tot(inf)).toBeGreaterThan(1_000_000);
    expect(tot(prof)).toBeLessThan(20_000);
  });
  it('gera notícias ao longo da partida, inclusive sobre o jogador', () => {
    const s = bot(createGame({ ...input, seed: 21 }), 'vereador');
    expect(s.news.length).toBeGreaterThan(60);
    expect(s.news.some((n) => n.aboutPlayer)).toBe(true);
  });
});
