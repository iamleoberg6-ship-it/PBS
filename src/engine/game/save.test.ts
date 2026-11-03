import { describe, expect, it } from 'vitest';
import { createGame } from './create';
import { advanceMonth } from './turn';
import { loadSave, serialize, validateState } from './save';
import { resolveEvent } from './events';
import { SAVE_VERSION } from './types';

const input = { name: 'T', birthDate: '1990-01-01', gender: 'x', education: 's', profession: 'professor' as const, startStatus: 'filiado' as const, startPartyId: 'party_real_psb', bio: '', attributeBonus: {}, seed: 5 };

function play(s: ReturnType<typeof createGame>, months: number) {
  for (let i = 0; i < months && !s.gameOver; i++) {
    while (s.pendingEvents.length) s = resolveEvent(s, 0);
    s = advanceMonth(s);
  }
  return s;
}

describe('Fase 0-C: salvamento', () => {
  it('ida e volta sem perda e sem reparos', () => {
    const s = play(createGame(input), 14);
    const { state, report } = loadSave(serialize(s));
    expect(report.repairs).toEqual([]);
    expect(state).toEqual(s);
  });

  it('continuar de um save produz o mesmo resultado que não salvar (reprodutibilidade)', () => {
    const a = play(createGame(input), 30);
    const mid = play(createGame(input), 15);
    const b = play(loadSave(serialize(mid)).state, 15);
    expect(JSON.stringify(b.elections)).toBe(JSON.stringify(a.elections));
    expect(b.finances).toEqual(a.finances);
  });

  it('migra save no formato v1 (sem Câmara nominal, redes, notícias, ideologia, bens)', () => {
    const s = JSON.parse(serialize(createGame(input)));
    s.saveVersion = 1;
    delete s.government.councillors; delete s.player.social; delete s.news; delete s.polls; delete s.mayorRace;
    delete s.character.ideology; delete s.finances.assets;
    const { state, report } = loadSave(JSON.stringify(s));
    expect(report.migratedFrom).toBe(1);
    expect(state.saveVersion).toBe(SAVE_VERSION);
    expect(state.government.councillors).toHaveLength(55);
    expect(state.finances.netWorth).toBe(state.finances.cash + state.finances.assets - state.finances.debts);
    const after = play(state, 24); // segue jogável
    expect(after.month.year).toBeGreaterThanOrEqual(2028);
  });

  it('repara valores fora dos limites e relações inconsistentes', () => {
    const s = createGame(input);
    s.character.attributes.charisma = 180;
    s.player.recognition = -5;
    s.finances.cash = -1000;
    s.government.councillors.push({ ...s.government.councillors[0] });
    s.player.partyId = 'party_inexistente';
    s.pendingEvents.push({ templateId: 'nao_existe', vars: {} });
    const r = validateState(s);
    expect(r.fatal).toEqual([]);
    expect(s.character.attributes.charisma).toBe(100);
    expect(s.player.recognition).toBe(0);
    expect(s.finances.cash).toBe(0);
    expect(s.finances.debts).toBeGreaterThanOrEqual(1000);
    expect(s.government.councillors).toHaveLength(55);
    expect(s.player.partyId).toBeNull();
    expect(s.pendingEvents).toHaveLength(0);
    expect(r.repairs.length).toBeGreaterThanOrEqual(6);
  });

  it('recusa com mensagem clara: JSON quebrado, versão futura, sem personagem', () => {
    expect(() => loadSave('{oops')).toThrow(/corrompido/);
    const s = JSON.parse(serialize(createGame(input)));
    expect(() => loadSave(JSON.stringify({ ...s, saveVersion: 99 }))).toThrow(/mais nova/);
    delete s.character;
    expect(() => loadSave(JSON.stringify(s))).toThrow(/Personagem/);
  });
});

describe('Fase 0-B: patrimônio', () => {
  it('patrimônio = caixa + bens − dívidas em todos os meses', () => {
    let s = createGame({ ...input, profession: 'desempregado', seed: 2 });
    for (let i = 0; i < 40 && !s.gameOver; i++) {
      while (s.pendingEvents.length) s = resolveEvent(s, 0);
      s = advanceMonth(s);
      const f = s.finances;
      expect(f.netWorth).toBe(Math.round(f.cash + f.assets - f.debts));
      expect(f.cash).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(f.netWorth)).toBe(true);
    }
  });
  it('desempregado acumula dívida com juros; quem tem renda forma patrimônio', () => {
    const poor = play(createGame({ ...input, profession: 'desempregado', seed: 2 }), 12);
    const rich = play(createGame({ ...input, profession: 'medico', seed: 2 }), 12);
    expect(poor.finances.debts).toBeGreaterThan(0);
    expect(rich.finances.netWorth).toBeGreaterThan(createGame({ ...input, profession: 'medico', seed: 2 }).finances.netWorth);
  });
});
