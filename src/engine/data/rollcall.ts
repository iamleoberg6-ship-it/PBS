// Posições dos partidos por tema a partir de VOTAÇÕES NOMINAIS da Câmara dos Deputados (Fase 10).
// Fonte: Câmara dos Deputados, Dados Abertos (API v2) — votos individuais de cada deputado (endpoint /votacoes/{id}/votos),
// agregados pelo partido do deputado na data da votação (siglas antigas mapeadas ao partido atual: DEM/PSL→União,
// PTB/Patriota→PRD, PROS→Solidariedade, PSC/PHS/PTN→Podemos, PRB→Republicanos, PR→PL, PPS→Cidadania, PMDB→MDB etc.).
// Método: por votação, (Sim − Não)/(Sim + Não) dentro do partido (obstrução conta como Não; abstenção não conta), com o sinal
// do eixo; média simples das votações do eixo, ×100 (−100 a +100). Partido com menos de 3 deputados votantes numa votação não
// pontua nela. Coleta: 10/11/2026. Gerado por script; não editar à mão.

import type { AxisId } from './ideology';

export interface RollCallVote { axis: AxisId; dir: 1 | -1; id: string; date: string; label: string; sim: number; nao: number }
export const ROLLCALL_VOTES: RollCallVote[] = [
  { axis: 'seguranca', dir: 1, id: '596844-116', date: '2022-08-03', label: "PL 583/2011 — fim da saída temporária de presos (substitutivo)", sim: 311, nao: 98 },
  { axis: 'seguranca', dir: 1, id: '2579832-62', date: '2025-11-18', label: "PL 5.582/2025 — \"PL Antifacção\" (substitutivo do relator)", sim: 370, nao: 110 },
  { axis: 'ambiente', dir: 1, id: '345311-270', date: '2023-05-30', label: "PL 490/2007 — marco temporal das terras indígenas", sim: 283, nao: 155 },
  { axis: 'ambiente', dir: 1, id: '257161-337', date: '2021-05-12', label: "PL 3.729/2004 — Lei Geral do Licenciamento Ambiental (substitutivo)", sim: 300, nao: 122 },
  { axis: 'ambiente', dir: 1, id: '257161-454', date: '2025-07-16', label: "PL 2.159/2021 — licenciamento ambiental (emendas do Senado)", sim: 267, nao: 116 },
  { axis: 'economia', dir: -1, id: '2383287-43', date: '2023-10-25', label: "PL 4.173/2023 — tributação de fundos exclusivos e offshores", sim: 323, nao: 119 },
  { axis: 'economia', dir: 1, id: '2270894-103', date: '2021-08-05', label: "PL 591/2021 — privatização dos Correios", sim: 285, nao: 173 },
  { axis: 'desenvolvimento', dir: 1, id: '2270894-103', date: '2021-08-05', label: "PL 591/2021 — privatização dos Correios", sim: 285, nao: 173 },
  { axis: 'fiscal', dir: -1, id: '2194899-103', date: '2022-12-20', label: "PEC 32/2022 — PEC da Transição (1º turno)", sim: 331, nao: 168 },
  { axis: 'fiscal', dir: 1, id: '2088351-235', date: '2016-10-10', label: "PEC 241/2016 — teto de gastos (1º turno)", sim: 366, nao: 111 },
  { axis: 'social', dir: 1, id: '534328-167', date: '2022-05-18', label: "PL 3.179/2012 — educação domiciliar (homeschooling)", sim: 264, nao: 144 },
  { axis: 'social', dir: 1, id: '2482078-57', date: '2025-11-05', label: "PDL 3/2025 — susta resolução do Conanda sobre atendimento ao aborto legal de crianças e adolescentes", sim: 317, nao: 111 },
  { axis: 'trabalho', dir: 1, id: '2122076-348', date: '2017-04-26', label: "PL 6.787/2016 — reforma trabalhista", sim: 296, nao: 177 },
  { axis: 'trabalho', dir: 1, id: '20794-133', date: '2017-03-22', label: "PL 4.302/1998 — terceirização irrestrita", sim: 232, nao: 188 },
];

/** Posição por eixo (−100 a +100) e número de votações usadas. */
export const ROLLCALL_POSITIONS: Record<string, Partial<Record<AxisId, { v: number; n: number }>>> = {
  party_real_avante: { seguranca: { v: 47, n: 2 }, ambiente: { v: 30, n: 3 }, economia: { v: -43, n: 2 }, desenvolvimento: { v: 14, n: 1 }, fiscal: { v: -33, n: 2 }, social: { v: 38, n: 2 }, trabalho: { v: -25, n: 2 } },
  party_real_cidadania: { seguranca: { v: 100, n: 2 }, ambiente: { v: 46, n: 3 }, economia: { v: 19, n: 2 }, desenvolvimento: { v: 71, n: 1 }, fiscal: { v: -26, n: 2 }, social: { v: 50, n: 1 }, trabalho: { v: 4, n: 2 } },
  party_real_mdb: { seguranca: { v: 97, n: 2 }, ambiente: { v: 72, n: 3 }, economia: { v: -6, n: 2 }, desenvolvimento: { v: 57, n: 1 }, fiscal: { v: 22, n: 2 }, social: { v: 58, n: 2 }, trabalho: { v: 65, n: 2 } },
  party_real_novo: { seguranca: { v: 100, n: 2 }, ambiente: { v: 100, n: 3 }, economia: { v: 100, n: 2 }, desenvolvimento: { v: 100, n: 1 }, fiscal: { v: 100, n: 1 }, social: { v: 100, n: 2 } },
  party_real_pcdob: { seguranca: { v: -72, n: 2 }, ambiente: { v: -100, n: 3 }, economia: { v: -100, n: 2 }, desenvolvimento: { v: -100, n: 1 }, fiscal: { v: -100, n: 2 }, social: { v: -100, n: 2 }, trabalho: { v: -100, n: 2 } },
  party_real_pdt: { seguranca: { v: 0, n: 2 }, ambiente: { v: -53, n: 3 }, economia: { v: -79, n: 2 }, desenvolvimento: { v: -58, n: 1 }, fiscal: { v: -65, n: 2 }, social: { v: -43, n: 2 }, trabalho: { v: -88, n: 2 } },
  party_real_pl: { seguranca: { v: 96, n: 2 }, ambiente: { v: 96, n: 3 }, economia: { v: 66, n: 2 }, desenvolvimento: { v: 61, n: 1 }, fiscal: { v: 81, n: 2 }, social: { v: 96, n: 2 }, trabalho: { v: 47, n: 2 } },
  party_real_pode: { seguranca: { v: 92, n: 2 }, ambiente: { v: 50, n: 3 }, economia: { v: -21, n: 2 }, desenvolvimento: { v: 30, n: 1 }, fiscal: { v: 22, n: 2 }, social: { v: 88, n: 2 }, trabalho: { v: 29, n: 2 } },
  party_real_pp: { seguranca: { v: 98, n: 2 }, ambiente: { v: 88, n: 3 }, economia: { v: 22, n: 2 }, desenvolvimento: { v: 94, n: 1 }, fiscal: { v: 24, n: 2 }, social: { v: 83, n: 2 }, trabalho: { v: 62, n: 2 } },
  party_real_prd: { seguranca: { v: 100, n: 2 }, ambiente: { v: 32, n: 3 }, economia: { v: 11, n: 2 }, desenvolvimento: { v: 71, n: 1 }, fiscal: { v: 64, n: 2 }, social: { v: 100, n: 2 }, trabalho: { v: 50, n: 2 } },
  party_real_psb: { seguranca: { v: -35, n: 2 }, ambiente: { v: -47, n: 3 }, economia: { v: -90, n: 2 }, desenvolvimento: { v: -80, n: 1 }, fiscal: { v: -31, n: 2 }, social: { v: -69, n: 2 }, trabalho: { v: 4, n: 2 } },
  party_real_psd: { seguranca: { v: 100, n: 2 }, ambiente: { v: 68, n: 3 }, economia: { v: -33, n: 2 }, desenvolvimento: { v: 23, n: 1 }, fiscal: { v: 12, n: 2 }, social: { v: 78, n: 2 }, trabalho: { v: 65, n: 2 } },
  party_real_psdb: { seguranca: { v: 74, n: 2 }, ambiente: { v: 83, n: 3 }, economia: { v: 4, n: 2 }, desenvolvimento: { v: 57, n: 1 }, fiscal: { v: 22, n: 2 }, social: { v: 58, n: 2 }, trabalho: { v: 73, n: 2 } },
  party_real_psol: { seguranca: { v: -100, n: 2 }, ambiente: { v: -100, n: 3 }, economia: { v: -100, n: 2 }, desenvolvimento: { v: -100, n: 1 }, fiscal: { v: -100, n: 2 }, social: { v: -100, n: 2 }, trabalho: { v: -100, n: 2 } },
  party_real_pt: { seguranca: { v: -98, n: 2 }, ambiente: { v: -99, n: 3 }, economia: { v: -100, n: 2 }, desenvolvimento: { v: -100, n: 1 }, fiscal: { v: -100, n: 2 }, social: { v: -95, n: 2 }, trabalho: { v: -100, n: 2 } },
  party_real_pv: { seguranca: { v: -25, n: 2 }, ambiente: { v: -89, n: 3 }, economia: { v: -50, n: 2 }, desenvolvimento: { v: 0, n: 1 }, fiscal: { v: 0, n: 2 }, social: { v: -75, n: 2 }, trabalho: { v: 0, n: 2 } },
  party_real_rede: { fiscal: { v: -100, n: 1 }, trabalho: { v: -100, n: 2 } },
  party_real_republicanos: { seguranca: { v: 95, n: 2 }, ambiente: { v: 93, n: 3 }, economia: { v: 11, n: 2 }, desenvolvimento: { v: 100, n: 1 }, fiscal: { v: 95, n: 2 }, social: { v: 97, n: 2 }, trabalho: { v: 59, n: 2 } },
  party_real_solidariedade: { seguranca: { v: 80, n: 2 }, ambiente: { v: 21, n: 2 }, economia: { v: -16, n: 2 }, desenvolvimento: { v: 68, n: 1 }, fiscal: { v: -12, n: 2 }, social: { v: 54, n: 2 }, trabalho: { v: -14, n: 2 } },
  party_real_uniao: { seguranca: { v: 98, n: 2 }, ambiente: { v: 90, n: 3 }, economia: { v: 20, n: 2 }, desenvolvimento: { v: 77, n: 1 }, fiscal: { v: 20, n: 2 }, social: { v: 72, n: 2 }, trabalho: { v: 63, n: 2 } },
};
