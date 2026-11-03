// Sistema proporcional (vereador / deputado estadual / deputado federal).
// Código Eleitoral arts. 106–111 com redação da Lei 14.211/2021, Res. TSE 23.677/2021
// e decisão do STF (fev/2024) que abriu a última fase das sobras a todos os partidos.
// Função pura: mesmas entradas -> mesma saída. Cada passo é registrado para auditoria na interface.

export interface PropCandidate {
  id: string;
  name: string;
  votes: number;
  /** Para desempate entre candidatos: o mais idoso (Código Eleitoral art. 110). null = data não disponível no jogo. */
  birthDate: string | null;
  /** Precisão da data (dados reais podem ser estimados pelo jogo). Ausente = exata. */
  birthPrecision?: 'exata' | 'ano' | 'estimada';
}

export interface PropList {
  /** Partido isolado ou federação (que concorre como uma única agremiação). */
  listId: string;
  label: string;
  legendVotes: number;
  candidates: PropCandidate[];
}

export interface PropParams {
  seats: number;
  nominalMinPhase1: number; // 0.10
  partyMinPhase2: number; // 0.80
  candidateMinPhase2: number; // 0.20
  phase3OpenToAllParties: boolean;
}

export type SeatPhase = 'QP' | 'SOBRAS_80_20' | 'SOBRAS_FINAL' | 'MAIS_VOTADOS_ART111';

export interface ElectedSeat {
  seatNumber: number;
  listId: string;
  candidateId: string;
  candidateName: string;
  candidateVotes: number;
  phase: SeatPhase;
  /** Média que deu a vaga (fases de sobras). */
  average?: number;
}

export interface ListSummary {
  listId: string;
  label: string;
  totalVotes: number;
  nominalVotes: number;
  legendVotes: number;
  partyQuotient: number;
  reachedEQ: boolean;
  reached80: boolean;
  seatsQP: number;
  seatsPhase2: number;
  seatsPhase3: number;
  seatsArt111: number;
  totalSeats: number;
}

export interface AuditStep {
  phase: SeatPhase | 'CALCULO';
  text: string;
}

export interface ProportionalResult {
  validVotes: number;
  seats: number;
  electoralQuotient: number;
  nominalMinPhase1Votes: number;
  partyMinPhase2Votes: number;
  candidateMinPhase2Votes: number;
  lists: ListSummary[];
  elected: ElectedSeat[];
  audit: AuditStep[];
}

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');
const fmtAvg = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** Código Eleitoral art. 106: despreza a fração se ≤ 0,5; arredonda para cima se > 0,5. */
export function electoralQuotient(validVotes: number, seats: number): number {
  const raw = validVotes / seats;
  const floor = Math.floor(raw);
  return raw - floor > 0.5 ? floor + 1 : floor;
}

/** Ordena candidatos por votos; empate -> mais idoso primeiro (art. 110).
 *  Se faltar a data de nascimento de algum empatado, usa FALLBACK do jogo (ordem do identificador) e sinaliza. */
function sortCandidates(cands: PropCandidate[], onFallback: (a: PropCandidate, b: PropCandidate) => void, onEstimated: (a: PropCandidate, b: PropCandidate) => void): PropCandidate[] {
  return [...cands].sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    if (a.birthDate && b.birthDate && a.birthDate !== b.birthDate) {
      if (a.votes > 0 && ((a.birthPrecision ?? 'exata') !== 'exata' || (b.birthPrecision ?? 'exata') !== 'exata')) onEstimated(a, b);
      return a.birthDate.localeCompare(b.birthDate);
    }
    if ((!a.birthDate || !b.birthDate) && a.votes > 0) onFallback(a, b);
    return a.id.localeCompare(b.id);
  });
}

export function allocateProportional(listsIn: PropList[], params: PropParams): ProportionalResult {
  const audit: AuditStep[] = [];
  const fallbackTies: string[] = [];
  const estimatedTies: string[] = [];
  const lists = listsIn.map((l) => ({ ...l, sorted: sortCandidates(l.candidates, (a, b) => fallbackTies.push(`${a.name} × ${b.name}`), (a, b) => estimatedTies.push(`${a.name} × ${b.name}`)) }));
  const totals = new Map<string, number>();
  for (const l of lists) {
    const nominal = l.candidates.reduce((s, c) => s + c.votes, 0);
    totals.set(l.listId, nominal + l.legendVotes);
  }
  const validVotes = [...totals.values()].reduce((s, v) => s + v, 0);
  const qe = electoralQuotient(validVotes, params.seats);
  const min1 = params.nominalMinPhase1 * qe;
  const min80 = params.partyMinPhase2 * qe;
  const min20 = params.candidateMinPhase2 * qe;

  audit.push({
    phase: 'CALCULO',
    text: `Votos válidos (nominais + legenda): ${fmt(validVotes)}. Vagas: ${params.seats}. Quociente eleitoral (QE) = ${fmt(validVotes)} ÷ ${params.seats} = ${fmt(qe)} (art. 106).`,
  });
  audit.push({
    phase: 'CALCULO',
    text: `Votação nominal mínima na 1ª fase: 10% do QE = ${fmt(min1)}. Sobras: partido com ≥ 80% do QE (${fmt(min80)}) e candidato com ≥ 20% do QE (${fmt(min20)}).`,
  });

  const seatsOf = new Map<string, number>(lists.map((l) => [l.listId, 0]));
  const electedIds = new Set<string>();
  const elected: ElectedSeat[] = [];
  const phaseCount = new Map<string, Record<SeatPhase, number>>(
    lists.map((l) => [l.listId, { QP: 0, SOBRAS_80_20: 0, SOBRAS_FINAL: 0, MAIS_VOTADOS_ART111: 0 }]),
  );

  const award = (list: (typeof lists)[number], cand: PropCandidate, phase: SeatPhase, average?: number) => {
    electedIds.add(cand.id);
    seatsOf.set(list.listId, (seatsOf.get(list.listId) ?? 0) + 1);
    phaseCount.get(list.listId)![phase]++;
    elected.push({
      seatNumber: elected.length + 1,
      listId: list.listId,
      candidateId: cand.id,
      candidateName: cand.name,
      candidateVotes: cand.votes,
      phase,
      average,
    });
  };

  const anyReachedQE = lists.some((l) => (totals.get(l.listId) ?? 0) >= qe);

  // Art. 111: se nenhum partido atingir o QE, elegem-se os mais votados.
  if (!anyReachedQE || qe === 0) {
    audit.push({ phase: 'MAIS_VOTADOS_ART111', text: 'Nenhuma agremiação atingiu o quociente eleitoral: elegem-se os candidatos mais votados (art. 111).' });
    const all = lists.flatMap((l) => l.sorted.map((c) => ({ l, c })));
    all.sort((a, b) => b.c.votes - a.c.votes || (a.c.birthDate && b.c.birthDate ? a.c.birthDate.localeCompare(b.c.birthDate) : a.c.id.localeCompare(b.c.id)));
    for (const { l, c } of all.slice(0, params.seats)) award(l, c, 'MAIS_VOTADOS_ART111');
    return finalize();
  }

  // 1ª fase — quociente partidário (art. 107) e votação nominal mínima de 10% (art. 108).
  for (const l of lists) {
    const total = totals.get(l.listId) ?? 0;
    const qp = Math.floor(total / qe);
    if (qp === 0) continue;
    const eligible = l.sorted.filter((c) => c.votes >= min1);
    const filled = Math.min(qp, eligible.length);
    for (let i = 0; i < filled; i++) award(l, eligible[i], 'QP');
    audit.push({
      phase: 'QP',
      text: `${l.label}: ${fmt(total)} votos ÷ QE = QP ${qp}. ${filled} vaga(s) preenchida(s) por candidatos com ≥ 10% do QE${filled < qp ? `; ${qp - filled} vaga(s) vão para as sobras por falta de votação nominal mínima` : ''}.`,
    });
  }

  const average = (listId: string) => (totals.get(listId) ?? 0) / ((seatsOf.get(listId) ?? 0) + 1);
  // Desempate de médias: maior votação da agremiação (critério adotado; validar redação da Res. TSE vigente).
  const byAverage = (ids: string[]) =>
    [...ids].sort((a, b) => average(b) - average(a) || (totals.get(b) ?? 0) - (totals.get(a) ?? 0) || a.localeCompare(b));

  // 2ª fase — sobras com a regra 80/20 (art. 109, I e §2º).
  const phase2Lists = lists.filter((l) => (totals.get(l.listId) ?? 0) >= min80).map((l) => l.listId);
  while (elected.length < params.seats) {
    let awarded = false;
    for (const id of byAverage(phase2Lists)) {
      const l = lists.find((x) => x.listId === id)!;
      const cand = l.sorted.find((c) => !electedIds.has(c.id) && c.votes >= min20);
      if (!cand) continue;
      const avg = average(id);
      award(l, cand, 'SOBRAS_80_20', avg);
      audit.push({ phase: 'SOBRAS_80_20', text: `Vaga ${elected.length}: ${l.label} tem a maior média apta (${fmtAvg(avg)}) → ${cand.name} (${fmt(cand.votes)} votos).` });
      awarded = true;
      break;
    }
    if (!awarded) break;
  }

  // 3ª fase — quando não houver mais partido e candidato que cumpram 80/20 (art. 109, III).
  // Após o STF (2024): todas as agremiações concorrem, pelas maiores médias, sem votação mínima individual.
  if (elected.length < params.seats) {
    const phase3Lists = params.phase3OpenToAllParties ? lists.map((l) => l.listId) : phase2Lists;
    audit.push({
      phase: 'SOBRAS_FINAL',
      text: `Restam ${params.seats - elected.length} vaga(s) sem partido/candidato que cumpra 80/20: distribuição pelas maiores médias entre ${params.phase3OpenToAllParties ? 'todas as agremiações' : 'as agremiações com 80% do QE'}.`,
    });
    while (elected.length < params.seats) {
      let awarded = false;
      for (const id of byAverage(phase3Lists)) {
        const l = lists.find((x) => x.listId === id)!;
        const cand = l.sorted.find((c) => !electedIds.has(c.id));
        if (!cand) continue;
        const avg = average(id);
        award(l, cand, 'SOBRAS_FINAL', avg);
        audit.push({ phase: 'SOBRAS_FINAL', text: `Vaga ${elected.length}: ${l.label} (média ${fmtAvg(avg)}) → ${cand.name} (${fmt(cand.votes)} votos).` });
        awarded = true;
        break;
      }
      if (!awarded) {
        audit.push({ phase: 'SOBRAS_FINAL', text: 'Não há mais candidatos disponíveis; vagas restantes ficam sem preenchimento.' });
        break;
      }
    }
  }

  return finalize();

  function finalize(): ProportionalResult {
    if (estimatedTies.length) {
      audit.push({ phase: 'CALCULO', text: `Empate de votos decidido pelo mais idoso (art. 110) com data de nascimento ESTIMADA pelo jogo (${[...new Set(estimatedTies)].slice(0, 3).join('; ')}).` });
    }
    if (fallbackTies.length) {
      audit.push({ phase: 'CALCULO', text: `Empate de votos sem data de nascimento disponível (${[...new Set(fallbackTies)].slice(0, 3).join('; ')}): o critério legal do mais idoso (art. 110) não pôde ser aplicado e o jogo usou ordem de registro como fallback.` });
    }
    const summaries: ListSummary[] = lists.map((l) => {
      const total = totals.get(l.listId) ?? 0;
      const pc = phaseCount.get(l.listId)!;
      return {
        listId: l.listId,
        label: l.label,
        totalVotes: total,
        nominalVotes: total - l.legendVotes,
        legendVotes: l.legendVotes,
        partyQuotient: qe > 0 ? Math.floor(total / qe) : 0,
        reachedEQ: total >= qe,
        reached80: total >= min80,
        seatsQP: pc.QP,
        seatsPhase2: pc.SOBRAS_80_20,
        seatsPhase3: pc.SOBRAS_FINAL,
        seatsArt111: pc.MAIS_VOTADOS_ART111,
        totalSeats: seatsOf.get(l.listId) ?? 0,
      };
    });
    summaries.sort((a, b) => b.totalSeats - a.totalSeats || b.totalVotes - a.totalVotes);
    return {
      validVotes,
      seats: params.seats,
      electoralQuotient: qe,
      nominalMinPhase1Votes: min1,
      partyMinPhase2Votes: min80,
      candidateMinPhase2Votes: min20,
      lists: summaries,
      elected,
      audit,
    };
  }
}
