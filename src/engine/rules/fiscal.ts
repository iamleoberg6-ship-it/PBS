// Regras fiscais reais aplicáveis ao Município de São Paulo, como funções puras.
// Cada regra traz a fonte; o que é parâmetro de jogo está dito.

export interface FiscalRule { id: string; text: string; source: string; tag: 'REAL' | 'DERIVADA' | 'SIMPLIFICAÇÃO' | 'PARÂMETRO' }

export const FISCAL_RULES: FiscalRule[] = [
  { id: 'pessoal', tag: 'REAL', text: 'Despesa total com pessoal do Município limitada a 60% da Receita Corrente Líquida (54% Executivo, 6% Legislativo); alerta a 90% do limite (54%) e limite prudencial a 95% (57%).', source: 'LC 101/2000 (LRF), arts. 19, 20, 22 e 59 §1º' },
  { id: 'prudencial', tag: 'REAL', text: 'Acima do limite prudencial ficam vedados reajustes (salvo revisão geral), criação de cargos e novas admissões.', source: 'LRF, art. 22, parágrafo único' },
  { id: 'excesso', tag: 'REAL', text: 'Acima do limite, o excesso deve ser eliminado em dois quadrimestres; enquanto não, o ente não recebe transferências voluntárias nem contrata operações de crédito.', source: 'LRF, art. 23' },
  { id: 'art21', tag: 'REAL', text: 'É nulo ato que aumente a despesa com pessoal nos 180 dias anteriores ao fim do mandato.', source: 'LRF, art. 21' },
  { id: 'art42', tag: 'REAL', text: 'Nos dois últimos quadrimestres do mandato, é vedado contrair obrigação que não possa ser paga dentro dele sem disponibilidade de caixa.', source: 'LRF, art. 42' },
  { id: 'contingenciamento', tag: 'REAL', text: 'Se a receita não comportar as metas fiscais, o Executivo limita empenho e movimentação financeira (contingenciamento).', source: 'LRF, art. 9º' },
  { id: 'educacao', tag: 'REAL', text: 'São Paulo deve aplicar no mínimo 31% da receita de impostos, incluídas as transferências, na manutenção e desenvolvimento do ensino (a Constituição exige 25%).', source: 'Lei Orgânica do Município, art. 208; CF, art. 212' },
  { id: 'saude', tag: 'REAL', text: 'Municípios aplicam no mínimo 15% da receita de impostos e transferências em ações e serviços públicos de saúde.', source: 'LC 141/2012, art. 7º' },
  { id: 'divida', tag: 'REAL', text: 'Dívida consolidada líquida do Município limitada a 1,2 vez a RCL; operações de crédito no ano limitadas a 16% da RCL.', source: 'Resoluções do Senado 40/2001 (art. 3º, II) e 43/2001 (art. 7º, I)' },
  { id: 'camara', tag: 'REAL', text: 'Despesa total da Câmara limitada a 3,5% da receita tributária e de transferências do ano anterior (cidades com mais de 8 milhões de habitantes); folha da Câmara até 70% de sua receita.', source: 'CF, art. 29-A, VI e §1º' },
  { id: 'calendario', tag: 'REAL', text: 'Prefeitura envia a LDO até 15 de abril e a LOA até 30 de setembro; a Câmara delibera a LOA até 31 de dezembro.', source: 'Lei Orgânica do Município, arts. 138 e 140' },
  { id: 'ppa', tag: 'DERIVADA', text: 'O Plano Plurianual cobre do 2º ano do mandato ao 1º do seguinte e é enviado no 1º ano (em 2025, o PPA 2026–2029 foi votado junto com a LOA 2026).', source: 'CF, art. 165 §1º; prática da CMSP em 2025' },
  { id: 'metas', tag: 'REAL', text: 'O prefeito eleito ou reeleito apresenta o Programa de Metas em até 90 dias após a posse, com prioridades, indicadores e metas quantitativas.', source: 'Lei Orgânica do Município, art. 69-A (Emenda 30/2008)' },
  { id: 'anterioridade', tag: 'REAL', text: 'Aumento de tributo só vale no ano seguinte à lei e 90 dias depois de publicada (a noventena não se aplica à base de cálculo do IPTU).', source: 'CF, art. 150, III, "b" e "c", e §1º' },
  { id: 'iss', tag: 'REAL', text: 'Alíquota do ISS entre 2% e 5%.', source: 'LC 116/2003, arts. 8º e 8º-A' },
  { id: 'tcm', tag: 'REAL', text: 'As contas do prefeito recebem parecer prévio do Tribunal de Contas do Município; a Câmara só derruba o parecer com 2/3 dos votos.', source: 'CF, art. 31 §§1º e 2º' },
  { id: 'loa_falta', tag: 'SIMPLIFICAÇÃO', text: 'Sem LOA votada até 31/12, o jogo executa o orçamento anterior corrigido pela inflação (a Câmara descreve essa regra para o art. 140 da LOM; conferir redação).', source: 'Lei Orgânica do Município, art. 140' },
];

export const PERSONNEL_MAX = 0.6;
export const PERSONNEL_PRUDENTIAL = 0.57;
export const PERSONNEL_ALERT = 0.54;
export const MIN_EDUCATION = 0.31;
export const MIN_HEALTH = 0.15;
export const DEBT_LIMIT = 1.2;
export const CREDIT_LIMIT = 0.16;
export const ISS_MIN = 2;
export const ISS_MAX = 5;
export const COUNCIL_SPENDING_SHARE = 0.035;
/** Votos para a Câmara derrubar o parecer prévio do TCM: 2/3 de 55 = 37 (arredondado para cima). */
export const TCM_OVERRIDE_VOTES = 37;

export type PersonnelStatus = 'ok' | 'alerta' | 'prudencial' | 'excedido';
export function personnelStatus(ratio: number): PersonnelStatus {
  if (ratio > PERSONNEL_MAX) return 'excedido';
  if (ratio > PERSONNEL_PRUDENTIAL) return 'prudencial';
  if (ratio > PERSONNEL_ALERT) return 'alerta';
  return 'ok';
}

/** Ano em que um aumento de tributo publicado em `month/year` passa a valer (anterioridade anual + noventena). */
export function taxEffectiveYear(year: number, month: number, isIptuBase = false): number {
  if (isIptuBase) return year + 1;
  // Publicada até setembro: os 90 dias terminam até dezembro → vale em 1º/01 do ano seguinte.
  // Publicada de outubro em diante: a noventena atravessa a virada; no jogo, vale no ano seguinte ao próximo.
  return month <= 9 ? year + 1 : year + 2;
}

/** LRF art. 21: últimos 180 dias do mandato (julho a dezembro do último ano). */
export function inPersonnelFreeze(year: number, month: number, mandateEndYear: number): boolean {
  return year === mandateEndYear && month >= 7;
}

/** LRF art. 42: dois últimos quadrimestres do mandato (maio a dezembro do último ano). */
export function inArt42Window(year: number, month: number, mandateEndYear: number): boolean {
  return year === mandateEndYear && month >= 5;
}
