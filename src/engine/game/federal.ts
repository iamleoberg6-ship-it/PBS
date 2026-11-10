// Governo federal jogável: Presidência, Vice-Presidência e ministérios.
//
// REGRAS REAIS usadas (Constituição Federal e leis citadas):
// - Presidente e vice: eleitos juntos (chapa), maioria absoluta com 2º turno (CF art. 77); idade mínima 35 anos
//   (CF art. 14 §3º, VI, "a"); mandato de 4 anos com posse em 5 de janeiro (CF art. 82, EC 111/2021); uma reeleição
//   consecutiva (CF art. 14 §5º), sem precisar deixar o cargo para disputá-la.
// - Para disputar OUTRO cargo, o presidente renuncia seis meses antes (CF art. 14 §6º).
// - Vice substitui o presidente nos impedimentos e sucede na vaga (CF art. 79); pode receber outras atribuições.
// - Ministros: brasileiros maiores de 21 anos, livre nomeação e exoneração pelo presidente (CF arts. 76, 84 I e 87).
//   Ministro que quiser disputar eleição deixa o cargo seis meses antes (LC 64/90, art. 1º, II, "a", 1).
// - Deputado ou senador nomeado ministro NÃO perde o mandato (CF art. 56, I): fica licenciado e o suplente assume;
//   ao deixar o ministério, volta ao Congresso.
// - Medida provisória: força de lei imediata, vale 60 dias prorrogáveis por mais 60 (CF art. 62 §3º e §7º); se não
//   for votada, perde a eficácia.
// - Sanção e veto: o presidente sanciona ou veta em 15 dias úteis (CF art. 66 §1º); o veto é derrubado pela maioria
//   absoluta de deputados (257) e senadores (41) em sessão conjunta (CF art. 66 §4º).
// - Impeachment por crime de responsabilidade (Lei 1.079/50): a Câmara autoriza por 2/3 (342 votos, CF arts. 51 I e 86);
//   o Senado julga e condena por 2/3 (54 votos, CF art. 52, parágrafo único).
// - Banco Central autônomo (LC 179/2021): o presidente não decide a Selic.
// - Subsídio de presidente, vice e ministros: R$ 46.366,19 (Decreto Legislativo 172/2022, desde fev/2025).
// - Ponto de partida da economia (dados reais): IPCA 2025 4,26%; PIB 2025 +2,3%; desocupação média 2025 5,6%;
//   dívida bruta do governo geral 78,7% do PIB (dez/2025, BCB); Selic 13,75% (Copom, 4/11/2026); meta de inflação 3%
//   com tolerância de 1,5 p.p. (CMN).
//
// SIMPLIFICAÇÕES / PROPOSTA (mecânicas de jogo):
// - 13 ministérios principais com o nome da estrutura de 2026; o governo real tem cerca de 38 pastas e cada presidente
//   pode reorganizá-las por lei/MP. Ações, orçamentos discricionários, índices de área e efeitos são parâmetros de jogo.
// - O mandato do presidente real em exercício (2027–2030) não é simulado por dentro: o jogo não decide nada por
//   pessoas reais (ministérios, convites, demissões). Ministérios, convites e coalizões só existem com presidentes
//   personagens do jogo (a partir de 2031) ou com o jogador na Presidência.
// - As matérias, MPs e escândalos são genéricos e fictícios.

import { next, normal, pick, type RngState } from '../rng';
import { PARTIES, listIdForParty, partyById } from '../data/parties';
import { fictionalName } from './names';
import { partyAlignment } from './general';
import { generalPosition, partyIdeology } from '../data/ideology';
import { BR_REGIONS, initNational, nationalAgenda, type BrRegion } from './national';
import { pushNews } from './news';
import { TEMPLATES_FOR_SANCTION, scaleCamaraSeats, senateSeatsApprox } from './pauta';
import type { GameMonth } from '../calendar';
import type { GameState, Mandate, ProfessionId } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const mi = (m: GameMonth) => m.year * 12 + (m.month - 1);

export const EXEC_SALARY = 46_366.19;
export const FEDERAL_LABEL: Record<string, string> = {
  presidente: 'Presidente da República',
  vice_presidente: 'Vice-presidente da República',
  ministro: 'Ministro(a) de Estado',
};

// ---------------- Índices e economia ----------------

export type FedIndex = 'saude' | 'educacao' | 'seguranca' | 'infraestrutura' | 'ambiente' | 'social';
export const INDEX_LABEL: Record<FedIndex, string> = {
  saude: 'Saúde', educacao: 'Educação', seguranca: 'Segurança', infraestrutura: 'Infraestrutura', ambiente: 'Meio ambiente', social: 'Proteção social',
};

export interface Economy {
  inflation: number;     // IPCA 12 meses (%)
  growth: number;        // PIB, ritmo anual (%)
  unemployment: number;  // desocupação (%)
  selic: number;         // % a.a. (Banco Central autônomo)
  debt: number;          // DBGG, % do PIB
  primary: number;       // resultado primário estrutural, % do PIB (negativo = déficit)
  stance: 'ajuste' | 'neutra' | 'expansao';
  stanceYear: number;
  confidence: number;    // 0–100, humor do mercado (PROPOSTA)
}

export const ECONOMY_SOURCES = [
  'IPCA 2025: 4,26% (IBGE, jan/2026).',
  'PIB 2025: +2,3% (IBGE, mar/2026).',
  'Desocupação média de 2025: 5,6% (IBGE, PNAD Contínua).',
  'Dívida bruta do governo geral: 78,7% do PIB em dez/2025 (Banco Central).',
  'Selic: 13,75% a.a. (Copom, 4/11/2026). Meta de inflação: 3% ± 1,5 p.p. (CMN).',
  'Déficit primário do governo central em 2025: R$ 58,7 bi (≈ −0,5% do PIB).',
];

// ---------------- Ministérios ----------------

export type MinistryId = 'fazenda' | 'casa_civil' | 'sri' | 'saude' | 'educacao' | 'justica' | 'mds' | 'cidades' | 'agricultura' | 'meio_ambiente' | 'trabalho' | 'integracao' | 'transportes';

export interface Effects {
  idx?: Partial<Record<FedIndex, number>>;
  econ?: Partial<Pick<Economy, 'inflation' | 'growth' | 'unemployment' | 'primary' | 'confidence'>>;
  regions?: Partial<Record<BrRegion, number>>;
  approval?: number;
  mood?: number;     // humor do Congresso
  presRel?: number;  // relação do ministro com o presidente
}

export interface MinAction {
  id: string;
  label: string;
  description: string;
  cost: number;           // compromissos do cargo
  budget: number;         // R$ bi do orçamento discricionário da pasta
  delay: number;          // meses até o efeito principal
  effects: Effects;
  region?: boolean;       // escolhe uma região do país
  risk?: { chance: number; text: string; approval: number };
}

export interface MinistryDef {
  id: MinistryId;
  name: string;
  weight: number;         // peso político na partilha da coalizão (PROPOSTA)
  budget: number;         // orçamento discricionário anual, R$ bi (ordem de grandeza de jogo)
  area: FedIndex | 'economia' | 'politica';
  fit: ProfessionId[];
  actions: MinAction[];
}

export const MINISTRIES: MinistryDef[] = [
  {
    id: 'fazenda', name: 'Ministério da Fazenda', weight: 3, budget: 4, area: 'economia', fit: ['economista', 'empresario'],
    actions: [
      { id: 'faz_meta', label: 'Anunciar meta fiscal mais dura', description: 'Corta despesas discricionárias para melhorar o resultado primário. O mercado gosta; ministérios e base reclamam.', cost: 1, budget: 0, delay: 2, effects: { econ: { primary: 0.25, confidence: 6, growth: -0.15 }, mood: -4, approval: -1 } },
      { id: 'faz_receita', label: 'Propor aumento de arrecadação sobre altas rendas', description: 'Medida para financiar gastos sem piorar a dívida. Popular em parte do eleitorado, resistência no Congresso.', cost: 1, budget: 0, delay: 3, effects: { econ: { primary: 0.2 }, approval: 1.5, mood: -3, regions: { nordeste: 1, norte: 1 } } },
      { id: 'faz_credito', label: 'Linha de crédito para pequenas empresas', description: 'Crédito com garantia pública. Ajuda o emprego; custa ao Tesouro.', cost: 1, budget: 2, delay: 2, effects: { econ: { unemployment: -0.15, growth: 0.1, primary: -0.05 }, approval: 1 } },
    ],
  },
  {
    id: 'casa_civil', name: 'Casa Civil', weight: 3, budget: 2, area: 'politica', fit: ['advogado', 'servidor', 'economista'],
    actions: [
      { id: 'cc_pac', label: 'Destravar obras paradas (programa de investimentos)', description: 'Coordena ministérios para retomar obras numa região.', cost: 1, budget: 3, delay: 3, region: true, effects: { idx: { infraestrutura: 2 }, econ: { unemployment: -0.05 }, approval: 1 } },
      { id: 'cc_coordenar', label: 'Coordenar a agenda prioritária do governo', description: 'Reúne ministros e destrava decisões; melhora o desempenho do governo.', cost: 1, budget: 0, delay: 1, effects: { presRel: 3, approval: 0.5, mood: 2 } },
      { id: 'cc_mediar', label: 'Mediar conflito entre ministérios', description: 'Apaga incêndios internos antes que virem notícia.', cost: 1, budget: 0, delay: 0, effects: { presRel: 2, approval: 0.3 } },
    ],
  },
  {
    id: 'sri', name: 'Secretaria de Relações Institucionais', weight: 2, budget: 1, area: 'politica', fit: ['advogado', 'lider_comunitario', 'sindicalista'],
    actions: [
      { id: 'sri_emendas', label: 'Liberar emendas para a base', description: 'Acelera pagamentos a parlamentares aliados. Base mais fiel; custo fiscal e risco de desgaste.', cost: 1, budget: 2, delay: 0, effects: { mood: 8, econ: { primary: -0.03 } }, risk: { chance: 0.08, text: 'Imprensa questiona critérios na liberação de emendas.', approval: -2 } },
      { id: 'sri_cargos', label: 'Negociar cargos com partidos do centro', description: 'Amplia a base com indicações para cargos federais.', cost: 1, budget: 0, delay: 0, effects: { mood: 6, approval: -0.5 } },
      { id: 'sri_contar', label: 'Contar votos antes de uma votação importante', description: 'Mapeia votos e evita derrotas em plenário.', cost: 1, budget: 0, delay: 0, effects: { mood: 3, presRel: 2 } },
    ],
  },
  {
    id: 'saude', name: 'Ministério da Saúde', weight: 3, budget: 30, area: 'saude', fit: ['medico', 'servidor'],
    actions: [
      { id: 'sau_mutirao', label: 'Mutirão nacional de cirurgias e exames', description: 'Reduz filas do SUS numa região.', cost: 1, budget: 2, delay: 2, region: true, effects: { idx: { saude: 2 }, approval: 1.5 } },
      { id: 'sau_vacina', label: 'Campanha nacional de vacinação', description: 'Amplia a cobertura vacinal; efeito lento e duradouro.', cost: 1, budget: 1, delay: 3, effects: { idx: { saude: 3 }, approval: 0.8 } },
      { id: 'sau_farmacia', label: 'Ampliar remédios gratuitos na rede pública', description: 'Mais itens gratuitos nas farmácias credenciadas.', cost: 1, budget: 3, delay: 2, effects: { idx: { saude: 2, social: 1 }, approval: 2, econ: { primary: -0.03 } } },
    ],
  },
  {
    id: 'educacao', name: 'Ministério da Educação', weight: 3, budget: 25, area: 'educacao', fit: ['professor', 'servidor'],
    actions: [
      { id: 'edu_integral', label: 'Expandir escola em tempo integral', description: 'Repasses a redes estaduais e municipais por matrícula integral.', cost: 1, budget: 3, delay: 6, effects: { idx: { educacao: 4 }, approval: 1 } },
      { id: 'edu_alfabetizacao', label: 'Pacto pela alfabetização na idade certa', description: 'Formação de professores e material; resultado demora.', cost: 1, budget: 1, delay: 8, region: true, effects: { idx: { educacao: 3 } } },
      { id: 'edu_enem', label: 'Organizar o Enem sem falhas', description: 'Logística e segurança da prova. Se der errado, vira crise.', cost: 1, budget: 0.5, delay: 0, effects: { idx: { educacao: 0.5 }, presRel: 2 }, risk: { chance: 0.07, text: 'Falha na aplicação do Enem vira crise nacional.', approval: -3 } },
    ],
  },
  {
    id: 'justica', name: 'Ministério da Justiça e Segurança Pública', weight: 2, budget: 5, area: 'seguranca', fit: ['advogado', 'policial'],
    actions: [
      { id: 'jus_operacao', label: 'Operação integrada contra o crime organizado', description: 'Polícia Federal e forças estaduais numa região.', cost: 1, budget: 1, delay: 1, region: true, effects: { idx: { seguranca: 2 }, approval: 1.5 }, risk: { chance: 0.06, text: 'Operação termina com mortes e denúncias de abuso.', approval: -3 } },
      { id: 'jus_fronteiras', label: 'Reforçar o controle de fronteiras', description: 'Menos armas e drogas entrando; efeito lento.', cost: 1, budget: 1.5, delay: 4, effects: { idx: { seguranca: 2.5 } } },
      { id: 'jus_fundo', label: 'Repassar o fundo de segurança aos estados', description: 'Viaturas, inteligência e câmeras para as polícias estaduais.', cost: 1, budget: 2, delay: 3, effects: { idx: { seguranca: 2 }, mood: 2 } },
    ],
  },
  {
    id: 'mds', name: 'Ministério do Desenvolvimento e Assistência Social', weight: 2, budget: 20, area: 'social', fit: ['lider_comunitario', 'servidor', 'sindicalista'],
    actions: [
      { id: 'mds_busca', label: 'Busca ativa no Cadastro Único', description: 'Encontra famílias pobres fora dos programas.', cost: 1, budget: 1, delay: 2, region: true, effects: { idx: { social: 2 }, approval: 1 } },
      { id: 'mds_revisao', label: 'Pente-fino em benefícios irregulares', description: 'Economiza recursos; pode cortar quem tem direito.', cost: 1, budget: 0, delay: 1, effects: { econ: { primary: 0.05 }, idx: { social: -0.5 } }, risk: { chance: 0.1, text: 'Famílias com direito tiveram o benefício cortado por erro.', approval: -2 } },
      { id: 'mds_fome', label: 'Programa de combate à fome em áreas críticas', description: 'Cozinhas, cestas e compras da agricultura familiar.', cost: 1, budget: 2, delay: 2, region: true, effects: { idx: { social: 2.5 }, approval: 1.5 } },
    ],
  },
  {
    id: 'cidades', name: 'Ministério das Cidades', weight: 2, budget: 12, area: 'infraestrutura', fit: ['engenheiro', 'empresario'],
    actions: [
      { id: 'cid_moradia', label: 'Contratar moradias populares', description: 'Unidades do programa habitacional federal numa região.', cost: 1, budget: 4, delay: 6, region: true, effects: { idx: { infraestrutura: 2, social: 1 }, econ: { unemployment: -0.08 }, approval: 2 } },
      { id: 'cid_mobilidade', label: 'Financiar obras de mobilidade urbana', description: 'Corredores de ônibus e metrô com estados e municípios.', cost: 1, budget: 3, delay: 8, region: true, effects: { idx: { infraestrutura: 3 }, approval: 1 } },
      { id: 'cid_saneamento', label: 'Acelerar o saneamento básico', description: 'Água e esgoto em cidades com baixa cobertura.', cost: 1, budget: 3, delay: 6, region: true, effects: { idx: { saude: 1, infraestrutura: 2, ambiente: 1 } } },
    ],
  },
  {
    id: 'agricultura', name: 'Ministério da Agricultura e Pecuária', weight: 2, budget: 4, area: 'economia', fit: ['agricultor', 'empresario', 'engenheiro'],
    actions: [
      { id: 'agr_safra', label: 'Lançar o Plano Safra', description: 'Crédito rural com juros equalizados pelo Tesouro.', cost: 1, budget: 2, delay: 3, effects: { econ: { growth: 0.15, inflation: -0.05, primary: -0.05 }, regions: { centro_oeste: 2, sul: 2 } } },
      { id: 'agr_mercados', label: 'Abrir mercados externos para a carne e os grãos', description: 'Missão comercial e acordos sanitários.', cost: 1, budget: 0.3, delay: 4, effects: { econ: { growth: 0.1, confidence: 2 }, regions: { centro_oeste: 1.5, sul: 1 } } },
      { id: 'agr_sanidade', label: 'Reforçar a defesa sanitária', description: 'Evita surtos que fecham mercados.', cost: 1, budget: 0.5, delay: 2, effects: { econ: { confidence: 1 } }, risk: { chance: 0.04, text: 'Suspeita de doença animal fecha mercados por semanas.', approval: -1 } },
    ],
  },
  {
    id: 'meio_ambiente', name: 'Ministério do Meio Ambiente e Mudança do Clima', weight: 1, budget: 3, area: 'ambiente', fit: ['engenheiro', 'professor', 'lider_comunitario'],
    actions: [
      { id: 'amb_desmatamento', label: 'Operação contra o desmatamento ilegal', description: 'Fiscalização na Amazônia; conflito com setores locais.', cost: 1, budget: 1, delay: 2, effects: { idx: { ambiente: 3 }, econ: { confidence: 1 }, regions: { norte: -1 } } },
      { id: 'amb_fundo', label: 'Captar recursos internacionais para o clima', description: 'Doações e financiamento para projetos verdes.', cost: 1, budget: 0, delay: 4, effects: { idx: { ambiente: 2 }, econ: { primary: 0.02, confidence: 2 } } },
      { id: 'amb_desastres', label: 'Plano de adaptação a eventos extremos', description: 'Mapeia áreas de risco e prepara cidades para chuvas e secas.', cost: 1, budget: 1, delay: 5, region: true, effects: { idx: { ambiente: 1, infraestrutura: 1 } } },
    ],
  },
  {
    id: 'trabalho', name: 'Ministério do Trabalho e Emprego', weight: 2, budget: 3, area: 'economia', fit: ['sindicalista', 'advogado'],
    actions: [
      { id: 'tra_qualificacao', label: 'Programa de qualificação profissional', description: 'Cursos ligados a vagas reais.', cost: 1, budget: 1, delay: 4, region: true, effects: { econ: { unemployment: -0.1 }, approval: 0.8 } },
      { id: 'tra_mediacao', label: 'Mediar uma greve nacional', description: 'Negocia com sindicatos e empresas para encerrar a paralisação.', cost: 1, budget: 0, delay: 0, effects: { approval: 1, econ: { growth: 0.05 } }, risk: { chance: 0.15, text: 'A negociação fracassa e a greve se arrasta.', approval: -1.5 } },
      { id: 'tra_fiscalizacao', label: 'Fiscalização contra trabalho análogo à escravidão', description: 'Operações com o Ministério Público do Trabalho.', cost: 1, budget: 0.3, delay: 1, effects: { idx: { social: 1 }, approval: 0.5 } },
    ],
  },
  {
    id: 'integracao', name: 'Ministério da Integração e do Desenvolvimento Regional', weight: 2, budget: 8, area: 'infraestrutura', fit: ['engenheiro', 'lider_comunitario'],
    actions: [
      { id: 'int_hidrica', label: 'Obras hídricas contra a seca', description: 'Adutoras, cisternas e barragens.', cost: 1, budget: 3, delay: 6, effects: { idx: { infraestrutura: 2 }, regions: { nordeste: 3 } } },
      { id: 'int_defesa', label: 'Resposta da Defesa Civil a um desastre', description: 'Recursos e equipes para uma região atingida.', cost: 1, budget: 1, delay: 0, region: true, effects: { approval: 1.5, idx: { social: 0.5 } } },
      { id: 'int_fundos', label: 'Atrair investimentos com fundos regionais', description: 'Crédito de desenvolvimento para Norte, Nordeste e Centro-Oeste.', cost: 1, budget: 1, delay: 5, effects: { econ: { growth: 0.08 }, regions: { norte: 1.5, nordeste: 1.5, centro_oeste: 1 } } },
    ],
  },
  {
    id: 'transportes', name: 'Ministério dos Transportes', weight: 2, budget: 10, area: 'infraestrutura', fit: ['engenheiro', 'empresario'],
    actions: [
      { id: 'tra_concessao', label: 'Leiloar concessões de rodovias', description: 'Investimento privado em troca de pedágio.', cost: 1, budget: 0, delay: 6, effects: { idx: { infraestrutura: 2 }, econ: { primary: 0.05, confidence: 3 }, approval: -0.5 } },
      { id: 'tra_obras', label: 'Recuperar rodovias federais', description: 'Tapa-buracos e duplicações numa região.', cost: 1, budget: 3, delay: 4, region: true, effects: { idx: { infraestrutura: 2.5 }, approval: 1 } },
      { id: 'tra_ferrovia', label: 'Destravar uma ferrovia de carga', description: 'Escoamento da produção; obra de longo prazo.', cost: 1, budget: 2, delay: 10, effects: { idx: { infraestrutura: 2 }, econ: { growth: 0.1 }, regions: { centro_oeste: 2, norte: 1 } } },
    ],
  },
];
export const ministryById = (id: string) => MINISTRIES.find((m) => m.id === id);

// ---------------- Agenda do presidente ----------------

export interface PresMeasure { id: string; label: string; kind: 'PL' | 'PEC' | 'MP'; summary: string; slant: number; support: number; effects: Effects; delay: number }

export const PRES_AGENDA: PresMeasure[] = [
  { id: 'renda', kind: 'PL', label: 'Reforma da tributação da renda', summary: 'Isenta salários mais baixos e cobra mais de rendas muito altas.', slant: -0.4, support: 0.6, delay: 6, effects: { econ: { primary: 0.1 }, approval: 2.5, regions: { nordeste: 1, norte: 1 } } },
  { id: 'teto', kind: 'PEC', label: 'Regra fiscal com limite de gastos mais rígido', summary: 'Trava o crescimento da despesa para estabilizar a dívida.', slant: 0.6, support: -0.2, delay: 6, effects: { econ: { primary: 0.5, confidence: 8, growth: -0.1 }, idx: { social: -1.5 }, approval: -2 } },
  { id: 'habitacao', kind: 'PL', label: 'Programa nacional de moradia', summary: 'Meta de unidades habitacionais com subsídio por faixa de renda.', slant: -0.2, support: 0.6, delay: 9, effects: { idx: { infraestrutura: 3, social: 2 }, econ: { unemployment: -0.2, primary: -0.15 }, approval: 2 } },
  { id: 'seguranca', kind: 'PEC', label: 'Sistema único de segurança pública', summary: 'Integra polícias, dados e financiamento entre União e estados.', slant: 0.2, support: 0.5, delay: 8, effects: { idx: { seguranca: 5 }, approval: 1.5 } },
  { id: 'integral', kind: 'PL', label: 'Escola em tempo integral para todos', summary: 'Financiamento federal permanente para a jornada integral.', slant: -0.2, support: 0.5, delay: 12, effects: { idx: { educacao: 5 }, econ: { primary: -0.08 }, approval: 1 } },
  { id: 'saneamento', kind: 'PL', label: 'Meta nacional de saneamento', summary: 'Fundo para universalizar água e esgoto.', slant: 0, support: 0.5, delay: 12, effects: { idx: { saude: 2, infraestrutura: 3, ambiente: 1 }, econ: { primary: -0.08 }, regions: { norte: 2, nordeste: 2 } } },
  { id: 'administrativa', kind: 'PEC', label: 'Reforma administrativa', summary: 'Muda carreiras e estabilidade de novos servidores.', slant: 0.6, support: 0, delay: 12, effects: { econ: { primary: 0.2, confidence: 5 }, approval: -1, mood: -2 } },
  { id: 'energia', kind: 'PL', label: 'Transição energética', summary: 'Incentivos a energia limpa e hidrogênio verde.', slant: -0.1, support: 0.3, delay: 10, effects: { idx: { ambiente: 4 }, econ: { growth: 0.1, confidence: 2 } } },
  { id: 'transferencia', kind: 'PL', label: 'Ampliação da transferência de renda', summary: 'Aumenta o benefício por criança e a cobertura.', slant: -0.6, support: 0.4, delay: 3, effects: { idx: { social: 5 }, econ: { primary: -0.2, inflation: 0.1 }, approval: 2, regions: { nordeste: 3, norte: 2 } } },
  { id: 'concessoes', kind: 'PL', label: 'Programa de concessões e privatizações', summary: 'Transfere estatais e serviços à iniciativa privada.', slant: 0.7, support: -0.2, delay: 8, effects: { econ: { primary: 0.15, growth: 0.15, confidence: 6 }, approval: -1.5 } },
  { id: 'mp_minimo', kind: 'MP', label: 'MP do salário mínimo acima da inflação', summary: 'Reajuste real do mínimo já no mês seguinte.', slant: -0.4, support: 0.7, delay: 0, effects: { approval: 3, econ: { inflation: 0.1, primary: -0.1 }, regions: { nordeste: 1.5, norte: 1 } } },
  { id: 'mp_diesel', kind: 'MP', label: 'MP de subvenção ao diesel e ao gás de cozinha', summary: 'Segura preços de combustíveis por alguns meses.', slant: -0.2, support: 0.6, delay: 0, effects: { approval: 2, econ: { inflation: -0.2, primary: -0.12, confidence: -2 } } },
  { id: 'mp_credito', kind: 'MP', label: 'MP de crédito emergencial a pequenas empresas', summary: 'Garantia pública para empréstimos de capital de giro.', slant: 0, support: 0.5, delay: 0, effects: { econ: { unemployment: -0.15, primary: -0.05 }, approval: 1 } },
  { id: 'mp_apostas', kind: 'MP', label: 'MP que eleva a tributação das apostas online', summary: 'Mais imposto sobre as casas de apostas.', slant: -0.1, support: 0.4, delay: 0, effects: { econ: { primary: 0.06 }, approval: 0.8, mood: -2 } },
];

// ---------------- Estado do governo federal ----------------

export interface CabinetSeat { name: string; partyId: string | null; competence: number; kind: 'tecnico' | 'politico'; isPlayer?: boolean; scandal?: boolean }

export interface MinisterState {
  ministry: MinistryId;
  budgetLeft: number;
  performance: number;
  relationPresident: number;
  since: GameMonth;
  /** Mandato de deputado/senador licenciado (CF art. 56, I): volta ao Congresso quando deixar o ministério. */
  licensed?: Mandate | null;
}

export interface FederalState {
  economy: Economy;
  indices: Record<FedIndex, number>;
  /** Estilo de governo do presidente (personagem do jogo ou jogador). */
  style: 'coalizao' | 'misto' | 'centralizador';
  cabinet: Partial<Record<MinistryId, CabinetSeat>>;
  /** Partidos da coalizão de governo no Congresso. */
  coalition: string[];
  base: { camara: number; senado: number };
  /** Humor do Congresso com o governo (0–100, PROPOSTA). */
  mood: number;
  vice: { name: string; partyId: string | null; isPlayer?: boolean; relation?: number } | null;
  pending: { due: number; label: string; effects: Effects; region?: BrRegion }[];
  bills: { id: string; measure: string; label: string; kind: 'PL' | 'PEC' | 'MP'; due: number; status: 'tramitando' | 'aprovado' | 'rejeitado' | 'caducou'; votes?: string }[];
  sanctions: { id: string; title: string; summary: string; support: number; slant: number; salience: number; decision: 'sancionar' | 'vetar' | null; month: GameMonth; outcome?: string }[];
  impeachment: { stage: null | 'denuncia' | 'afastado'; since?: number };
  regionBias: Record<BrRegion, number>;
  lastReshuffle: number;
  log: string[];
}

export function initFederal(): FederalState {
  return {
    economy: { inflation: 4.26, growth: 2.3, unemployment: 5.6, selic: 13.75, debt: 78.7, primary: -0.5, stance: 'neutra', stanceYear: 0, confidence: 50 },
    indices: { saude: 50, educacao: 50, seguranca: 50, infraestrutura: 50, ambiente: 50, social: 50 },
    style: 'misto',
    cabinet: {},
    coalition: [],
    base: { camara: 0, senado: 0 },
    mood: 50,
    vice: null,
    pending: [],
    bills: [],
    sanctions: [],
    impeachment: { stage: null },
    regionBias: { norte: 0, nordeste: 0, centro_oeste: 0, sudeste: 0, sul: 0 },
    lastReshuffle: -99,
    log: [],
  };
}

export const playerIsPresident = (s: GameState) => s.player.mandate?.office === 'presidente';
export const playerIsVice = (s: GameState) => s.player.mandate?.office === 'vice_presidente';
export const playerMinistry = (s: GameState): MinisterState | null => s.player.mandate?.minister ?? null;
/** O governo federal é simulado por dentro só com presidente personagem do jogo ou com o jogador. */
export const federalModeled = (s: GameState) => playerIsPresident(s) || !s.stateWorld.president.real;

// ---------------- Coalizão e gabinete ----------------

function seatsOf(s: GameState, parties: string[]) {
  const cam = scaleCamaraSeats(s);
  const sen = senateSeatsApprox();
  return {
    camara: parties.reduce((a, p) => a + (cam[p] ?? 0), 0),
    senado: parties.reduce((a, p) => a + (sen[p] ?? 0), 0),
  };
}

/** Monta a coalizão segundo o estilo: ampla (busca 3/5 do Congresso), mista ou centralizada no próprio campo. */
export function buildCoalition(s: GameState, presParty: string, style: FederalState['style']): string[] {
  const own = PARTIES.filter((p) => listIdForParty(p.id) === listIdForParty(presParty)).map((p) => p.id);
  // Presidencialismo de coalizão: partidos de centro aderem a governos de diferentes campos em troca de espaço.
  const minAlign = style === 'coalizao' ? 0.04 : style === 'misto' ? 0.2 : 0.6;
  const target = style === 'coalizao' ? 330 : style === 'misto' ? 280 : 0;
  const cam = scaleCamaraSeats(s);
  const others = PARTIES.filter((p) => !own.includes(p.id))
    // Disposição de aderir: afinidade ideológica com o presidente OU posição perto do centro da escala
    // (partidos de centro tendem a compor com governos de campos diferentes) — PROPOSTA baseada na escala ideológica do jogo.
    .map((p) => { const pos = generalPosition(partyIdeology(p.id)) ?? 5; return { id: p.id, a: Math.max(partyAlignment(presParty, p.id), 0.5 - Math.abs(pos - 5) / 6), seats: cam[p.id] ?? 0 }; })
    .filter((x) => x.a >= minAlign)
    .sort((x, y) => y.a - x.a || y.seats - x.seats);
  const out = [...own];
  for (const o of others) {
    if (style === 'centralizador' && out.length >= own.length + 2) break;
    if (target && seatsOf(s, out).camara >= target) break;
    out.push(o.id);
  }
  return out;
}

function newMinisterName(_s: GameState, rng: RngState, partyId: string | null, kind: 'tecnico' | 'politico'): CabinetSeat {
  const comp = kind === 'tecnico' ? 62 + normal(rng, 0, 10) : 50 + normal(rng, 0, 12);
  return { name: fictionalName(rng), partyId, competence: Math.round(clamp(comp, 20, 95)), kind };
}

/** Distribui ministérios entre os partidos da coalizão: no estilo centralizador, o partido do presidente fica com quase tudo. */
export function formCabinet(s: GameState, rng: RngState, presParty: string) {
  const f = s.federal!;
  const coalition = f.coalition.length ? f.coalition : [presParty];
  const own = coalition.filter((p) => listIdForParty(p) === listIdForParty(presParty));
  const allies = coalition.filter((p) => !own.includes(p));
  const cam = scaleCamaraSeats(s);
  const share = f.style === 'coalizao' ? 0.55 : f.style === 'misto' ? 0.35 : 0.12;
  const keep = f.cabinet;
  const cabinet: FederalState['cabinet'] = {};
  const order = [...MINISTRIES].sort((a, b) => b.weight - a.weight);
  // Pastas do núcleo (Fazenda, Casa Civil, Relações Institucionais) ficam com o presidente.
  for (const m of order) {
    const prev = keep[m.id];
    if (prev?.isPlayer) { cabinet[m.id] = prev; continue; }
    const core = ['fazenda', 'casa_civil', 'sri'].includes(m.id);
    let party: string | null;
    if (!core && allies.length && next(rng) < share) {
      const tot = allies.reduce((a, p) => a + (cam[p] ?? 1), 0);
      let r = next(rng) * tot;
      party = allies.find((p) => (r -= cam[p] ?? 1) <= 0) ?? allies[0];
    } else party = next(rng) < 0.3 ? null : own[0] ?? presParty;
    cabinet[m.id] = newMinisterName(s, rng, party, party === null ? 'tecnico' : party === presParty || own.includes(party) ? (next(rng) < 0.4 ? 'tecnico' : 'politico') : 'politico');
  }
  f.cabinet = cabinet;
  const b = seatsOf(s, coalition);
  f.base = b;
  f.mood = clamp(f.style === 'coalizao' ? 62 : f.style === 'misto' ? 52 : 40);
}

// ---------------- Posse e passo mensal ----------------

/** Posse de um presidente personagem do jogo: escolhe estilo, coalizão e ministério (e talvez convide o jogador). */
export function aiPresidentTakesOffice(s: GameState, rng: RngState): string[] {
  const f = (s.federal ??= initFederal());
  const p = s.stateWorld.president;
  if (p.real || p.isPlayer) return [];
  f.style = pick(rng, ['coalizao', 'coalizao', 'misto', 'misto', 'centralizador'] as const);
  f.coalition = buildCoalition(s, p.partyId, f.style);
  s.stateWorld.presidentCoalition = f.coalition;
  f.cabinet = {};
  formCabinet(s, rng, p.partyId);
  f.vice = { name: f.vice?.name ?? fictionalName(rng), partyId: f.coalition[1] ?? p.partyId };
  f.lastReshuffle = mi(s.month);
  const label = f.style === 'coalizao' ? 'governo de coalizão ampla' : f.style === 'misto' ? 'coalizão moderada' : 'governo centralizado no próprio partido';
  const notes = [`${p.name} (${partyById(p.partyId)?.acronym}, personagem do jogo) toma posse e monta um ${label}: base de ${f.base.camara} deputados e ${f.base.senado} senadores (simulação).`];
  notes.push(...ministerInvite(s, rng, 'posse'));
  return notes;
}

/** Convite ao jogador para um ministério (só com presidente personagem do jogo). */
export function ministerInvite(s: GameState, rng: RngState, when: 'posse' | 'reforma'): string[] {
  const p = s.stateWorld.president;
  if (p.real || p.isPlayer || !s.player.partyId) return [];
  const off = s.player.mandate?.office;
  if (off && !['deputado_federal', 'senador'].includes(off)) return []; // demais cargos teriam de renunciar: fora do escopo do convite
  if (s.player.candidacy) return [];
  const f = s.federal!;
  const inCoalition = f.coalition.includes(s.player.partyId);
  const align = partyAlignment(s.player.partyId, p.partyId);
  const close = inCoalition || align >= (f.style === 'centralizador' ? 0.8 : 0.45);
  if (!close) return [];
  const a = s.character.attributes;
  const nat = s.national ? (s.national.player.sudeste.recognition + s.national.player.nordeste.recognition) / 2 : 0;
  const prominent = s.player.recognition >= 40 || nat >= 15 || !!off;
  const prepared = a.management >= 45 || a.politicalKnowledge >= 50 || a.negotiation >= 55;
  if (!prominent || !prepared) return [];
  const chance = (when === 'posse' ? 0.55 : 0.3) * (inCoalition ? 1 : 0.7) * (f.style === 'coalizao' ? 1.15 : f.style === 'centralizador' ? 0.6 : 1);
  if (next(rng) > chance) return [];
  const prof = s.character.profession;
  const options = [...MINISTRIES].filter((m) => !f.cabinet[m.id]?.isPlayer)
    .sort((x, y) => (y.fit.includes(prof) ? 1 : 0) - (x.fit.includes(prof) ? 1 : 0) || x.weight - y.weight)
    .slice(0, 3).map((m) => m.id);
  s.flags.conviteMinisterio = options.join(',');
  s.flags.conviteMinisterioPres = p.name;
  s.pendingEvents.push({ templateId: 'convite_ministerio', vars: {} });
  return [`${p.name} sondou seu nome para o ministério.`];
}

/** Aceite do convite: deputado/senador se licencia (CF art. 56, I); quem não tem mandato assume direto. */
export function becomeMinister(s: GameState, ministry: MinistryId): string {
  const f = (s.federal ??= initFederal());
  const def = ministryById(ministry)!;
  const cur = s.player.mandate;
  const licensed = cur && ['deputado_federal', 'senador'].includes(cur.office) ? cur : null;
  const prevSeat = f.cabinet[ministry];
  s.player.mandate = {
    office: 'ministro', since: `${s.month.year}-${String(s.month.month).padStart(2, '0')}-01`, until: licensed?.until ?? `${s.stateWorld.president.until + 1}-01-05`,
    stance: 'independente', approval: 50, relationExecutive: 60, councilBase: 0, projects: [], councilPresident: false, priorityArea: null, portfolio: ministry, budgetShare: 0,
    minister: { ministry, budgetLeft: def.budget, performance: 55, relationPresident: 62, since: { ...s.month }, licensed },
  } as Mandate;
  s.player.job = null;
  s.finances.monthlyIncome = EXEC_SALARY;
  f.cabinet[ministry] = { name: s.character.name, partyId: s.player.partyId, competence: Math.round((s.character.attributes.management + s.character.attributes.politicalKnowledge) / 2), kind: 'politico', isPlayer: true };
  s.player.careerHistory.push({ office: def.name.replace('Ministério', 'Ministro(a)'), from: `${s.month.year}-${String(s.month.month).padStart(2, '0')}`, to: null, note: 'Nomeação' });
  const lic = licensed ? ` Você se licencia do mandato de ${licensed.office === 'senador' ? 'senador(a)' : 'deputado(a) federal'} (CF art. 56, I): o suplente assume e você pode voltar quando deixar o ministério.` : '';
  return `Você tomou posse como titular do ${def.name}${prevSeat ? ` no lugar de ${prevSeat.name}` : ''}.${lic}`;
}

/** Saída do ministério (pedido, demissão ou desincompatibilização). */
export function leaveMinistry(s: GameState, reason: string): string {
  const m = s.player.mandate;
  const ms = m?.minister;
  if (!m || !ms) return 'Você não ocupa ministério.';
  const f = s.federal!;
  const def = ministryById(ms.ministry)!;
  const h = s.player.careerHistory.findLast((x) => x.to === null && x.office.startsWith('Ministro'));
  if (h) h.to = `${s.month.year}-${String(s.month.month).padStart(2, '0')}`;
  f.cabinet[ms.ministry] = { name: fictionalName(s.rng), partyId: s.stateWorld.president.partyId, competence: 55, kind: 'politico' };
  if (m.office === 'vice_presidente') { m.minister = null; return `Você deixou o ${def.name} e segue como vice-presidente. ${reason}`; }
  if (ms.licensed) {
    s.player.mandate = ms.licensed;
    s.finances.monthlyIncome = EXEC_SALARY;
    return `Você deixou o ${def.name} (${reason}) e reassumiu o mandato de ${ms.licensed.office === 'senador' ? 'senador(a)' : 'deputado(a) federal'}.`;
  }
  s.player.mandate = null;
  s.player.job = 'profissao';
  s.finances.monthlyIncome = 9_000;
  return `Você deixou o ${def.name}. ${reason}`;
}

function applyEffects(s: GameState, e: Effects, region?: BrRegion, scale = 1) {
  const f = s.federal!;
  const ec = f.economy;
  for (const [k, v] of Object.entries(e.idx ?? {})) f.indices[k as FedIndex] = clamp(f.indices[k as FedIndex] + (v as number) * scale);
  for (const [k, v] of Object.entries(e.econ ?? {})) {
    const key = k as keyof Economy;
    if (key === 'confidence') ec.confidence = clamp(ec.confidence + (v as number) * scale);
    else (ec as unknown as Record<string, number>)[key] = (ec as unknown as Record<string, number>)[key] + (v as number) * scale;
  }
  const n = (s.national ??= initNational());
  const regs = { ...(e.regions ?? {}) } as Partial<Record<BrRegion, number>>;
  if (region) regs[region] = (regs[region] ?? 0) + 2;
  for (const [r, v] of Object.entries(regs)) {
    const id = r as BrRegion;
    f.regionBias[id] = Math.max(-15, Math.min(15, f.regionBias[id] + (v as number) * scale));
    if (playerMinistry(s) || playerIsPresident(s) || playerIsVice(s)) n.player[id].recognition = clamp(n.player[id].recognition + Math.abs(v as number) * 0.6 * scale);
  }
  if (e.mood) f.mood = clamp(f.mood + e.mood * scale);
  const m = s.player.mandate;
  if (e.approval) {
    s.stateWorld.presidentApproval = clamp(s.stateWorld.presidentApproval + e.approval * scale * 0.6);
    if (m && (playerIsPresident(s))) m.approval = s.stateWorld.presidentApproval;
    else if (m?.minister) m.approval = clamp(m.approval + e.approval * scale);
  }
  if (e.presRel && m?.minister) m.minister.relationPresident = clamp(m.minister.relationPresident + e.presRel * scale);
}

/** Ação personalizada de um ministério (jogador ministro ou vice com pasta). */
export function ministryAction(s: GameState, rng: RngState, param: string): string {
  const ms = playerMinistry(s);
  if (!ms) return 'Você não comanda um ministério.';
  const [aid, reg] = param.split('|');
  const def = ministryById(ms.ministry)!;
  const a = def.actions.find((x) => x.id === aid);
  if (!a) return 'Ação indisponível nesta pasta.';
  if (a.budget > ms.budgetLeft + 1e-9) return `Orçamento discricionário da pasta insuficiente (restam R$ ${ms.budgetLeft.toFixed(1)} bi; renova em janeiro). Peça mais verba à Fazenda ou escolha outra ação.`;
  ms.budgetLeft = Math.round((ms.budgetLeft - a.budget) * 10) / 10;
  const region = reg && (BR_REGIONS as string[]).includes(reg) ? (reg as BrRegion) : undefined;
  const attr = s.character.attributes;
  const quality = 0.7 + (attr.management + attr.politicalKnowledge) / 400 + normal(rng, 0, 0.1);
  const f = s.federal!;
  const label = `${a.label}${region ? ` (${s.national?.regions[region].name})` : ''}`;
  if (a.delay > 0) f.pending.push({ due: mi(s.month) + a.delay, label, effects: a.effects, region });
  else applyEffects(s, a.effects, region, quality);
  ms.performance = clamp(ms.performance + 1.5 * quality);
  let txt = `${label}: ${a.delay > 0 ? `lançado; resultados em cerca de ${a.delay} ${a.delay === 1 ? 'mês' : 'meses'}.` : 'feito.'}`;
  if (a.risk && next(rng) < a.risk.chance * (1.4 - quality / 2)) {
    applyEffects(s, { approval: a.risk.approval, presRel: -4 }, undefined, 1);
    ms.performance = clamp(ms.performance - 6);
    txt += ` PROBLEMA: ${a.risk.text}`;
    pushNews(s, rng, { section: 'Brasil', headline: `${a.risk.text} (simulação)`, lead: `Desgaste para ${s.character.name}, à frente do ${def.name}.`, aboutPlayer: true, tone: 'critico' });
  }
  return txt;
}

/** Ações comuns a todo ministro. */
export function ministerCommon(s: GameState, rng: RngState, kind: 'congresso' | 'imprensa' | 'despacho' | 'verba'): string {
  const ms = playerMinistry(s);
  if (!ms) return 'Você não comanda um ministério.';
  const f = s.federal!;
  const a = s.character.attributes;
  const def = ministryById(ms.ministry)!;
  if (kind === 'congresso') { f.mood = clamp(f.mood + 2 + a.negotiation / 40); ms.relationPresident = clamp(ms.relationPresident + 1.5); return 'Você defendeu a agenda da pasta em comissões do Congresso. O humor dos parlamentares melhorou.'; }
  if (kind === 'imprensa') {
    const n = (s.national ??= initNational());
    for (const r of BR_REGIONS) n.player[r].recognition = clamp(n.player[r].recognition + 0.6 + a.communication / 120);
    if (next(rng) < 0.12 - a.communication / 1500) { ms.relationPresident = clamp(ms.relationPresident - 5); return 'Entrevista coletiva com uma frase mal colocada: virou manchete e irritou o Planalto.'; }
    return 'Entrevista coletiva sobre as ações da pasta: mais projeção nacional.';
  }
  if (kind === 'despacho') { ms.relationPresident = clamp(ms.relationPresident + 3 + a.negotiation / 50); return 'Despacho com o(a) presidente: você apresentou resultados e alinhou prioridades.'; }
  // verba: pede crédito à Fazenda
  const got = ms.relationPresident >= 55 && next(rng) < 0.4 + ms.relationPresident / 250;
  if (got) { ms.budgetLeft += Math.max(0.5, def.budget * 0.15); f.economy.primary -= 0.02; return `A Fazenda liberou crédito adicional de R$ ${Math.max(0.5, def.budget * 0.15).toFixed(1)} bi para a pasta.`; }
  ms.relationPresident = clamp(ms.relationPresident - 1);
  return 'A Fazenda negou o pedido de verba: o orçamento está apertado.';
}

// ---------------- Presidente (jogador) ----------------

export function presSetStyle(s: GameState, rng: RngState, style: FederalState['style']): string {
  const f = s.federal!;
  if (mi(s.month) - f.lastReshuffle < 6) return 'Reforma ministerial recente: espere ao menos seis meses para outra.';
  f.style = style;
  f.coalition = buildCoalition(s, s.player.partyId!, style);
  s.stateWorld.presidentCoalition = f.coalition;
  formCabinet(s, rng, s.player.partyId!);
  f.lastReshuffle = mi(s.month);
  const comp = Object.values(f.cabinet).reduce((a, c) => a + (c?.competence ?? 0), 0) / MINISTRIES.length;
  return `Reforma ministerial (${style === 'coalizao' ? 'coalizão ampla' : style === 'misto' ? 'coalizão moderada' : 'governo centralizado'}): base de ${f.base.camara} deputados e ${f.base.senado} senadores; competência média do ministério ${Math.round(comp)}.`;
}

export function presAppoint(s: GameState, rng: RngState, param: string): string {
  const f = s.federal!;
  const [mid, kind] = param.split('|') as [MinistryId, 'tecnico' | 'politico'];
  const def = ministryById(mid);
  if (!def) return 'Ministério inválido.';
  const old = f.cabinet[mid];
  const allies = f.coalition.filter((p) => listIdForParty(p) !== listIdForParty(s.player.partyId ?? ''));
  const party = kind === 'tecnico' ? null : (allies.length ? pick(rng, allies) : s.player.partyId);
  f.cabinet[mid] = newMinisterName(s, rng, party, kind);
  f.mood = clamp(f.mood + (kind === 'politico' ? 4 : -2));
  return `${old ? `${old.name} deixa o ${def.name}. ` : ''}Novo(a) ministro(a): ${f.cabinet[mid]!.name} (${party ? partyById(party)?.acronym : 'técnico(a), sem partido'}), competência ${f.cabinet[mid]!.competence}.`;
}

/** Envia projeto/PEC ou edita MP. A votação acontece meses depois, conforme a base. */
export function presMeasure(s: GameState, rng: RngState, id: string): string {
  const f = s.federal!;
  const m = PRES_AGENDA.find((x) => x.id === id);
  if (!m) return 'Medida inválida.';
  if (f.bills.some((b) => b.measure === id && b.status === 'tramitando')) return 'Essa proposta já está tramitando.';
  if (f.bills.some((b) => b.measure === id && b.status === 'aprovado')) return 'Essa proposta já foi aprovada neste governo.';
  const months = m.kind === 'MP' ? 3 : m.kind === 'PEC' ? 6 : 4;
  f.bills.push({ id: `pb_${id}_${mi(s.month)}`, measure: id, label: m.label, kind: m.kind, due: mi(s.month) + months, status: 'tramitando' });
  if (m.kind === 'MP') {
    applyEffects(s, m.effects, undefined, 0.7);
    f.mood = clamp(f.mood - 1.5); // MPs em excesso irritam o Congresso
    return `Medida provisória editada: "${m.label}" já tem força de lei (CF art. 62). O Congresso tem até 120 dias para votar; se rejeitar ou deixar caducar, os efeitos se desfazem.`;
  }
  void rng;
  return `${m.kind === 'PEC' ? 'Proposta de emenda à Constituição' : 'Projeto de lei'} enviado ao Congresso: "${m.label}". ${m.kind === 'PEC' ? 'Precisa de 3/5 em dois turnos nas duas Casas (CF art. 60 §2º).' : 'Precisa de maioria simples nas duas Casas.'}`;
}

/** Apoio efetivo do Congresso numa votação (base × humor + votos avulsos), com o quórum real de cada tipo. */
export function congressVote(s: GameState, rng: RngState, slant: number, support: number, kind: 'PL' | 'PEC' | 'MP' | 'VETO'): { yes: number; ok: boolean; rule: string } {
  const f = s.federal!;
  const base = f.base.camara;
  const loyal = 0.62 + f.mood / 300;
  const others = 513 - base;
  const swing = 0.14 + Math.max(0, support) * 0.25 + f.mood / 600 - Math.abs(slant) * 0.06;
  const yes = Math.round(base * Math.min(0.98, loyal) + others * clamp(swing, 0.02, 0.6, ) + normal(rng, 0, 12));
  const need = kind === 'PEC' ? 308 : kind === 'VETO' ? 257 : 257 - 0; // maioria simples com quórum cheio ≈ 257
  const rule = kind === 'PEC' ? 'PEC: 308 de 513 (3/5)' : kind === 'VETO' ? 'manter o veto: impedir 257 votos pela derrubada' : 'maioria dos presentes';
  return { yes: Math.max(0, Math.min(513, yes)), ok: yes >= need, rule };
}

export function presFiscal(s: GameState, stance: Economy['stance'] | 'pedalada'): string {
  const f = s.federal!;
  const ec = f.economy;
  if (ec.stanceYear === s.month.year) return 'A política fiscal deste ano já foi definida.';
  ec.stanceYear = s.month.year;
  if (stance === 'pedalada') {
    s.flags.pedalada = Number(s.flags.pedalada ?? 0) + 1;
    ec.stance = 'expansao';
    s.stateWorld.presidentApproval = clamp(s.stateWorld.presidentApproval + 2);
    return 'Você mandou atrasar repasses a bancos públicos para maquiar o resultado fiscal. Isso pode ser crime de responsabilidade contra a lei orçamentária (Lei 1.079/50, art. 10) — base possível de impeachment se vier à tona.';
  }
  ec.stance = stance;
  ec.confidence = clamp(ec.confidence + (stance === 'ajuste' ? 6 : stance === 'expansao' ? -6 : 0));
  return stance === 'ajuste' ? 'Política fiscal de ajuste: menos gasto, mercado mais confiante, economia e popularidade sentem no curto prazo.'
    : stance === 'expansao' ? 'Política fiscal expansionista: mais gasto e investimento agora; inflação, juros e dívida podem subir.'
    : 'Política fiscal neutra: mantém o ritmo das contas públicas.';
}

export function presEmendas(s: GameState, value: number): string {
  const f = s.federal!;
  f.mood = clamp(f.mood + value / 2);
  f.economy.primary -= value / 127 / 12 * 12 * 0.1; // R$ bi → % do PIB (PIB ≈ R$ 12,7 tri)
  if (next(s.rng) < 0.04 + value / 400) {
    s.stateWorld.presidentApproval = clamp(s.stateWorld.presidentApproval - 2);
    return `Liberação de R$ ${value} bi em emendas e cargos melhora o humor da base, mas a imprensa fala em "balcão de negócios".`;
  }
  return `Liberação de R$ ${value} bi em emendas e cargos para a base: o Congresso fica mais receptivo.`;
}

export function presSpeech(s: GameState, rng: RngState): string {
  const a = s.character.attributes;
  const d = (a.communication + a.charisma) / 50 - 1.2 + normal(rng, 0, 1);
  s.stateWorld.presidentApproval = clamp(s.stateWorld.presidentApproval + d);
  if (s.player.mandate) s.player.mandate.approval = s.stateWorld.presidentApproval;
  if (Math.abs(d) < 0.3) return 'Pronunciamento em rede nacional sem grande repercussão.';
  return d > 0 ? `Pronunciamento em rede nacional bem recebido (aprovação +${d.toFixed(1)}).` : `Pronunciamento em rede nacional caiu mal: panelaço em algumas capitais (aprovação ${d.toFixed(1)}).`;
}

export function presInternational(s: GameState): string {
  const f = s.federal!;
  f.economy.confidence = clamp(f.economy.confidence + 2);
  const n = (s.national ??= initNational());
  for (const r of BR_REGIONS) n.player[r].recognition = clamp(n.player[r].recognition + 0.5);
  const vice = f.vice?.name ?? 'o(a) vice';
  return `Viagem internacional e cúpula com chefes de Estado: acordos comerciais e projeção. ${vice} assume a Presidência interinamente durante a viagem (CF art. 79).`;
}

export function decideSanction(state: GameState, id: string, decision: 'sancionar' | 'vetar' | null): GameState {
  const s: GameState = structuredClone(state);
  const x = s.federal?.sanctions.find((v) => v.id === id && !v.outcome);
  if (x) x.decision = decision;
  return s;
}

// ---------------- Vice-presidente (jogador) ----------------

export function viceAction(s: GameState, rng: RngState, kind: 'articular' | 'missao' | 'agenda' | 'perfil', region?: string): string {
  const f = s.federal!;
  const v = f.vice;
  const a = s.character.attributes;
  if (!v?.isPlayer) return 'Você não é vice-presidente.';
  v.relation = v.relation ?? 60;
  if (kind === 'articular') { f.mood = clamp(f.mood + 2 + a.negotiation / 50); v.relation = clamp(v.relation + 2); return 'Você articulou votos do governo no Congresso a pedido do(a) presidente.'; }
  if (kind === 'missao') { const n = (s.national ??= initNational()); for (const r of BR_REGIONS) n.player[r].recognition = clamp(n.player[r].recognition + 0.7); f.economy.confidence = clamp(f.economy.confidence + 1); return 'Missão oficial no exterior representando o governo: projeção e contatos.'; }
  if (kind === 'agenda') return nationalAgenda(s, rng, region ?? 'br_nordeste');
  const n = (s.national ??= initNational());
  for (const r of BR_REGIONS) n.player[r].recognition = clamp(n.player[r].recognition + 1.2);
  v.relation = clamp(v.relation - 6);
  return 'Você marcou posição própria em entrevistas, de olho no futuro. Ganhou projeção — e o Planalto não gostou.';
}

// ---------------- Passo mensal ----------------

export function federalMonthlyStep(s: GameState, rng: RngState): string[] {
  const f = (s.federal ??= initFederal());
  const out: string[] = [];
  const t = mi(s.month);
  const ec = f.economy;
  const modeled = federalModeled(s);

  // Economia (PROPOSTA ancorada em dados reais de partida). O Banco Central é autônomo: a Selic reage à inflação.
  const stanceG = ec.stance === 'expansao' ? 0.7 : ec.stance === 'ajuste' ? -0.5 : 0;
  const stanceP = ec.stance === 'expansao' ? -0.6 : ec.stance === 'ajuste' ? 0.4 : 0;
  ec.primary += ((-0.4 + stanceP) - ec.primary) * 0.02;
  const targetGrowth = 2.0 + stanceG - (ec.selic - 10) * 0.12 + (ec.confidence - 50) / 40;
  ec.growth += (targetGrowth - ec.growth) * 0.08 + normal(rng, 0, 0.08);
  ec.inflation += ((3 + (ec.growth - 2) * 0.6 + stanceG * 0.8 - (ec.selic - 11) * 0.25 + (50 - ec.confidence) / 30) - ec.inflation) * 0.06 + normal(rng, 0, 0.08);
  ec.inflation = Math.max(0.5, Math.min(20, ec.inflation));
  const selicTarget = Math.max(4, Math.min(20, ec.inflation + 5.5 + 1.2 * (ec.inflation - 3)));
  if (s.month.month % 2 === 0) ec.selic = Math.round((ec.selic + Math.max(-0.5, Math.min(0.5, (selicTarget - ec.selic) * 0.3))) * 4) / 4;
  ec.unemployment = Math.max(3, Math.min(18, ec.unemployment - (ec.growth - 2) * 0.03 + (6.5 - ec.unemployment) * 0.004 + normal(rng, 0, 0.03)));
  const realRate = ec.selic - ec.inflation;
  ec.debt = Math.max(30, ec.debt + (ec.debt * (realRate * 0.55 - ec.growth) / 100 - ec.primary) / 12);
  ec.confidence = clamp(ec.confidence + (ec.debt > 85 ? -0.4 : 0) + (ec.primary > 0 ? 0.2 : -0.05) + (50 - ec.confidence) * 0.02);
  f.mood = clamp(f.mood + (50 - f.mood) * 0.04);
  for (const k of Object.keys(f.indices) as FedIndex[]) f.indices[k] = clamp(f.indices[k] + (50 - f.indices[k]) * 0.004 + normal(rng, 0, 0.15));

  if (s.month.month === 1) {
    const ms = playerMinistry(s);
    if (ms) ms.budgetLeft = ministryById(ms.ministry)!.budget;
    if (ec.stanceYear !== s.month.year && !playerIsPresident(s)) ec.stance = 'neutra';
  }

  // Programas maduros.
  for (const p of f.pending.filter((x) => x.due <= t)) { applyEffects(s, p.effects, p.region); out.push(`Resultado: ${p.label}.`); }
  f.pending = f.pending.filter((x) => x.due > t);

  if (!modeled) return out; // presidente real: só a economia de fundo

  // Votações das propostas do governo.
  for (const b of f.bills.filter((x) => x.status === 'tramitando' && x.due <= t)) {
    const m = PRES_AGENDA.find((x) => x.id === b.measure)!;
    const v = congressVote(s, rng, m.slant, m.support, m.kind);
    b.votes = `${v.yes} votos na Câmara (${v.rule})`;
    if (v.ok) {
      b.status = 'aprovado';
      if (m.kind === 'MP') applyEffects(s, m.effects, undefined, 0.3);
      else if (m.delay > 0) f.pending.push({ due: t + m.delay, label: m.label, effects: m.effects });
      else applyEffects(s, m.effects);
      f.mood = clamp(f.mood - 1);
      if (playerIsPresident(s)) out.push(`Congresso APROVOU "${m.label}" (${b.votes}).`);
    } else {
      b.status = m.kind === 'MP' ? 'caducou' : 'rejeitado';
      if (m.kind === 'MP') applyEffects(s, m.effects, undefined, -0.6);
      s.stateWorld.presidentApproval = clamp(s.stateWorld.presidentApproval - 1);
      if (playerIsPresident(s)) out.push(`Derrota no Congresso: "${m.label}" ${m.kind === 'MP' ? 'perdeu a validade' : 'foi rejeitada'} (${b.votes}).`);
    }
  }
  if (f.bills.length > 40) f.bills.splice(0, f.bills.length - 40);

  // Sanção ou veto de projetos aprovados pelo Congresso (só quando o jogador é presidente).
  if (playerIsPresident(s)) {
    for (const x of f.sanctions.filter((v) => !v.outcome)) {
      const d = x.decision ?? 'sancionar';
      x.decision = d;
      if (d === 'sancionar') {
        s.stateWorld.presidentApproval = clamp(s.stateWorld.presidentApproval + x.support * 1.2);
        f.mood = clamp(f.mood + 1);
        x.outcome = 'Sancionado — virou lei.';
      } else {
        const v = congressVote(s, rng, -x.slant, -x.support, 'VETO');
        const override = 513 - v.yes >= 257 && next(rng) < 0.6;
        s.stateWorld.presidentApproval = clamp(s.stateWorld.presidentApproval - x.support * 1.2);
        if (override) { f.mood = clamp(f.mood - 4); x.outcome = 'Veto DERRUBADO pelo Congresso em sessão conjunta (CF art. 66 §4º) — virou lei mesmo assim.'; }
        else x.outcome = 'Veto mantido.';
      }
      out.push(`"${x.title}": ${x.outcome}`);
    }
    if (f.sanctions.length > 30) f.sanctions.splice(0, f.sanctions.length - 30);
    if (next(rng) < 0.55) {
      const tpl = pick(rng, TEMPLATES_FOR_SANCTION);
      f.sanctions.push({ id: `sc_${t}`, title: tpl.title, summary: tpl.summary, support: tpl.support, slant: tpl.slant, salience: tpl.salience, decision: null, month: { ...s.month } });
      out.push(`O Congresso aprovou "${tpl.title}" e enviou para sanção. Você tem até o fim do mês para sancionar ou vetar (CF art. 66 §1º: 15 dias úteis).`);
    }
  }

  // Aprovação do governo: economia, áreas e lua de mel (PROPOSTA).
  const p = s.stateWorld.president;
  const honeymoon = t - mi({ year: p.since, month: 1 }) < 6 ? 6 : 0;
  const idxAvg = Object.values(f.indices).reduce((a, b) => a + b, 0) / 6;
  const target = 46 + (6 - ec.unemployment) * 3.5 + (4 - ec.inflation) * 3 + (ec.growth - 2) * 2 + (idxAvg - 50) * 1.0 + honeymoon;
  s.stateWorld.presidentApproval = clamp(s.stateWorld.presidentApproval + (target - s.stateWorld.presidentApproval) * 0.08 + normal(rng, 0, 0.8));
  if (playerIsPresident(s) && s.player.mandate) s.player.mandate.approval = s.stateWorld.presidentApproval;

  // Aprovação por região do jogador presidente segue a do governo com vieses regionais.
  if (playerIsPresident(s) && s.national) {
    for (const r of BR_REGIONS) {
      const pr = s.national.player[r];
      pr.approval = clamp(pr.approval + (s.stateWorld.presidentApproval + f.regionBias[r] - pr.approval) * 0.15);
      pr.recognition = Math.max(pr.recognition, 85);
    }
  }

  // Ministros (IA): escândalos ocasionais, mais comuns com pouca competência.
  for (const m of MINISTRIES) {
    const seat = f.cabinet[m.id];
    if (!seat || seat.isPlayer) continue;
    if (next(rng) < 0.004 + (60 - seat.competence) / 6000) {
      seat.scandal = true;
      s.stateWorld.presidentApproval = clamp(s.stateWorld.presidentApproval - 2);
      out.push(`Escândalo no ${m.name}: denúncias contra ${seat.name} (personagem do jogo). ${playerIsPresident(s) ? 'Você pode trocar o(a) ministro(a).' : ''}`);
      if (!playerIsPresident(s) && next(rng) < 0.6) { f.cabinet[m.id] = newMinisterName(s, rng, seat.partyId, 'politico'); out.push(`${seat.name} deixou o ${m.name}.`); }
    }
  }

  // Jogador ministro: relação com o presidente e risco de demissão.
  const ms = playerMinistry(s);
  if (ms && !p.isPlayer) {
    const def = ministryById(ms.ministry)!;
    const areaIdx = def.area in f.indices ? f.indices[def.area as FedIndex] : 50 + (ec.growth - 2) * 5;
    ms.performance = clamp(ms.performance + (areaIdx - 50) * 0.02 - 0.3);
    ms.relationPresident = clamp(ms.relationPresident + (ms.performance - 50) * 0.02 + (f.coalition.includes(s.player.partyId ?? '') ? 0.1 : -0.4));
    if (s.player.mandate) s.player.mandate.approval = clamp(s.player.mandate.approval + (ms.performance - s.player.mandate.approval) * 0.05);
    if (s.player.mandate?.office === 'ministro' && (ms.relationPresident < 22 || (ms.performance < 25 && next(rng) < 0.25))) {
      out.push(`${p.name} exonerou você do ${def.name}. ${leaveMinistry(s, 'Exoneração pelo(a) presidente (CF art. 84, I).')}`);
    }
  }

  // Reforma ministerial do presidente personagem do jogo (anual, em abril) — e chance de convite.
  if (!p.isPlayer && s.month.month === 4 && t - f.lastReshuffle >= 12) {
    f.lastReshuffle = t;
    const weak = MINISTRIES.filter((m) => { const c = f.cabinet[m.id]; return c && !c.isPlayer && (c.competence < 50 || c.scandal); }).slice(0, 3);
    for (const m of weak) f.cabinet[m.id] = newMinisterName(s, rng, f.coalition.length ? pick(rng, f.coalition) : p.partyId, 'politico');
    if (weak.length) out.push(`Reforma ministerial: ${p.name} troca ${weak.length} ministro(s) (${weak.map((m) => m.name.replace('Ministério d', '').replace(/^[aoe]s? /, '')).join(', ')}).`);
    out.push(...ministerInvite(s, rng, 'reforma'));
  }

  // Jogador vice: substituições e, raramente, sucessão por vacância (CF arts. 79 e 80).
  if (playerIsVice(s) && !p.isPlayer && f.vice?.isPlayer) {
    if (s.stateWorld.presidentApproval < 18 && f.base.camara < 172 && next(rng) < 0.03) {
      out.push(`O Congresso afastou ${p.name} num processo de impeachment (simulação). Você assume a Presidência da República (CF art. 79).`);
      s.flags.assumiuPresidencia = true;
    }
  }

  // Impeachment do jogador presidente: exige crime de responsabilidade (aqui: pedalada ou vantagem indevida provada).
  if (playerIsPresident(s)) {
    const crime = Number(s.flags.pedalada ?? 0) > 0 || Number(s.flags.vantagemIndevida ?? 0) > 0;
    const imp = f.impeachment;
    if (!imp.stage && crime && s.stateWorld.presidentApproval < 28 && f.mood < 40 && next(rng) < 0.12) {
      imp.stage = 'denuncia'; imp.since = t;
      out.push('Denúncia por crime de responsabilidade é aceita na Câmara (Lei 1.079/50). A votação no plenário exige 342 votos para autorizar o processo.');
    } else if (imp.stage === 'denuncia' && t - (imp.since ?? t) >= 2) {
      const support = congressVote(s, rng, 0, -0.5, 'PL');
      const against = 513 - support.yes;
      if (against >= 342) { imp.stage = 'afastado'; imp.since = t; out.push(`A Câmara autorizou o processo de impeachment (${against} votos). O Senado instaura o julgamento e você é afastado(a) por até 180 dias (CF art. 86 §1º, II).`); }
      else { imp.stage = null; f.mood = clamp(f.mood - 3); out.push(`A Câmara barrou o impeachment: só ${against} votos a favor (eram necessários 342).`); }
    } else if (imp.stage === 'afastado' && t - (imp.since ?? t) >= 4) {
      const senAgainst = Math.round(81 - f.base.senado * (0.7 + f.mood / 300));
      if (senAgainst >= 54) { out.push(`O Senado condenou você por crime de responsabilidade (${senAgainst} votos de 81, eram necessários 54): perda do cargo e inabilitação por oito anos (CF art. 52, parágrafo único).`); s.flags.impeachment = true; s.flags.cassado = true; }
      else { imp.stage = null; out.push(`O Senado absolveu você (${senAgainst} votos pela condenação, eram necessários 54). Você volta ao cargo.`); }
    }
  }
  if (f.log.length > 50) f.log.splice(0, f.log.length - 50);
  return out;
}

/** Resumo para o topo e para a página do governo federal. */
export function cabinetAverage(f: FederalState) {
  const xs = Object.values(f.cabinet).filter(Boolean) as CabinetSeat[];
  return xs.length ? xs.reduce((a, c) => a + c.competence, 0) / xs.length : 0;
}

export const FEDERAL_RULES = [
  '[REAL] Presidente e vice: chapa única, maioria absoluta com 2º turno (CF art. 77), 35 anos (CF art. 14 §3º, VI, "a"), posse em 5/1 (CF art. 82), uma reeleição (CF art. 14 §5º).',
  '[REAL] Para disputar outro cargo, o presidente renuncia seis meses antes (CF art. 14 §6º); para a reeleição, não precisa sair.',
  '[REAL] Vice substitui o presidente nos impedimentos (viagens, por exemplo) e sucede na vaga (CF art. 79).',
  '[REAL] Ministros: maiores de 21 anos, livre nomeação e exoneração (CF arts. 84, I, e 87). Para disputar eleição, deixam o cargo seis meses antes (LC 64/90, art. 1º, II, "a", 1).',
  '[REAL] Deputado ou senador nomeado ministro não perde o mandato: fica licenciado e o suplente assume (CF art. 56, I).',
  '[REAL] Medida provisória: vale de imediato, por 60 + 60 dias; se não for aprovada, perde a eficácia (CF art. 62).',
  '[REAL] Sanção ou veto em 15 dias úteis; veto derrubado por maioria absoluta de deputados e senadores (CF art. 66).',
  '[REAL] Impeachment por crime de responsabilidade (Lei 1.079/50): Câmara autoriza por 2/3 (342), Senado condena por 2/3 (54).',
  '[REAL] O Banco Central é autônomo (LC 179/2021): o presidente não decide a Selic.',
  '[REAL] Subsídio de presidente, vice e ministros: R$ 46.366,19 (Decreto Legislativo 172/2022).',
  '[SIMPLIFICAÇÃO] 13 ministérios principais (estrutura de 2026); o governo real tem cerca de 38 pastas.',
  '[PROPOSTA] Ações das pastas, orçamentos discricionários, índices de área, humor do Congresso, efeitos econômicos e riscos são mecânicas de jogo. O governo do presidente real em exercício não é simulado por dentro.',
];

export function vicePresidentTakesOver(s: GameState): string {
  const w = s.stateWorld;
  const f = s.federal!;
  const m = s.player.mandate!;
  m.office = 'presidente';
  m.upper = null;
  w.president = { id: 'character_player', name: s.character.name, partyId: s.player.partyId!, real: false, since: w.president.since, until: w.president.until, consecutiveTerms: 1, isPlayer: true };
  f.vice = null;
  if (s.player.mandate?.minister) leaveMinistry(s, 'Você assumiu a Presidência.');
  delete s.flags.assumiuPresidencia;
  return 'Você é agora Presidente da República até o fim do mandato (CF art. 79). Quem sucede o titular exerce o mandato: você pode disputar a reeleição uma única vez (CF art. 14 §5º).';
}

export { mi as federalMonthIndex };
export type { Mandate };
