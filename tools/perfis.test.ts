// Robôs de balanceamento da Fase 4: oito perfis do plano (rico, pobre, popular, desconhecido, ideológico,
// pragmático, independente, partidário) + assessor. Mede taxa de eleição, votos, gasto e diversidade de estratégia.
// Rodar: npm run balance
import { it, expect } from 'vitest';
import { playerElectoralScore, campaignFactor, createGame, advanceMonth, availableActions, performAction, resolveEvent, fatigueMultiplier, partyIdeology, REGIONS, type GameState, type NewGameInput } from '../src/engine';

interface Profile {
  id: string;
  input: Partial<NewGameInput>;
  prefs: string[];
  param?: (s: GameState, id: string) => string | undefined;
  setup?: (s: GameState) => GameState;
  oncePerMonth?: string[];
}

const ideo = (p: string) => Object.fromEntries(Object.entries(partyIdeology(p)).map(([k, v]) => [k, v ?? 0]));
const CAMPAIGN = ['montar_equipe', 'plano_campanha', 'arrecadar', 'corpo_a_corpo', 'comunicacao', 'comicio', 'lideranca_local', 'pesquisa_interna'];
// Ações genéricas que qualquer jogador razoável também usa depois das preferências do perfil.
const GENERIC = ['pre_campanha', 'comunidade', 'redes', 'atividade_partidaria', ...CAMPAIGN];

const PROFILES: Profile[] = [
  { id: 'rico', input: { profession: 'empresario', startStatus: 'herdeiro', startPartyId: 'party_real_psd' },
    prefs: ['pleitear', 'autofinanciar', ...CAMPAIGN, 'pre_campanha', 'rede_contatos', 'comunidade'],
    param: (s, id) => (id === 'autofinanciar' ? '200000' : id === 'comunicacao' ? 'tv' : undefined) },
  { id: 'pobre', input: { profession: 'desempregado', startStatus: 'militante', startPartyId: 'party_real_pt' },
    prefs: ['pleitear', 'lideranca_local', 'corpo_a_corpo', 'comunidade', 'atividade_partidaria', 'arrecadar', 'trabalho_extra', 'pre_campanha', 'plano_campanha'] },
  { id: 'popular', input: { profession: 'influenciador', startStatus: 'filiado', startPartyId: 'party_real_pode' },
    prefs: ['pleitear', 'redes', 'comunicacao', 'pre_campanha', 'arrecadar', 'plano_campanha', 'corpo_a_corpo'],
    param: (_s, id) => (id === 'comunicacao' ? 'digital' : undefined) },
  { id: 'desconhecido', input: { profession: 'estudante', startStatus: 'filiado', startPartyId: 'party_real_psb' },
    prefs: ['pleitear', 'estudar', 'comunidade', 'pre_campanha', ...CAMPAIGN] },
  { id: 'ideologico', input: { profession: 'professor', startStatus: 'militante', startPartyId: 'party_real_psol', ideology: ideo('party_real_psol') },
    prefs: ['pleitear', 'atividade_partidaria', 'comunidade', 'plano_campanha', 'contraste', 'corpo_a_corpo', 'comunicacao', 'arrecadar'],
    param: (s, id) => (id === 'plano_campanha' ? (s.player.candidacy?.plan?.tone === 'ataque' ? 'tema|educacao' : 'tom|ataque') : undefined) },
  { id: 'pragmatico', input: { profession: 'advogado', startStatus: 'filiado', startPartyId: 'party_real_mdb' },
    prefs: ['pleitear', 'rede_contatos', 'aproximar_faccao', 'negociar_faccao', 'lideranca_local', ...CAMPAIGN] },
  { id: 'independente', input: { profession: 'medico', startStatus: 'filiado', startPartyId: 'party_real_novo' },
    prefs: ['pleitear', 'comunidade', 'redes', 'estudar', 'trabalho_extra', ...CAMPAIGN] },
  { id: 'partidario', input: { profession: 'sindicalista', startStatus: 'militante', startPartyId: 'party_real_pt' },
    prefs: ['pleitear', 'atividade_partidaria', 'mobilizar_filiados', 'aproximar_faccao', 'candidatar_diretorio', 'fundo_partidario', ...CAMPAIGN] },
  { id: 'assessor', input: { profession: 'servidor', startStatus: 'militante', startPartyId: 'party_real_mdb' },
    prefs: ['cargo_assessor', 'cumprir_demanda', 'pleitear', 'pedir_promocao', 'iniciativa_gabinete'], oncePerMonth: ['cumprir_demanda', 'iniciativa_gabinete'],
    param: (s, id) => (id === 'iniciativa_gabinete' ? 'bastidores' : undefined) },
];

function run(p: Profile, seed: number) {
  let s = createGame({ name: 'Bot', birthDate: '1988-05-05', gender: 'x', education: 's', bio: '', attributeBonus: { articulation: 10, communication: 10 }, seed, homeRegion: REGIONS[seed % REGIONS.length].id, ...(p.input as NewGameInput) });
  const used = new Set<string>();
  while (!(s.month.year === 2028 && s.month.month === 11)) {
    while (s.pendingEvents.length) s = resolveEvent(s, 0);
    let guard = 0;
    const prefs = [...new Set([...p.prefs, ...GENERIC])];
    const freeUsed = new Set<string>();
    while (s.actionPoints > 0 && guard++ < 15) {
      const opts = availableActions(s).filter((a) => a.status === null && prefs.includes(a.def.id) && s.actionPoints >= a.def.cost && !((a.def.cost === 0 || p.oncePerMonth?.includes(a.def.id)) && freeUsed.has(a.def.id)));
      if (!opts.length) break;
      const a = opts.sort((x, y) => (fatigueMultiplier(s, y.def.id).mult - fatigueMultiplier(s, x.def.id).mult) || prefs.indexOf(x.def.id) - prefs.indexOf(y.def.id))[0];
      const before = s.actionPoints;
      const opt = a.def.params?.(s) ?? [];
      const param = a.def.id === 'pleitear' ? 'vereador' : p.param?.(s, a.def.id) ?? opt[Math.floor(guard * 7 + s.month.month) % Math.max(1, opt.length)]?.value;
      s = performAction(s, a.def.id, param);
      used.add(a.def.id);
      if (a.def.cost === 0 || p.oncePerMonth?.includes(a.def.id)) freeUsed.add(a.def.id);
      if (s.actionPoints === before && a.def.cost > 0) prefs.splice(prefs.indexOf(a.def.id), 1);
    }
    s = advanceMonth(s);
  }
  const e = s.elections[0];
  const c = s.player.candidacy;
  return {
    votes: e?.playerVotes ?? 0, elected: !!e?.playerElected, spent: c?.account.spent ?? 0,
    ran: c?.status === 'registrada', used: used.size, rec: Math.round(s.player.recognition), base: Math.round(s.player.base), cp: Math.round(c?.campaignPoints ?? 0), score: Math.round(playerElectoralScore(s)), factor: Math.round(campaignFactor(s) * 100) / 100, staffTrust: s.player.staff?.trust ?? null,
  };
}

it('perfis de jogador (Fase 4)', () => {
  const rows: Record<string, ReturnType<typeof run>[]> = {};
  for (const p of PROFILES) rows[p.id] = [1, 2, 3, 4, 5].map((seed) => run(p, seed));
  for (const [id, rs] of Object.entries(rows)) {
    const avg = (f: (r: (typeof rs)[0]) => number) => Math.round(rs.reduce((a, r) => a + f(r), 0) / rs.length);
    console.log(`${id.padEnd(13)} eleitos ${rs.filter((r) => r.elected).length}/5 · concorreu ${rs.filter((r) => r.ran).length}/5 · votos ${avg((r) => r.votes)} · gasto R$ ${avg((r) => r.spent).toLocaleString('pt-BR')} · ações distintas ${avg((r) => r.used)} · rec ${avg((r) => r.rec)} base ${avg((r) => r.base)} pts ${avg((r) => r.cp)} score ${avg((r) => r.score)} fator ${(rs.reduce((a, r) => a + r.factor, 0) / rs.length).toFixed(2)}`);
  }
  const winners = Object.values(rows).filter((rs) => rs.some((r) => r.elected)).length;
  expect(winners).toBeGreaterThanOrEqual(3); // mais de uma estratégia viável
  const rich = rows.rico.filter((r) => r.elected).length;
  const others = Object.entries(rows).filter(([k]) => k !== 'rico').reduce((a, [, rs]) => a + rs.filter((r) => r.elected).length, 0);
  expect(others).toBeGreaterThan(rich); // dinheiro sozinho não decide
}, 600_000);
