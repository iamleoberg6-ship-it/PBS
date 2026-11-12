/**
 * Fase 13 — Cenas: os grandes momentos da carreira viram telas próprias.
 *
 * As cenas são DERIVADAS comparando o estado antes e depois de um mês (função pura).
 * Não mudam o estado nem o save: são só apresentação. A noite da apuração usa os
 * números finais já calculados pelo motor eleitoral; a ORDEM em que as urnas aparecem
 * na tela é ilustrativa (MECÂNICA DE APRESENTAÇÃO, não dado real).
 */
import type { GameState } from './types';
import type { GameMonth } from '../calendar';
import { listIdForParty, partyById } from '../data/parties';

export type SceneKind =
  | 'apuracao' | 'posse' | 'fim_mandato' | 'cassacao' | 'nascimento' | 'casamento' | 'separacao'
  | 'nomeacao' | 'promocao' | 'exoneracao' | 'escandalo' | 'filiacao' | 'ameaca' | 'sucessao' | 'fim_carreira';
export type SceneTone = 'vitoria' | 'derrota' | 'alegre' | 'tenso' | 'neutro';

export interface ApuracaoRef { level: 'municipal' | 'geral'; year: number; round: 1 | 2; office: string }
export interface Scene { id: string; kind: SceneKind; tone: SceneTone; month: GameMonth; kicker: string; title: string; text: string; office?: string; apuracao?: ApuracaoRef }

export const OFFICE_NAME: Record<string, string> = {
  vereador: 'vereador(a)', prefeito: 'prefeito(a) de São Paulo', secretario: 'secretário(a) municipal', deputado_estadual: 'deputado(a) estadual',
  deputado_federal: 'deputado(a) federal', senador: 'senador(a)', governador: 'governador(a) de São Paulo', secretario_estadual: 'secretário(a) estadual',
  presidente: 'presidente da República', vice_presidente: 'vice-presidente da República', ministro: 'ministro(a) de Estado',
};
const HOUSE: Record<string, string> = {
  vereador: 'Câmara Municipal de São Paulo', prefeito: 'Edifício Matarazzo, sede da Prefeitura', deputado_estadual: 'Assembleia Legislativa (Alesp)',
  deputado_federal: 'Câmara dos Deputados, em Brasília', senador: 'Senado Federal, em Brasília', governador: 'Palácio dos Bandeirantes',
  presidente: 'Palácio do Planalto', vice_presidente: 'Palácio do Planalto', secretario: 'Prefeitura de São Paulo', secretario_estadual: 'Governo do Estado', ministro: 'Esplanada dos Ministérios',
};

const mi = (m: GameMonth) => m.year * 12 + m.month;
const RANK_NAME: Record<string, string> = { assessor: 'assessor(a) parlamentar', especial: 'assessor(a) especial', chefe_gabinete: 'chefe de gabinete' };

/** Compara dois estados consecutivos e devolve as cenas, em ordem de importância narrativa. */
export function detectScenes(prev: GameState, next: GameState): Scene[] {
  const out: Scene[] = [];
  const m = next.month;
  const add = (sc: Omit<Scene, 'id' | 'month'>) => out.push({ ...sc, id: `${sc.kind}_${mi(m)}_${out.length}`, month: m });

  // --- Apuração municipal (1º turno) ---
  if (next.elections.length > prev.elections.length) {
    const r = next.elections[next.elections.length - 1];
    if (r.playerOffice) add({ kind: 'apuracao', tone: r.runoffPending ? 'tenso' : r.playerElected ? 'vitoria' : 'derrota', kicker: `Eleições municipais de ${r.year}`, title: 'Noite da apuração', text: '', office: r.playerOffice, apuracao: { level: 'municipal', year: r.year, round: 1, office: r.playerOffice } });
  }
  // --- 2º turno municipal ---
  for (const r of next.elections) {
    const before = prev.elections.find((e) => e.year === r.year);
    if (before?.runoffPending && !r.runoffPending && r.mayorRunoff && (before.runoffPending.a.isPlayer || before.runoffPending.b.isPlayer))
      add({ kind: 'apuracao', tone: r.playerElected ? 'vitoria' : 'derrota', kicker: `2º turno de ${r.year}`, title: 'Noite da apuração — 2º turno', text: '', office: 'prefeito', apuracao: { level: 'municipal', year: r.year, round: 2, office: 'prefeito' } });
  }
  // --- Eleições gerais ---
  if (next.generalElections.length > prev.generalElections.length) {
    const r = next.generalElections[next.generalElections.length - 1];
    if (r.playerOffice) {
      const runoff = (r.playerOffice === 'governador' && r.runoffPending) || (r.playerOffice === 'presidente' && r.presidentRunoffPending);
      add({ kind: 'apuracao', tone: runoff ? 'tenso' : r.playerElected ? 'vitoria' : 'derrota', kicker: `Eleições gerais de ${r.year}`, title: 'Noite da apuração', text: '', office: r.playerOffice, apuracao: { level: 'geral', year: r.year, round: 1, office: r.playerOffice } });
    }
  }
  for (const r of next.generalElections) {
    const before = prev.generalElections.find((e) => e.year === r.year);
    if (!before) continue;
    if (before.runoffPending && !r.runoffPending && r.governorRunoff && (before.runoffPending.a.isPlayer || before.runoffPending.b.isPlayer))
      add({ kind: 'apuracao', tone: r.playerElected ? 'vitoria' : 'derrota', kicker: `2º turno de ${r.year}`, title: 'Noite da apuração — 2º turno', text: '', office: 'governador', apuracao: { level: 'geral', year: r.year, round: 2, office: 'governador' } });
    if (before.presidentRunoffPending && !r.presidentRunoffPending && r.presidentRunoff)
      add({ kind: 'apuracao', tone: r.playerElected ? 'vitoria' : 'derrota', kicker: `2º turno de ${r.year}`, title: 'Noite da apuração — 2º turno', text: '', office: 'presidente', apuracao: { level: 'geral', year: r.year, round: 2, office: 'presidente' } });
  }

  // --- Sucessão (herdeiro assume a carreira) ---
  const pg = prev.personal?.generation ?? 0, ng = next.personal?.generation ?? 0;
  if (ng > pg) {
    add({ kind: 'sucessao', tone: 'alegre', kicker: 'Passagem de bastão', title: `${next.character.name} assume a história`, text: `A carreira de ${prev.character.name} vira memória da família. Agora é a vez de ${next.character.name}.` });
    return out;
  }

  // --- Mandato: posse, fim, cassação ---
  const pm = prev.player.mandate, nm = next.player.mandate;
  if (nm && (!pm || pm.office !== nm.office)) {
    add({ kind: 'posse', tone: 'vitoria', kicker: 'Posse', title: `${next.character.name} toma posse como ${OFFICE_NAME[nm.office] ?? nm.office}`, text: `${HOUSE[nm.office] ?? 'Cerimônia de posse'}. Família na plateia, juramento lido, assinatura no livro de posse. A partir de hoje, cada decisão tem nome e sobrenome.`, office: nm.office });
  } else if (pm && !nm) {
    const fresh = next.log.slice(prev.log.length).map((l) => l.text).join(' ');
    if (/cassa/i.test(fresh)) add({ kind: 'cassacao', tone: 'derrota', kicker: 'Mandato cassado', title: 'O mandato acabou antes da hora', text: 'A decisão foi publicada. Os assessores encaixotam o gabinete e o telefone para de tocar. Ainda dá para recomeçar, mas o caminho ficou mais longo.', office: pm.office });
    else add({ kind: 'fim_mandato', tone: 'neutro', kicker: 'Fim de mandato', title: `Último dia como ${OFFICE_NAME[pm.office] ?? pm.office}`, text: 'Gavetas vazias, placas retiradas, despedida da equipe. O que você fez no cargo agora é a sua vitrine para o próximo passo.', office: pm.office });
  }

  // --- Assessoria ---
  const ps = prev.player.staff, ns = next.player.staff;
  if (!ps && ns) add({ kind: 'nomeacao', tone: 'alegre', kicker: 'Diário Oficial', title: `Nomeado(a) no gabinete de ${ns.bossName}`, text: 'Crachá novo, mesa no gabinete e uma pilha de demandas. Cargo em comissão: de livre nomeação e exoneração.' });
  else if (ps && ns && ps.rank !== ns.rank) add({ kind: 'promocao', tone: 'alegre', kicker: 'Promoção', title: `Agora você é ${RANK_NAME[ns.rank] ?? ns.rank}`, text: `${ns.bossName} confiou a você mais responsabilidade. Salário maior, porta da sala aberta para os bastidores.` });
  else if (ps && !ns && !nm) add({ kind: 'exoneracao', tone: 'derrota', kicker: 'Diário Oficial', title: `Exonerado(a) do gabinete de ${ps.bossName}`, text: 'Uma caixa de papelão, o crachá devolvido na portaria. A rede de contatos, porém, vai com você.' });

  // --- Família ---
  const kids = (s: GameState) => (s.personal?.family ?? []).filter((f) => f.relation === 'filho');
  const newKids = kids(next).filter((k) => !kids(prev).some((p) => p.id === k.id));
  for (const k of newKids) add({ kind: 'nascimento', tone: 'alegre', kicker: 'Família', title: `Nasceu ${k.name.split(' ')[0]}!`, text: 'Madrugada no hospital, mensagens de parabéns chegando sem parar. Por algumas horas, a política fica do lado de fora da porta.' });
  const partner = (s: GameState) => (s.personal?.family ?? []).find((f) => f.relation === 'conjuge');
  const pp = partner(prev), np = partner(next);
  if (!pp && np) add({ kind: 'casamento', tone: 'alegre', kicker: 'Família', title: `Casamento com ${np.name.split(' ')[0]}`, text: 'Festa com a família, amigos de militância e um ou outro político que se convidou sozinho.' });
  else if (pp && !np) add({ kind: 'separacao', tone: 'derrota', kicker: 'Família', title: `Fim do casamento com ${pp.name.split(' ')[0]}`, text: 'A agenda cheia cobrou o seu preço. A casa ficou grande demais e silenciosa.' });

  // --- Escândalo ---
  const newCrisis = next.crises.find((c) => c.targetId === 'character_player' && c.status === 'ativa' && !prev.crises.some((p) => p.id === c.id));
  if (newCrisis) add({ kind: 'escandalo', tone: 'tenso', kicker: 'Manchete', title: newCrisis.headline, text: newCrisis.truth === 'verdadeira' ? 'Os flashes não param na porta do gabinete. Desta vez a história tem fundamento.' : newCrisis.truth === 'falsa' ? 'É mentira, mas já está em todos os grupos de mensagem. Responder ou deixar passar?' : 'Meia-verdade com título forte. O contexto ficou de fora da reportagem.' });

  // --- Partido ---
  if (next.player.partyId && prev.player.partyId !== next.player.partyId) {
    const p = partyById(next.player.partyId);
    add({ kind: 'filiacao', tone: 'neutro', kicker: prev.player.partyId ? 'Troca de partido' : 'Filiação', title: `Ficha assinada no ${p?.acronym ?? 'partido'}`, text: prev.player.partyId ? 'Foto com a nova direção, críticas dos antigos companheiros. A janela partidária não perdoa quem hesita.' : 'Foto com a direção, número de filiação na mão. Agora você tem uma legenda para chamar de sua.' });
  }

  // --- Ameaça grave ---
  const newThreat = (next.personal?.threats ?? []).filter((t) => t.level >= 4 && !(prev.personal?.threats ?? []).some((p) => p.month === t.month && p.text === t.text));
  if (newThreat.length) add({ kind: 'ameaca', tone: 'tenso', kicker: 'Ameaça', title: 'Uma ameaça séria', text: `${newThreat[0].text} A decisão sobre segurança, polícia e afastamento é sua.` });

  // --- Fim da carreira ---
  if (next.gameOver && !prev.gameOver) add({ kind: 'fim_carreira', tone: 'neutro', kicker: 'Fim de jogo', title: 'Fim da carreira', text: 'A trajetória termina aqui. Veja as conquistas e o legado deixado.' });

  return out;
}

// ---------------------------------------------------------------------------------------------
// Dados da noite da apuração
// ---------------------------------------------------------------------------------------------

export interface ApuracaoCand { id: string; name: string; label: string; votes: number; isPlayer: boolean; elected?: boolean }
export interface ApuracaoData {
  title: string;
  subtitle: string;
  mode: 'majoritaria' | 'proporcional';
  validVotes: number;
  candidates: ApuracaoCand[];
  /** Vagas em disputa (majoritária: 1 ou 2 no Senado; proporcional: vagas obtidas pela lista do jogador). */
  seats: number;
  outcome: 'eleito' | 'nao_eleito' | 'segundo_turno';
  outcomeText: string;
  playerVotes: number;
  regions?: Record<string, number>;
  listLabel?: string;
  /** Linha de corte: votos do último eleito da lista do jogador (proporcional). */
  cutoff?: number;
}

const playerName = (s: GameState) => s.character.name;

function propData(s: GameState, prop: { elected: { listId: string; candidateId: string; candidateName: string; candidateVotes: number }[]; lists: { listId: string; label: string; totalSeats: number }[]; validVotes: number }, partyId: string | undefined, votes: number, elected: boolean, regions: Record<string, number> | undefined, office: string, year: number): ApuracaoData {
  const listId = partyId ? listIdForParty(partyId) : '';
  const list = prop.lists.find((l) => l.listId === listId);
  const mates = prop.elected.filter((e) => e.listId === listId && e.candidateId !== 'character_player');
  const cands: ApuracaoCand[] = mates.map((e) => ({ id: e.candidateId, name: e.candidateName, label: list?.label ?? '', votes: e.candidateVotes, isPlayer: false, elected: true }));
  cands.push({ id: 'character_player', name: playerName(s), label: list?.label ?? '', votes, isPlayer: true, elected });
  cands.sort((a, b) => b.votes - a.votes);
  const cutoff = mates.length ? Math.min(...mates.map((m) => m.candidateVotes)) : undefined;
  const seats = list?.totalSeats ?? mates.length + (elected ? 1 : 0);
  return {
    title: `Apuração — ${OFFICE_NAME[office] ?? office}`, subtitle: `${year} · lista ${list?.label ?? '—'} · ${seats} vaga(s) para a lista`,
    mode: 'proporcional', validVotes: prop.validVotes, candidates: cands.slice(0, 12).some((c) => c.isPlayer) ? cands.slice(0, 12) : [...cands.filter((c) => !c.isPlayer).slice(0, 11), cands.find((c) => c.isPlayer)!], seats, outcome: elected ? 'eleito' : 'nao_eleito',
    outcomeText: elected ? `${votes.toLocaleString('pt-BR')} votos. A lista fez ${seats} cadeira(s) e você está dentro.` : `${votes.toLocaleString('pt-BR')} votos. A lista fez ${seats} cadeira(s); ${cutoff ? `o último eleito teve ${cutoff.toLocaleString('pt-BR')}` : 'não sobrou vaga para você'}.`,
    playerVotes: votes, regions, listLabel: list?.label, cutoff,
  };
}

function majData(s: GameState, round: { validVotes: number; ranking: { id: string; name: string; label: string; votes: number }[]; winnerId: string | null; needsRunoff: boolean; runoffIds: [string, string] | null }, seats: number, office: string, year: number, roundNo: 1 | 2, regions?: Record<string, number>): ApuracaoData {
  const top = round.ranking.slice(0, 5);
  const me = round.ranking.find((r) => r.id === 'character_player');
  if (me && !top.includes(me)) top.push(me);
  const winners = round.ranking.slice(0, seats).map((r) => r.id);
  const inRunoff = !!round.needsRunoff && !!round.runoffIds?.includes('character_player');
  const elected = seats > 1 ? winners.includes('character_player') : round.winnerId === 'character_player';
  const outcome = inRunoff ? 'segundo_turno' : elected ? 'eleito' : 'nao_eleito';
  const pv = me?.votes ?? 0;
  const pos = me ? round.ranking.indexOf(me) + 1 : 0;
  return {
    title: `Apuração — ${OFFICE_NAME[office] ?? office}${roundNo === 2 ? ' (2º turno)' : ''}`, subtitle: `${year} · ${seats > 1 ? `${seats} vagas em disputa` : 'maioria absoluta dos votos válidos para vencer no 1º turno'}`,
    mode: 'majoritaria', validVotes: round.validVotes,
    candidates: top.map((r) => ({ id: r.id, name: r.id === 'character_player' ? playerName(s) : r.name, label: r.label, votes: r.votes, isPlayer: r.id === 'character_player', elected: seats > 1 ? winners.includes(r.id) : round.winnerId === r.id })),
    seats, outcome, playerVotes: pv, regions,
    outcomeText: outcome === 'segundo_turno' ? `Ninguém passou de 50% dos válidos. Você vai ao 2º turno (${pos}º lugar).` : elected ? `${pv.toLocaleString('pt-BR')} votos. Vitória!` : `${pv.toLocaleString('pt-BR')} votos, ${pos}º lugar.`,
  };
}

/** Monta os números da apuração a partir do registro final da eleição. */
export function apuracaoData(s: GameState, ref: ApuracaoRef): ApuracaoData | null {
  if (ref.level === 'municipal') {
    const r = s.elections.find((e) => e.year === ref.year);
    if (!r) return null;
    const party = r.candidatePartyById?.character_player ?? s.player.partyId ?? undefined;
    if (ref.office === 'vereador' && r.proportional) return propData(s, r.proportional, party, r.playerVotes ?? 0, r.playerElected, r.playerVotesByRegion, 'vereador', r.year);
    const round = ref.round === 2 ? r.mayorRunoff : r.mayorFirst;
    return round ? majData(s, round, 1, 'prefeito', r.year, ref.round, ref.round === 1 ? r.playerVotesByRegion : undefined) : null;
  }
  const g = s.generalElections.find((e) => e.year === ref.year);
  if (!g) return null;
  const party = g.candidatePartyById?.character_player ?? s.player.partyId ?? undefined;
  if (ref.office === 'deputado_estadual') return propData(s, g.alesp, party, g.playerVotes ?? 0, g.playerElected, g.playerVotesByRegion, ref.office, g.year);
  if (ref.office === 'deputado_federal') return propData(s, g.camara, party, g.playerVotes ?? 0, g.playerElected, g.playerVotesByRegion, ref.office, g.year);
  if (ref.office === 'senador') return majData(s, g.senate, g.senateSeats, 'senador', g.year, 1, g.playerVotesByRegion);
  if (ref.office === 'governador') { const round = ref.round === 2 ? g.governorRunoff : g.governorFirst; return round ? majData(s, round, 1, 'governador', g.year, ref.round, g.playerVotesByRegion) : null; }
  if (ref.office === 'presidente') { const round = ref.round === 2 ? g.presidentRunoff : g.presidentFirst; return round ? majData(s, round, 1, 'presidente', g.year, ref.round) : null; }
  return null;
}

/** Eleições em que o jogador foi candidato, para "rever a noite da apuração". */
export function pastApuracoes(s: GameState): ApuracaoRef[] {
  const out: ApuracaoRef[] = [];
  for (const r of s.elections) if (r.playerOffice) { out.push({ level: 'municipal', year: r.year, round: 1, office: r.playerOffice }); if (r.mayorRunoff && r.mayorRunoff.ranking.some((x) => x.id === 'character_player')) out.push({ level: 'municipal', year: r.year, round: 2, office: 'prefeito' }); }
  for (const g of s.generalElections) if (g.playerOffice) {
    out.push({ level: 'geral', year: g.year, round: 1, office: g.playerOffice });
    if (g.playerOffice === 'governador' && g.governorRunoff?.ranking.some((x) => x.id === 'character_player')) out.push({ level: 'geral', year: g.year, round: 2, office: 'governador' });
    if (g.playerOffice === 'presidente' && g.presidentRunoff?.ranking.some((x) => x.id === 'character_player')) out.push({ level: 'geral', year: g.year, round: 2, office: 'presidente' });
  }
  return out.filter((r) => apuracaoData(s, r));
}
