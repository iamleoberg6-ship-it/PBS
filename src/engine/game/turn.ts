// Processamento do turno mensal: finanças, decaimentos, IA, gatilhos do calendário e eventos.

import { addMonths, monthIndex, monthLabel } from '../calendar';
import { normal, next } from '../rng';
import { RULEPACK_BR_2028_MUN as RP } from '../data/rulepack';
import { PARTIES, partyById, listIdForParty } from '../data/parties';
import { GAMEPLAY } from '../data/rulepack';
import { isEligible, partyStrength, resolveConvention, runEligibility, simulateCouncil, simulateMayor } from './elections';
import { runoff } from '../rules/majoritarian';
import { rollEvent } from './events';
import { aiElectMesa, seatsByParty } from './council';
import { makeMayorPoll, makeRunoffPoll } from './polls';
import { createMayorRace } from './elections';
import { monthlySocialGrowth, digitalScore } from './social';
import { backgroundNews, newsFromContests, newsFromLog, newsFromPoll } from './news';
import { grow } from './actions';
import { closePersonalMonth, recomputeNetWorth } from './finance';
import { snapshot, recordDiff } from './ledger';
import { partyMonthlyStep } from './partyorg';
import { decayRelations } from './relations';
import type { ElectionRecord, GameState, LogEntry, Mandate } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const mi = (y: number, m: number) => y * 12 + (m - 1);
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

// Remunerações: vereador = valor 2024 (Câmara SP); demais são PROPOSTA de jogo.
export const SALARIES = { vereador: 18991.68, prefeito: 35000, secretario: 26000, assessor: 9500 };

export const END_MONTH = mi(2032, 12);

function log(s: GameState, kind: LogEntry['kind'], text: string) {
  s.log.push({ month: { ...s.month }, kind, text });
}

function newMandate(office: Mandate['office'], since: string, until: string): Mandate {
  return {
    office, since, until, stance: 'independente', approval: 50, relationExecutive: 50,
    councilBase: 0, projects: [], councilPresident: false, priorityArea: null, portfolio: null, budgetShare: 40,
  };
}

export function advanceMonth(state: GameState): GameState {
  if (state.gameOver || state.pendingEvents.length > 0) return state;
  const s: GameState = structuredClone(state);
  const rng = s.rng;

  // Cada fase grava no livro de causas o que mudou e por quê.
  let snap = snapshot(s);
  const mark = (cause: string) => { recordDiff(s, snap, cause); snap = snapshot(s); };

  // 1) Finanças pessoais do mês que termina (renda, despesas, bens, dívida, patrimônio).
  for (const note of closePersonalMonth(s)) log(s, 'financas', note);
  mark('Fechamento do mês: renda e despesas pessoais');

  // 2) Mandato: tramitação de projetos e aprovação.
  const m = s.player.mandate;
  if (m) {
    for (const p of m.projects) {
      if (p.status !== 'tramitando') continue;
      p.monthsLeft -= 1;
      if (p.monthsLeft > 0) continue;
      const a = s.character.attributes;
      const bancada = s.government.councilSeatsByParty[s.player.partyId!] ?? 1;
      const chance = clamp(15 + a.articulation * 0.35 + a.negotiation * 0.25 + bancada * 1.5 + (m.stance === 'base' ? 12 : m.stance === 'oposicao' ? -12 : 0) + (m.councilPresident ? 15 : 0), 5, 90) / 100;
      if (next(rng) < chance) {
        const veto = next(rng) < (m.stance === 'oposicao' ? 0.45 : m.stance === 'base' ? 0.08 : 0.2);
        p.status = veto ? 'vetado' : 'sancionado';
        if (veto) log(s, 'mandato', `${p.title}: aprovado na Câmara, mas vetado pelo prefeito.`);
        else {
          m.approval = clamp(m.approval + 4);
          s.player.recognition = grow(s.player.recognition, 3);
          log(s, 'mandato', `${p.title}: aprovado e sancionado! Agora é lei municipal.`);
        }
      } else {
        p.status = 'rejeitado';
        log(s, 'mandato', `${p.title}: rejeitado em plenário.`);
      }
    }
    if (m.office === 'prefeito') {
      const drift = (50 - m.approval) * 0.03 + normal(rng, 0, 1.2) + (m.priorityArea ? 0.6 + s.character.attributes.management / 120 : -0.4) + (m.councilBase < 28 ? -0.8 : 0.3);
      m.approval = clamp(m.approval + drift);
    } else {
      m.approval = clamp(m.approval + (50 - m.approval) * 0.02 + normal(rng, 0, 0.6));
    }
    s.character.attributes.popularity = clamp(s.character.attributes.popularity + (m.approval - 50) / 80);
  }

  mark('Mandato: tramitação de projetos e avaliação do público');

  // 3) Decaimentos naturais.
  s.player.recognition = clamp(s.player.recognition - (s.player.recognition > 15 ? 0.6 : 0.2));
  s.player.base = clamp(s.player.base - (s.player.base > 15 ? 0.4 : 0.1));
  if (s.player.job === 'assessor') {
    s.character.attributes.politicalKnowledge = clamp(s.character.attributes.politicalKnowledge + 0.5);
  }

  mark('Esquecimento natural (tempo sem aparecer)');

  // 3b) Redes sociais: crescimento da rede em foco e efeito do alcance digital no reconhecimento.
  monthlySocialGrowth(s, rng);
  s.player.recognition = grow(s.player.recognition, digitalScore(s.player.social) * 0.08);

  mark('Alcance das redes sociais');

  // 4) IA: momento dos partidos (passeio aleatório com reversão à média).
  for (const party of PARTIES) {
    const pr = s.parties[party.id];
    pr.momentum = Math.max(-0.5, Math.min(0.5, pr.momentum * 0.92 + normal(rng, 0, 0.03)));
  }

  // 5) Avança o mês.
  s.month = addMonths(s.month, 1);
  s.actionPoints = GAMEPLAY.actionPointsPerMonth.value;
  const t = monthIndex(s.month);

  // 5b) Política partidária (facções, disputas, disciplina) e relações (decaimento e memória).
  for (const note of partyMonthlyStep(s, rng)) log(s, 'partido', note);
  decayRelations(s);
  mark('Vida partidária: disputas, facções e acomodação dos indicadores');

  // 6) Gatilhos do calendário.
  if (t === mi(2027, 7)) log(s, 'sistema', 'Já é possível colocar seu nome como pré-candidato(a) para 2028 (ação "Pleitear candidatura").');
  if (t === mi(2028, 3)) log(s, 'sistema', `Atenção: prazo de filiação e domicílio eleitoral para 2028 termina em 01/04/2028 (${RP.filiationDeadline.source}).`);
  if (t === mi(2028, 4) && !s.player.partyId) log(s, 'sistema', 'O prazo de filiação para 2028 passou. Você não poderá concorrer este ano.');
  if (t === mi(2028, 7)) {
    log(s, 'eleicao', `Convenções partidárias de 20/07 a 05/08. Pela regra de reeleição (CF art. 14 §5º), o prefeito Ricardo Nunes não pode disputar um terceiro mandato consecutivo em 2028.`);
  }
  if (t === mi(2028, 8)) handleConventionAndRegistration(s);
  if (t === mi(2028, 10)) handleElectionDay(s);
  if (t === mi(2028, 11)) handleRunoffAndAftermath(s);
  if (t === mi(2028, 12)) log(s, 'eleicao', 'Diplomação dos eleitos pela Justiça Eleitoral.');
  if (t === mi(2029, 1)) handlePosse(s);
  for (const y of [2028, 2030, 2031, 2032]) if (t === mi(y, 1) && !s.flags[`mesa_${y}`]) log(s, 'mandato', aiElectMesa(s, y, rng));
  if (t === mi(2029, 2) && !s.flags.mesa_2029) log(s, 'mandato', aiElectMesa(s, 2029, rng));
  // Pesquisas eleitorais (institutos fictícios), de março a setembro de 2028; 2º turno em outubro.
  if (t === mi(2028, 3) && !s.mayorRace) {
    s.mayorRace = createMayorRace(s, rng);
    log(s, 'eleicao', `Pré-candidaturas à prefeitura se consolidam: ${s.mayorRace.slice(0, 5).map((r) => r.label.replace('Federação ', 'Fed. ')).join(', ')} e outros já têm nomes. Pesquisas registradas começam a sair.`);
  }
  if (t >= mi(2028, 3) && t <= mi(2028, 9) && s.mayorRace) {
    const times = t >= mi(2028, 8) ? 2 : 1;
    for (let k = 0; k < times; k++) {
      const poll = makeMayorPoll(s, rng);
      if (poll) {
        s.polls.push(poll);
        newsFromPoll(s, poll, rng);
        const [a, b] = poll.results;
        log(s, 'eleicao', `Pesquisa ${poll.institute} (n=${poll.sample}, ±${poll.marginOfError.toString().replace('.', ',')} p.p.): ${a.name} ${(a.share * 100).toFixed(0)}%, ${b.name} ${(b.share * 100).toFixed(0)}%.`);
      }
    }
  }
  if (t === mi(2028, 10)) {
    const rp = s.elections.find((e) => e.year === 2028)?.runoffPending;
    if (rp) {
      s.polls.push(makeRunoffPoll(s, rng, { ...rp.a, w: rp.a.strength * (rp.a.isPlayer ? 1 + (s.player.candidacy?.campaignPoints ?? 0) / 160 : 1) }, { ...rp.b, w: rp.b.strength * (rp.b.isPlayer ? 1 + (s.player.candidacy?.campaignPoints ?? 0) / 160 : 1) }));
      newsFromPoll(s, s.polls[s.polls.length - 1], rng);
    }
  }
  if (t === mi(2028, 11) && (s.player.candidacy?.irregularities ?? 0) > 0 && next(rng) < 0.45) {
    s.character.attributes.popularity = clamp(s.character.attributes.popularity - 6);
    log(s, 'eleicao', 'Reportagem aponta caixa dois na sua campanha. A Justiça Eleitoral pode ser acionada (consequências jurídicas chegam numa versão futura).');
  }
  if (t === mi(2030, 10)) log(s, 'sistema', 'Eleições gerais de 2030 (presidente, governador, senado, deputados). Disputa ainda não disponível nesta versão do protótipo.');
  if (t > END_MONTH) {
    s.gameOver = true;
    s.month = addMonths(s.month, -1);
    log(s, 'sistema', 'Fim do mandato 2029–2032 e da versão protótipo. Obrigado por jogar!');
    return s;
  }

  // 7) Salário de mandato / emprego.
  const office = s.player.mandate?.office;
  if (office === 'vereador' || office === 'prefeito' || office === 'secretario') s.finances.monthlyIncome = SALARIES[office];

  // 7b) Imprensa: notícias sobre o que aconteceu desde o último fechamento + contexto.
  mark('Calendário eleitoral e acontecimentos do mês');
  const cursor = Number(s.flags.newsCursor ?? 0);
  newsFromLog(s, s.log.slice(cursor), rng);
  s.flags.newsCursor = s.log.length;
  backgroundNews(s, rng);
  newsFromContests(s, rng);
  mark('Cobertura da imprensa');

  recomputeNetWorth(s);

  // 8) Evento aleatório condicionado ao estado.
  if (s.pendingEvents.length === 0 && next(rng) < 0.45) {
    const ev = rollEvent(s, rng);
    if (ev) s.pendingEvents.push(ev);
  }
  return s;
}

function handleConventionAndRegistration(s: GameState) {
  const c = s.player.candidacy;
  if (!c) return;
  const rng = s.rng;
  if (c.status === 'pretendida') {
    const conv = resolveConvention(s, rng);
    c.status = conv.approved ? 'aprovada_convencao' : 'rejeitada_convencao';
    log(s, 'eleicao', conv.text);
    if (!conv.approved && c.office === 'prefeito' && s.player.partyRel.leadershipTrust >= 20) {
      c.office = 'vereador';
      c.status = 'aprovada_convencao';
      log(s, 'eleicao', 'Como alternativa, a convenção incluiu você na lista de candidatos a vereador.');
    }
  }
  if (c.status !== 'aprovada_convencao') return;
  c.checks = runEligibility(s);
  if (isEligible(c.checks)) {
    c.status = 'registrada';
    const party = partyById(s.player.partyId!)!;
    const strength = partyStrength(s, party.id);
    const fefc = Math.round((c.office === 'prefeito' ? 1_200_000 : 15_000) * (0.5 + strength / 4) * (0.4 + s.player.partyRel.leadershipTrust / 140 + s.player.partyRel.influence / 200));
    c.account.fefc = fefc;
    log(s, 'eleicao', `Registro de candidatura deferido. O ${party.acronym} repassou ${brl(fefc)} do FEFC para sua campanha (critério de distribuição interno do partido — valor de jogo). Campanha liberada a partir de 16/08.`);
  } else {
    c.status = 'indeferida';
    const failed = c.checks.filter((x) => !x.ok).map((x) => x.label).join('; ');
    log(s, 'eleicao', `Registro de candidatura indeferido: ${failed}.`);
  }
}

function handleElectionDay(s: GameState) {
  const rng = s.rng;
  const c = s.player.candidacy;
  const council = simulateCouncil(s, rng);
  const mayor = simulateMayor(s, rng);
  const playerInRunoff = !!mayor.r1.runoffIds?.includes('character_player');
  const record: ElectionRecord = {
    year: 2028,
    proportional: council.record.proportional,
    mayorFirst: mayor.r1,
    mayorRunoff: playerInRunoff ? null : mayor.r2,
    playerOffice: c?.status === 'registrada' ? c.office : null,
    playerCandidateId: council.record.playerCandidateId ?? (c?.office === 'prefeito' && c.status === 'registrada' ? 'character_player' : null),
    playerVotes: council.record.playerVotes ?? (mayor.field.find((x) => x.isPlayer)?.votes ?? null),
    playerElected: false,
    candidatePartyById: council.record.candidatePartyById,
    mayorWinner: null,
    runoffPending: null,
  };
  for (const cand of mayor.field) record.candidatePartyById[cand.id] = cand.partyId;
  if (playerInRunoff) {
    const [a, b] = mayor.r1.runoffIds!.map((id) => mayor.field.find((x) => x.id === id)!);
    const rest = mayor.field.filter((x) => x.id !== a.id && x.id !== b.id).reduce((sum, x) => sum + x.votes, 0);
    const pick = (x: typeof a) => ({ id: x.id, name: x.name, label: x.label, partyId: x.partyId, votes: x.votes, strength: x.strength, birthDate: x.birthDate, isPlayer: x.isPlayer });
    record.runoffPending = { a: pick(a), b: pick(b), rest };
    log(s, 'eleicao', `1º turno: você está no 2º turno contra ${a.isPlayer ? b.name : a.name}! Você tem mais um mês de campanha (2º turno em 29/10).`);
  } else {
    record.mayorWinner = { id: mayor.winner.id, name: mayor.winner.name, partyId: mayor.winner.partyId, isPlayer: mayor.winner.isPlayer };
    log(s, 'eleicao', `Prefeitura: ${mayor.winner.isPlayer ? 'VOCÊ FOI ELEITO(A) PREFEITO(A)!' : `${mayor.winner.name} (${partyById(mayor.winner.partyId)?.acronym}) foi eleito(a) prefeito(a).`}`);
  }
  if (c?.status === 'registrada' && c.office === 'vereador') {
    const elected = council.record.proportional!.elected.find((e) => e.candidateId === 'character_player');
    record.playerElected = !!elected;
    log(s, 'eleicao', elected
      ? `VOCÊ FOI ELEITO(A) VEREADOR(A) com ${record.playerVotes!.toLocaleString('pt-BR')} votos (vaga nº ${elected.seatNumber}, fase: ${elected.phase === 'QP' ? 'quociente partidário' : 'sobras'}).`
      : `Você teve ${record.playerVotes!.toLocaleString('pt-BR')} votos, mas não foi eleito(a). Veja na apuração como as cadeiras foram distribuídas.`);
  }
  if (c?.status === 'registrada' && c.office === 'prefeito' && !playerInRunoff) record.playerElected = mayor.winner.isPlayer;
  if (c?.status === 'registrada' && c.office === 'prefeito' && !playerInRunoff && !mayor.winner.isPlayer) {
    log(s, 'eleicao', `Você não chegou ao 2º turno da disputa para prefeito (${(record.playerVotes ?? 0).toLocaleString('pt-BR')} votos).`);
  }
  s.elections.push(record);
}

function handleRunoffAndAftermath(s: GameState) {
  const rec = s.elections.find((e) => e.year === 2028);
  if (!rec) return;
  const rng = s.rng;
  if (rec.runoffPending) {
    const { a, b, rest } = rec.runoffPending;
    const boost = (x: typeof a) => (x.isPlayer ? 1 + (s.player.candidacy?.campaignPoints ?? 0) / 160 + (s.character.attributes.negotiation - 50) / 250 - (s.player.candidacy?.irregularities ?? 0) * 0.05 : 1);
    const wa = a.strength * boost(a) * Math.max(0.5, 1 + normal(rng, 0, 0.12));
    const wb = b.strength * boost(b) * Math.max(0.5, 1 + normal(rng, 0, 0.12));
    const va = Math.round(a.votes + rest * 0.85 * (wa / (wa + wb)));
    const vb = Math.round(b.votes + rest * 0.85 * (wb / (wa + wb)));
    const r2 = runoff([{ ...a, votes: va }, { ...b, votes: vb }]);
    rec.mayorRunoff = r2;
    const w = r2.winnerId === a.id ? a : b;
    rec.mayorWinner = { id: w.id, name: w.name, partyId: w.partyId, isPlayer: w.isPlayer };
    rec.playerElected = w.isPlayer;
    rec.runoffPending = null;
    log(s, 'eleicao', w.isPlayer ? 'VOCÊ VENCEU O 2º TURNO E FOI ELEITO(A) PREFEITO(A) DE SÃO PAULO!' : `${w.name} venceu o 2º turno. Você não foi eleito(a).`);
  }
  // Convite para secretaria: perdeu (ou não concorreu), mas o partido está com o vencedor.
  const winnerParty = rec.mayorWinner?.partyId;
  if (!rec.playerElected && s.player.partyId && winnerParty && !rec.mayorWinner?.isPlayer) {
    const sameSide = listIdForParty(winnerParty) === listIdForParty(s.player.partyId) || next(rng) < 0.15;
    if (sameSide && s.player.recognition >= 12 && s.character.attributes.management >= 35) {
      s.government.mayor = { personId: rec.mayorWinner!.id, name: rec.mayorWinner!.name, partyId: winnerParty, real: false };
      s.pendingEvents.push({ templateId: 'convite_secretaria', vars: {} });
    }
  }
}

function handlePosse(s: GameState) {
  const rec = s.elections.find((e) => e.year === 2028);
  if (!rec) return;
  // Nova composição da Câmara a partir do resultado.
  const prevBirth = new Map(s.government.councillors.map((c) => [c.id, c]));
  s.government.councillors = (rec.proportional?.elected ?? []).map((e) => ({
    id: e.candidateId,
    name: e.candidateId === 'character_player' ? s.character.name : e.candidateName,
    partyId: rec.candidatePartyById[e.candidateId] ?? e.listId,
    real: e.candidateId.startsWith('real_ver_'),
    votes: e.candidateVotes,
    electedIn: 2028,
    birthDate: e.candidateId === 'character_player' ? s.character.birthDate : (prevBirth.get(e.candidateId)?.birthDate ?? null),
    birthPrecision: e.candidateId === 'character_player' ? 'exata' : (prevBirth.get(e.candidateId)?.birthPrecision ?? null),
  }));
  const seats = seatsByParty(s.government.councillors);
  s.government.councilSeatsByParty = seats;
  if (rec.mayorWinner && !rec.mayorWinner.isPlayer) {
    const wl = listIdForParty(rec.mayorWinner.partyId);
    const allies = Object.entries(seats).filter(([id]) => listIdForParty(id) !== wl).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => id);
    s.government.mayorCoalition = [...PARTIES.filter((p) => listIdForParty(p.id) === wl).map((p) => p.id), ...allies];
  }
  if (rec.mayorWinner) {
    s.government.mayor = { personId: rec.mayorWinner.id, name: rec.mayorWinner.isPlayer ? s.character.name : rec.mayorWinner.name, partyId: rec.mayorWinner.partyId, real: false };
    s.government.viceMayor = { personId: 'vice_2029', name: rec.mayorWinner.isPlayer ? 'Vice da sua chapa' : 'Vice eleito(a)', partyId: rec.mayorWinner.partyId, real: false };
  }
  s.government.mandateUntil = '2032-12-31';
  s.government.councilPresident = null;
  log(s, 'mandato', 'Posse dos eleitos (1º/01/2029). A 20ª legislatura da Câmara Municipal começa.');

  if (rec.playerElected && rec.playerOffice === 'vereador') {
    s.player.mandate = newMandate('vereador', '2029-01-01', '2032-12-31');
    s.player.job = null;
    s.player.careerHistory.forEach((h) => { if (h.to === null) h.to = '2028-12'; });
    s.player.careerHistory.push({ office: 'Vereador(a) de São Paulo', from: '2029-01', to: null, note: `${(rec.playerVotes ?? 0).toLocaleString('pt-BR')} votos` });
    log(s, 'mandato', 'Você tomou posse como vereador(a). Use as ações de mandato. Em janeiro há eleição da Mesa Diretora.');
  } else if (rec.playerElected && rec.playerOffice === 'prefeito') {
    const coalition = [s.player.partyId!, ...(s.player.candidacy?.coalitionPartyIds ?? [])];
    const base = coalition.reduce((sum, id) => sum + (seats[id] ?? 0), 0);
    s.player.mandate = newMandate('prefeito', '2029-01-01', '2032-12-31');
    s.player.mandate.councilBase = base;
    s.player.mandate.approval = 55;
    s.player.consecutiveTermsPrefeito += 1;
    s.player.job = null;
    s.player.careerHistory.forEach((h) => { if (h.to === null) h.to = '2028-12'; });
    s.player.careerHistory.push({ office: 'Prefeito(a) de São Paulo', from: '2029-01', to: null, note: `${(rec.playerVotes ?? 0).toLocaleString('pt-BR')} votos no 1º turno` });
    log(s, 'mandato', `Você tomou posse como prefeito(a). Sua coligação elegeu ${base} dos 55 vereadores: ${base >= 28 ? 'você começa com maioria' : 'você precisa ampliar a base para aprovar projetos'}.`);
    s.government.mayorCoalition = coalition;
  } else if (typeof s.flags.secretariaAceita === 'string') {
    s.player.mandate = newMandate('secretario', '2029-01-01', '2032-12-31');
    s.player.mandate.portfolio = String(s.flags.secretariaAceita);
    s.player.mandate.stance = 'base';
    s.player.job = null;
    s.player.careerHistory.forEach((h) => { if (h.to === null) h.to = '2028-12'; });
    s.player.careerHistory.push({ office: `Secretário(a) municipal de ${s.flags.secretariaAceita}`, from: '2029-01', to: null, note: 'Cargo de nomeação' });
    log(s, 'mandato', `Você assumiu a Secretaria Municipal de ${s.flags.secretariaAceita}.`);
  }
  if (s.player.candidacy) s.player.candidacy = null;
  if (s.player.mandate?.office !== 'vereador') log(s, 'mandato', aiElectMesa(s, 2029, s.rng));
  else log(s, 'mandato', 'A Mesa Diretora de 2029 será eleita este mês. Você pode disputar a presidência.');
}

export function currentPhaseLabel(s: GameState): string {
  const t = monthIndex(s.month);
  if (s.gameOver) return 'Fim da versão protótipo';
  if (t < mi(2028, 4)) return 'Pré-eleitoral — prazo de filiação até 01/04/2028';
  if (t < mi(2028, 7)) return 'Pré-campanha';
  if (t === mi(2028, 7)) return 'Convenções partidárias';
  if (t <= mi(2028, 9)) return 'Campanha eleitoral';
  if (t === mi(2028, 10)) return s.elections[0]?.runoffPending ? 'Campanha de 2º turno' : 'Resultado das eleições';
  if (t <= mi(2028, 12)) return 'Transição e diplomação';
  return `Mandatos 2029–2032 — ${monthLabel(s.month)}`;
}
