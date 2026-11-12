import { describe, it, expect } from 'vitest';
import { createGame, advanceMonth, availableActions, performAction, resolveEvent, fatigueMultiplier, detectScenes, apuracaoData, pastApuracoes, type GameState, type Scene } from '../index';

const PREFS = ['pleitear', 'atividade_partidaria', 'mobilizar_filiados', 'rede_contatos', 'montar_equipe', 'plano_campanha', 'arrecadar', 'corpo_a_corpo', 'comunicacao', 'comicio', 'lideranca_local', 'pre_campanha', 'comunidade', 'redes'];
function step(s: GameState) {
  while (s.pendingEvents.length) s = resolveEvent(s, 0);
  const P = [...PREFS]; const used = new Set<string>(); let g = 0;
  while (s.actionPoints > 0 && g++ < 15) {
    const opts = availableActions(s).filter((a) => a.status === null && P.includes(a.def.id) && s.actionPoints >= a.def.cost && !(a.def.cost === 0 && used.has(a.def.id)));
    if (!opts.length) break;
    const a = opts.sort((x, y) => (fatigueMultiplier(s, y.def.id).mult - fatigueMultiplier(s, x.def.id).mult) || P.indexOf(x.def.id) - P.indexOf(y.def.id))[0];
    const before = s.actionPoints; const opt = a.def.params?.(s) ?? [];
    s = performAction(s, a.def.id, a.def.id === 'pleitear' ? 'vereador' : opt[(g * 7 + s.month.month) % Math.max(1, opt.length)]?.value);
    if (a.def.cost === 0) used.add(a.def.id);
    if (s.actionPoints === before && a.def.cost > 0) P.splice(P.indexOf(a.def.id), 1);
  }
  return advanceMonth(s);
}
const mk = () => createGame({ name: 'Teste Cena', birthDate: '1990-01-01', gender: 'F', education: 'superior', profession: 'economista', startStatus: 'militante', startPartyId: 'party_real_pt', bio: '', seed: 41,
  attributeBonus: { articulation: 14, negotiation: 14, politicalKnowledge: 8, communication: 4 }, family: { marital: 'casado', partnerName: 'Ana', partnerGender: 'F', children: [], parentsAlive: true } } as never);

describe('Fase 13 — cenas', () => {
  it('a eleição municipal com o jogador gera a noite da apuração com os números do registro', () => {
    let s = mk(); const all: Scene[] = [];
    while (!(s.month.year === 2028 && s.month.month === 11)) { const n = step(s); all.push(...detectScenes(s, n)); s = n; }
    const apu = all.find((x) => x.kind === 'apuracao');
    expect(apu?.apuracao?.office).toBe('vereador');
    const d = apuracaoData(s, apu!.apuracao!)!;
    const rec = s.elections.find((e) => e.year === 2028)!;
    expect(d.mode).toBe('proporcional');
    expect(d.playerVotes).toBe(rec.playerVotes);
    expect(d.candidates.some((c) => c.isPlayer && c.votes === rec.playerVotes)).toBe(true);
    expect(d.outcome).toBe(rec.playerElected ? 'eleito' : 'nao_eleito');
    expect(pastApuracoes(s).length).toBe(1);
  }, 60000);

  it('detecta posse, nascimento, promoção e filiação comparando estados', () => {
    const a = mk(); const b = structuredClone(a);
    b.player.mandate = { office: 'vereador', start: { year: 2029, month: 1 }, end: { year: 2032, month: 12 } } as never;
    b.personal!.family.push({ id: 'kid1', name: 'Bia Cena', relation: 'filho', gender: 'F', birthYear: 2027, mood: 80, trait: 'apoiador', politicalInterest: 10 } as never);
    b.player.partyId = 'party_real_psol';
    const kinds = detectScenes(a, b).map((x) => x.kind);
    expect(kinds).toEqual(expect.arrayContaining(['posse', 'nascimento', 'filiacao']));
    const c = structuredClone(a); c.player.staff = { bossId: 'x', bossName: 'Fulano', rank: 'assessor' } as never;
    const d = structuredClone(c); d.player.staff = { ...(c.player.staff as object), rank: 'especial' } as never;
    expect(detectScenes(a, c).map((x) => x.kind)).toContain('nomeacao');
    expect(detectScenes(c, d).map((x) => x.kind)).toContain('promocao');
    expect(detectScenes(a, structuredClone(a))).toEqual([]);
  });
});
