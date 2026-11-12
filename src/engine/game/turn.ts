// Processamento do turno mensal: finanças, decaimentos, IA, gatilhos do calendário e eventos.

import { addMonths, monthIndex, monthLabel } from '../calendar';
import { normal, next } from '../rng';
import { genRulepack, munRulepack } from '../data/rulepack';
import { PARTIES, partyById, listIdForParty } from '../data/parties';
import { GAMEPLAY } from '../data/rulepack';
import { isEligible, partyStrength, resolveConvention, runEligibility, simulateCouncil, simulateMayor } from './elections';
import { runoff } from '../rules/majoritarian';
import { rollEvent } from './events';
import { seatsByParty } from './council';
import { PROFESSIONS } from './create';
import { onLeave, personalMonthlyStep } from './personal';
import { seatHeirs } from './personalActions';
import { indicatorsMonthlyStep } from './indicators';
import { demographyMonthlyStep } from './demografia';
import { aiGovernmentsStep } from './govprofile';
import { ensureMonthlyFloorVote, blocCounts, electMesa, initLegislature, legislatureMonthlyStep, legislatureNews, mesaWindow, playerIsCouncillor } from './legislature';
import { createSecretariat, inviteAffinity, secretariatMonthlyStep } from './secretariat';
import { campaignMonthlyStep, distributeVotes, electoralLawsuit, enrichMayorPoll, enrichNationalPoll, judgeAccounts, mayorRegionalShares } from './campaign';
import { bossEndorsement, leaveStaff, staffMonthlyStep } from './assessor';
import { PLAYER } from './relations';
import { aiFiscalPolicy, cityMonthlyStep, citySummaryForMayorApproval, closeFiscalYear, fiscalCalendar, isMayorPlayer, resetSecretariatForNewMayor, tcmStep } from './municipality';
import { makeMayorPoll, makeRacePoll, makeRunoffPoll } from './polls';
import { createMayorRace } from './elections';
import { monthlySocialGrowth, digitalScore } from './social';
import { backgroundNews, newsFromContests, newsFromLog, newsFromPoll } from './news';
import { grow, officePointsFor } from './actions';
import { closePersonalMonth, recomputeNetWorth } from './finance';
import { buildMonthReport, snapshot, recordDiff } from './ledger';
import { partyMonthlyStep } from './partyorg';
import { decayRelations } from './relations';
import { LAST_YEAR, councilLegislatureNumber, genCycle, isGenYear, isMunYear, munCycle, munTerm, nextElection } from './cycle';
import { applyGeneralResults, createStateRace, generalTermEnd, partyAlignment, pickCouncillorCandidates, resolveGovernorRunoff, resolvePresidentRunoff, runGeneralElection, stateRaceShares, stateStrength, stateWorldMonthly } from './general';
import { refreshPool, teamMonthlyStep } from './team';
import { FEDERAL_LABEL, ministryById, aiPresidentTakesOffice, buildCoalition, federalMonthlyStep, formCabinet, initFederal, leaveMinistry, vicePresidentTakesOver } from './federal';
import { nationalMonthlyStep } from './national';
import { UPPER_LABEL, UPPER_SALARIES, schemeInvestigation, upperMonthlyStep } from './upper';
import { generateFloorVotes, resolveFloorVotes } from './pauta';
import { governorRegionsStep, legislativoMonthlyStep } from './legislativo';
import { councillorWindowSwitches, crisisMonthlyStep, lapseCampaignPromises, promisesMonthlyStep } from './livingworld';
import { checkAchievements, computeEnding } from './endings';
import { endMandate, rememberVotes, startExecMandate, isMunicipalMandate, mandateExpired, newMandate, startUpperMandate, vacateCouncilSeat } from './careers';
import type { ElectionRecord, GameState, LogEntry } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const mi = (y: number, m: number) => y * 12 + (m - 1);
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

// Remunerações: vereador = valor 2024 (Câmara SP); demais são PROPOSTA de jogo.
export const SALARIES = { vereador: 18991.68, prefeito: 35000, secretario: 26000, assessor: 9500 };

export const END_MONTH = mi(LAST_YEAR, 12);

function log(s: GameState, kind: LogEntry['kind'], text: string) {
  s.log.push({ month: { ...s.month }, kind, text });
}

export function advanceMonth(state: GameState): GameState {
  const out = advanceMonthInner(state);
  if (out !== state) out.monthReport = buildMonthReport(out, state.month);
  return out;
}

function advanceMonthInner(state: GameState): GameState {
  if (state.gameOver || state.pendingEvents.length > 0) return state;
  const s: GameState = structuredClone(state);
  const rng = s.rng;

  // Cada fase grava no livro de causas o que mudou e por quê.
  let snap = snapshot(s);
  const mark = (cause: string) => { recordDiff(s, snap, cause); snap = snapshot(s); };

  // 1) Finanças pessoais do mês que termina (renda, despesas, bens, dívida, patrimônio).
  for (const note of closePersonalMonth(s)) log(s, 'financas', note);
  mark('Fechamento do mês: renda e despesas pessoais');

  const t0 = monthIndex(s.month);
  // 1b) Votações de plenário do mês que termina (Alesp, Câmara dos Deputados, Senado).
  for (const n of resolveFloorVotes(s, rng)) log(s, 'mandato', n);
  // 2) Câmara Municipal: tramitação, votações, vetos, CPIs (roda sempre — a Câmara funciona com ou sem o jogador).
  const legNotes = legislatureMonthlyStep(s, rng);
  for (const n of legNotes) log(s, 'camara', n);
  legislatureNews(s, rng, legNotes);
  const mesaTerm = mesaWindow(s);
  if (mesaTerm !== null && !s.flags[`mesa_${mesaTerm}`]) log(s, 'camara', electMesa(s, mesaTerm, rng));
  mark('Câmara Municipal: votações, vetos e Mesa');

  // 2a) Prefeitura: execução do orçamento, secretarias da IA, calendário fiscal e Tribunal de Contas.
  aiFiscalPolicy(s);
  for (const n of cityMonthlyStep(s, rng)) log(s, isMayorPlayer(s) ? 'mandato' : 'sistema', n);
  for (const n of fiscalCalendar(s, rng)) log(s, isMayorPlayer(s) ? 'mandato' : 'sistema', n);
  for (const n of tcmStep(s, rng)) log(s, 'mandato', n);
  if (s.month.month === 12) for (const n of closeFiscalYear(s, rng)) log(s, isMayorPlayer(s) ? 'mandato' : 'sistema', n);
  mark('Prefeitura: orçamento, secretarias e contas');

  // 2b) Secretaria (se o jogador chefia uma pasta).
  for (const n of secretariatMonthlyStep(s, rng)) log(s, 'secretaria', n);
  if (s.flags.exonerado && s.player.mandate?.office === 'secretario') {
    delete s.flags.exonerado;
    const sec = s.player.mandate.secretariat;
    if (sec) {
      s.city.secretariats[sec.portfolio] = sec;
      s.city.secretaries[sec.portfolio] = { portfolio: sec.portfolio, name: 'Novo(a) secretário(a) (personagem do jogo)', partyId: null, kind: 'tecnico', competence: 60, since: { ...s.month } };
    }
    s.player.careerHistory.forEach((h) => { if (h.to === null) h.to = `${s.month.year}-${String(s.month.month).padStart(2, '0')}`; });
    s.player.mandate = null;
    s.player.job = 'profissao';
    s.finances.monthlyIncome = PROFESSIONS[s.character.profession].income;
  }
  mark('Secretaria: programas, indicadores e crises');

  // 2c) Mandato: avaliação do público.
  const m = s.player.mandate;
  if (m) {
    if (m.office === 'prefeito') {
      m.councilBase = blocCounts(s).base;
      const drift = (50 - m.approval) * 0.05 + normal(rng, 0, 1.2) + (s.city.metas ? 0.3 + s.character.attributes.management / 160 : -0.3) + (m.councilBase < 28 ? -0.8 : 0.3) + citySummaryForMayorApproval(s) * 0.12;
      m.approval = clamp(m.approval + drift);
    } else if (!m.secretariat) {
      m.approval = clamp(m.approval + (50 - m.approval) * 0.02 + normal(rng, 0, 0.6));
    }
    s.character.attributes.popularity = clamp(s.character.attributes.popularity + (m.approval - 50) / 80);
  }

  mark('Mandato: avaliação do público');

  // 2d) Campanha territorial e gabinete parlamentar.
  campaignMonthlyStep(s);
  for (const n of staffMonthlyStep(s, rng)) log(s, 'acao', n);
  const cy = s.player.candidacy?.year ?? 2028;
  if (s.player.candidacy && t0 === mi(cy, 7)) { const e = bossEndorsement(s); if (e) log(s, 'eleicao', e); }
  if (s.player.candidacy && t0 === mi(cy, 12)) { const j = judgeAccounts(s, rng); if (j) log(s, 'eleicao', j); }
  const ly = Number(s.flags.lastElectionYear ?? 0);
  if (ly && t0 === mi(ly + 1, 4) && !s.flags[`aije_${ly}`]) {
    s.flags[`aije_${ly}`] = true;
    const j = electoralLawsuit(s, rng);
    if (j) log(s, 'eleicao', j);
    if (s.flags.cassado && s.player.mandate && !s.flags[`cassadoAplicado_${ly}`]) { s.flags[`cassadoAplicado_${ly}`] = true; cassate(s); }
  }
  mark('Campanha territorial e trabalho de assessoria');
  for (const n of upperMonthlyStep(s, rng)) log(s, 'mandato', n);
  for (const n of legislativoMonthlyStep(s, rng)) log(s, 'mandato', n);
  governorRegionsStep(s);
  mark('Mandato estadual/federal: emendas, projetos e relação com o governo');
  for (const n of schemeInvestigation(s, rng)) log(s, 'mandato', n);
  mark('Investigação de esquema com emendas');
  for (const n of teamMonthlyStep(s, rng)) log(s, 'mandato', n);
  nationalMonthlyStep(s, rng);
  for (const n of federalMonthlyStep(s, rng)) log(s, 'mandato', n);
  mark('Governo federal: economia, Congresso e ministérios');
  if (s.flags.assumiuPresidencia) log(s, 'mandato', vicePresidentTakesOver(s));
  mark('Equipe do gabinete: tarefas, devoluções e denúncias');
  if (s.flags.perdaMandatoEsquema && s.player.mandate) { delete s.flags.perdaMandatoEsquema; endMandate(s, 'Você perdeu o mandato por quebra de decoro parlamentar.'); }
  if (s.flags.exoneradoEstadual && s.player.mandate?.office === 'secretario_estadual') { delete s.flags.exoneradoEstadual; endMandate(s, 'Você deixou a secretaria estadual.'); }
  stateWorldMonthly(s, rng);
  mark('Mundo estadual, desligamentos e posses');

  // 3) Decaimentos naturais.
  const recFloor = s.player.recognitionFloor ?? 0;
  if (s.player.recognition > recFloor) s.player.recognition = Math.max(recFloor, clamp(s.player.recognition - (s.player.recognition > 15 ? 0.6 : 0.2)));
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

  // 6) Gatilhos do calendário (Fase 5: ciclos repetidos — municipais 2028/2032/2036, gerais 2030/2034).
  for (const n of municipalCalendar(s, t)) log(s, 'eleicao', n);
  for (const n of generalCalendar(s, t)) log(s, 'eleicao', n);
  // Fim de mandato sem reeleição (fallback para qualquer cargo).
  if (mandateExpired(s)) endMandate(s, `Seu mandato de ${s.player.mandate!.office} terminou.`);
  // Mundo vivo: crises de imagem, promessas, conquistas.
  for (const n of crisisMonthlyStep(s, rng)) log(s, 'evento', n);
  for (const n of promisesMonthlyStep(s, rng)) log(s, 'evento', n);
  for (const a of checkAchievements(s)) log(s, 'sistema', `Conquista desbloqueada: ${a}.`);
  if (t > END_MONTH) {
    s.month = addMonths(s.month, -1);
    s.ending = computeEnding(s, 'fim');
    s.gameOver = true;
    log(s, 'sistema', `Fim da partida (dezembro de ${LAST_YEAR}). Desfecho: ${s.ending.title}.`);
    return s;
  }

  // 6b) Pauta do novo mês: ao menos uma votação para quem tem mandato legislativo.
  // Licenciado(a): o suplente vota no lugar.
  if (!onLeave(s)) {
    s.floorVotes.push(...generateFloorVotes(s, rng));
    ensureMonthlyFloorVote(s, rng);
  }
  // 7) Agenda do cargo (depois das posses do mês).
  s.officePoints = officePointsFor(s);
  refreshPool(s, rng);
  // 7b) Salário de mandato / emprego.
  const office = s.player.mandate?.office;
  if (office === 'vereador' || office === 'prefeito' || office === 'secretario') s.finances.monthlyIncome = SALARIES[office];
  else if (office && office in UPPER_SALARIES) s.finances.monthlyIncome = UPPER_SALARIES[office as keyof typeof UPPER_SALARIES].value;

  mark('Calendário eleitoral e acontecimentos do mês');
  // 7c) Vida pessoal: família, estresse, saúde, exposição, ameaças, licença.
  for (const n of personalMonthlyStep(s)) log(s, 'pessoal', n);
  for (const n of seatHeirs(s)) log(s, 'camara', n);
  // 7d) Governos da IA (personagens do jogo) seguem o perfil ideológico do partido; depois, indicadores sociais.
  for (const n of aiGovernmentsStep(s, rng)) log(s, 'mandato', n);
  for (const n of indicatorsMonthlyStep(s)) log(s, 'mandato', n);
  for (const n of demographyMonthlyStep(s)) log(s, 'sistema', n);
  mark('Indicadores sociais e efeitos do seu trabalho');
  if (!onLeave(s) && !s.officePoints) s.officePoints = officePointsFor(s);
  mark('Vida pessoal: família, estresse, segurança');
  // 7b) Imprensa: notícias sobre o que aconteceu desde o último fechamento + contexto.
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

// =====================================================================
// Calendário municipal (ciclo Y = 2028, 2032, 2036…)
// =====================================================================

function municipalCalendar(s: GameState, t: number): string[] {
  const out: string[] = [];
  const Y = munCycle(t);
  const rp = munRulepack(Y);
  const rng = s.rng;
  const c = s.player.candidacy;
  const mine = !!c && (c.year ?? 2028) === Y;
  if (t === mi(Y - 1, 7)) out.push(`Já é possível colocar seu nome como pré-candidato(a) para as eleições municipais de ${Y} (ação "Pleitear candidatura").`);
  if (t === mi(Y, 3)) {
    out.push(`Atenção: prazo de filiação e domicílio eleitoral para ${Y} termina em ${rp.filiationDeadline.value.split('-').reverse().join('/')} (${rp.filiationDeadline.source}). Março é a janela partidária dos vereadores.`);
    for (const n of councillorWindowSwitches(s, rng)) out.push(n);
  }
  if (t === mi(Y, 4) && !s.player.partyId) out.push(`O prazo de filiação para ${Y} passou. Você não poderá concorrer este ano.`);
  if (t === mi(Y, 7)) {
    const inc = s.government.mayor;
    const terms = Number(s.flags.mayorTerms ?? 2);
    out.push(Y === 2028
      ? 'Convenções partidárias de 20/07 a 05/08. Pela regra de reeleição (CF art. 14 §5º), o prefeito Ricardo Nunes não pode disputar um terceiro mandato consecutivo em 2028.'
      : inc.personId === PLAYER
        ? `Convenções partidárias de 20/07 a 05/08. Você ${s.player.consecutiveTermsPrefeito >= 2 ? 'não pode disputar um terceiro mandato consecutivo (CF art. 14 §5º)' : 'pode disputar a reeleição (CF art. 14 §5º)'}.`
        : `Convenções partidárias de 20/07 a 05/08. ${terms >= 2 ? `${inc.name} já cumpriu dois mandatos e não pode concorrer de novo (CF art. 14 §5º).` : `${inc.name} pode disputar a reeleição.`}`);
  }
  if (mine && t === mi(Y, 8)) handleConventionAndRegistration(s);
  if (t === mi(Y, 10)) handleElectionDay(s, Y);
  if (t === mi(Y, 11)) handleRunoffAndAftermath(s, Y);
  if (t === mi(Y, 12)) out.push('Diplomação dos eleitos pela Justiça Eleitoral.');
  if (t === mi(Y + 1, 1)) handlePosse(s, Y);
  if (t === mi(Y + 1, 1) && playerIsCouncillor(s)) log(s, 'camara', `Eleição da Mesa Diretora para ${Y + 1} neste mês: use "Lançar candidatura à Mesa" e negocie com as bancadas. O resultado sai no fechamento do mês.`);
  if (s.month.month === 12 && (s.month.year - 2028) % 4 !== 0 && s.month.year >= 2029 && playerIsCouncillor(s)) log(s, 'camara', `Eleição da Mesa para ${s.month.year + 1} neste mês.`);
  // Pesquisas (institutos fictícios) de março a setembro; 2º turno em outubro.
  if (t === mi(Y, 3) && !s.mayorRace) {
    s.mayorRace = createMayorRace(s, rng);
    out.push(`Pré-candidaturas à prefeitura se consolidam: ${s.mayorRace.slice(0, 5).map((r) => `${r.name} (${r.label.replace('Federação ', 'Fed. ')})`).join(', ')} e outros. Pesquisas registradas começam a sair.`);
  }
  if (t >= mi(Y, 3) && t <= mi(Y, 9) && s.mayorRace) {
    const times = t >= mi(Y, 8) ? 2 : 1;
    for (let k = 0; k < times; k++) {
      const poll = makeMayorPoll(s, rng);
      if (poll) {
        enrichMayorPoll(s, rng, poll);
        s.polls.push(poll);
        newsFromPoll(s, poll, rng);
        const [a, b] = poll.results;
        out.push(`Pesquisa ${poll.institute} (n=${poll.sample}, ±${poll.marginOfError.toString().replace('.', ',')} p.p.): ${a.name} ${(a.share * 100).toFixed(0)}%, ${b.name} ${(b.share * 100).toFixed(0)}%.`);
      }
    }
  }
  if (t === mi(Y, 10)) {
    const rp2 = s.elections.find((e) => e.year === Y)?.runoffPending;
    if (rp2) {
      const w = (x: typeof rp2.a) => x.strength * (x.isPlayer ? 1 + (s.player.candidacy?.campaignPoints ?? 0) / 160 : 1);
      s.polls.push(makeRunoffPoll(s, rng, { ...rp2.a, w: w(rp2.a) }, { ...rp2.b, w: w(rp2.b) }));
      newsFromPoll(s, s.polls[s.polls.length - 1], rng);
    }
  }
  if (mine && t === mi(Y, 11) && (c?.irregularities ?? 0) > 0 && next(rng) < 0.45) {
    s.character.attributes.popularity = clamp(s.character.attributes.popularity - 6);
    out.push('Reportagem aponta caixa dois na sua campanha. A Justiça Eleitoral pode ser acionada.');
  }
  if (s.polls.length > 70) s.polls.splice(0, s.polls.length - 70);
  return out;
}

// =====================================================================
// Calendário das eleições gerais (ciclo G = 2030, 2034…)
// =====================================================================

function generalCalendar(s: GameState, t: number): string[] {
  const out: string[] = [];
  const G = genCycle(t);
  const rp = genRulepack(G);
  const rng = s.rng;
  const c = s.player.candidacy;
  const mine = !!c && (c.year ?? 2028) === G;
  const w = s.stateWorld;
  departures(s, t);
  if (t === mi(G - 1, 7)) out.push(`Já é possível pleitear candidatura para as eleições gerais de ${G}: deputado(a) estadual (Alesp, 94 vagas), deputado(a) federal (70 vagas por SP), senador(a) (${rp.seats.senadoSP.value} vaga${rp.seats.senadoSP.value > 1 ? 's' : ''}) e governador(a).`);
  if (t === mi(G, 3)) {
    w.councillorRuns = pickCouncillorCandidates(s, rng);
    out.push(`Prazo de filiação e domicílio para ${G}: ${rp.filiationDeadline.value.split('-').reverse().join('/')}. Março é a janela partidária dos deputados.`);
    if (w.councillorRuns.length) out.push(`${w.councillorRuns.length} vereador(es) de SP (personagens fictícios) anunciam pré-candidatura a deputado: ${w.councillorRuns.map((r) => `${s.government.councillors.find((x) => x.id === r.id)?.name} (${r.office === 'deputado_estadual' ? 'Alesp' : 'Câmara'})`).join(', ')}.`);
    if (mine && ['prefeito', 'secretario', 'secretario_estadual', 'governador', 'ministro', 'presidente'].includes(s.player.mandate?.office ?? '') && !(s.player.mandate?.office === 'governador' && c!.office === 'governador') && !(s.player.mandate?.office === 'presidente' && c!.office === 'presidente')) {
      out.push(`ÚLTIMO MÊS para se desincompatibilizar (${rp.desincompatibilizacao.source}): sem renunciar/afastar-se até o fim de março, o registro será indeferido.`);
    }
  }
  if (t === mi(G, 4) && mine) {
    const off = s.player.mandate?.office ?? '';
    s.flags[`cargoAbril_${G}`] = ['prefeito', 'secretario', 'secretario_estadual', 'ministro'].includes(off) || (off === 'governador' && c!.office !== 'governador') || (off === 'presidente' && c!.office !== 'presidente') ? off : '';
  }
  if (t === mi(G, 7)) {
    w.governorRace = createStateRace(s, rng, 'governador');
    w.senateRace = createStateRace(s, rng, 'senador');
    w.presidentRace = createStateRace(s, rng, 'presidente');
    out.push(...viceInvite(s, rng));
    const gov = w.governor;
    out.push(`Convenções de 20/07 a 05/08 também para os cargos estaduais e federais. ${gov.isPlayer ? '' : gov.consecutiveTerms >= 2 ? `${gov.name} (governador) está no 2º mandato consecutivo e não pode concorrer (CF art. 14 §5º).` : `${gov.name} (governador) pode disputar a reeleição.`} Candidatos majoritários a partir de ${G} são personagens fictícios.`);
    if (s.player.staff && mine) out.push('Como servidor comissionado, você precisa se afastar do gabinete três meses antes do pleito (LC 64/90 art. 1º, II, "l") — licença registrada.');
  }
  if (mine && t === mi(G, 8)) handleConventionAndRegistration(s);
  if (t === mi(G, 8) || t === mi(G, 9)) {
    for (const race of ['governador', 'senador', 'presidente'] as const) {
      if (race === 'senador' && !(mine && c!.office === 'senador')) continue;
      if (race === 'presidente' && !(mine && (c!.office === 'presidente' || c!.office === 'vice_presidente'))) continue;
      const poll = makeRacePoll(s, rng, stateRaceShares(s, race), race, G * 12 + 6);
      if (poll) { if (race === 'presidente') enrichNationalPoll(s, poll); s.polls.push(poll); newsFromPoll(s, poll, rng); }
    }
  }
  if (t === mi(G, 10)) {
    const { record, notes } = runGeneralElection(s, rng, w.councillorRuns);
    compactOldRecords(s);
    s.generalElections.push(record);
    s.flags.lastElectionYear = G;
    out.push(...notes);
    for (const r of record.councillorRuns.filter((x) => x.elected)) w.pendingDepartures.push({ councillorId: r.id, office: r.office, posseMonth: r.office === 'deputado_federal' ? mi(G + 1, 2) : mi(G + 1, 3) });
    if (mine && !record.playerElected && !record.runoffPending) lapseCampaignPromises(s, G);
    if (record.runoffPending) {
      const pr = record.runoffPending;
      const ww = (x: typeof pr.a) => x.strength * (x.isPlayer ? 1 + (c?.campaignPoints ?? 0) / 180 : 1);
      s.polls.push(makeRunoffPoll(s, rng, { ...pr.a, w: ww(pr.a) }, { ...pr.b, w: ww(pr.b) }, 'governador'));
    }
  }
  if (t === mi(G, 11)) {
    const rp2 = resolvePresidentRunoff(s, rng);
    if (rp2) { out.push(rp2); if (rp2.includes('VOCÊ VENCEU') || rp2.includes('VOCÊ É')) s.flags.venceuSegundoTurno = true; else if (mine) lapseCampaignPromises(s, G); }
    const r = resolveGovernorRunoff(s, rng);
    if (r) { out.push(r); if (r.startsWith('VOCÊ VENCEU')) s.flags.venceuSegundoTurno = true; else if (mine) lapseCampaignPromises(s, G); }
    const rec = s.generalElections.find((e) => e.year === G);
    if (rec?.governorWinner && !rec.governorWinner.isPlayer && !rec.playerElected) stateSecretaryInvite(s, rec.governorWinner.partyId, rec.governorWinner.name);
  }
  if (t === mi(G, 12) && mine) out.push('Diplomação dos eleitos (eleições gerais).');
  const rec = s.generalElections.find((e) => e.year === G);
  if (rec && t === mi(G + 1, 1)) {
    applyGeneralResults(s, rec, 'executivos');
    if (rec.playerElected && rec.playerOffice !== 'governador' && s.player.mandate && s.player.mandate.office !== rec.playerOffice) {
      out.push(`Lembrete: sua posse como ${UPPER_LABEL[rec.playerOffice!] ?? rec.playerOffice} é em ${rec.playerOffice === 'deputado_estadual' ? '15 de março' : '1º de fevereiro'}. Até lá você segue exercendo o mandato de ${s.player.mandate.office.replace('_', ' ')}.`);
    }
    out.push(`Posse do(a) presidente (05/01) e do(a) governador(a) (06/01) — EC 111/2021. Governo de SP: ${w.governor.isPlayer ? 'você' : w.governor.name} (${partyById(w.governor.partyId)?.acronym}).`);
    if (s.player.mandate?.office === 'governador' && !(rec.playerElected && rec.playerOffice === 'governador')) endMandate(s, 'Seu mandato de governador(a) terminou.');
    if (s.player.mandate?.office === 'secretario_estadual') endMandate(s, 'Com a posse do novo governo, você deixou a secretaria estadual.');
    // Presidência (5/1): fim e início de mandatos do jogador, novo governo e ministério.
    const pw = rec.presidentWinner;
    const offNow = s.player.mandate?.office;
    if (offNow === 'presidente' && !(pw?.isPlayer)) endMandate(s, 'Seu mandato de presidente da República terminou.');
    if (offNow === 'vice_presidente' && !(pw?.viceIsPlayer)) endMandate(s, 'Seu mandato de vice-presidente terminou.');
    if (s.player.mandate?.minister && s.player.mandate.office === 'ministro' && !(pw && !pw.isPlayer && s.stateWorld.president.consecutiveTerms > 1)) out.push(leaveMinistry(s, 'Com a posse do novo governo, o ministério foi recomposto.'));
    const f = (s.federal ??= initFederal());
    if (pw?.isPlayer) {
      const cont = s.player.mandate?.office === 'presidente';
      if (!cont) startExecMandate(s, 'presidente', `${G + 1}-01-05`, `${G + 5}-01-04`, `${(rec.playerVotes ?? 0).toLocaleString('pt-BR')} votos`);
      else { s.player.mandate!.since = `${G + 1}-01-05`; s.player.mandate!.until = `${G + 5}-01-04`; s.player.careerHistory.push({ office: 'Presidente da República (reeleição)', from: `${G + 1}-01`, to: null, note: 'Reeleição' }); }
      f.coalition = [...new Set([s.player.partyId!, ...(c?.coalitionPartyIds ?? []), ...buildCoalition(s, s.player.partyId!, f.style)])];
      s.stateWorld.presidentCoalition = f.coalition;
      formCabinet(s, rng, s.player.partyId!);
      f.vice = { name: s.stateWorld.vicePresident?.name ?? 'Vice da chapa', partyId: s.stateWorld.vicePresident?.partyId ?? s.player.partyId, relation: 65 };
      f.lastReshuffle = t;
      out.push(`Você tomou posse como PRESIDENTE DA REPÚBLICA. Ministério montado (coalizão moderada): base de ${f.base.camara} deputados e ${f.base.senado} senadores. Ajuste o estilo de governo na página da Presidência.`);
    } else {
      if (pw?.viceIsPlayer) startExecMandate(s, 'vice_presidente', `${G + 1}-01-05`, `${G + 5}-01-04`, 'Eleito(a) na chapa presidencial');
      out.push(...aiPresidentTakesOffice(s, rng));
      if (pw?.viceIsPlayer) { f.vice = { name: s.character.name, partyId: s.player.partyId, isPlayer: true, relation: 65 }; out.push(`Você tomou posse como VICE-PRESIDENTE da República, ao lado de ${s.stateWorld.president.name}.`); }
    }
    if (rec.playerElected && rec.playerOffice === 'governador') {
      const terms = (s.player.consecutiveTermsGovernador ?? 0);
      startUpperMandate(s, 'governador', `${G + 1}-01-06`, generalTermEnd('governador', G), `${(rec.playerVotes ?? 0).toLocaleString('pt-BR')} votos`);
      s.player.consecutiveTermsGovernador = s.flags[`govAntes_${G}`] ? terms + 1 : 1;
      const coalition = [s.player.partyId!, ...(c?.coalitionPartyIds ?? [])];
      s.player.mandate!.upper!.assemblyBase = Object.entries(s.stateWorld.alespSeats).filter(([p]) => coalition.includes(p)).reduce((a, [, n]) => a + n, 0);
      s.stateWorld.governorCoalition = coalition;
    }
    if (typeof s.flags.secEstadualAceita === 'string') {
      startUpperMandate(s, 'secretario_estadual', `${G + 1}-01-06`, generalTermEnd('governador', G), 'Cargo de nomeação');
      s.player.mandate!.portfolio = String(s.flags.secEstadualAceita);
      s.player.mandate!.upper!.relationGov = 62;
      delete s.flags.secEstadualAceita;
    }
    if (c && (c.year ?? 0) === G && (!rec.playerElected || rec.playerOffice === 'governador' || rec.playerOffice === 'presidente' || rec.playerOffice === 'vice_presidente')) s.player.candidacy = null;
  }
  if (rec && t === mi(G + 1, 2)) {
    applyGeneralResults(s, rec, 'federal');
    out.push('Posse dos deputados federais e senadores (1º/02).');
    const off = s.player.mandate?.office;
    if (off === 'deputado_federal' && !(rec.playerElected && rec.playerOffice === 'deputado_federal')) endMandate(s, 'Seu mandato de deputado(a) federal terminou.');
    if (off === 'senador' && Number(s.player.mandate!.until.slice(0, 4)) <= G + 1 && !(rec.playerElected && rec.playerOffice === 'senador')) endMandate(s, 'Seu mandato de senador(a) terminou.');
    if (rec.playerElected && (rec.playerOffice === 'deputado_federal' || rec.playerOffice === 'senador')) {
      startUpperMandate(s, rec.playerOffice, `${G + 1}-02-01`, generalTermEnd(rec.playerOffice, G), `${(rec.playerVotes ?? 0).toLocaleString('pt-BR')} votos`);
      s.player.candidacy = null;
    }
    departures(s, mi(G + 1, 2));
    const lic = s.player.mandate?.minister?.licensed;
    if (lic && Number(lic.until.slice(0, 4)) <= G + 1) { s.player.mandate!.minister!.licensed = null; out.push('Seu mandato parlamentar (licenciado) terminou: ao deixar o ministério, você não terá mandato para reassumir.'); }
  }
  if (rec && t === mi(G + 1, 3)) {
    applyGeneralResults(s, rec, 'alesp');
    out.push('Posse da nova legislatura da Alesp (15/03).');
    if (s.player.mandate?.office === 'deputado_estadual' && !(rec.playerElected && rec.playerOffice === 'deputado_estadual')) endMandate(s, 'Seu mandato de deputado(a) estadual terminou.');
    if (rec.playerElected && rec.playerOffice === 'deputado_estadual') {
      startUpperMandate(s, 'deputado_estadual', `${G + 1}-03-15`, generalTermEnd('deputado_estadual', G), `${(rec.playerVotes ?? 0).toLocaleString('pt-BR')} votos`);
    }
    if (c && (c.year ?? 0) === G) s.player.candidacy = null;
    departures(s, mi(G + 1, 3));
    w.governorRace = null;
    w.senateRace = null;
    w.councillorRuns = [];
  }
  return out;
}

/** Saves longos (até 2036): auditorias passo a passo só ficam guardadas na eleição mais recente de cada tipo. */
function compactOldRecords(s: GameState) {
  const note = { phase: 'CALCULO' as const, text: 'Auditoria detalhada removida do save para economizar espaço (fica guardada só na eleição mais recente).' };
  for (const e of s.elections) if (e.proportional && e.proportional.audit.length > 1) e.proportional.audit = [note];
  for (const g of s.generalElections) { if (g.alesp.audit.length > 1) g.alesp.audit = [note]; if (g.camara.audit.length > 1) g.camara.audit = [note]; }
}

/** Vereadores eleitos deputados deixam a Câmara na posse; os suplentes assumem. */
function departures(s: GameState, month: number) {
  const due = s.stateWorld.pendingDepartures.filter((d) => d.posseMonth === month);
  for (const d of due) {
    const msg = vacateCouncilSeat(s, d.councillorId, `${d.office === 'deputado_federal' ? 'eleito(a) deputado(a) federal' : 'eleito(a) deputado(a) estadual'}${d.real2026 ? ' em 2026 — fato real' : ''}`);
    if (msg) log(s, 'camara', msg);
  }
  s.stateWorld.pendingDepartures = s.stateWorld.pendingDepartures.filter((d) => d.posseMonth !== month);
}

/** Convite para compor chapa presidencial como vice (julho do ano eleitoral; candidatos são personagens do jogo). */
function viceInvite(s: GameState, rng: GameState['rng']): string[] {
  const c = s.player.candidacy;
  if (c && c.status !== 'pretendida') return [];
  if (!s.player.partyId || !s.stateWorld.presidentRace?.length) return [];
  const age = s.month.year - Number(s.character.birthDate.slice(0, 4));
  if (age < 35) return [];
  const natRec = s.national ? (s.national.player.sudeste.recognition + s.national.player.nordeste.recognition + s.national.player.sul.recognition) / 3 : 0;
  const off = s.player.mandate?.office ?? '';
  const prominent = natRec >= 15 || s.player.recognition >= 60 || ['governador', 'senador', 'ministro', 'prefeito'].includes(off);
  if (!prominent) return [];
  const mineList = listIdForParty(s.player.partyId);
  const cand = s.stateWorld.presidentRace.filter((r) => r.listId !== mineList && partyAlignment(s.player.partyId, r.partyId) >= 0.45).sort((a, b) => b.baseStrength - a.baseStrength)[0];
  if (!cand || next(rng) > 0.5) return [];
  s.flags.conviteVice = `${cand.listId}|${cand.name}|${cand.partyId}`;
  s.pendingEvents.push({ templateId: 'convite_vice', vars: {} });
  return [`${cand.name} (${partyById(cand.partyId)?.acronym}, personagem do jogo), pré-candidato(a) à Presidência, quer conversar sobre a vaga de vice na chapa.`];
}

/** Convite para secretaria estadual: só com afinidade política e preparo (mesma lógica do convite municipal). */
function stateSecretaryInvite(s: GameState, govParty: string, govName: string) {
  if (!s.player.partyId || s.player.mandate?.office === 'governador') return;
  const aff = inviteAffinity(s, govParty);
  const a = s.character.attributes;
  const competent = s.player.recognition >= 25 && (a.management >= 45 || a.politicalKnowledge >= 55) && (s.player.mandate || s.player.careerHistory.length > 0);
  if (aff.ok && competent && next(s.rng) < 0.7) {
    s.flags.conviteEstadualGov = govName;
    s.pendingEvents.push({ templateId: 'convite_secretaria_estadual', vars: {} });
  }
}

function handleConventionAndRegistration(s: GameState) {
  const c = s.player.candidacy;
  if (!c) return;
  const rng = s.rng;
  const general = isGenYear(c.year ?? 2028);
  if (c.status === 'pretendida') {
    const conv = resolveConvention(s, rng);
    c.status = conv.approved ? 'aprovada_convencao' : 'rejeitada_convencao';
    log(s, 'eleicao', conv.text);
    if (!conv.approved) lapseCampaignPromises(s, c.year ?? 2028);
    if (!conv.approved && c.office !== 'vereador' && c.account.crowdPending && s.player.partyRel.leadershipTrust < 20) { log(s, 'eleicao', `Sem candidatura, a vaquinha virtual (${brl(c.account.crowdPending)}) é devolvida aos doadores.`); c.account.crowdPending = 0; }
    const fallback = c.office === 'prefeito' ? 'vereador' : c.office === 'governador' || c.office === 'senador' || c.office === 'presidente' ? 'deputado_federal' : c.office === 'deputado_federal' ? 'deputado_estadual' : null;
    if (!conv.approved && fallback && s.player.partyRel.leadershipTrust >= 20) {
      c.office = fallback;
      c.status = 'aprovada_convencao';
      log(s, 'eleicao', `Como alternativa, a convenção incluiu você na lista de candidatos a ${fallback.replace('_', ' ')}.`);
    }
  }
  if (c.status !== 'aprovada_convencao') return;
  c.checks = runEligibility(s);
  if (isEligible(c.checks)) {
    c.status = 'registrada';
    const party = partyById(s.player.partyId!)!;
    const strength = general ? stateStrength(s, party.id) / 4 : partyStrength(s, party.id);
    const baseFund = ({ presidente: 20_000_000, vice_presidente: 0, prefeito: 1_200_000, governador: 2_500_000, senador: 900_000, deputado_federal: 60_000, deputado_estadual: 35_000 } as Record<string, number>)[c.office] ?? 15_000;
    const fefc = Math.round(baseFund * (0.5 + strength / 4) * (0.4 + s.player.partyRel.leadershipTrust / 140 + s.player.partyRel.influence / 200));
    c.account.fefc = fefc;
    if (s.flags.caixaDoisReserva) { c.account.donations += Number(s.flags.caixaDoisReserva); c.irregularities += 1; s.flags.irregCampanha = Number(s.flags.irregCampanha ?? 0) + 1; log(s, 'eleicao', `O dinheiro guardado por fora (${brl(Number(s.flags.caixaDoisReserva))}) entrou na campanha sem declaração: caixa dois.`); delete s.flags.caixaDoisReserva; }
    if (c.account.crowdPending) { c.account.donations += c.account.crowdPending; log(s, 'eleicao', `Vaquinha virtual liberada com o registro: ${brl(c.account.crowdPending)} entram na conta de campanha.`); c.account.crowdPending = 0; }
    log(s, 'eleicao', `Registro de candidatura deferido. O ${party.acronym} repassou ${brl(fefc)} do FEFC para sua campanha (critério de distribuição interno do partido — valor de jogo). Campanha liberada a partir de 16/08.`);
  } else {
    c.status = 'indeferida';
    lapseCampaignPromises(s, c.year ?? 2028);
    if (c.account.crowdPending) { log(s, 'eleicao', `Sem registro, a vaquinha virtual (${brl(c.account.crowdPending)}) é devolvida aos doadores (Lei 9.504/97 art. 22-A §3º).`); c.account.crowdPending = 0; }
    const failed = c.checks.filter((x) => !x.ok).map((x) => x.label).join('; ');
    log(s, 'eleicao', `Registro de candidatura indeferido: ${failed}.`);
  }
}

function handleElectionDay(s: GameState, Y: number) {
  const rng = s.rng;
  const c = s.player.candidacy && (s.player.candidacy.year ?? 2028) === Y ? s.player.candidacy : null;
  const council = simulateCouncil(s, rng);
  const mayor = simulateMayor(s, rng);
  const playerInRunoff = !!mayor.r1.runoffIds?.includes('character_player');
  const record: ElectionRecord = {
    year: Y,
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
  s.flags.lastElectionYear = Y;
  for (const cand of mayor.field) record.candidatePartyById[cand.id] = cand.partyId;
  if (record.playerVotes && c?.status === 'registrada') { record.playerVotesByRegion = distributeVotes(s, record.playerVotes); rememberVotes(s, record.playerVotes, 'cidade'); }
  const totalMayor = mayor.field.reduce((a, x) => a + x.votes, 0) || 1;
  record.mayorByRegion = mayorRegionalShares(s, mayor.field.map((x) => ({ id: x.id, name: x.isPlayer ? s.character.name : x.name, share: x.votes / totalMayor, partyId: x.partyId })));
  if (playerInRunoff) {
    const [a, b] = mayor.r1.runoffIds!.map((id) => mayor.field.find((x) => x.id === id)!);
    const rest = mayor.field.filter((x) => x.id !== a.id && x.id !== b.id).reduce((sum, x) => sum + x.votes, 0);
    const pick = (x: typeof a) => ({ id: x.id, name: x.name, label: x.label, partyId: x.partyId, votes: x.votes, strength: x.strength, birthDate: x.birthDate, isPlayer: x.isPlayer });
    record.runoffPending = { a: pick(a), b: pick(b), rest };
    log(s, 'eleicao', `1º turno: você está no 2º turno contra ${a.isPlayer ? b.name : a.name}! Você tem mais um mês de campanha (2º turno no último domingo de outubro).`);
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
  if (c && !record.playerElected && !playerInRunoff) lapseCampaignPromises(s, Y);
  const keep = new Set((record.proportional?.elected ?? []).map((e) => e.candidateId).concat(['character_player'], mayor.field.map((x) => x.id)));
  record.candidatePartyById = Object.fromEntries(Object.entries(record.candidatePartyById).filter(([id]) => keep.has(id)));
  compactOldRecords(s);
  s.elections.push(record);
}

function handleRunoffAndAftermath(s: GameState, Y: number) {
  const rec = s.elections.find((e) => e.year === Y);
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
    if (w.isPlayer) s.flags.venceuSegundoTurno = true; else lapseCampaignPromises(s, Y);
    log(s, 'eleicao', w.isPlayer ? 'VOCÊ VENCEU O 2º TURNO E FOI ELEITO(A) PREFEITO(A) DE SÃO PAULO!' : `${w.name} venceu o 2º turno. Você não foi eleito(a).`);
  }
  // Convite para secretaria: só se houver relação política (mesma chapa, apoio) ou proximidade ideológica forte.
  const winnerParty = rec.mayorWinner?.partyId;
  if (!rec.playerElected && s.player.partyId && winnerParty && !rec.mayorWinner?.isPlayer && !['governador', 'senador', 'deputado_estadual', 'deputado_federal'].includes(s.player.mandate?.office ?? '')) {
    const aff = inviteAffinity(s, winnerParty);
    const a = s.character.attributes;
    const competent = s.player.recognition >= 12 && (a.management >= 35 || a.politicalKnowledge >= 45);
    const loyalOk = s.player.partyRel.leadershipTrust >= 15;
    s.flags.conviteMotivo = aff.reason;
    if (aff.ok && competent && loyalOk && next(rng) < 0.85) {
      s.flags.prefeitoEleitoNome = rec.mayorWinner!.name;
      s.pendingEvents.push({ templateId: 'convite_secretaria', vars: {} });
    } else if (competent && !aff.ok) {
      log(s, 'eleicao', `Sem convite para o governo eleito: ${aff.reason}`);
    }
  }
}

/** Cassação do diploma: o jogador perde o mandato; a vaga vai para a suplência, o vice ou o suplente. */
function cassate(s: GameState) {
  const m = s.player.mandate!;
  if (m.office === 'vereador') {
    vacateCouncilSeat(s, PLAYER, 'diploma cassado');
  } else if (m.office === 'prefeito') {
    s.government.mayor = { ...s.government.viceMayor };
    s.log.push({ month: { ...s.month }, kind: 'mandato', text: 'O vice assume a prefeitura. (Regra real: se a cassação ocorre na primeira metade do mandato, a Justiça Eleitoral pode convocar nova eleição — CE art. 224 §3º; o jogo simplifica com a posse do vice.)' });
  } else if (m.office === 'governador') {
    s.stateWorld.governor = { ...s.stateWorld.governor, id: 'vice_gov', name: 'Vice-governador(a) (personagem do jogo)', isPlayer: false };
  }
  endMandate(s, `Seu diploma de ${m.office} foi cassado pela Justiça Eleitoral.`);
  s.character.attributes.popularity = clamp(s.character.attributes.popularity - 10);
}

function handlePosse(s: GameState, Y: number) {
  const rec = s.elections.find((e) => e.year === Y);
  if (!rec) return;
  const from = Y + 1;
  const until = `${Y + 4}-12-31`;
  const prevOffice = s.player.mandate?.office;
  // Nova composição da Câmara a partir do resultado.
  const prevBirth = new Map(s.government.councillors.map((c) => [c.id, c]));
  s.government.councillors = (rec.proportional?.elected ?? []).map((e) => ({
    id: e.candidateId,
    name: e.candidateId === 'character_player' ? s.character.name : e.candidateName,
    partyId: rec.candidatePartyById[e.candidateId] ?? e.listId,
    real: e.candidateId.startsWith('real_ver_'),
    votes: e.candidateVotes,
    electedIn: Y,
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
    const same = s.government.mayor.personId === rec.mayorWinner.id && !s.government.mayor.real;
    s.flags.mayorTerms = same ? Number(s.flags.mayorTerms ?? 1) + 1 : 1;
    s.government.mayor = { personId: rec.mayorWinner.id, name: rec.mayorWinner.isPlayer ? s.character.name : rec.mayorWinner.name, partyId: rec.mayorWinner.partyId, real: false };
    s.government.viceMayor = { personId: `vice_${from}`, name: rec.mayorWinner.isPlayer ? 'Vice da sua chapa' : 'Vice eleito(a)', partyId: rec.mayorWinner.partyId, real: false };
    delete s.flags.mayorScandals;
  }
  s.government.mandateUntil = until;
  s.government.councilPresident = null;
  s.mayorRace = null;
  log(s, 'mandato', `Posse dos eleitos (1º/01/${from}). A ${councilLegislatureNumber(from)}ª legislatura da Câmara Municipal começa.`);

  // Mandatos municipais do jogador terminam aqui (reeleição abre um novo).
  if (isMunicipalMandate(prevOffice)) endMandate(s, `Seu mandato de ${prevOffice} (até 31/12/${Y}) terminou.`);
  if (prevOffice !== 'prefeito') s.player.consecutiveTermsPrefeito = 0;

  const histClose = () => s.player.careerHistory.forEach((h) => { if (h.to === null) h.to = `${Y}-12`; });
  if (rec.playerElected && rec.playerOffice === 'vereador') {
    s.player.mandate = newMandate('vereador', `${from}-01-01`, until);
    s.player.job = null;
    histClose();
    s.player.careerHistory.push({ office: 'Vereador(a) de São Paulo', from: `${from}-01`, to: null, note: `${(rec.playerVotes ?? 0).toLocaleString('pt-BR')} votos` });
    log(s, 'mandato', 'Você tomou posse como vereador(a). Use as ações de mandato. Em janeiro há eleição da Mesa Diretora.');
  } else if (rec.playerElected && rec.playerOffice === 'prefeito') {
    const coalition = [s.player.partyId!, ...(s.player.candidacy?.coalitionPartyIds ?? [])];
    const base = coalition.reduce((sum, id) => sum + (seats[id] ?? 0), 0);
    s.player.mandate = newMandate('prefeito', `${from}-01-01`, until);
    s.player.mandate.councilBase = base;
    s.player.mandate.approval = 55;
    s.player.consecutiveTermsPrefeito = prevOffice === 'prefeito' ? s.player.consecutiveTermsPrefeito + 1 : 1;
    s.player.job = null;
    histClose();
    s.player.careerHistory.push({ office: 'Prefeito(a) de São Paulo', from: `${from}-01`, to: null, note: `${(rec.playerVotes ?? 0).toLocaleString('pt-BR')} votos no 1º turno` });
    log(s, 'mandato', `Você tomou posse como prefeito(a). Sua coligação elegeu ${base} dos 55 vereadores: ${base >= 28 ? 'você começa com maioria' : 'você precisa ampliar a base para aprovar projetos'}.`);
    resetSecretariatForNewMayor(s, s.rng);
    log(s, 'mandato', 'As secretarias estão com interinos: nomeie o secretariado. Você tem até o fim de março para apresentar o Programa de Metas (LOM art. 69-A).');
    s.government.mayorCoalition = coalition;
    s.city.metas = null;
  } else if (typeof s.flags.secretariaAceita === 'string' && !s.player.mandate) {
    s.player.mandate = newMandate('secretario', `${from}-01-01`, until);
    const pid = String(s.flags.secretariaAceita);
    const sec = s.city.secretariats[pid] ? { ...structuredClone(s.city.secretariats[pid]), monthsInOffice: 0, lowMonths: 0, crisis: null } : createSecretariat(pid);
    s.city.secretaries[pid] = { portfolio: pid, name: s.character.name, partyId: s.player.partyId, kind: 'politico', competence: s.character.attributes.management, since: { ...s.month } };
    s.player.mandate.portfolio = sec.name;
    s.player.mandate.secretariat = sec;
    s.player.mandate.stance = 'base';
    s.player.mandate.relationExecutive = 60;
    s.player.job = null;
    histClose();
    s.player.careerHistory.push({ office: `Secretário(a) municipal de ${sec.name}`, from: `${from}-01`, to: null, note: 'Cargo de nomeação' });
    log(s, 'mandato', `Você assumiu a Secretaria Municipal de ${sec.name}. Orçamento (ordem de grandeza simulada): R$ ${sec.budget.toLocaleString('pt-BR')} mi/ano.`);
  }
  delete s.flags.secretariaAceita;
  if (s.player.mandate && s.player.staff) leaveStaff(s, 'Ao tomar posse, você deixou o cargo de assessor(a).');
  if (s.player.candidacy && (s.player.candidacy.year ?? 2028) === Y) s.player.candidacy = null;
  // Nova legislatura: blocos, comissões (proporcionais) e Mesa.
  initLegislature(s, s.rng);
  if (s.player.mandate?.office === 'prefeito') s.player.mandate.councilBase = blocCounts(s).base;
}

export function currentPhaseLabel(s: GameState): string {
  const t = monthIndex(s.month);
  if (s.gameOver) return s.ending ? `Fim da partida — ${s.ending.title}` : 'Fim da partida';
  const ne = nextElection(t);
  const Y = ne.year;
  const kind = ne.kind === 'municipal' ? 'municipais' : 'gerais';
  const recentY = Math.floor(t / 12);
  const inElectionYear = isMunYear(recentY) || isGenYear(recentY);
  const cur = s.player.mandate;
  const won = s.generalElections.find((e) => e.playerElected && e.playerOffice && e.playerOffice !== cur?.office && t > mi(e.year, 10) && t < mi(e.year + 1, e.playerOffice === 'deputado_estadual' ? 3 : e.playerOffice === 'governador' ? 1 : 2));
  if (won && cur) {
    const lbl = UPPER_LABEL[cur.office] ?? ({ vereador: 'Vereador(a)', prefeito: 'Prefeito(a)', secretario: 'Secretário(a) municipal' } as Record<string, string>)[cur.office] ?? cur.office;
    return `${lbl} · eleito(a) ${UPPER_LABEL[won.playerOffice!] ?? won.playerOffice} — posse em ${won.playerOffice === 'deputado_estadual' ? `15/03/${won.year + 1}` : won.playerOffice === 'governador' ? `06/01/${won.year + 1}` : `01/02/${won.year + 1}`}`;
  }
  if (inElectionYear && t >= mi(recentY, 8) && t <= mi(recentY, 9)) return `Campanha eleitoral ${recentY} (${isMunYear(recentY) ? 'municipal' : 'geral'})`;
  if (inElectionYear && t === mi(recentY, 10)) return 'Resultado das eleições / 2º turno';
  if (inElectionYear && t > mi(recentY, 10)) return 'Transição e diplomação';
  if (inElectionYear && t === mi(recentY, 7)) return 'Convenções partidárias';
  if (inElectionYear && t < mi(recentY, 4)) return `Pré-eleitoral ${recentY} — prazo de filiação no início de abril`;
  if (inElectionYear && t < mi(recentY, 7)) return 'Pré-campanha';
  const m = s.player.mandate;
  if (m && FEDERAL_LABEL[m.office]) return `${m.office === 'ministro' && m.minister ? (ministryById(m.minister.ministry)?.name ?? 'Ministério') : FEDERAL_LABEL[m.office]}${m.office !== 'ministro' ? ` ${m.since.slice(0, 4)}–${m.until.slice(0, 4)}` : ''} · próximas eleições ${nextElection(t).kind === 'geral' ? 'gerais' : 'municipais'}: ${nextElection(t).year}`;
  if (m && m.upper) return `Seu mandato: ${UPPER_LABEL[m.office] ?? m.office} ${m.since.slice(0, 4)}–${m.until.slice(0, 4)} · próximas eleições ${kind}: ${Y}`;
  const term = munTerm(t);
  return `Mandatos municipais ${term.from}–${term.to} · próximas eleições ${kind}: ${Y} — ${monthLabel(s.month)}`;
}
