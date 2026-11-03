// Secretarias municipais jogáveis (Fase 2).
//
// [REAL] Secretário municipal é cargo de livre nomeação e exoneração do prefeito (CF art. 37 II; LOM-SP).
// [REAL] Contratações seguem a Lei 14.133/2021 (licitação), com controle do Tribunal de Contas do Município de SP.
// Orçamentos: Saúde, Educação e Assistência ancorados no PLOA 2026 (ver data/spfinance.ts); demais áreas são estimativas;
// os indicadores sociais partem de valores SIMULADOS e plausíveis, rotulados como tal; custos e prazos de programas
// são parâmetros de jogo.

import { next, normal, pick, type RngState } from '../rng';
import { ideologicalDistance, partyIdeology, EXPERT_SCALE } from '../data/ideology';
import { listIdForParty } from '../data/parties';
import type { GameState, ProfessionId, SecIndicator, SecProgram, Secretariat } from './types';
import { AREA_BASE_2027, type AreaKey } from '../data/spfinance';
import { areaFunding } from './municipality';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

interface IndicatorDef { key: string; label: string; unit: string; start: number; better: 'up' | 'down'; drift: number; min?: number; max?: number }
interface ProgramDef { id: string; label: string; cost: number; plan: number; lic: number; exec: number; effects: Record<string, number>; note: string }
interface CrisisDef { id: string; label: string; effects: Record<string, number> }
export interface PortfolioDef {
  id: string;
  name: string;
  budget: number; // R$ milhões/ano — ordem de grandeza simulada
  fit: ProfessionId[];
  indicators: IndicatorDef[];
  programs: ProgramDef[];
  special: { id: string; label: string; description: string; cost: number; effects: Record<string, number>; approval: number; risk?: string };
  crises: CrisisDef[];
}

/**
 * Pressão de demanda e de visibilidade de cada pasta (PARÂMETRO de balanceamento, Fase 4):
 * pastas grandes e essenciais têm demanda crescente, mais crises e cobrança pública maior.
 */
export const PRESSURE: Record<string, number> = { saude: 1.7, educacao: 1.5, mobilidade: 1.5, subprefeituras: 1.3, seguranca: 1.3, assistencia: 1.2, habitacao: 1.2, cultura: 1, esportes: 1, meioambiente: 1 };
export const pressureOf = (id: string) => PRESSURE[id] ?? 1;

export const PORTFOLIOS: PortfolioDef[] = [
  {
    id: 'saude', name: 'Saúde', budget: AREA_BASE_2027.saude.total, fit: ['medico', 'servidor', 'economista'],
    indicators: [
      { key: 'espera', label: 'Espera por consulta na atenção básica', unit: 'dias', start: 28, better: 'down', drift: 0.25, min: 3 },
      { key: 'esf', label: 'Cobertura da Saúde da Família', unit: '%', start: 52, better: 'up', drift: -0.05, max: 100 },
      { key: 'satisf', label: 'Satisfação com as UBS', unit: '/100', start: 48, better: 'up', drift: -0.15, max: 100 },
    ],
    programs: [
      { id: 'ubs_novas', label: 'Construir 6 novas UBS', cost: 180, plan: 2, lic: 3, exec: 8, effects: { esf: 4, espera: -4, satisf: 4 }, note: 'Obra: sujeita a atrasos e aditivos.' },
      { id: 'equipes_esf', label: 'Contratar 40 equipes de Saúde da Família', cost: 90, plan: 1, lic: 2, exec: 4, effects: { esf: 6, espera: -3 }, note: 'Contratação por chamamento/concurso.' },
      { id: 'telemed', label: 'Teleconsulta na rede básica', cost: 35, plan: 1, lic: 2, exec: 3, effects: { espera: -5, satisf: 2 }, note: 'Tecnologia: risco de falhas na implantação.' },
    ],
    special: { id: 'mutirao_consultas', label: 'Mutirão de consultas e exames', description: 'Força-tarefa aos sábados nas UBS com maior fila. Alívio rápido, efeito temporário.', cost: 12, effects: { espera: -3, satisf: 1.5 }, approval: 2 },
    crises: [
      { id: 'dengue', label: 'Surto de dengue lota as UBS', effects: { espera: 6, satisf: -5 } },
      { id: 'falta_medico', label: 'Falta de médicos em UBS da periferia', effects: { espera: 4, esf: -2 } },
    ],
  },
  {
    id: 'educacao', name: 'Educação', budget: AREA_BASE_2027.educacao.total, fit: ['professor', 'servidor'],
    indicators: [
      { key: 'fila_creche', label: 'Fila de vagas em creche', unit: 'crianças', start: 12000, better: 'down', drift: 120, min: 0 },
      { key: 'aprend', label: 'Índice de aprendizagem (escala do jogo)', unit: '/10', start: 5.6, better: 'up', drift: -0.005, max: 10 },
      { key: 'evasao', label: 'Abandono no fundamental II', unit: '%', start: 2.8, better: 'down', drift: 0.01, min: 0 },
    ],
    programs: [
      { id: 'creches_conv', label: 'Ampliar convênios de creche (3 mil vagas)', cost: 120, plan: 1, lic: 2, exec: 4, effects: { fila_creche: -3000 }, note: 'Rede conveniada: rápida, mas exige fiscalização.' },
      { id: 'cei_novos', label: 'Construir 10 CEIs', cost: 200, plan: 2, lic: 3, exec: 9, effects: { fila_creche: -2500, aprend: 0.1 }, note: 'Obra: sujeita a atrasos.' },
      { id: 'reforco', label: 'Reforço escolar no contraturno', cost: 60, plan: 1, lic: 1, exec: 5, effects: { aprend: 0.35, evasao: -0.5 }, note: 'Depende de professores disponíveis.' },
    ],
    special: { id: 'busca_ativa', label: 'Busca ativa escolar', description: 'Equipes visitam famílias de alunos faltosos com a assistência social.', cost: 6, effects: { evasao: -0.25 }, approval: 1 },
    crises: [
      { id: 'merenda', label: 'Problemas na entrega da merenda escolar', effects: { aprend: -0.05 } },
      { id: 'greve', label: 'Greve de professores da rede municipal', effects: { aprend: -0.15, evasao: 0.3 } },
    ],
  },
  {
    id: 'mobilidade', name: 'Mobilidade e Trânsito', budget: AREA_BASE_2027.mobilidade.total, fit: ['engenheiro', 'economista', 'servidor'],
    indicators: [
      { key: 'viagem', label: 'Tempo médio de viagem de ônibus', unit: 'min', start: 52, better: 'down', drift: 0.12, min: 20 },
      { key: 'veloc', label: 'Velocidade média nos corredores', unit: 'km/h', start: 17, better: 'up', drift: -0.03, max: 30 },
      { key: 'mortes', label: 'Mortes no trânsito', unit: 'por 100 mil hab.', start: 6.5, better: 'down', drift: 0.02, min: 1 },
    ],
    programs: [
      { id: 'corredor', label: 'Novo corredor de ônibus (12 km)', cost: 450, plan: 2, lic: 3, exec: 10, effects: { viagem: -4, veloc: 2.5 }, note: 'Obra grande: desapropriações e atrasos são comuns.' },
      { id: 'faixas', label: 'Programa de faixas exclusivas', cost: 25, plan: 1, lic: 1, exec: 2, effects: { veloc: 1.5, viagem: -1.5 }, note: 'Barato e rápido; desagrada motoristas.' },
      { id: 'vida_transito', label: 'Redução de velocidade e travessias seguras', cost: 40, plan: 1, lic: 2, exec: 3, effects: { mortes: -0.8 }, note: 'Costuma gerar críticas no início.' },
    ],
    special: { id: 'operacao_corredores', label: 'Operação de fiscalização nos corredores', description: 'Agentes de trânsito e remoção de obstáculos nos horários de pico.', cost: 3, effects: { veloc: 0.5, viagem: -0.5 }, approval: 1 },
    crises: [
      { id: 'greve_onibus', label: 'Paralisação de motoristas de ônibus', effects: { viagem: 5 } },
      { id: 'acidente', label: 'Acidente grave em avenida reacende debate sobre velocidade', effects: { mortes: 0.3 } },
    ],
  },
  {
    id: 'habitacao', name: 'Habitação', budget: AREA_BASE_2027.habitacao.total, fit: ['engenheiro', 'lider_comunitario', 'advogado'],
    indicators: [
      { key: 'unidades', label: 'Moradias entregues no mandato', unit: 'unidades', start: 0, better: 'up', drift: 0, min: 0 },
      { key: 'risco', label: 'Famílias em área de risco', unit: 'mil', start: 40, better: 'down', drift: 0.05, min: 0 },
      { key: 'titulos', label: 'Títulos de regularização fundiária', unit: 'títulos', start: 0, better: 'up', drift: 0, min: 0 },
    ],
    programs: [
      { id: 'conjunto', label: 'Conjunto habitacional (1.200 unidades)', cost: 240, plan: 3, lic: 3, exec: 12, effects: { unidades: 1200, risco: -1.5 }, note: 'Obra longa; pode atravessar o mandato.' },
      { id: 'regulariza', label: 'Mutirão de regularização fundiária', cost: 20, plan: 1, lic: 1, exec: 4, effects: { titulos: 5000 }, note: 'Barato; depende de cartórios e da Justiça.' },
      { id: 'locacao', label: 'Locação social para famílias removidas', cost: 50, plan: 1, lic: 2, exec: 3, effects: { risco: -3 }, note: 'Despesa contínua.' },
    ],
    special: { id: 'vistoria_risco', label: 'Vistoria preventiva em áreas de risco', description: 'Mapeia encostas e margens de córregos antes das chuvas.', cost: 4, effects: { risco: -0.8 }, approval: 1, risk: 'Reduz a chance de crise nas chuvas.' },
    crises: [
      { id: 'deslizamento', label: 'Deslizamento após temporal deixa famílias desabrigadas', effects: { risco: 2 } },
      { id: 'reintegracao', label: 'Reintegração de posse tensa em ocupação', effects: { risco: 1 } },
    ],
  },
  {
    id: 'assistencia', name: 'Assistência e Desenvolvimento Social', budget: AREA_BASE_2027.assistencia.total, fit: ['lider_comunitario', 'servidor', 'professor'],
    indicators: [
      { key: 'acolhidos', label: 'População de rua acolhida', unit: '%', start: 45, better: 'up', drift: -0.1, max: 100 },
      { key: 'cras', label: 'Famílias atendidas nos CRAS', unit: 'mil/mês', start: 60, better: 'up', drift: -0.05, min: 0 },
      { key: 'espera_acolhida', label: 'Espera por vaga em centro de acolhida', unit: 'dias', start: 9, better: 'down', drift: 0.05, min: 0 },
    ],
    programs: [
      { id: 'centros', label: 'Abrir 8 centros de acolhida', cost: 70, plan: 1, lic: 2, exec: 4, effects: { acolhidos: 6, espera_acolhida: -4 }, note: 'Imóveis alugados: vizinhança costuma resistir.' },
      { id: 'moradia_primeiro', label: 'Moradia Primeiro (500 vagas)', cost: 45, plan: 2, lic: 2, exec: 4, effects: { acolhidos: 4 }, note: 'Modelo com evidência internacional; caro por pessoa.' },
      { id: 'cras_ampliar', label: 'Ampliar equipes dos CRAS', cost: 30, plan: 1, lic: 1, exec: 3, effects: { cras: 12 }, note: 'Contratação de equipes técnicas.' },
    ],
    special: { id: 'abordagem', label: 'Abordagem social noturna', description: 'Equipes oferecem vagas e encaminhamento nas noites frias.', cost: 3, effects: { acolhidos: 1.5 }, approval: 1.5 },
    crises: [
      { id: 'frio', label: 'Onda de frio aumenta procura por acolhimento', effects: { espera_acolhida: 4, acolhidos: -2 } },
      { id: 'cracolandia', label: 'Tensão em cena de uso de drogas no centro', effects: { acolhidos: -1.5 } },
    ],
  },
  {
    id: 'cultura', name: 'Cultura', budget: AREA_BASE_2027.cultura.total, fit: ['jornalista', 'influenciador', 'professor'],
    indicators: [
      { key: 'publico', label: 'Público nos equipamentos culturais', unit: 'mil/mês', start: 380, better: 'up', drift: -1, min: 0 },
      { key: 'fomento', label: 'Projetos culturais fomentados no mandato', unit: 'projetos', start: 0, better: 'up', drift: 0, min: 0 },
      { key: 'equip_ok', label: 'Equipamentos culturais funcionando', unit: '%', start: 85, better: 'up', drift: -0.1, max: 100 },
    ],
    programs: [
      { id: 'edital', label: 'Edital de fomento à cultura de periferia', cost: 30, plan: 1, lic: 2, exec: 3, effects: { fomento: 400, publico: 15 }, note: 'Seleção pública por edital.' },
      { id: 'reforma_ceus', label: 'Reformar teatros e centros culturais', cost: 80, plan: 2, lic: 3, exec: 6, effects: { equip_ok: 8, publico: 30 }, note: 'Obra.' },
      { id: 'bibliotecas', label: 'Bibliotecas abertas à noite e aos domingos', cost: 15, plan: 1, lic: 1, exec: 2, effects: { publico: 25 }, note: 'Depende de servidores.' },
    ],
    special: { id: 'virada_bairros', label: 'Festival cultural nos bairros', description: 'Shows e oficinas em praças da periferia. Muita visibilidade.', cost: 8, effects: { publico: 40 }, approval: 2 },
    crises: [
      { id: 'teatro_interditado', label: 'Teatro municipal de bairro é interditado', effects: { equip_ok: -4 } },
    ],
  },
  {
    id: 'esportes', name: 'Esportes e Lazer', budget: AREA_BASE_2027.esportes.total, fit: ['influenciador', 'professor', 'policial'],
    indicators: [
      { key: 'participantes', label: 'Participantes em programas esportivos', unit: 'mil', start: 90, better: 'up', drift: -0.2, min: 0 },
      { key: 'centros_ok', label: 'Centros esportivos em boas condições', unit: '%', start: 60, better: 'up', drift: -0.15, max: 100 },
      { key: 'eventos', label: 'Eventos esportivos no mandato', unit: 'eventos', start: 0, better: 'up', drift: 0, min: 0 },
    ],
    programs: [
      { id: 'reforma_ces', label: 'Reformar 15 clubes-escola e centros esportivos', cost: 45, plan: 1, lic: 3, exec: 5, effects: { centros_ok: 10, participantes: 8 }, note: 'Obra.' },
      { id: 'escolinhas', label: 'Escolinhas esportivas gratuitas', cost: 20, plan: 1, lic: 1, exec: 3, effects: { participantes: 15 }, note: 'Contratação de professores.' },
    ],
    special: { id: 'jogos_bairros', label: 'Jogos dos bairros', description: 'Campeonato de várzea e esportes de rua com transmissão nas redes.', cost: 4, effects: { eventos: 1, participantes: 4 }, approval: 1.5 },
    crises: [
      { id: 'piscina', label: 'Acidente em piscina de centro esportivo', effects: { centros_ok: -4 } },
    ],
  },
  {
    id: 'meioambiente', name: 'Verde e Meio Ambiente', budget: AREA_BASE_2027.meioambiente.total, fit: ['engenheiro', 'agricultor', 'estudante'],
    indicators: [
      { key: 'verde', label: 'Área verde por habitante', unit: 'm²', start: 12, better: 'up', drift: -0.005, min: 0 },
      { key: 'arvores', label: 'Árvores plantadas no mandato', unit: 'mil', start: 0, better: 'up', drift: 0, min: 0 },
      { key: 'quedas', label: 'Chamados de poda e queda de árvores em aberto', unit: 'mil', start: 6, better: 'down', drift: 0.04, min: 0 },
    ],
    programs: [
      { id: 'parques', label: 'Implantar 3 parques lineares', cost: 120, plan: 2, lic: 3, exec: 8, effects: { verde: 0.4 }, note: 'Desapropriação e obra.' },
      { id: 'plantio', label: 'Plano de plantio de 50 mil árvores', cost: 25, plan: 1, lic: 2, exec: 6, effects: { arvores: 50, verde: 0.1 }, note: 'Depende de viveiros e manutenção.' },
      { id: 'poda', label: 'Contrato emergencial de manejo arbóreo', cost: 30, plan: 1, lic: 1, exec: 3, effects: { quedas: -3 }, note: 'Contratação emergencial é fiscalizada de perto pelo TCM.' },
    ],
    special: { id: 'mutirao_plantio', label: 'Mutirão de plantio com moradores', description: 'Ação com escolas e associações de bairro.', cost: 2, effects: { arvores: 4 }, approval: 1 },
    crises: [
      { id: 'queda_arvores', label: 'Ventania derruba centenas de árvores e deixa bairros sem luz', effects: { quedas: 3 } },
    ],
  },
  {
    id: 'subprefeituras', name: 'Subprefeituras (zeladoria)', budget: AREA_BASE_2027.subprefeituras.total, fit: ['lider_comunitario', 'empresario', 'engenheiro'],
    indicators: [
      { key: 'buracos', label: 'Buracos tapados no prazo', unit: '%', start: 55, better: 'up', drift: -0.2, max: 100 },
      { key: 'pedidos', label: 'Pedidos de zeladoria em aberto', unit: 'mil', start: 35, better: 'down', drift: 0.4, min: 0 },
      { key: 'pontos_lixo', label: 'Pontos viciados de descarte de lixo', unit: 'pontos', start: 2600, better: 'down', drift: 8, min: 0 },
    ],
    programs: [
      { id: 'recapeamento', label: 'Programa de recapeamento de vias', cost: 300, plan: 1, lic: 3, exec: 6, effects: { buracos: 12, pedidos: -6 }, note: 'Contratos grandes; atenção a sobrepreço.' },
      { id: 'ecopontos', label: 'Novos ecopontos e câmeras em pontos de descarte', cost: 25, plan: 1, lic: 2, exec: 3, effects: { pontos_lixo: -600 }, note: 'Precisa de fiscalização contínua.' },
      { id: 'app_zeladoria', label: 'Novo sistema de pedidos de zeladoria', cost: 12, plan: 1, lic: 2, exec: 2, effects: { pedidos: -5 }, note: 'Tecnologia.' },
    ],
    special: { id: 'tapa_buraco', label: 'Operação tapa-buraco', description: 'Mutirão das subprefeituras nas vias com mais reclamações.', cost: 6, effects: { buracos: 4, pedidos: -2 }, approval: 1.5 },
    crises: [
      { id: 'enchente', label: 'Temporal entope bueiros e alaga avenidas', effects: { pedidos: 6, pontos_lixo: 150 } },
    ],
  },
  {
    id: 'seguranca', name: 'Segurança Urbana', budget: AREA_BASE_2027.seguranca.total, fit: ['policial', 'advogado', 'servidor'],
    indicators: [
      { key: 'patrulha', label: 'Efetivo da GCM em patrulhamento', unit: '%', start: 60, better: 'up', drift: -0.1, max: 100 },
      { key: 'furtos', label: 'Furtos em áreas monitoradas (índice do jogo)', unit: '/100', start: 60, better: 'down', drift: 0.1, min: 0 },
      { key: 'resposta', label: 'Tempo de resposta da GCM', unit: 'min', start: 18, better: 'down', drift: 0.03, min: 4 },
    ],
    programs: [
      { id: 'cameras', label: 'Ampliar rede municipal de câmeras', cost: 60, plan: 1, lic: 3, exec: 4, effects: { furtos: -6, resposta: -2 }, note: 'Debate sobre privacidade e reconhecimento facial.' },
      { id: 'concurso_gcm', label: 'Concurso para 1.000 guardas civis', cost: 70, plan: 2, lic: 3, exec: 6, effects: { patrulha: 10, resposta: -2 }, note: 'Concurso e formação demoram.' },
      { id: 'bases', label: 'Bases comunitárias da GCM em praças', cost: 20, plan: 1, lic: 2, exec: 3, effects: { furtos: -3 }, note: 'Visibilidade alta.' },
    ],
    special: { id: 'operacao_gcm', label: 'Operação da GCM em áreas comerciais', description: 'Reforço de patrulha em centros comerciais de bairro.', cost: 3, effects: { furtos: -2 }, approval: 1, risk: 'Abordagens podem gerar denúncia de excesso.' },
    crises: [
      { id: 'abordagem', label: 'Vídeo de abordagem violenta da GCM viraliza', effects: { patrulha: -2 } },
    ],
  },
];

export const portfolioById = (id: string) => PORTFOLIOS.find((p) => p.id === id || p.name === id);

export const SEC_RULES = [
  '[REAL] Secretário municipal é cargo de livre nomeação e exoneração do prefeito.',
  '[REAL] Contratações passam por licitação (Lei 14.133/2021) e são fiscalizadas pelo Tribunal de Contas do Município.',
  '[REAL/ESTIMATIVA] Orçamento da pasta vem da LOA do jogo: Saúde, Educação e Assistência ancorados no PLOA 2026; as demais áreas são estimativas do jogo.',
  '[FICÇÃO] Indicadores começam em valores simulados plausíveis; não são estatísticas oficiais.',
  '[PARÂMETRO] Custos, prazos, atrasos, crises e risco de exoneração são parâmetros de jogo.',
];

/** Fração do orçamento anual disponível para novos programas (o resto é custeio comprometido). PARÂMETRO. */
export const DISCRETIONARY_SHARE = 0.04;

// ---------------- Convite ----------------
/** Afinidade política entre o partido do jogador e o do prefeito eleito: só há convite se fizer sentido. */
export function inviteAffinity(s: GameState, winnerPartyId: string): { ok: boolean; reason: string } {
  const pp = s.player.partyId;
  if (!pp) return { ok: false, reason: 'Sem partido.' };
  if (listIdForParty(pp) === listIdForParty(winnerPartyId)) return { ok: true, reason: 'Seu partido disputou a eleição na mesma chapa/federação do prefeito eleito.' };
  if (s.player.candidacy?.coalitionPartyIds?.includes(winnerPartyId)) return { ok: true, reason: 'Seu partido apoiou o prefeito eleito.' };
  const d = ideologicalDistance(partyIdeology(pp), partyIdeology(winnerPartyId));
  const a = EXPERT_SCALE[pp]?.value;
  const b = EXPERT_SCALE[winnerPartyId]?.value;
  if (d !== null && d <= 0.15 && a !== null && a !== undefined && b !== null && b !== undefined) return { ok: true, reason: `Partidos ideologicamente próximos (${a.toFixed(1)} e ${b.toFixed(1)} na escala de especialistas): o prefeito busca ampliar a base.` };
  return { ok: false, reason: 'Sem relação política ou ideológica com o prefeito eleito.' };
}

/** Pastas oferecidas, ordenadas pela afinidade com a profissão e os atributos. */
export function offeredPortfolios(s: GameState, n = 3): PortfolioDef[] {
  const prof = s.character.profession;
  const a = s.character.attributes;
  const scored = PORTFOLIOS.map((p) => ({ p, w: (p.fit.includes(prof) ? 3 : 0) + a.management / 40 + (p.budget > 5000 ? (a.management - 50) / 25 + (s.player.recognition - 20) / 20 : 0.5) }));
  scored.sort((x, y) => y.w - x.w);
  return scored.slice(0, n).map((x) => x.p);
}

// ---------------- Estado ----------------
export function createSecretariat(portfolioId: string): Secretariat {
  const def = portfolioById(portfolioId) ?? PORTFOLIOS[0];
  return {
    portfolio: def.id, name: def.name, budget: def.budget, executed: 0, capacity: 45, relationCouncil: 45,
    indicators: def.indicators.map((i): SecIndicator => ({ key: i.key, label: i.label, unit: i.unit, value: i.start, start: i.start, better: i.better })),
    programs: [], extraSpent: 0, monthsInOffice: 0, crisis: null, lowMonths: 0, lastActionNote: null,
  };
}

/** Orçamento livre: fatia discricionária do ano menos programas ainda não entregues e ações pontuais. */
export const freeBudget = (sec: Secretariat) => Math.round(sec.budget * DISCRETIONARY_SHARE - sec.programs.filter((p) => p.phase !== 'cancelado' && p.phase !== 'entregue').reduce((a, p) => a + p.cost, 0) - sec.extraSpent);

export function applyEffects(sec: Secretariat, effects: Record<string, number>, scale = 1) {
  const def = portfolioById(sec.portfolio)!;
  for (const [k, v] of Object.entries(effects)) {
    const ind = sec.indicators.find((i) => i.key === k);
    const d = def.indicators.find((i) => i.key === k);
    if (!ind) continue;
    let nv = ind.value + v * scale;
    if (d?.min !== undefined) nv = Math.max(d.min, nv);
    if (d?.max !== undefined) nv = Math.min(d.max, nv);
    ind.value = Math.round(nv * 100) / 100;
  }
}

/** Desempenho da pasta −1..+1: melhora relativa dos indicadores frente ao ponto de partida. */
export function performance(sec: Secretariat): number {
  const vals = sec.indicators.map((i) => {
    const ref = Math.max(Math.abs(i.start), i.unit === '%' || i.unit === '/100' ? 20 : i.start === 0 ? 1 : Math.abs(i.start));
    let rel: number;
    if (i.start === 0) rel = i.value > 0 ? Math.min(1, Math.log10(1 + i.value) / 3.5) : 0;
    else rel = ((i.value - i.start) / ref) * (i.better === 'up' ? 1 : -1) * 2.5;
    return Math.max(-1, Math.min(1, rel));
  });
  return vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
}

// ---------------- Ações ----------------
export function startProgram(s: GameState, programId: string): string {
  const sec = s.player.mandate?.secretariat;
  if (!sec) return 'Sem secretaria.';
  const def = portfolioById(sec.portfolio)!.programs.find((p) => p.id === programId);
  if (!def) return 'Programa desconhecido.';
  if (sec.programs.some((p) => p.id === def.id && p.phase !== 'cancelado' && p.phase !== 'entregue')) return 'Esse programa já está em andamento.';
  if (freeBudget(sec) < def.cost) return `Orçamento livre insuficiente (R$ ${freeBudget(sec)} mi; o programa custa R$ ${def.cost} mi). Dispute suplementação com a Fazenda.`;
  const prog: SecProgram = { id: def.id, label: def.label, phase: 'planejamento', monthsLeft: def.plan, cost: def.cost, effects: def.effects, delayed: false };
  sec.programs.push(prog);
  s.player.recognition = clamp(s.player.recognition + 0.8);
  return `Programa lançado: ${def.label} (R$ ${def.cost} mi). Fase de planejamento: ${def.plan} mês(es); depois licitação e execução.`;
}

export function superviseProgram(s: GameState, rng: RngState, programId: string): string {
  const sec = s.player.mandate?.secretariat;
  const p = sec?.programs.find((x) => x.id === programId && ['planejamento', 'licitacao', 'execucao'].includes(x.phase));
  if (!sec || !p) return 'Não há programa em andamento com esse nome.';
  const m = s.character.attributes.management;
  if (next(rng) < 0.4 + m / 200 + sec.capacity / 300) {
    p.monthsLeft = Math.max(0, p.monthsLeft - 1);
    p.delayed = false;
    s.character.attributes.management = clamp(m + 0.6);
    return `Você destravou etapas de "${p.label}": prazo encurtado em 1 mês.`;
  }
  s.character.attributes.management = clamp(m + 0.3);
  return `Você acompanhou "${p.label}", mas o gargalo (${p.phase === 'licitacao' ? 'recursos de licitantes' : p.phase === 'execucao' ? 'ritmo da empreiteira' : 'projeto técnico'}) não se resolveu este mês.`;
}

export function specialAction(s: GameState, rng: RngState): string {
  const sec = s.player.mandate?.secretariat;
  if (!sec) return 'Sem secretaria.';
  const def = portfolioById(sec.portfolio)!;
  const sp = def.special;
  if (freeBudget(sec) < sp.cost) return `Sem orçamento livre para a ação (custa R$ ${sp.cost} mi).`;
  sec.executed += sp.cost;
  sec.extraSpent += sp.cost; // gasto pontual sai do orçamento livre
  const q = 0.7 + sec.capacity / 200 + normal(rng, 0, 0.15);
  applyEffects(sec, sp.effects, q);
  s.player.mandate!.approval = clamp(s.player.mandate!.approval + (sp.approval * q) / pressureOf(def.id));
  s.player.recognition = clamp(s.player.recognition + 1);
  let extra = '';
  if (sp.id === 'operacao_gcm' && next(rng) < 0.15) { s.player.mandate!.approval = clamp(s.player.mandate!.approval - 3); extra = ' Uma abordagem durante a operação gerou denúncia de excesso.'; }
  if (sp.id === 'vistoria_risco') s.flags.vistoriaRisco = monthIndexOf(s);
  const eff = Object.entries(sp.effects).map(([k, v]) => `${sec.indicators.find((i) => i.key === k)?.label.toLowerCase()} ${v * q > 0 ? '+' : ''}${fmt(v * q)}`).join('; ');
  return `${sp.label}: ${eff}.${extra}`;
}
const monthIndexOf = (s: GameState) => s.month.year * 12 + s.month.month - 1;
const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('pt-BR') : (Math.round(v * 10) / 10).toLocaleString('pt-BR'));

export function disputeBudget(s: GameState, rng: RngState): string {
  const m = s.player.mandate!;
  const sec = m.secretariat!;
  const p = 0.25 + s.character.attributes.negotiation / 200 + m.relationExecutive / 300 + (performance(sec) > 0 ? 0.1 : 0);
  if (next(rng) < p) {
    const add = Math.round(sec.budget * 0.03);
    sec.budget += add;
    m.relationExecutive = clamp(m.relationExecutive - 3);
    return `A Fazenda liberou suplementação de R$ ${add.toLocaleString('pt-BR')} mi para a pasta. Algum atrito com o núcleo do governo.`;
  }
  m.relationExecutive = clamp(m.relationExecutive - 7);
  return 'Pedido de suplementação negado; a disputa gerou desgaste com a Fazenda e o gabinete do prefeito.';
}

export function meetCouncillors(s: GameState): string {
  const m = s.player.mandate!;
  const sec = m.secretariat!;
  sec.relationCouncil = clamp(sec.relationCouncil + 6);
  m.relationExecutive = clamp(m.relationExecutive + 1);
  s.character.attributes.articulation = clamp(s.character.attributes.articulation + 1);
  return 'Você recebeu vereadores da base e da oposição e atendeu pedidos para os bairros. Relação com a Câmara +6.';
}

export function trainTeam(s: GameState): string {
  const sec = s.player.mandate!.secretariat!;
  sec.capacity = clamp(sec.capacity + 6 * Math.pow(1 - sec.capacity / 100, 0.8));
  return `Você reorganizou a equipe técnica e nomeou quadros experientes. Capacidade da equipe: ${Math.round(sec.capacity)}/100.`;
}

export function pressConference(s: GameState, rng: RngState): string {
  const m = s.player.mandate!;
  const sec = m.secretariat!;
  const perf = performance(sec);
  const comm = s.character.attributes.communication;
  const delta = (perf * 4 + (comm - 50) / 30 + normal(rng, 0, 1) - (sec.crisis ? 2 : 0)) / Math.sqrt(pressureOf(sec.portfolio));
  m.approval = clamp(m.approval + delta);
  s.player.recognition = clamp(s.player.recognition + 1.5);
  return delta >= 0 ? `Coletiva de imprensa: você apresentou resultados da pasta. Aprovação ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}.` : `Coletiva de imprensa difícil: jornalistas cobraram ${sec.crisis ? sec.crisis.label.toLowerCase() : 'indicadores que não melhoraram'}. Aprovação ${delta.toFixed(1)}.`;
}

export function manageCrisis(s: GameState, rng: RngState): string {
  const m = s.player.mandate!;
  const sec = m.secretariat!;
  if (!sec.crisis) return 'Não há crise em curso.';
  const p = 0.35 + s.character.attributes.management / 200 + sec.capacity / 250;
  if (next(rng) < p) {
    const c = sec.crisis;
    sec.crisis = null;
    m.approval = clamp(m.approval + 2);
    m.relationExecutive = clamp(m.relationExecutive + 3);
    return `Gabinete de crise: "${c.label}" foi controlada. O prefeito elogiou a resposta.`;
  }
  sec.crisis.monthsLeft = Math.max(1, sec.crisis.monthsLeft - 1);
  return 'Você montou gabinete de crise, mas a situação ainda não está sob controle.';
}

// ---------------- Passo mensal ----------------
export interface CoreStepResult { notes: string[]; delivered: number; crisisStarted: boolean; crisisSeverity: number }

/**
 * Passo mensal de uma pasta, comum ao jogador e às secretarias da IA.
 * funding = orçamento da área na LOA ÷ orçamento de referência (1 = mantido; < 1 = corte; > 1 = reforço).
 */
export function stepSecretariatCore(sec: Secretariat, rng: RngState, opts: { funding?: number; crisisShield?: boolean } = {}): CoreStepResult {
  const def = portfolioById(sec.portfolio)!;
  const res: CoreStepResult = { notes: [], delivered: 0, crisisStarted: false, crisisSeverity: 0 };
  const funding = opts.funding ?? 1;
  const fundingDrift = Math.max(0.4, Math.min(3, 1 + (1 - funding) * 2.5));
  // Pressão natural sobre os indicadores (demanda cresce, equipamentos envelhecem); cortes aceleram, reforço freia.
  const pressure = pressureOf(def.id);
  for (const d of def.indicators) if (d.drift) applyEffects(sec, { [d.key]: d.drift * (1.2 - sec.capacity / 100) * fundingDrift * pressure });
  for (const p of sec.programs) {
    if (!['planejamento', 'licitacao', 'execucao'].includes(p.phase)) continue;
    const pd = def.programs.find((x) => x.id === p.id)!;
    if (p.phase === 'execucao') sec.executed += p.cost / Math.max(1, pd.exec);
    p.monthsLeft--;
    if (p.monthsLeft > 0) continue;
    if (p.phase === 'planejamento') { p.phase = 'licitacao'; p.monthsLeft = pd.lic; res.notes.push(`"${p.label}": edital publicado; começa a licitação.`); continue; }
    if (p.phase === 'licitacao') {
      if (next(rng) < 0.3 - sec.capacity / 400) { p.monthsLeft = 1 + Math.floor(next(rng) * 2); p.delayed = true; res.notes.push(`"${p.label}": licitação impugnada; o Tribunal de Contas pediu esclarecimentos. Atraso de ${p.monthsLeft} mês(es).`); continue; }
      p.phase = 'execucao'; p.monthsLeft = pd.exec; res.notes.push(`"${p.label}": contrato assinado; execução começa.`); continue;
    }
    if (p.phase === 'execucao') {
      if (next(rng) < 0.28 - sec.capacity / 450) {
        p.monthsLeft = 1 + Math.floor(next(rng) * 3); p.delayed = true;
        const over = Math.round(p.cost * 0.1);
        p.cost += over;
        res.notes.push(`"${p.label}": atraso na execução e aditivo de R$ ${over} mi.`);
        continue;
      }
      p.phase = 'entregue';
      applyEffects(sec, p.effects, 0.85 + sec.capacity / 400);
      res.delivered++;
      res.notes.push(`Entrega: "${p.label}" concluído.`);
    }
  }
  if (sec.crisis) {
    applyEffects(sec, Object.fromEntries(Object.entries(def.crises.find((c) => c.id === sec.crisis!.id)?.effects ?? {}).map(([k, v]) => [k, v * 0.25])));
    res.crisisSeverity = sec.crisis.severity;
    sec.crisis.monthsLeft--;
    if (sec.crisis.monthsLeft <= 0) { res.notes.push(`A crise "${sec.crisis.label}" saiu do noticiário.`); sec.crisis = null; }
  } else {
    let p = 0.06 * pressure * (funding < 0.9 ? 1.5 : 1);
    if (opts.crisisShield) p *= 0.4;
    if (next(rng) < p) {
      const c = pick(rng, def.crises);
      sec.crisis = { id: c.id, label: c.label, monthsLeft: 2 + Math.floor(next(rng) * 2), severity: 1 + Math.floor(next(rng) * 3) };
      applyEffects(sec, c.effects);
      res.crisisStarted = true;
      res.notes.push(`Crise na pasta de ${sec.name}: ${c.label}.`);
    }
  }
  sec.relationCouncil = clamp(sec.relationCouncil + (50 - sec.relationCouncil) * 0.04);
  return res;
}

export function secretariatMonthlyStep(s: GameState, rng: RngState): string[] {
  const m = s.player.mandate;
  const sec = m?.secretariat;
  if (!m || !sec) return [];
  const def = portfolioById(sec.portfolio)!;
  sec.monthsInOffice++;
  if (s.month.month === 1 && sec.monthsInOffice > 1) {
    sec.executed = 0; sec.extraSpent = 0;
    const loaBudget = s.city?.loa.areas[def.id as AreaKey];
    sec.budget = loaBudget ? Math.round(loaBudget) : Math.round(def.budget * (1 + (sec.budget / def.budget - 1) * 0.5));
  }
  const shield = def.id === 'habitacao' && typeof s.flags.vistoriaRisco === 'number' && monthIndexOf(s) - (s.flags.vistoriaRisco as number) < 6;
  const r = stepSecretariatCore(sec, rng, { funding: s.city ? areaFunding(s, def.id as AreaKey) : 1, crisisShield: shield });
  const out = r.notes.map((n) => (n.startsWith('Crise na pasta') ? `${n} Use "Gabinete de crise".` : n));
  const pr = pressureOf(def.id);
  m.approval = clamp(m.approval + (r.delivered * 3) / pr - r.crisisSeverity * 0.6 * pr - (r.crisisStarted ? 3 : 0));
  s.player.recognition = clamp(s.player.recognition + r.delivered * 2.5);
  if (r.crisisSeverity) m.relationExecutive = clamp(m.relationExecutive - 1);
  // Aprovação da pasta acompanha desempenho e relações.
  // Pastas de alta cobrança (Saúde, Educação, Mobilidade) partem de expectativa maior do público.
  const target = 45 + performance(sec) * 30 + (sec.relationCouncil - 50) / 10 - (sec.crisis ? 6 : 0) - (pr - 1) * 18;
  m.approval = clamp(m.approval + (target - m.approval) * 0.15 + normal(rng, 0, 0.8));
  m.relationExecutive = clamp(m.relationExecutive + (m.approval - 50) / 80 + (55 - m.relationExecutive) * 0.04);
  // Risco de exoneração (livre nomeação): relação ruim ou pasta mal avaliada por 3+ meses.
  if (m.relationExecutive < 25 || m.approval < 28) sec.lowMonths++; else sec.lowMonths = Math.max(0, sec.lowMonths - 1);
  if (sec.lowMonths >= 3 && next(rng) < 0.35) {
    out.push(`EXONERAÇÃO: o prefeito exonerou você da Secretaria de ${sec.name}.`);
    s.flags.exonerado = true;
  } else if (sec.lowMonths === 2) out.push('Bastidores: o gabinete do prefeito avalia trocar o comando da sua pasta.');
  return out;
}
