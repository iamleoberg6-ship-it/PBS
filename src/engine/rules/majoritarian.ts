// Sistema majoritário municipal (prefeito). CF art. 29, II e art. 77 (aplicado por remissão).
// Maioria absoluta dos votos válidos (sem brancos e nulos) no 1º turno; senão, 2º turno entre os
// dois mais votados — apenas em municípios com mais de 200 mil eleitores. Abaixo disso, maioria simples.

export interface MajCandidate {
  id: string;
  name: string;
  label: string;
  votes: number;
  birthDate: string;
}

export interface MajRoundResult {
  validVotes: number;
  ranking: (MajCandidate & { share: number })[];
  winnerId: string | null;
  needsRunoff: boolean;
  runoffIds: [string, string] | null;
  explanation: string;
}

function rank(cands: MajCandidate[]) {
  const valid = cands.reduce((s, c) => s + c.votes, 0);
  const ranking = [...cands]
    .sort((a, b) => b.votes - a.votes || a.birthDate.localeCompare(b.birthDate))
    .map((c) => ({ ...c, share: valid > 0 ? c.votes / valid : 0 }));
  return { valid, ranking };
}

export function firstRound(cands: MajCandidate[], electorate: number, runoffThreshold: number): MajRoundResult {
  const { valid, ranking } = rank(cands);
  const top = ranking[0];
  const hasRunoff = electorate > runoffThreshold;
  if (!hasRunoff) {
    return {
      validVotes: valid, ranking, winnerId: top?.id ?? null, needsRunoff: false, runoffIds: null,
      explanation: `Município com até ${runoffThreshold.toLocaleString('pt-BR')} eleitores: vence o mais votado (maioria simples).`,
    };
  }
  if (top && top.votes > valid / 2) {
    return {
      validVotes: valid, ranking, winnerId: top.id, needsRunoff: false, runoffIds: null,
      explanation: `${top.name} obteve maioria absoluta dos votos válidos (${(top.share * 100).toFixed(2)}%) e está eleito no 1º turno.`,
    };
  }
  return {
    validVotes: valid, ranking, winnerId: null, needsRunoff: true,
    runoffIds: [ranking[0].id, ranking[1].id],
    explanation: `Ninguém passou de 50% dos votos válidos: ${ranking[0].name} e ${ranking[1].name} vão ao 2º turno.`,
  };
}

export function runoff(cands: [MajCandidate, MajCandidate]): MajRoundResult {
  const { valid, ranking } = rank(cands);
  // Empate: o mais idoso (CF art. 77 §5º, por analogia).
  return {
    validVotes: valid, ranking, winnerId: ranking[0].id, needsRunoff: false, runoffIds: null,
    explanation: `${ranking[0].name} vence o 2º turno com ${(ranking[0].share * 100).toFixed(2)}% dos votos válidos.`,
  };
}
