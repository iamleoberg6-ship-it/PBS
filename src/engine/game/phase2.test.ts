import { describe, expect, it } from 'vitest';
import { createGame } from './create';
import { advanceMonth } from './turn';
import { availableActions, performAction } from './actions';
import { resolveEvent } from './events';
import { PLAYER } from './relations';
import { loadSave, serialize } from './save';
import {
  ABSOLUTE_MAJORITY, COMMITTEES, CPI_SIGNATURES, collectSignatures, electMesa, fileBill, initLegislature, isActive,
  legislatureMonthlyStep, negotiateMesaVote, partyOrientation, startCpi,
} from './legislature';
import { createSecretariat, inviteAffinity, PORTFOLIOS, startProgram, secretariatMonthlyStep } from './secretariat';
import { createRng } from '../rng';
import type { GameState, Mandate } from './types';

const base = { name: 'T', birthDate: '1990-01-01', gender: 'x', education: 's', bio: '', attributeBonus: { articulation: 20, negotiation: 20 } };
const mk = (seed = 1, party = 'party_real_pt') => createGame({ ...base, profession: 'advogado', startStatus: 'militante', startPartyId: party, seed });

function mandate(office: Mandate['office']): Mandate {
  return { office, since: '2029-01-01', until: '2032-12-31', stance: 'independente', approval: 50, relationExecutive: 50, councilBase: 0, projects: [], councilPresident: false, priorityArea: null, portfolio: null, budgetShare: 40 };
}

/** Coloca o jogador na cadeira de um vereador do próprio partido (ou da maior bancada) e recompõe a Câmara. */
function asCouncillor(s: GameState): GameState {
  const idx = Math.max(0, s.government.councillors.findIndex((c) => c.partyId === s.player.partyId));
  s.government.councillors[idx] = { ...s.government.councillors[idx], id: PLAYER, name: s.character.name, partyId: s.player.partyId!, real: false };
  s.player.mandate = mandate('vereador');
  initLegislature(s, s.rng);
  return s;
}
const month = (s: GameState, n = 1) => { for (let i = 0; i < n; i++) { while (s.pendingEvents.length) s = resolveEvent(s, 0); s = advanceMonth(s); } return s; };

describe('Fase 2 — Câmara: comissões e blocos', () => {
  it('7 comissões permanentes, cada vereador em exatamente uma, composição proporcional', () => {
    const s = mk(3);
    const L = s.legislature;
    expect(L.committees.map((c) => c.id)).toEqual(COMMITTEES.map((c) => c.id));
    const all = L.committees.flatMap((c) => c.members);
    expect(all.length).toBe(55);
    expect(new Set(all).size).toBe(55);
    // Maior bancada tem cadeira na CCJ e em Finanças (D'Hondt).
    const biggest = Object.entries(s.government.councilSeatsByParty).sort((a, b) => b[1] - a[1])[0][0];
    for (const id of ['ccj', 'financas']) {
      const c = L.committees.find((x) => x.id === id)!;
      expect(c.members.some((m) => s.government.councillors.find((x) => x.id === m)?.partyId === biggest)).toBe(true);
      expect(c.presidentId).not.toBeNull();
    }
  });
  it('blocos: partidos da coligação do prefeito são base; partidos distantes são oposição', () => {
    const s = mk(4);
    const byParty = (pid: string) => s.government.councillors.filter((c) => c.partyId === pid).map((c) => s.legislature.blocs[c.id]);
    expect(byParty('party_real_mdb').every((b) => b === 'base')).toBe(true);
    expect(byParty('party_real_psol').every((b) => b === 'oposicao' || b === 'oposicao_radical')).toBe(true);
  });
});

describe('Fase 2 — tramitação', () => {
  it('projeto passa por etapas válidas até um desfecho, com histórico', () => {
    let s = asCouncillor(mk(5));
    const b0 = fileBill(s, s.rng, 'saude', 'regulacao');
    for (let i = 0; i < 14 && s.legislature.bills.find((b) => b.id === b0.id)!.stage !== 'lei'; i++) s = month(s);
    const b = s.legislature.bills.find((x) => x.id === b0.id)!;
    expect(b.history.length).toBeGreaterThan(1);
    expect(b.history[0].text).toContain('Constituição e Justiça');
    if (!isActive(b)) expect(['lei', 'arquivado', 'rejeitado', 'veto_mantido']).toContain(b.stage);
  }, 30_000);
  it('derrubar veto exige 28 votos (maioria absoluta)', () => {
    for (const seed of [11, 12, 13, 14, 15]) {
      const s = asCouncillor(mk(seed));
      const b = fileBill(s, s.rng, 'educacao', 'regulacao');
      b.stage = 'veto'; b.monthsInStage = 1;
      legislatureMonthlyStep(s, s.rng);
      const bb = s.legislature.bills.find((x) => x.id === b.id)!;
      expect(bb.vetoVote).not.toBeNull();
      if (bb.stage === 'lei') expect(bb.vetoVote!.yes).toBeGreaterThanOrEqual(ABSOLUTE_MAJORITY);
      else expect(bb.vetoVote!.yes).toBeLessThan(ABSOLUTE_MAJORITY);
    }
  });
  it('vício de iniciativa: Executivo contra e CCJ barra com mais frequência', () => {
    let flawedOut = 0, cleanOut = 0;
    for (let seed = 20; seed < 32; seed++) {
      for (const flawed of [true, false]) {
        const s = asCouncillor(mk(seed));
        const b = fileBill(s, s.rng, 'habitacao', 'programa');
        b.executiveInitiativeOnly = flawed;
        b.executivePosition = flawed ? 'contra' : 'neutro';
        b.monthsInStage = 1;
        for (let k = 0; k < 4 && s.legislature.bills.find((x) => x.id === b.id)!.stage === 'ccj'; k++) legislatureMonthlyStep(s, s.rng);
        const out = s.legislature.bills.find((x) => x.id === b.id)!.stage === 'arquivado';
        if (flawed && out) flawedOut++;
        if (!flawed && out) cleanOut++;
      }
    }
    expect(flawedOut).toBeGreaterThan(cleanOut);
  }, 30_000);
  it('votar contra a orientação da bancada reduz a fidelidade percebida', () => {
    const s = asCouncillor(mk(40));
    const b = fileBill(s, s.rng, 'mobilidade', 'regulacao');
    b.author = 'bancada:party_real_pl';
    b.stage = 'plenario'; b.scheduled = true; b.salience = 80;
    const orient = partyOrientation(s, s.player.partyId, b);
    if (orient === 'A') return;
    s.legislature.playerVotes[b.id] = orient === 'S' ? 'N' : 'S';
    const before = s.player.partyRel.perceivedLoyalty;
    legislatureMonthlyStep(s, s.rng);
    expect(s.player.partyRel.perceivedLoyalty).toBeLessThan(before);
    expect(s.legislature.voteHistory.at(-1)?.billId).toBe(b.id);
  });
  it('IA apresenta projetos todo mês, atribuídos a bancadas (não a pessoas reais)', () => {
    let s = mk(41);
    s = month(s, 3);
    const ai = s.legislature.bills.filter((b) => b.author !== PLAYER);
    expect(ai.length).toBeGreaterThanOrEqual(3);
    expect(ai.every((b) => b.author === 'executivo' || b.author.startsWith('bancada:'))).toBe(true);
  }, 20_000);
});

describe('Fase 2 — Mesa e CPI', () => {
  it('Mesa tem 5 cargos distintos e presidente coerente com a Câmara', () => {
    const s = asCouncillor(mk(50));
    s.legislature.mesaCandidates.push(PLAYER);
    for (const p of Object.keys(s.government.councilSeatsByParty).slice(0, 4)) negotiateMesaVote(s, s.rng, p);
    const text = electMesa(s, 2029, s.rng);
    expect(text).toMatch(/Votação: você \d+ × \d+/);
    expect(s.legislature.mesa.length).toBe(5);
    expect(new Set(s.legislature.mesa.map((m) => m.actorId)).size).toBe(5);
    expect(s.legislature.presidentId).toBe(s.legislature.mesa[0].actorId);
    expect(s.player.mandate!.councilPresident).toBe(s.legislature.presidentId === PLAYER);
  });
  it('CPI só é instalada com 19 assinaturas', () => {
    const s = asCouncillor(mk(51));
    const cpi = startCpi(s, 'teste');
    for (let i = 0; i < 12 && cpi.status === 'coleta'; i++) collectSignatures(s, s.rng, cpi.id);
    const c = s.legislature.cpis[0];
    if (c.status === 'instalada') expect(c.signatures.length).toBeGreaterThanOrEqual(CPI_SIGNATURES);
    else expect(c.signatures.length).toBeLessThan(CPI_SIGNATURES);
  });
});

describe('Fase 2 — Secretarias', () => {
  it('convite exige relação política ou proximidade ideológica', () => {
    const psol = mk(60, 'party_real_psol');
    expect(inviteAffinity(psol, 'party_real_pl').ok).toBe(false);
    const pt = mk(61, 'party_real_pt');
    expect(inviteAffinity(pt, 'party_real_pcdob').ok).toBe(true); // mesma federação
    const novo = mk(62, 'party_real_novo');
    expect(inviteAffinity(novo, 'party_real_psol').ok).toBe(false);
  });
  it('cada pasta tem indicadores sociais, programas e ação própria', () => {
    for (const p of PORTFOLIOS) {
      expect(p.indicators.length).toBeGreaterThanOrEqual(2);
      expect(p.programs.length).toBeGreaterThanOrEqual(2);
      expect(p.special.id).toBeTruthy();
      expect(p.crises.length).toBeGreaterThanOrEqual(1);
    }
    expect(new Set(PORTFOLIOS.map((p) => p.special.id)).size).toBe(PORTFOLIOS.length);
  });
  it('programa percorre planejamento → licitação → execução → entrega e melhora indicador', () => {
    const s = mk(63);
    s.player.mandate = { ...mandate('secretario'), secretariat: createSecretariat('educacao'), stance: 'base', relationExecutive: 70 };
    s.player.mandate.secretariat!.capacity = 100;
    expect(startProgram(s, 'creches_conv')).toContain('Programa lançado');
    const rng = createRng(5);
    const phases = new Set<string>();
    for (let i = 0; i < 20; i++) { secretariatMonthlyStep(s, rng); phases.add(s.player.mandate!.secretariat!.programs[0].phase); s.flags.exonerado = false; }
    expect(phases.has('licitacao')).toBe(true);
    expect(phases.has('execucao')).toBe(true);
    expect(s.player.mandate!.secretariat!.programs[0].phase).toBe('entregue');
    const fila = s.player.mandate!.secretariat!.indicators.find((i) => i.key === 'fila_creche')!;
    expect(fila.value).toBeLessThan(fila.start);
  });
  it('ações de secretaria são específicas da pasta ocupada', () => {
    const s = mk(64);
    s.player.mandate = { ...mandate('secretario'), secretariat: createSecretariat('saude') };
    const ids = availableActions(s).map((a) => a.def.id);
    expect(ids).toContain('pasta_mutirao_consultas');
    expect(ids).not.toContain('pasta_busca_ativa');
    const after = performAction(s, 'pasta_mutirao_consultas');
    const esp = after.player.mandate!.secretariat!.indicators.find((i) => i.key === 'espera')!;
    expect(esp.value).toBeLessThan(esp.start);
  });
});

describe('Fase 2 — save', () => {
  it('save v4 (sem Câmara) migra para v5', () => {
    const s = mk(70);
    const raw = JSON.parse(serialize(s));
    delete raw.legislature;
    raw.saveVersion = 4;
    raw.government.mayorCoalition = ['party_real_mdb', 'party_real_pl'];
    const { state, report } = loadSave(JSON.stringify(raw));
    expect(report.migratedFrom).toBe(4);
    expect(state.legislature.committees.length).toBe(7);
    expect(state.government.mayorCoalition.length).toBe(12);
    const again = loadSave(serialize(state));
    expect(again.report.repairs).toEqual([]);
  });
});
