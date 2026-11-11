// Ideologia dos partidos reais — metodologia (documentada e igual para todos):
// 1) Escala geral esquerda–direita (0 = extrema esquerda, 10 = extrema direita): média de especialistas em 2022,
//    Bolognesi, Ribeiro, Codato & Silva, "O desaparecimento do centro ideológico no sistema partidário brasileiro",
//    Opinião Pública (2025), survey com cientistas políticos (≈ 480 respondentes, lista da ABCP).
// 2) Partidos renomeados herdam o valor da sigla anterior; fusões usam a média simples das siglas fundidas;
//    partidos criados depois de 2022 ficam "não classificados".
// 3) As 10 dimensões do documento mestre ainda NÃO têm fonte própria. Nesta versão, 7 dimensões
//    tradicionalmente associadas ao eixo esquerda–direita são DERIVADAS da escala geral (provisório);
//    3 dimensões que não se alinham a esse eixo ficam sem valor. Calibração futura: votações nominais por tema.

import { ROLLCALL_POSITIONS } from './rollcall';

export const IDEOLOGY_SOURCE = 'Bolognesi, Ribeiro, Codato e Silva — Opinião Pública (2025), survey de especialistas, posições de 2022';

export type AxisId =
  | 'economia' | 'fiscal' | 'social' | 'seguranca' | 'ambiente'
  | 'estado' | 'internacional' | 'direitos' | 'trabalho' | 'desenvolvimento';

export const AXES: { id: AxisId; label: string; minus: string; plus: string; derivable: boolean }[] = [
  { id: 'economia', label: 'Economia', minus: 'Mais intervenção estatal', plus: 'Mais liberdade de mercado', derivable: true },
  { id: 'fiscal', label: 'Política fiscal', minus: 'Expansão de gastos', plus: 'Disciplina fiscal', derivable: true },
  { id: 'social', label: 'Questões sociais', minus: 'Progressismo', plus: 'Conservadorismo', derivable: true },
  { id: 'seguranca', label: 'Segurança pública', minus: 'Prevenção social', plus: 'Respostas punitivas', derivable: true },
  { id: 'ambiente', label: 'Meio ambiente', minus: 'Preservação', plus: 'Exploração econômica', derivable: true },
  { id: 'estado', label: 'Organização do Estado', minus: 'Descentralização', plus: 'Centralização', derivable: false },
  { id: 'internacional', label: 'Relações internacionais', minus: 'Multilateralismo', plus: 'Nacionalismo', derivable: false },
  { id: 'direitos', label: 'Direitos individuais', minus: 'Proteção liberal de direitos civis', plus: 'Restrição em nome de valores coletivos', derivable: false },
  { id: 'trabalho', label: 'Relações trabalhistas', minus: 'Proteção trabalhista', plus: 'Flexibilização', derivable: true },
  { id: 'desenvolvimento', label: 'Desenvolvimento', minus: 'Indução estatal', plus: 'Orientação pelo mercado', derivable: true },
];

export interface ExpertPosition {
  value: number | null;
  basis: string;
}

const src = (value: number, basis = 'Valor da fonte (2022)'): ExpertPosition => ({ value, basis });

export const EXPERT_SCALE: Record<string, ExpertPosition> = {
  party_real_pstu: src(0.51),
  party_real_pco: src(0.55),
  party_real_pcb: src(0.69),
  party_real_psol: src(1.41),
  party_real_up: src(1.63),
  party_real_pcdob: src(1.78),
  party_real_pt: src(2.68),
  party_real_psb: src(3.59),
  party_real_rede: src(3.69),
  party_real_pdt: src(3.86),
  party_real_pv: src(4.12),
  party_real_solidariedade: src(6.01),
  party_real_cidadania: src(6.17),
  party_real_avante: src(6.47),
  party_real_mdb: src(6.5),
  party_real_mobiliza: src(6.74, 'Valor do PMN (2022), sigla anterior da Mobilização Nacional'),
  party_real_psdb: src(6.76),
  party_real_psd: src(6.94),
  party_real_democrata: src(7.29, 'Valor do PMB (2022), sigla anterior do Democrata'),
  party_real_pode: src(7.44),
  party_real_prtb: src(7.49),
  party_real_agir: src(7.55),
  party_real_prd: src(8.16, 'Média de PTB (7,72) e Patriota (8,60), que se fundiram no PRD'),
  party_real_pp: src(8.15),
  party_real_dc: src(8.21),
  party_real_republicanos: src(8.33),
  party_real_uniao: src(8.49),
  party_real_novo: src(8.67),
  party_real_pl: src(8.8),
  party_real_missao: { value: null, basis: 'Partido registrado em 2025: não estava na pesquisa de 2022 (não classificado)' },
};

/** Categorias da fonte: 0–1,5 extrema esquerda; 1,51–3 esquerda; 3,01–4,49 centro-esquerda; 4,5–5,5 centro; simétrico à direita. */
export function categoryLabel(v: number | null): string {
  if (v === null) return 'Não classificado';
  if (v <= 1.5) return 'Extrema esquerda';
  if (v <= 3) return 'Esquerda';
  if (v < 4.5) return 'Centro-esquerda';
  if (v <= 5.5) return 'Centro';
  if (v < 7) return 'Centro-direita';
  if (v <= 8.5) return 'Direita';
  return 'Extrema direita';
}

export type IdeologyVector = Record<AxisId, number | null>;

/** Converte a escala geral (0–10) em vetor −100..+100 nas dimensões deriváveis. */
/** Valor derivado da escala geral de especialistas (provisório, antes da calibração por votações). */
export function expertDerived(partyId: string, axis: AxisId): number | null {
  const v = EXPERT_SCALE[partyId]?.value ?? null;
  const a = AXES.find((x) => x.id === axis)!;
  return v === null || !a.derivable ? null : Math.round((v - 5) * 20);
}

/**
 * Vetor ideológico do partido (Fase 10): combina votações nominais da Câmara (data/rollcall.ts) com a escala de especialistas.
 * Regra (PARÂMETRO do método, documentado): com 2 ou mais votações no eixo, 75% votações + 25% escala; com 1 votação, 50% + 50%;
 * sem votação (partido pequeno, novo ou sem deputados), só a escala. Sem escala, só as votações.
 */
export function partyIdeology(partyId: string): IdeologyVector {
  const out = {} as IdeologyVector;
  for (const a of AXES) out[a.id] = axisPosition(partyId, a.id).value;
  return out;
}
export function axisPosition(partyId: string, axis: AxisId): { value: number | null; basis: 'votacoes' | 'votacoes+escala' | 'escala' | 'sem dado'; votes: number } {
  const ex = expertDerived(partyId, axis);
  const rc = ROLLCALL_POSITIONS[partyId]?.[axis];
  if (rc && ex !== null) {
    const w = rc.n >= 2 ? 0.75 : 0.5;
    return { value: Math.round(rc.v * w + ex * (1 - w)), basis: 'votacoes+escala', votes: rc.n };
  }
  if (rc) return { value: rc.v, basis: 'votacoes', votes: rc.n };
  if (ex !== null) return { value: ex, basis: 'escala', votes: 0 };
  return { value: null, basis: 'sem dado', votes: 0 };
}

export function neutralIdeology(): Record<AxisId, number> {
  const out = {} as Record<AxisId, number>;
  for (const a of AXES) out[a.id] = 0;
  return out;
}

/** Distância 0..1 entre dois vetores, só nas dimensões em que ambos têm valor. null se não houver base. */
export function ideologicalDistance(a: Partial<IdeologyVector>, b: Partial<IdeologyVector>): number | null {
  let sum = 0;
  let n = 0;
  for (const ax of AXES) {
    const x = a[ax.id];
    const y = b[ax.id];
    if (x === null || x === undefined || y === null || y === undefined) continue;
    sum += Math.abs(x - y);
    n++;
  }
  return n === 0 ? null : sum / n / 200;
}

/** Posição geral (0–10) de um vetor −100..+100: média das dimensões deriváveis. */
export function generalPosition(v: Partial<IdeologyVector>): number | null {
  const vals = AXES.filter((a) => a.derivable).map((a) => v[a.id]).filter((x): x is number => typeof x === 'number');
  if (!vals.length) return null;
  return Math.round((vals.reduce((s, x) => s + x, 0) / vals.length / 20 + 5) * 100) / 100;
}
