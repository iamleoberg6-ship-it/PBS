// Indicadores sociais (Fase 9): cidade de São Paulo (com as 8 regiões do jogo), estado de SP e Brasil.
//
// Valores de PARTIDA são dados reais, com fonte e ano (ver INDICATORS). Daí em diante a evolução é SIMULAÇÃO:
//   valor = tendência de fundo × (1 ∓ melhora estrutural ∓ contribuição do jogador)
// · tendência de fundo: variação anual parametrizada (PARÂMETRO);
// · melhora estrutural: desempenho das secretarias da prefeitura (cidade), índices do governo estadual quando o
//   jogador governa (estado) e índices do governo federal + economia (Brasil) — modelos que já existiam no jogo;
// · contribuição do jogador: "impulsos" gerados por indicações atendidas, emendas executadas e leis aprovadas,
//   que entram aos poucos e perdem força devagar se não forem renovados (PROPOSTA).
// A desigualdade entre as regiões da capital é PARÂMETRO (inspirada no Mapa da Desigualdade da Rede Nossa São Paulo).

import { REGIONS, regionWeights } from '../data/regions';
import { REGION_ZONE, SUBPREF_DATA, ZONE_COMMUTE } from '../data/subprefeituras';
import { stateGovIndices } from './govprofile';
import { monthIndex } from '../calendar';
import type { GameState } from './types';

export type Sphere = 'cidade' | 'estado' | 'brasil';
export interface IndicatorDef {
  id: string;
  sphere: Sphere;
  label: string;
  unit: string;
  better: 'up' | 'down';
  base: number;
  /** Ano do dado de partida e fonte. */
  year: number;
  source: string;
  /** Variação anual de fundo (proporcional; para indicadores em %, pontos percentuais se `additive`). */
  trend: number;
  additive?: boolean;
  max?: number;
  decimals: number;
  /** Quem tem a competência principal (contexto real). */
  competence: string;
  /** Como o jogador influencia (texto da página). */
  levers: string;
}

export const INDICATORS: IndicatorDef[] = [
  // ---------------- Cidade de São Paulo ----------------
  { id: 'c_mortinf', sphere: 'cidade', label: 'Mortalidade infantil', unit: 'por mil nascidos vivos', better: 'down', base: 10.0, year: 2025, source: 'SMS-SP, Boletim CEInfo por Subprefeitura (2026)', trend: -0.01, decimals: 1, competence: 'Atenção básica e pré-natal: município (SUS)', levers: 'Indicações e emendas de saúde, leis de saúde, Secretaria da Saúde' },
  { id: 'c_ideb', sphere: 'cidade', label: 'Ideb anos iniciais (rede municipal)', unit: 'nota 0–10', better: 'up', base: 5.6, year: 2023, source: 'Inep (Ideb 2023)', trend: 0.004, max: 10, decimals: 1, competence: 'Ensino fundamental I: rede municipal', levers: 'Indicações e emendas de educação, leis de educação, Secretaria da Educação' },
  { id: 'c_homic', sphere: 'cidade', label: 'Homicídios', unit: 'por 100 mil hab. (padronizado por idade)', better: 'down', base: 5.1, year: 2024, source: 'SMS-SP, Boletim CEInfo por Subprefeitura (2026), dados do SIM', trend: -0.02, decimals: 1, competence: 'Polícias: governo do estado. A GCM municipal ajuda na prevenção', levers: 'Ações de segurança/GCM, Segurança Urbana municipal; mais forte pelo governo do estado' },
  { id: 'c_esgoto', sphere: 'cidade', label: 'Domicílios urbanos com coleta de esgoto', unit: '%', better: 'up', base: 89.1, year: 2024, source: 'Cetesb / SMDU-Deinfo (Prefeitura de SP)', trend: 0.4, additive: true, max: 99.5, decimals: 1, competence: 'Concessão de saneamento (Sabesp) com o município e o estado', levers: 'Emendas e indicações de infraestrutura/zeladoria, leis de meio ambiente' },
  { id: 'c_poprua', sphere: 'cidade', label: 'Pessoas em situação de rua (CadÚnico)', unit: 'pessoas', better: 'down', base: 93355, year: 2025, source: 'CadÚnico, jan/2025 (via OBPopRua/UFMG). O censo da prefeitura de 2021 contou 31.884, com outro método', trend: 0.02, decimals: 0, competence: 'Assistência social e habitação: município, com estado e União', levers: 'Indicações e emendas de assistência/habitação, leis de habitação, Secretarias de Assistência e Habitação' },
  { id: 'c_desloc', sphere: 'cidade', label: 'Tempo diário em deslocamentos', unit: 'minutos (ida e volta)', better: 'down', base: 145, year: 2024, source: 'Rede Nossa SP / Ipec, Viver em São Paulo: Mobilidade Urbana 2024 (pesquisa de opinião)', trend: 0, decimals: 0, competence: 'Ônibus municipais e trânsito: prefeitura; metrô e trens: governo do estado', levers: 'Indicações, emendas e leis de mobilidade; Secretaria de Mobilidade e Trânsito; transporte metropolitano (estado)' },
  { id: 'c_transito', sphere: 'cidade', label: 'Mortes no trânsito', unit: 'por 100 mil hab.', better: 'down', base: 4.3, year: 2024, source: 'Ministério da Saúde, SIM/DataSUS (via Observatório da Saúde Pública/Umane)', trend: 0.01, decimals: 1, competence: 'Engenharia e fiscalização do trânsito: prefeitura (CET); policiamento rodoviário: estado', levers: 'Leis e ações de mobilidade, Secretaria de Mobilidade e Trânsito' },
  { id: 'c_cultura', sphere: 'cidade', label: 'Moradores sem nenhuma atividade cultural no ano', unit: '%', better: 'down', base: 24, year: 2017, source: 'Rede Nossa SP / Ibope, Viver em São Paulo: Cultura (dez/2017; edição mais recente com esse recorte)', trend: 0.005, decimals: 0, competence: 'Equipamentos e programação culturais: prefeitura (CEUs, casas de cultura), estado e União', levers: 'Indicações, emendas e leis de cultura; Secretaria de Cultura' },
  // ---------------- Estado de São Paulo ----------------
  { id: 'e_mortinf', sphere: 'estado', label: 'Mortalidade infantil', unit: 'por mil nascidos vivos', better: 'down', base: 11.45, year: 2024, source: 'Fundação Seade', trend: -0.01, decimals: 1, competence: 'Hospitais e rede regional: estado; atenção básica: municípios', levers: 'Projetos e emendas de saúde na Alesp; programas do governador' },
  { id: 'e_ideb', sphere: 'estado', label: 'Ideb anos iniciais (todas as redes)', unit: 'nota 0–10', better: 'up', base: 6.5, year: 2023, source: 'Inep (Ideb 2023)', trend: 0.004, max: 10, decimals: 1, competence: 'Redes municipais e estadual', levers: 'Projetos e emendas de educação; programas do governador' },
  { id: 'e_homic', sphere: 'estado', label: 'Homicídios', unit: 'por 100 mil hab.', better: 'down', base: 6.6, year: 2024, source: 'Atlas da Violência 2026 (Ipea/FBSP)', trend: -0.02, decimals: 1, competence: 'Polícias Civil e Militar: governo do estado', levers: 'Projetos de segurança na Alesp; programas do governador' },
  { id: 'e_desemp', sphere: 'estado', label: 'Taxa de desocupação', unit: '%', better: 'down', base: 5.0, year: 2025, source: 'IBGE, PNAD Contínua (média anual)', trend: 0, decimals: 1, competence: 'Economia: principalmente União; o estado influencia investimento e qualificação', levers: 'Segue a economia nacional; projetos de emprego e economia' },
  { id: 'e_esgoto', sphere: 'estado', label: 'Domicílios ligados à rede de esgoto', unit: '%', better: 'up', base: 94.1, year: 2024, source: 'IBGE, PNAD Contínua 2024', trend: 0.3, additive: true, max: 99.5, decimals: 1, competence: 'Concessão estadual (Sabesp) e municípios', levers: 'Emendas de infraestrutura; programas do governador' },
  { id: 'e_transito', sphere: 'estado', label: 'Mortes no trânsito', unit: 'por 100 mil hab.', better: 'down', base: 11.7, year: 2024, source: 'Atlas da Violência 2026 (Ipea/FBSP)', trend: 0.01, decimals: 1, competence: 'Rodovias estaduais, Detran e polícia rodoviária: estado; vias urbanas: municípios', levers: 'Projetos de transporte e segurança viária; programas de transporte do governador' },
  { id: 'e_cultura', sphere: 'estado', label: 'Pessoas sem nenhuma atividade cultural no ano', unit: '%', better: 'down', base: 26, year: 2025, source: 'Fundação Seade, pesquisa de oferta e uso dos serviços de cultura', trend: 0, decimals: 0, competence: 'Estado (equipamentos estaduais, fomento) e municípios', levers: 'Projetos e emendas de cultura' },
  // ---------------- Brasil ----------------
  { id: 'b_mortinf', sphere: 'brasil', label: 'Mortalidade infantil', unit: 'por mil nascimentos', better: 'down', base: 12.5, year: 2023, source: 'IBGE, Tábua de Mortalidade 2023', trend: -0.015, decimals: 1, competence: 'SUS: União, estados e municípios', levers: 'Ministério da Saúde, emendas de saúde, projetos no Congresso' },
  { id: 'b_ideb', sphere: 'brasil', label: 'Ideb anos iniciais', unit: 'nota 0–10', better: 'up', base: 6.0, year: 2023, source: 'Inep (Ideb 2023)', trend: 0.004, max: 10, decimals: 1, competence: 'Redes municipais; a União financia (Fundeb) e coordena', levers: 'Ministério da Educação, emendas de educação' },
  { id: 'b_mvi', sphere: 'brasil', label: 'Mortes violentas intencionais', unit: 'por 100 mil hab.', better: 'down', base: 19.1, year: 2025, source: 'Anuário Brasileiro de Segurança Pública 2026 (FBSP)', trend: -0.02, decimals: 1, competence: 'Polícias: estados; a União coordena e financia', levers: 'Ministério da Justiça e Segurança Pública, projetos de segurança' },
  { id: 'b_desemp', sphere: 'brasil', label: 'Taxa de desocupação', unit: '%', better: 'down', base: 5.6, year: 2025, source: 'IBGE, PNAD Contínua (média anual)', trend: 0, decimals: 1, competence: 'Política econômica: União (o Banco Central é autônomo)', levers: 'Segue a economia simulada do governo federal' },
  { id: 'b_pobreza', sphere: 'brasil', label: 'População na pobreza (US$ 6,85 PPC/dia)', unit: '%', better: 'down', base: 23.1, year: 2024, source: 'IBGE, Síntese de Indicadores Sociais 2025', trend: -0.01, decimals: 1, competence: 'Transferência de renda: União; emprego e renda', levers: 'Ministério do Desenvolvimento Social, emprego, emendas de assistência' },
  { id: 'b_extrema', sphere: 'brasil', label: 'Extrema pobreza (US$ 2,15 PPC/dia)', unit: '%', better: 'down', base: 3.5, year: 2024, source: 'IBGE, Síntese de Indicadores Sociais 2025', trend: -0.01, decimals: 1, competence: 'Bolsa Família e assistência: União com municípios', levers: 'Ministério do Desenvolvimento Social, emendas de assistência' },
  { id: 'b_transito', sphere: 'brasil', label: 'Mortes no trânsito', unit: 'por 100 mil hab.', better: 'down', base: 17.5, year: 2024, source: 'Atlas da Violência 2026 (Ipea/FBSP)', trend: 0.015, decimals: 1, competence: 'Rodovias federais (PRF, DNIT) e coordenação nacional (Senatran); estados e municípios nas suas vias', levers: 'Ministério dos Transportes, emendas de infraestrutura, projetos de trânsito' },
  { id: 'b_cultura', sphere: 'brasil', label: 'Sem atividade cultural presencial em 12 meses', unit: '%', better: 'down', base: 12, year: 2026, source: 'Observatório Fundação Itaú / Datafolha, Hábitos Culturais (7ª ed.): 88% fizeram ao menos uma', trend: 0, decimals: 0, competence: 'Ministério da Cultura (fomento, Lei Rouanet, Política Nacional Aldir Blanc), estados e municípios', levers: 'Emendas e projetos de cultura' },
  { id: 'b_esgoto', sphere: 'brasil', label: 'Domicílios ligados à rede de esgoto', unit: '%', better: 'up', base: 70.4, year: 2024, source: 'IBGE, PNAD Contínua 2024', trend: 0.5, additive: true, max: 99.5, decimals: 1, competence: 'Concessões municipais/estaduais; a União financia e regula (Marco Legal, Lei 14.026/2020: meta de 90% até 2033)', levers: 'Ministério das Cidades, emendas de infraestrutura' },
];
export const indicatorById = (id: string) => INDICATORS.find((i) => i.id === id);

/** Temas das ações → indicadores que elas movem (por esfera). */
const THEME_MAP: Record<string, string[]> = {
  saude: ['mortinf'], 'saúde': ['mortinf'],
  educacao: ['ideb'], 'educação': ['ideb'],
  gcm: ['homic'], seguranca: ['homic', 'mvi'],
  habitacao: ['poprua', 'pobreza'], 'assistência social': ['poprua', 'pobreza', 'extrema'], assistencia: ['poprua', 'pobreza', 'extrema'], social: ['pobreza', 'extrema', 'poprua'],
  zeladoria: ['esgoto'], meioambiente: ['esgoto'], infraestrutura: ['esgoto'],
  economia: ['desemp'],
  mobilidade: ['desloc', 'transito'], infraestrutura_viaria: ['transito'],
  cultura: ['cultura'],
};
const PREFIX: Record<Sphere, string> = { cidade: 'c_', estado: 'e_', brasil: 'b_' };
export function themeIndicators(sphere: Sphere, theme: string): string[] {
  return (THEME_MAP[theme] ?? []).map((k) => `${PREFIX[sphere]}${k}`).filter((id) => !!indicatorById(id));
}

// ---------------- Estado ----------------

export interface Impulse { ind: string; region: string | null; pct: number; left: number; source: string }
export interface IndicatorsState {
  /** Melhora acumulada atribuída ao jogador, em % do valor (positivo = melhor), por indicador. */
  mine: Record<string, number>;
  /** Idem por região da capital (indicadores da cidade). */
  mineRegion: Record<string, Record<string, number>>;
  /** Melhora estrutural do mês (secretarias/índices), em %. */
  structural: Record<string, number>;
  pending: Impulse[];
  /** Ids já convertidos em impulso (leis, emendas). */
  seen: string[];
  /** Valores no fim de cada ano. */
  history: { year: number; values: Record<string, number> }[];
}

export function initIndicators(): IndicatorsState {
  return { mine: {}, mineRegion: {}, structural: {}, pending: [], seen: [], history: [] };
}

const years = (s: GameState) => (monthIndex(s.month) - monthIndex({ year: 2027, month: 1 })) / 12;

function trendValue(s: GameState, d: IndicatorDef): number {
  const y = years(s) + (2027 - d.year) * 0.5; // metade da tendência entre o dado e 2027 (ponto de partida conservador)
  return d.additive ? d.base + d.trend * y : d.base * Math.pow(1 + d.trend, y);
}
function apply(d: IndicatorDef, v: number, improvePct: number): number {
  const out = d.better === 'down' ? v * (1 - improvePct / 100) : d.additive || d.unit === '%' ? v + (d.max !== undefined ? (d.max - v) : v) * (improvePct / 100) : v * (1 + improvePct / 100);
  return Math.max(0, d.max !== undefined ? Math.min(d.max, out) : out);
}

/** Valor atual do indicador (cidade, estado ou Brasil). */
export function indicatorValue(s: GameState, id: string): number {
  const d = indicatorById(id)!;
  const st = s.indicators;
  if (id === 'b_desemp') return s.federal?.economy.unemployment ?? d.base;
  if (id === 'e_desemp') return Math.max(1, (s.federal?.economy.unemployment ?? 5.6) * (5.0 / 5.6) * (1 - (st?.mine[id] ?? 0) / 100));
  const imp = (st?.structural[id] ?? 0) + (st?.mine[id] ?? 0);
  return apply(d, trendValue(s, d), imp);
}

/** Desigualdade entre as regiões da capital (PARÂMETRO). */
const INCOME_FACTOR: Record<string, { down: number; ideb: number; esgoto: number }> = {
  alta: { down: 0.7, ideb: 0.4, esgoto: 7 },
  'média': { down: 1.0, ideb: 0, esgoto: 2 },
  baixa: { down: 1.3, ideb: -0.35, esgoto: -6 },
};
export const REGIONAL_IDS = ['c_mortinf', 'c_homic', 'c_desloc', 'c_ideb', 'c_esgoto', 'c_cultura'];
/** Indicadores com dado regional REAL (subprefeituras ou zonas); os demais usam o parâmetro de renda. */
export const REGIONAL_REAL = new Set(['c_mortinf', 'c_homic', 'c_desloc']);

/** Média por região do jogo, ponderada pela população das subprefeituras (Censo 2022). */
export function regionBaseReal(id: string, regionId: string): number | null {
  const r = REGIONS.find((x) => x.id === regionId);
  if (!r) return null;
  if (id === 'c_desloc') return ZONE_COMMUTE[REGION_ZONE[regionId]] ?? null;
  const key = id === 'c_mortinf' ? 'mortinf' : id === 'c_homic' ? 'homic' : null;
  if (!key) return null;
  let w = 0, sum = 0;
  for (const sp of r.subprefeituras) { const d = SUBPREF_DATA[sp.name]; if (d) { sum += d[key] * sp.pop2022; w += sp.pop2022; } }
  return w ? sum / w : null;
}
export function regionalValue(s: GameState, id: string, regionId: string): number {
  const d = indicatorById(id)!;
  const r = REGIONS.find((x) => x.id === regionId);
  const f = INCOME_FACTOR[r?.income ?? 'média'] ?? INCOME_FACTOR['média'];
  const city = indicatorValue(s, id);
  const extra = s.indicators?.mineRegion[regionId]?.[id] ?? 0;
  const real = regionBaseReal(id, regionId);
  const v = real !== null ? real * (city / d.base) : id === 'c_ideb' ? city + f.ideb : id === 'c_esgoto' ? city + f.esgoto : city * f.down;
  return apply(d, Math.max(0, d.max !== undefined ? Math.min(d.max, v) : v), extra);
}
/** Valor de uma subprefeitura (dado real × evolução da cidade × efeito do jogador na região). */
export function subprefValue(s: GameState, id: 'c_mortinf' | 'c_homic', name: string, regionId: string): number | null {
  const d = indicatorById(id)!;
  const sp = SUBPREF_DATA[name];
  if (!sp) return null;
  const base = id === 'c_mortinf' ? sp.mortinf : sp.homic;
  return apply(d, base * (indicatorValue(s, id) / d.base), s.indicators?.mineRegion[regionId]?.[id] ?? 0);
}

// ---------------- Impulsos do jogador ----------------

/** Registra um efeito do jogador sobre os indicadores (entra aos poucos em `months`). `pct` = melhora total, em % do valor. */
export function addImpulse(s: GameState, sphere: Sphere, theme: string, pct: number, months: number, source: string, region: string | null = null): string[] {
  const st = (s.indicators ??= initIndicators());
  const ids = themeIndicators(sphere, theme);
  for (const ind of ids) st.pending.push({ ind, region: sphere === 'cidade' ? region : null, pct: pct / ids.length, left: Math.max(1, months), source });
  return ids;
}

const AREA_TO_THEME: Record<string, string> = { 'saúde': 'saude', 'educação': 'educacao', infraestrutura: 'infraestrutura', 'assistência social': 'assistencia' };

/** Leis e emendas do jogador viram impulsos (uma vez cada). */
function harvest(s: GameState): void {
  const st = s.indicators!;
  const seen = new Set(st.seen);
  const mark = (k: string) => { seen.add(k); st.seen.push(k); };
  for (const b of s.legislature?.bills ?? []) {
    if (b.author !== 'character_player' || b.stage !== 'lei' || seen.has(`bill_${b.id}`)) continue;
    mark(`bill_${b.id}`);
    const pct = b.kind === 'programa' ? 2.2 : b.kind === 'regulacao' ? 0.9 : 0;
    if (pct) addImpulse(s, 'cidade', b.theme, pct, 12, `Lei ${b.number}`);
  }
  const m = s.player.mandate;
  const u = m?.upper;
  if (!m || !u) return;
  u.amendments.forEach((a, i) => {
    const k = `am_${a.month.year}_${a.month.month}_${a.region}_${a.theme}_${a.value}_${i}`;
    if (!a.paid || seen.has(k)) return;
    mark(k);
    const theme = AREA_TO_THEME[a.theme] ?? a.theme;
    const label = `${a.kind === 'indicacao' ? 'Verba pedida' : 'Emenda'} de R$ ${a.value} mi (${a.theme})`;
    if (a.region.startsWith('br_')) addImpulse(s, 'brasil', theme, Math.min(1.5, a.value / 60), 8, label);
    else {
      addImpulse(s, 'cidade', theme, Math.min(4, a.value / 4), 8, label, a.region);
      if (m.office === 'deputado_estadual') addImpulse(s, 'estado', theme, Math.min(1, a.value / 40), 8, label);
    }
  });
  for (const b of u.bills) {
    const k = `ub_${b.id}`;
    if (b.status !== 'aprovado' || seen.has(k)) continue;
    mark(k);
    const sphere: Sphere = m.office === 'deputado_estadual' ? 'estado' : 'brasil';
    addImpulse(s, sphere, b.theme, sphere === 'estado' ? 1.2 : 0.6, 12, `Lei aprovada: ${b.title}`);
  }
  if (st.seen.length > 600) st.seen = st.seen.slice(-400);
}

/** Desempenho de uma secretaria municipal em relação ao início: média das variações (positivo = melhor), limitada a ±40%. */
function secProgress(s: GameState, portfolio: string): number {
  const sec = s.player.mandate?.secretariat?.portfolio === portfolio ? s.player.mandate.secretariat : s.city?.secretariats[portfolio];
  if (!sec) return 0;
  const parts = sec.indicators.filter((i) => i.start > 0).map((i) => ((i.value - i.start) / i.start) * (i.better === 'up' ? 1 : -1));
  if (!parts.length) return 0;
  return Math.max(-0.4, Math.min(0.4, parts.reduce((a, b) => a + b, 0) / parts.length));
}
const idx = (v: number | undefined) => ((v ?? 50) - 50) / 50;

function structural(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  // Cidade: secretarias municipais (prefeito da IA ou do jogador; secretário do jogador). Elasticidades: PARÂMETRO.
  out.c_mortinf = secProgress(s, 'saude') * 25;
  out.c_ideb = secProgress(s, 'educacao') * 12;
  out.c_homic = secProgress(s, 'seguranca') * 8;
  out.c_esgoto = (secProgress(s, 'subprefeituras') + secProgress(s, 'meioambiente')) * 6;
  out.c_poprua = (secProgress(s, 'assistencia') + secProgress(s, 'habitacao') * 0.5) * 20;
  out.c_desloc = secProgress(s, 'mobilidade') * 12;
  out.c_transito = secProgress(s, 'mobilidade') * 15;
  out.c_cultura = secProgress(s, 'cultura') * 15;
  // Estado: índices do governo estadual quando o jogador governa; senão, só a tendência.
  // Estado: índices do governo estadual — do jogador governador, ou do governador personagem do jogo (perfil ideológico).
  const ind = s.player.mandate?.upper?.stateIndicators ?? stateGovIndices(s);
  if (ind) {
    out.e_mortinf = idx(ind.saude) * 12;
    out.e_ideb = idx(ind.educacao) * 8;
    out.e_homic = idx(ind.seguranca) * 15;
    out.e_esgoto = idx(ind.habitacao) * 4;
    out.e_transito = idx(ind.mobilidade) * 10;
    out.c_desloc += idx(ind.mobilidade) * 8;
    // A segurança do estado também chega à capital.
    out.c_homic += idx(ind.seguranca) * 12;
  }
  // Brasil: índices do governo federal (personagem do jogo ou jogador).
  const f = s.federal?.indices;
  if (f) {
    out.b_mortinf = idx(f.saude) * 12;
    out.b_ideb = idx(f.educacao) * 8;
    out.b_mvi = idx(f.seguranca) * 15;
    out.b_pobreza = idx(f.social) * 15 + ((5.6 - (s.federal?.economy.unemployment ?? 5.6)) * 2);
    out.b_extrema = idx(f.social) * 25;
    out.b_esgoto = idx(f.infraestrutura) * 6;
    out.b_transito = idx(f.infraestrutura) * 8;
    out.b_cultura = idx(f.social) * 5;
  }
  return out;
}

/** Passo mensal. Retorna notas para o log (efeitos do jogador que começaram a aparecer). */
export function indicatorsMonthlyStep(s: GameState): string[] {
  const st = (s.indicators ??= initIndicators());
  const notes: string[] = [];
  harvest(s);
  st.structural = structural(s);
  // Contribuições perdem força devagar sem renovação (PROPOSTA: ~0,6% ao mês).
  for (const k of Object.keys(st.mine)) st.mine[k] *= 0.994;
  for (const r of Object.keys(st.mineRegion)) for (const k of Object.keys(st.mineRegion[r])) st.mineRegion[r][k] *= 0.994;
  const w = regionWeights();
  let monthGain = 0;
  const regionGain: Record<string, number> = {};
  const bySource = new Map<string, number>();
  for (const p of st.pending) {
    const step = p.pct / p.left;
    p.pct -= step;
    p.left -= 1;
    if (p.region) {
      const rr = (st.mineRegion[p.region] ??= {});
      rr[p.ind] = (rr[p.ind] ?? 0) + step;
      st.mine[p.ind] = (st.mine[p.ind] ?? 0) + step * (w[p.region] ?? 0.125);
      regionGain[p.region] = (regionGain[p.region] ?? 0) + step;
    } else st.mine[p.ind] = (st.mine[p.ind] ?? 0) + step;
    monthGain += step;
    bySource.set(p.source, (bySource.get(p.source) ?? 0) + step);
  }
  const finished = st.pending.filter((p) => p.left <= 0);
  st.pending = st.pending.filter((p) => p.left > 0);
  for (const p of finished) {
    const d = indicatorById(p.ind)!;
    notes.push(`${p.source}: efeito completo em ${d.label.toLowerCase()}${p.region ? ` (${REGIONS.find((r) => r.id === p.region)?.name})` : ''}.`);
  }
  // Retorno político: quem melhora a vida no seu território é lembrado (PROPOSTA).
  const m = s.player.mandate;
  if (m && monthGain > 0) {
    m.approval = Math.min(100, m.approval + Math.min(1.5, monthGain * 0.5));
    s.player.recognition = Math.min(100, s.player.recognition + Math.min(0.5, monthGain * 0.1));
    for (const [r, g] of Object.entries(regionGain)) {
      const gw = s.player.regionalGoodwill;
      if (gw) gw[r] = Math.min(100, (gw[r] ?? 0) + g * 1.5);
    }
  }
  if (s.month.month === 12) {
    st.history.push({ year: s.month.year, values: Object.fromEntries(INDICATORS.map((d) => [d.id, round(indicatorValue(s, d.id), d.decimals)])) });
    if (st.history.length > 12) st.history.shift();
  }
  return notes;
}

const round = (v: number, dec: number) => Math.round(v * 10 ** dec) / 10 ** dec;

/** Variação desde a partida em % (positivo = melhor). */
export function indicatorChange(s: GameState, id: string): number {
  const d = indicatorById(id)!;
  const v = indicatorValue(s, id);
  if (!d.base) return 0;
  return ((v - d.base) / d.base) * 100 * (d.better === 'up' ? 1 : -1);
}
/** Parte da mudança atribuída ao jogador, nas unidades do indicador. */
export function playerEffect(s: GameState, id: string): number {
  const d = indicatorById(id)!;
  const v = indicatorValue(s, id);
  const st = s.indicators;
  if (!st) return 0;
  const without = apply(d, trendValue(s, d), st.structural[id] ?? 0);
  if (id === 'b_desemp' || id === 'e_desemp') return 0;
  return v - without;
}
/** Esferas que o mandato atual do jogador afeta mais diretamente. */
export function playerSphere(s: GameState): Sphere {
  const o = s.player.mandate?.office ?? '';
  if (['deputado_federal', 'senador', 'presidente', 'vice_presidente', 'ministro'].includes(o)) return 'brasil';
  if (['deputado_estadual', 'governador', 'secretario_estadual'].includes(o)) return 'estado';
  return 'cidade';
}

export const INDICATOR_RULES = [
  'Dados de partida: fontes oficiais com ano indicado (IBGE, Inep, Seade, SSP-SP, Ipea/FBSP, Cetesb, CadÚnico).',
  'Daqui para frente, a evolução é SIMULAÇÃO do jogo: tendência de fundo (PARÂMETRO) + desempenho dos governos simulados + o que você faz.',
  'Indicações atendidas, emendas executadas e leis aprovadas geram efeito gradual (meses) no tema e na região; sem renovação, perdem força devagar (PROPOSTA).',
  'Cada indicador mostra quem tem a competência real: vereador não comanda a polícia, e prefeito não define a taxa de juros.',
  'Por região da capital: mortalidade infantil e homicídios vêm dos dados oficiais das 32 subprefeituras (SMS-SP/CEInfo), agregados pela população; tempo de deslocamento vem da pesquisa Viver em SP por zona. Ideb, esgoto e cultura por região ainda usam um PARÂMETRO de renda.',
  'Melhoras no seu território rendem aprovação do mandato, reconhecimento e simpatia regional (PROPOSTA).',
];
