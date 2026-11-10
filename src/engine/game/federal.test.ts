import { describe, expect, it } from 'vitest';
import { createGame } from './create';
import { advanceMonth } from './turn';
import { availableActions, performAction } from './actions';
import { resolveEvent } from './events';
import { startUpperMandate } from './careers';
import { MINISTRIES, aiPresidentTakesOffice, becomeMinister, buildCoalition, congressVote, decideSanction, initFederal, playerMinistry } from './federal';
import { previewEligibility } from './elections';
import { loadSave, serialize } from './save';
import type { GameState } from './types';

const base = { name: 'T', birthDate: '1970-01-01', gender: 'x', education: 's', bio: '', attributeBonus: { management: 15, politicalKnowledge: 15, negotiation: 10 } };
const mk = (party = 'party_real_psd', seed = 6) => createGame({ ...base, profession: 'medico', startStatus: 'militante', startPartyId: party, seed });
const step = (s: GameState) => { let x = s; while (x.pendingEvents.length) x = resolveEvent(x, x.pendingEvents[0].templateId.startsWith('convite') ? 99 : 0); return advanceMonth(x); };
const fictionalPresident = (s: GameState, partyId = 'party_real_psd') => {
  s.month = { year: 2031, month: 1 };
  s.stateWorld.president = { id: 'pres_x', name: 'Presidente Fictício', partyId, real: false, since: 2031, until: 2034, consecutiveTerms: 1 };
  s.federal = initFederal();
};

describe('Governo federal — ministérios e coalizão', () => {
  it('13 ministérios, cada um com ações próprias', () => {
    expect(MINISTRIES).toHaveLength(13);
    const ids = new Set(MINISTRIES.flatMap((m) => m.actions.map((a) => a.id)));
    expect(ids.size).toBe(MINISTRIES.length * 3);
  });
  it('coalizão ampla tem mais deputados que governo centralizado', () => {
    const s = mk();
    const wide = buildCoalition(s, 'party_real_psd', 'coalizao');
    const narrow = buildCoalition(s, 'party_real_psd', 'centralizador');
    expect(wide.length).toBeGreaterThan(narrow.length);
  });
  it('presidente real não tem ministério simulado nem faz convites', () => {
    const s = mk();
    expect(s.stateWorld.president.real).toBe(true);
    expect(aiPresidentTakesOffice(s, s.rng)).toEqual([]);
    expect(Object.keys(s.federal!.cabinet)).toHaveLength(0);
  });
  it('presidente personagem do jogo monta ministério; deputado de partido próximo pode ser convidado', () => {
    let invited = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const s = mk('party_real_psd', seed);
      s.player.recognition = 70;
      startUpperMandate(s, 'deputado_federal', '2031-02-01', '2035-01-31', 'teste');
      fictionalPresident(s);
      aiPresidentTakesOffice(s, s.rng);
      expect(Object.keys(s.federal!.cabinet)).toHaveLength(13);
      if (s.pendingEvents.some((e) => e.templateId === 'convite_ministerio')) invited++;
    }
    expect(invited).toBeGreaterThan(0);
  });
});

describe('Governo federal — jogador ministro', () => {
  it('deputado nomeado ministro fica licenciado e volta ao mandato ao sair (CF art. 56)', () => {
    let s = mk();
    startUpperMandate(s, 'deputado_federal', '2031-02-01', '2035-01-31', 'teste');
    fictionalPresident(s);
    aiPresidentTakesOffice(s, s.rng);
    s.pendingEvents = [];
    becomeMinister(s, 'saude');
    expect(s.player.mandate!.office).toBe('ministro');
    expect(s.player.mandate!.minister!.licensed!.office).toBe('deputado_federal');
    const acts = availableActions(s).map((a) => a.def.id);
    expect(acts).toContain('min_acao');
    const opts = availableActions(s).find((a) => a.def.id === 'min_acao')!.def.params!(s).map((o) => o.value);
    expect(opts.some((v) => v.startsWith('sau_mutirao|'))).toBe(true);
    expect(opts.some((v) => v.startsWith('edu_'))).toBe(false); // cada pasta tem as suas
    const b0 = s.player.mandate!.minister!.budgetLeft;
    s = performAction(s, 'min_acao', 'sau_mutirao|nordeste');
    expect(playerMinistry(s)!.budgetLeft).toBeLessThan(b0);
    expect(s.federal!.pending.length).toBeGreaterThan(0);
    s = performAction(s, 'min_sair');
    expect(s.player.mandate!.office).toBe('deputado_federal');
  });
  it('ministro precisa deixar o cargo seis meses antes para disputar eleição', () => {
    const s = mk();
    fictionalPresident(s);
    becomeMinister(s, 'educacao');
    s.month = { year: 2034, month: 2 };
    s.player.candidacy = { office: 'senador', year: 2034, status: 'pretendida', checks: [], coalitionPartyIds: [], campaignPoints: 0, account: { fefc: 0, donations: 0, ownFunds: 0, spent: 0 }, irregularities: 0 };
    const d = previewEligibility(s, 'senador', 2034).find((c) => c.id === 'desincompatibilizacao');
    expect(d?.ok).toBe(false);
    expect(availableActions(s).some((a) => a.def.id === 'renunciar_concorrer')).toBe(true);
  });
});

describe('Governo federal — jogador presidente e vice', () => {
  const asPresident = () => {
    let s = mk('party_real_pt', 3);
    s.month = { year: 2030, month: 12 };
    s.generalElections.push({ year: 2030, presidentWinner: { id: 'character_player', name: 'T', partyId: 'party_real_pt', isPlayer: true }, playerElected: true, playerOffice: 'presidente', playerVotes: 60_000_000, alesp: { elected: [], audit: [] }, camara: { elected: [], audit: [] }, senate: {}, senateWinners: [], governorWinner: null, councillorRuns: [], candidatePartyById: {}, runoffPending: null } as never);
    s.player.candidacy = { office: 'presidente', year: 2030, status: 'registrada', checks: [], coalitionPartyIds: [], campaignPoints: 0, account: { fefc: 0, donations: 0, ownFunds: 0, spent: 0 }, irregularities: 0, viceName: 'Vice Teste' };
    s = step(s);
    return s;
  };
  it('posse em 5/1 com ministério, base e ações presidenciais', () => {
    const s = asPresident();
    expect(s.player.mandate?.office).toBe('presidente');
    expect(s.player.mandate?.since).toBe('2031-01-05');
    expect(Object.keys(s.federal!.cabinet)).toHaveLength(13);
    expect(s.federal!.base.camara).toBeGreaterThan(0);
    const ids = availableActions(s).map((a) => a.def.id);
    for (const id of ['pres_estilo', 'pres_nomear', 'pres_proposta', 'pres_fiscal', 'pres_pronunciamento']) expect(ids).toContain(id);
  });
  it('MP vale na hora e vai a votação; política fiscal só uma vez por ano', () => {
    let s = asPresident();
    s = performAction(s, 'pres_proposta', 'mp_minimo');
    expect(s.federal!.bills.at(-1)!.kind).toBe('MP');
    s = performAction(s, 'pres_fiscal', 'ajuste');
    expect(availableActions(s).find((a) => a.def.id === 'pres_fiscal')!.status).not.toBeNull();
    for (let i = 0; i < 4; i++) s = step(s);
    expect(['aprovado', 'caducou']).toContain(s.federal!.bills.find((b) => b.measure === 'mp_minimo')!.status);
  });
  it('sanção ou veto de projetos do Congresso; quórum de PEC é 3/5', () => {
    let s = asPresident();
    for (let i = 0; i < 6 && !s.federal!.sanctions.length; i++) s = step(s);
    expect(s.federal!.sanctions.length).toBeGreaterThan(0);
    const x = s.federal!.sanctions.at(-1)!;
    s = decideSanction(s, x.id, 'vetar');
    s = step(s);
    expect(s.federal!.sanctions.find((v) => v.id === x.id)!.outcome).toMatch(/Veto/);
    expect(congressVote(s, s.rng, 0, 0, 'PEC').rule).toMatch(/308/);
  });
  it('presidente sobrevive ao resto da partida e o save preserva o governo', () => {
    let s = asPresident();
    for (let i = 0; i < 24; i++) s = step(s);
    expect(s.federal!.economy.inflation).toBeGreaterThan(0);
    expect(s.federal!.economy.debt).toBeGreaterThan(30);
    const back = loadSave(serialize(s)).state as GameState;
    expect(back.federal!.cabinet.fazenda?.name).toBe(s.federal!.cabinet.fazenda?.name);
  });
  it('vice eleito na chapa toma posse com o presidente e pode acumular um ministério', () => {
    let s = mk('party_real_psd', 4);
    s.month = { year: 2030, month: 12 };
    s.generalElections.push({ year: 2030, presidentWinner: { id: 'p_x', name: 'Cabeça de Chapa', partyId: 'party_real_mdb', viceIsPlayer: true }, playerElected: true, playerOffice: 'vice_presidente', playerVotes: 50_000_000, alesp: { elected: [], audit: [] }, camara: { elected: [], audit: [] }, senate: {}, senateWinners: [], governorWinner: null, councillorRuns: [], candidatePartyById: {}, runoffPending: null } as never);
    s = step(s);
    expect(s.player.mandate?.office).toBe('vice_presidente');
    expect(s.stateWorld.president.name).toBe('Cabeça de Chapa');
    s = performAction(s, 'vp_ministerio', 'saude');
    expect(playerMinistry(s)?.ministry).toBe('saude');
    expect(availableActions(s).map((a) => a.def.id)).toContain('min_acao');
  });
  it('presidente (35 anos) — idade mínima real', () => {
    const s = createGame({ ...base, birthDate: '2000-01-01', profession: 'medico', startStatus: 'militante', startPartyId: 'party_real_psd', seed: 1 });
    expect(previewEligibility(s, 'presidente', 2030).find((c) => c.id === 'idade')?.ok).toBe(false);
  });
});
