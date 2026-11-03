// Finanças da cidade de São Paulo — dados reais de base, com fonte (retrato de 30/10/2026).
// Valores em R$ milhões correntes.
//
// [REAL] Execução de 2025: Secretaria Municipal da Fazenda, "Gestão Fiscal — 3º quadrimestre de 2025" e
//        RGF Anexo 6 consolidado (3º quadrimestre de 2025).
// [REAL] LOA 2026 aprovada: R$ 137,4 bi; investimentos R$ 19 bi; operações de crédito ≈ R$ 8,2 bi (Prefeitura, 18/12/2025).
// [REAL] PLOA 2026 por área: Saúde R$ 24,6 bi; Educação R$ 26,5 bi; Assistência Social R$ 2,7 bi (Prefeitura, 30/09/2025).
// [REAL] LDO 2027: receita total prevista R$ 138,6 bi (sancionada em julho de 2026).
// [ESTIMATIVA DO JOGO] Demais áreas, divisão de pessoal por área e projeções a partir de 2027.

export const FISCAL_SOURCES = [
  'Prefeitura de SP / Secretaria da Fazenda — Gestão Fiscal, 3º quadrimestre de 2025 (execução jan–dez 2025)',
  'Prefeitura de SP — RGF, Anexo 6, consolidado, 3º quadrimestre de 2025 (RCL, pessoal, dívida)',
  'Prefeitura de SP — Câmara aprova Orçamento 2026 de R$ 137,4 bilhões (18/12/2025)',
  'Prefeitura de SP — PLOA 2026: R$ 135,45 bilhões (30/09/2025): Saúde, Educação, Assistência',
  'Prefeitura de SP — LDO 2027 sancionada com receita prevista de R$ 138,6 bilhões (2026)',
];

/** Execução de 2025 (jan–dez). */
export const EXEC_2025 = {
  revenue: { iptu: 16097, iss: 37521, itbi: 4537, transf: 25500, outrasCorrentes: 104715 - 16097 - 37521 - 4537 - 25500, capital: 123452 - 104715 },
  correntes: 104715,
  total: 123452,
  pessoal: 40744, // ativos 26.705 + inativos 14.039
  custeio: 67438,
  juros: 693,
  investimentos: 11000, // a fonte traz 10.979 e 11.126 em tabelas diferentes
  amortizacao: 1619,
  despesaTotal: 123572,
  rcl: 100653,
  dtp: 28135, // despesa total com pessoal para a LRF (28,10% da RCL ajustada)
  dcl: 19753, // dívida consolidada líquida (19,64% da RCL)
  operacoesCredito: 2835,
};

export const LOA_2026_TOTAL = 137400;
export const LDO_2027_TOTAL = 138600;

/** Relação RCL / receitas correntes em 2025 (DERIVADA): 100.653 / 104.715. */
export const RCL_RATIO = EXEC_2025.rcl / EXEC_2025.correntes;
/** Fração da despesa de pessoal (ativos + inativos) que entra no cálculo da LRF em 2025 (DERIVADA). */
export const DTP_RATIO = EXEC_2025.dtp / EXEC_2025.pessoal;

export type AreaKey = 'saude' | 'educacao' | 'mobilidade' | 'habitacao' | 'assistencia' | 'cultura' | 'esportes' | 'meioambiente' | 'subprefeituras' | 'seguranca';
export const AREA_KEYS: AreaKey[] = ['saude', 'educacao', 'mobilidade', 'habitacao', 'assistencia', 'cultura', 'esportes', 'meioambiente', 'subprefeituras', 'seguranca'];

/**
 * Orçamento total de cada área em 2027 (pessoal incluído), R$ milhões, e fração do pessoal municipal lotada nela.
 * real = valor ancorado em fonte (PLOA 2026 corrigido pela variação LDO 2027 / LOA 2026); demais são estimativas do jogo.
 */
export const AREA_BASE_2027: Record<AreaKey, { total: number; staffShare: number; real: boolean; note: string }> = {
  saude: { total: 24800, staffShare: 0.22, real: true, note: 'PLOA 2026: R$ 24,6 bi' },
  educacao: { total: 26700, staffShare: 0.33, real: true, note: 'PLOA 2026: R$ 26,5 bi' },
  assistencia: { total: 2700, staffShare: 0.01, real: true, note: 'PLOA 2026: R$ 2,7 bi' },
  mobilidade: { total: 9500, staffShare: 0.01, real: false, note: 'estimativa do jogo (inclui subsídio ao ônibus)' },
  subprefeituras: { total: 6000, staffShare: 0.05, real: false, note: 'estimativa do jogo' },
  habitacao: { total: 2000, staffShare: 0.005, real: false, note: 'estimativa do jogo' },
  seguranca: { total: 1900, staffShare: 0.025, real: false, note: 'Câmara citou "quase R$ 2 bilhões" para segurança na LOA 2026' },
  cultura: { total: 1200, staffShare: 0.01, real: false, note: 'estimativa do jogo' },
  meioambiente: { total: 900, staffShare: 0.005, real: false, note: 'estimativa do jogo' },
  esportes: { total: 500, staffShare: 0.005, real: false, note: 'estimativa do jogo' },
};

/** Parâmetros macro do jogo (não são previsões). */
export const MACRO = {
  inflation: 0.04, // PARÂMETRO: inflação anual de referência
  realGrowth: 0.015, // PARÂMETRO: crescimento real da atividade
  interestRate: 0.08, // PARÂMETRO: custo médio da dívida ao ano
  amortizationYears: 15, // PARÂMETRO
};
