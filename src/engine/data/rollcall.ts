// Posições dos partidos por tema a partir de VOTAÇÕES NOMINAIS da Câmara dos Deputados e do Senado Federal (Fases 10 e 11).
// Fontes: Câmara dos Deputados, Dados Abertos (API v2, /votacoes/{id}/votos) e Senado Federal, Dados Abertos
// (/plenario/lista/votacao) — voto individual de cada parlamentar, agregado pelo partido dele na data da votação
// (siglas antigas mapeadas ao partido atual: DEM/PSL→União, PTB/Patriota→PRD, PROS→Solidariedade, PSC/PHS/PTN→Podemos,
// PRB→Republicanos, PR→PL, PPS→Cidadania, PMDB→MDB, PMB→Democrata etc.).
// Método: por votação, (Sim − Não)/(Sim + Não) dentro do partido (obstrução conta como Não; abstenção não conta), com o sinal
// do eixo; média simples de todas as votações do eixo nas duas casas, ×100 (−100 a +100). Mínimo de votantes do partido
// numa votação: 3 deputados na Câmara, 2 senadores no Senado. Coleta: 10/11/2026. Gerado por script; não editar à mão.

import type { AxisId } from './ideology';

export type House = 'CD' | 'SF';
export interface RollCallVote { axis: AxisId; dir: 1 | -1; id: string; date: string; label: string; sim: number; nao: number; house: House }
export const ROLLCALL_VOTES: RollCallVote[] = [
  { axis: 'seguranca', dir: 1, id: '596844-116', date: '2022-08-03', label: "PL 583/2011 — fim da saída temporária de presos (substitutivo)", sim: 311, nao: 98, house: 'CD' },
  { axis: 'seguranca', dir: 1, id: '2579832-62', date: '2025-11-18', label: "PL 5.582/2025 — \"PL Antifacção\" (substitutivo do relator)", sim: 370, nao: 110, house: 'CD' },
  { axis: 'ambiente', dir: 1, id: '345311-270', date: '2023-05-30', label: "PL 490/2007 — marco temporal das terras indígenas", sim: 283, nao: 155, house: 'CD' },
  { axis: 'ambiente', dir: 1, id: '257161-337', date: '2021-05-12', label: "PL 3.729/2004 — Lei Geral do Licenciamento Ambiental (substitutivo)", sim: 300, nao: 122, house: 'CD' },
  { axis: 'ambiente', dir: 1, id: '257161-454', date: '2025-07-16', label: "PL 2.159/2021 — licenciamento ambiental (emendas do Senado)", sim: 267, nao: 116, house: 'CD' },
  { axis: 'economia', dir: -1, id: '2383287-43', date: '2023-10-25', label: "PL 4.173/2023 — tributação de fundos exclusivos e offshores", sim: 323, nao: 119, house: 'CD' },
  { axis: 'economia', dir: 1, id: '2270894-103', date: '2021-08-05', label: "PL 591/2021 — privatização dos Correios", sim: 285, nao: 173, house: 'CD' },
  { axis: 'desenvolvimento', dir: 1, id: '2270894-103', date: '2021-08-05', label: "PL 591/2021 — privatização dos Correios", sim: 285, nao: 173, house: 'CD' },
  { axis: 'fiscal', dir: -1, id: '2194899-103', date: '2022-12-20', label: "PEC 32/2022 — PEC da Transição (1º turno)", sim: 331, nao: 168, house: 'CD' },
  { axis: 'fiscal', dir: 1, id: '2088351-235', date: '2016-10-10', label: "PEC 241/2016 — teto de gastos (1º turno)", sim: 366, nao: 111, house: 'CD' },
  { axis: 'social', dir: 1, id: '534328-167', date: '2022-05-18', label: "PL 3.179/2012 — educação domiciliar (homeschooling)", sim: 264, nao: 144, house: 'CD' },
  { axis: 'social', dir: 1, id: '2482078-57', date: '2025-11-05', label: "PDL 3/2025 — susta resolução do Conanda sobre atendimento ao aborto legal de crianças e adolescentes", sim: 317, nao: 111, house: 'CD' },
  { axis: 'trabalho', dir: 1, id: '2122076-348', date: '2017-04-26', label: "PL 6.787/2016 — reforma trabalhista", sim: 296, nao: 177, house: 'CD' },
  { axis: 'trabalho', dir: 1, id: '20794-133', date: '2017-03-22', label: "PL 4.302/1998 — terceirização irrestrita", sim: 232, nao: 188, house: 'CD' },
  { axis: 'estado', dir: 1, id: '2196833-373', date: '2023-07-06', label: "PEC 45/2019 — reforma tributária (IBS/CBS, 2º turno)", sim: 375, nao: 113, house: 'CD' },
  { axis: 'estado', dir: 1, id: '2237876-99', date: '2021-10-13', label: "PLP 11/2020 — lei federal fixa regra do ICMS dos combustíveis", sim: 392, nao: 71, house: 'CD' },
  { axis: 'seguranca', dir: 1, id: 'SF-6818', date: '2024-02-20', label: "PL 2.253/2022 — fim da saída temporária de presos", sim: 61, nao: 2, house: 'SF' },
  { axis: 'ambiente', dir: 1, id: 'SF-6756', date: '2023-09-27', label: "PL 2.903/2023 — marco temporal das terras indígenas", sim: 43, nao: 21, house: 'SF' },
  { axis: 'ambiente', dir: 1, id: 'SF-6935', date: '2025-05-21', label: "PL 2.159/2021 — Lei Geral do Licenciamento Ambiental", sim: 54, nao: 13, house: 'SF' },
  { axis: 'fiscal', dir: -1, id: 'SF-6671', date: '2022-12-20', label: "PEC 32/2022 — PEC da Transição (1º turno)", sim: 63, nao: 10, house: 'SF' },
  { axis: 'trabalho', dir: 1, id: 'SF-5726', date: '2017-07-11', label: "PLC 38/2017 — reforma trabalhista", sim: 50, nao: 25, house: 'SF' },
  { axis: 'estado', dir: 1, id: 'SF-6777', date: '2023-11-08', label: "PEC 45/2019 — reforma tributária (IBS/CBS, 2º turno)", sim: 53, nao: 24, house: 'SF' },
  { axis: 'estado', dir: 1, id: 'SF-6612', date: '2022-06-13', label: "PLP 18/2022 — teto do ICMS sobre combustíveis, energia e telecom", sim: 65, nao: 12, house: 'SF' },
  { axis: 'direitos', dir: 1, id: 'SF-6824', date: '2024-04-16', label: "PEC 45/2023 — criminaliza porte de qualquer quantidade de droga (1º turno)", sim: 53, nao: 9, house: 'SF' },
];

/** Posição por eixo (−100 a +100) e número de votações usadas (Câmara + Senado). */
export const ROLLCALL_POSITIONS: Record<string, Partial<Record<AxisId, { v: number; n: number }>>> = {
  party_real_avante: { seguranca: { v: 47, n: 2 }, ambiente: { v: 30, n: 3 }, economia: { v: -43, n: 2 }, desenvolvimento: { v: 14, n: 1 }, fiscal: { v: -33, n: 2 }, social: { v: 38, n: 2 }, trabalho: { v: -25, n: 2 }, estado: { v: 86, n: 2 } },
  party_real_cidadania: { seguranca: { v: 100, n: 2 }, ambiente: { v: 46, n: 3 }, economia: { v: 19, n: 2 }, desenvolvimento: { v: 71, n: 1 }, fiscal: { v: -26, n: 2 }, social: { v: 50, n: 1 }, trabalho: { v: 4, n: 2 }, estado: { v: 86, n: 2 } },
  party_real_mdb: { seguranca: { v: 98, n: 3 }, ambiente: { v: 61, n: 5 }, economia: { v: -6, n: 2 }, desenvolvimento: { v: 57, n: 1 }, fiscal: { v: -19, n: 3 }, social: { v: 58, n: 2 }, trabalho: { v: 63, n: 3 }, estado: { v: 41, n: 4 }, direitos: { v: 25, n: 1 } },
  party_real_novo: { seguranca: { v: 100, n: 2 }, ambiente: { v: 100, n: 3 }, economia: { v: 100, n: 2 }, desenvolvimento: { v: 100, n: 1 }, fiscal: { v: 100, n: 1 }, social: { v: 100, n: 2 }, estado: { v: -67, n: 2 } },
  party_real_pcdob: { seguranca: { v: -72, n: 2 }, ambiente: { v: -100, n: 3 }, economia: { v: -100, n: 2 }, desenvolvimento: { v: -100, n: 1 }, fiscal: { v: -100, n: 2 }, social: { v: -100, n: 2 }, trabalho: { v: -100, n: 2 }, estado: { v: 100, n: 2 } },
  party_real_pdt: { seguranca: { v: 0, n: 2 }, ambiente: { v: -45, n: 5 }, economia: { v: -79, n: 2 }, desenvolvimento: { v: -58, n: 1 }, fiscal: { v: -76, n: 3 }, social: { v: -43, n: 2 }, trabalho: { v: -88, n: 2 }, estado: { v: 90, n: 4 } },
  party_real_pl: { seguranca: { v: 97, n: 3 }, ambiente: { v: 93, n: 5 }, economia: { v: 66, n: 2 }, desenvolvimento: { v: 61, n: 1 }, fiscal: { v: 58, n: 3 }, social: { v: 96, n: 2 }, trabalho: { v: 64, n: 3 }, estado: { v: 11, n: 4 }, direitos: { v: 100, n: 1 } },
  party_real_pode: { seguranca: { v: 95, n: 3 }, ambiente: { v: 70, n: 5 }, economia: { v: -21, n: 2 }, desenvolvimento: { v: 30, n: 1 }, fiscal: { v: 15, n: 3 }, social: { v: 88, n: 2 }, trabalho: { v: 8, n: 3 }, estado: { v: 64, n: 4 }, direitos: { v: 100, n: 1 } },
  party_real_pp: { seguranca: { v: 99, n: 3 }, ambiente: { v: 93, n: 5 }, economia: { v: 22, n: 2 }, desenvolvimento: { v: 94, n: 1 }, fiscal: { v: -6, n: 3 }, social: { v: 83, n: 2 }, trabalho: { v: 75, n: 3 }, estado: { v: 55, n: 4 }, direitos: { v: 100, n: 1 } },
  party_real_prd: { seguranca: { v: 100, n: 2 }, ambiente: { v: 32, n: 3 }, economia: { v: 11, n: 2 }, desenvolvimento: { v: 71, n: 1 }, fiscal: { v: 9, n: 3 }, social: { v: 100, n: 2 }, trabalho: { v: 33, n: 3 }, estado: { v: 73, n: 3 } },
  party_real_psb: { seguranca: { v: -6, n: 3 }, ambiente: { v: -21, n: 5 }, economia: { v: -90, n: 2 }, desenvolvimento: { v: -80, n: 1 }, fiscal: { v: -31, n: 2 }, social: { v: -69, n: 2 }, trabalho: { v: -4, n: 3 }, estado: { v: 94, n: 4 }, direitos: { v: 100, n: 1 } },
  party_real_psd: { seguranca: { v: 100, n: 3 }, ambiente: { v: 51, n: 5 }, economia: { v: -33, n: 2 }, desenvolvimento: { v: 23, n: 1 }, fiscal: { v: -25, n: 3 }, social: { v: 78, n: 2 }, trabalho: { v: 64, n: 3 }, estado: { v: 87, n: 4 }, direitos: { v: 100, n: 1 } },
  party_real_psdb: { seguranca: { v: 83, n: 3 }, ambiente: { v: 87, n: 4 }, economia: { v: 4, n: 2 }, desenvolvimento: { v: 57, n: 1 }, fiscal: { v: -19, n: 3 }, social: { v: 58, n: 2 }, trabalho: { v: 76, n: 3 }, estado: { v: 59, n: 4 } },
  party_real_psol: { seguranca: { v: -100, n: 2 }, ambiente: { v: -100, n: 3 }, economia: { v: -100, n: 2 }, desenvolvimento: { v: -100, n: 1 }, fiscal: { v: -100, n: 2 }, social: { v: -100, n: 2 }, trabalho: { v: -100, n: 2 }, estado: { v: 38, n: 2 } },
  party_real_pt: { seguranca: { v: -49, n: 3 }, ambiente: { v: -99, n: 5 }, economia: { v: -100, n: 2 }, desenvolvimento: { v: -100, n: 1 }, fiscal: { v: -100, n: 3 }, social: { v: -95, n: 2 }, trabalho: { v: -100, n: 3 }, estado: { v: 46, n: 4 }, direitos: { v: -100, n: 1 } },
  party_real_pv: { seguranca: { v: -25, n: 2 }, ambiente: { v: -89, n: 3 }, economia: { v: -50, n: 2 }, desenvolvimento: { v: 0, n: 1 }, fiscal: { v: 0, n: 2 }, social: { v: -75, n: 2 }, trabalho: { v: 0, n: 2 }, estado: { v: 75, n: 2 } },
  party_real_rede: { fiscal: { v: -100, n: 1 }, trabalho: { v: -100, n: 2 } },
  party_real_republicanos: { seguranca: { v: 97, n: 3 }, ambiente: { v: 96, n: 5 }, economia: { v: 11, n: 2 }, desenvolvimento: { v: 100, n: 1 }, fiscal: { v: 95, n: 2 }, social: { v: 97, n: 2 }, trabalho: { v: 59, n: 2 }, estado: { v: 30, n: 3 }, direitos: { v: 100, n: 1 } },
  party_real_solidariedade: { seguranca: { v: 80, n: 2 }, ambiente: { v: 21, n: 2 }, economia: { v: -16, n: 2 }, desenvolvimento: { v: 68, n: 1 }, fiscal: { v: -12, n: 2 }, social: { v: 54, n: 2 }, trabalho: { v: -14, n: 2 }, estado: { v: 64, n: 3 } },
  party_real_uniao: { seguranca: { v: 99, n: 3 }, ambiente: { v: 94, n: 5 }, economia: { v: 20, n: 2 }, desenvolvimento: { v: 77, n: 1 }, fiscal: { v: -20, n: 3 }, social: { v: 72, n: 2 }, trabalho: { v: 76, n: 3 }, estado: { v: 78, n: 4 }, direitos: { v: 100, n: 1 } },
};
