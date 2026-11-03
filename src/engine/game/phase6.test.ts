import { describe, expect, it } from 'vitest';
import { createGame } from './create';
import { advanceMonth } from './turn';
import { performAction } from './actions';
import { newMandate, endMandate, rememberVotes } from './careers';
import { loadSave, serialize } from './save';
import { TIPS, dismissTip, pendingTip, resetTutorial, setTutorial } from './tutorial';
import { resolveConvention } from './elections';
import type { GameState } from './types';

const base = { name: 'T', birthDate: '1985-01-01', gender: 'x', education: 's', bio: '', attributeBonus: {} };
const mk = (seed = 2) => createGame({ ...base, profession: 'advogado', startStatus: 'militante', startPartyId: 'party_real_psd', seed });

describe('Fase 6 — guia do jogador', () => {
  it('começa pela introdução, em ordem, e cada dica aparece uma vez', () => {
    let s = mk();
    expect(pendingTip(s)?.id).toBe('intro_agenda');
    s = dismissTip(s, 'intro_agenda');
    expect(pendingTip(s)?.id).toBe('intro_menu');
    s = dismissTip(s, 'intro_menu');
    s = dismissTip(s, 'intro_porque');
    s = dismissTip(s, 'intro_porque');
    expect(s.tutorial!.seen.filter((x) => x === 'intro_porque').length).toBe(1);
  });
  it('dicas de contexto aparecem quando a situação acontece', () => {
    let s = mk();
    for (const t of ['intro_agenda', 'intro_menu', 'intro_porque', 'partido_interno', 'redes', 'evento']) s = dismissTip(s, t);
    s.player.mandate = newMandate('vereador', '2025-01-01', '2028-12-31');
    const ids: string[] = [];
    for (let i = 0; i < 5 && pendingTip(s); i++) { const t = pendingTip(s)!; ids.push(t.id); s = dismissTip(s, t.id); }
    expect(ids).toEqual(expect.arrayContaining(['mandato', 'votacoes', 'equipe']));
  });
  it('desligar e recomeçar o guia', () => {
    let s = setTutorial(mk(), false);
    expect(pendingTip(s)).toBeNull();
    s = resetTutorial(dismissTip(s, 'intro_agenda'));
    expect(pendingTip(s)?.id).toBe('intro_agenda');
  });
  it('partidas antigas em andamento não reveem a introdução', () => {
    let s = mk();
    for (let i = 0; i < 4; i++) s = advanceMonth(s.pendingEvents.length ? { ...s, pendingEvents: [] } : s);
    const raw = JSON.parse(serialize(s));
    delete raw.tutorial;
    const back = loadSave(JSON.stringify(raw)).state as GameState;
    expect(back.tutorial!.seen).toContain('intro_agenda');
    expect(back.tutorial!.seen).not.toContain('equipe');
    expect(TIPS.every((t) => typeof t.when === 'function')).toBe(true);
  });
});

describe('Fase 6 — por que mudou', () => {
  it('o resumo do mês soma as variações e mostra as causas', () => {
    let s = mk();
    s = performAction(s, 'trabalhar');
    s = advanceMonth(s);
    const r = s.monthReport!;
    expect(r.length).toBeGreaterThan(0);
    const cash = r.find((x) => x.key === 'cash');
    expect(cash?.causes.length).toBeGreaterThan(0);
    expect(r.every((x) => x.causes.every((c) => typeof c.cause === 'string' && c.cause.length > 3))).toBe(true);
  });
});

describe('Fase 6 — balanceamento de carreira', () => {
  it('votos e cargos deixam memória: o reconhecimento não volta ao zero', () => {
    const s = mk();
    s.player.recognition = 10;
    rememberVotes(s, 20_000, 'cidade');
    expect(s.player.recognitionFloor).toBeGreaterThanOrEqual(29);
    expect(s.player.recognition).toBeGreaterThanOrEqual(s.player.recognitionFloor!);
    s.player.mandate = newMandate('vereador', '2025-01-01', '2028-12-31');
    endMandate(s, 'fim');
    expect(s.player.recognitionFloor).toBeGreaterThanOrEqual(29);
    let t = s;
    for (let i = 0; i < 24; i++) t = advanceMonth(t.pendingEvents.length ? { ...t, pendingEvents: [] } : t);
    expect(t.player.recognition).toBeGreaterThanOrEqual(t.player.recognitionFloor! - 0.01);
  });
  it('convenção usa o cargo disputado (correção: deputado não era tratado como vereador)', () => {
    const s = mk();
    s.player.candidacy = { office: 'deputado_estadual', year: 2030, status: 'pretendida', checks: [], coalitionPartyIds: [], campaignPoints: 0, account: { fefc: 0, donations: 0, ownFunds: 0, spent: 0 } as never, irregularities: 0 };
    expect(resolveConvention(s, s.rng).text).toMatch(/deputado\(a\) estadual/);
  });
});
