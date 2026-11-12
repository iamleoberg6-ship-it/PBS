// Mandatos estaduais e federais jogáveis (Fase 5.6): deputado(a) estadual, deputado(a) federal, senador(a),
// governador(a) e secretário(a) estadual.
//
// SIMPLIFICAÇÃO declarada: Alesp, Câmara dos Deputados e Senado NÃO têm tramitação simulada voto a voto como a
// Câmara Municipal (Fase 2). O mandato é abstrato: projetos têm prazo e chance de aprovação; emendas
// individuais destinam recursos a regiões da capital; a relação com o Executivo pesa em tudo.
// REGRA REAL citada: emendas individuais impositivas (CF art. 166 §§9º–11, EC 86/2015 e EC 126/2022),
// teto do subsídio de deputado estadual em 75% do federal (CF art. 27 §2º), mandatos (CF arts. 27, 44, 46, 28).
// Valores das emendas, chances e efeitos são PARÂMETROS de jogo.

import { next, normal, pick, type RngState } from '../rng';
import { REGIONS } from '../data/regions';
import { brName, isBrRegion, nationalAmendmentPaid } from './national';
import { partyById } from '../data/parties';
import { addGoodwill } from './campaign';
import { partyAlignment } from './general';
import type { GameState, Mandate, UpperMandate } from './types';
import { UPPER_COMMITTEES } from './legislativo';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

export const UPPER_SALARIES = {
  deputado_federal: { value: 46366.19, source: 'Subsídio de deputado federal e senador em 2025 (Decreto Legislativo 172/2022)', status: 'REGRA_REAL' },
  senador: { value: 46366.19, source: 'Subsídio de deputado federal e senador em 2025 (Decreto Legislativo 172/2022)', status: 'REGRA_REAL' },
  deputado_estadual: { value: 34774.64, source: '75% do subsídio federal (CF art. 27 §2º) — teto aplicado como valor do jogo', status: 'DERIVADA' },
  governador: { value: 35000, source: 'Valor de jogo: o subsídio do governador é fixado por lei estadual', status: 'PROPOSTA' },
  secretario_estadual: { value: 30000, source: 'Valor de jogo', status: 'PROPOSTA' },
} as const;

/** Cota ANUAL de emendas individuais impositivas por parlamentar (R$ milhões), valores de 2026 mantidos constantes. */
export const AMENDMENT_BUDGET: Record<string, number> = { deputado_estadual: 13, deputado_federal: 40, senador: 73 };
export const AMENDMENT_SOURCES: Record<string, { text: string; status: 'REGRA_REAL' | 'DERIVADA' }> = {
  deputado_estadual: { text: 'Alesp: os 94 deputados dividem 0,45% da receita corrente líquida do estado a cada ano — cerca de R$ 13 milhões por deputado em 2026 (InfoMoney/O Globo). O Executivo estadual paga devagar: só uma fração costuma ser liberada no ano.', status: 'DERIVADA' },
  deputado_federal: { text: 'LOA 2026: R$ 39,9 milhões por deputado federal em emendas individuais (CF art. 166 §§9º–11). Metade tem de ir para a saúde.', status: 'REGRA_REAL' },
  senador: { text: 'LOA 2026: R$ 72,8 milhões por senador em emendas individuais (CF art. 166 §§9º–11). Metade tem de ir para a saúde.', status: 'REGRA_REAL' },
};
/** Federal: metade das emendas individuais vai para ações e serviços de saúde (CF art. 166 §9º). */
export const healthShareRequired = (office: string) => office === 'deputado_federal' || office === 'senador';
export function amendmentYearTotals(u: UpperMandate, year: number) {
  const ys = u.amendments.filter((a) => a.month.year === year && (a.kind ?? 'individual') === 'individual');
  return { total: ys.reduce((x, a) => x + a.value, 0), health: ys.filter((a) => a.theme === 'saúde').reduce((x, a) => x + a.value, 0) };
}

export const UPPER_LABEL: Record<string, string> = {
  deputado_estadual: 'Deputado(a) estadual (Alesp)',
  deputado_federal: 'Deputado(a) federal por SP',
  senador: 'Senador(a) por SP',
  governador: 'Governador(a) de São Paulo',
  secretario_estadual: 'Secretário(a) estadual',
};

export const STATE_AREAS = [
  { id: 'seguranca', label: 'Segurança pública (polícias estaduais)' },
  { id: 'saude', label: 'Saúde (hospitais estaduais)' },
  { id: 'educacao', label: 'Educação (ensino médio estadual)' },
  { id: 'mobilidade', label: 'Metrô e trens metropolitanos' },
  { id: 'habitacao', label: 'Habitação (CDHU)' },
];

export const UPPER_THEMES = [
  { value: 'seguranca', label: 'Segurança pública' },
  { value: 'saude', label: 'Saúde' },
  { value: 'educacao', label: 'Educação' },
  { value: 'mobilidade', label: 'Transporte metropolitano' },
  { value: 'economia', label: 'Emprego e economia' },
  { value: 'meioambiente', label: 'Meio ambiente' },
];

export function isUpperOffice(o: string | undefined | null): boolean {
  return !!o && ['deputado_estadual', 'deputado_federal', 'senador', 'governador', 'secretario_estadual'].includes(o);
}
export const isLegislatorUpper = (o: string | undefined | null) => !!o && ['deputado_estadual', 'deputado_federal', 'senador'].includes(o);

export function newUpper(office: string): UpperMandate {
  return {
    bills: [], amendments: [], amendmentBudget: AMENDMENT_BUDGET[office] ?? 0, committeeRole: null, relationGov: 50,
    assemblyBase: office === 'governador' ? 0 : undefined,
    stateIndicators: office === 'governador' || office === 'secretario_estadual' ? Object.fromEntries(STATE_AREAS.map((a) => [a.id, 50])) : undefined,
    programs: office === 'governador' || office === 'secretario_estadual' ? [] : undefined,
    awayFromBase: 0,
  };
}

/** Executivo de referência do mandato: governador (Alesp, secretário estadual) ou presidente (Congresso). */
function govRef(s: GameState, office: string) {
  return office === 'deputado_estadual' || office === 'secretario_estadual' ? { h: s.stateWorld.governor, coalition: s.stateWorld.governorCoalition } : { h: s.stateWorld.president, coalition: s.stateWorld.presidentCoalition };
}
export function upperAlignment(s: GameState): number {
  const m = s.player.mandate;
  if (!m) return 0;
  const { h, coalition } = govRef(s, m.office);
  return partyAlignment(s.player.partyId, h.partyId, coalition);
}

// ---------------- Ações de parlamentar ----------------

export function upperBill(s: GameState, rng: RngState, theme: string): string {
  const u = s.player.mandate!.upper!;
  const label = UPPER_THEMES.find((t) => t.value === theme)?.label ?? theme;
  const id = `ub_${s.month.year}_${u.bills.length + 1}`;
  u.bills.push({ id, title: `${label}: projeto de ${s.character.name.split(' ')[0]}`, theme, status: 'tramitando', monthsLeft: 6 + Math.floor(next(rng) * 9) });
  s.player.recognition = clamp(s.player.recognition + 0.8);
  return `Projeto apresentado (${label}). A tramitação é longa: a chance de aprovação depende da relação com o governo, da sua articulação e de uma presidência de comissão.`;
}

export function upperAmendment(s: GameState, rng: RngState, param: string): string {
  const u = s.player.mandate!.upper!;
  const [region, theme, v] = param.split('|');
  const value = Math.min(u.amendmentBudget, Number(v) || 1);
  if (value <= 0 || u.amendmentBudget <= 0) return 'Seu saldo de emendas do ano acabou.';
  const office = s.player.mandate!.office;
  if (healthShareRequired(office) && theme !== 'saúde') {
    const cap = AMENDMENT_BUDGET[office] / 2;
    const t = amendmentYearTotals(u, s.month.year);
    if (t.total - t.health + value > cap + 1e-9) return `Metade da cota anual precisa ir para a saúde (CF art. 166 §9º): você só pode indicar mais R$ ${Math.max(0, cap - (t.total - t.health))} mi fora da saúde este ano.`;
  }
  u.amendmentBudget -= value;
  u.amendments.push({ region, theme, value, month: { ...s.month }, paid: false, kind: 'individual' });
  void rng;
  const r = REGIONS.find((x) => x.id === region);
  if (isBrRegion(region)) return `Emenda individual de R$ ${value} mi indicada para ${theme} em municípios do ${brName(region)}. Rende projeção nacional nessa região, mas não votos em SP.`;
  return `Emenda individual de R$ ${value} mi indicada para ${theme} na região ${r?.name ?? region}. O pagamento depende da execução pelo Executivo (emendas individuais são impositivas, mas o ritmo de pagamento varia).`;
}

export function articulateGov(s: GameState, rng: RngState): string {
  const m = s.player.mandate!;
  const u = m.upper!;
  const g = 3 + s.character.attributes.articulation / 20 + next(rng) * 3 + upperAlignment(s) * 4;
  u.relationGov = clamp(u.relationGov + g);
  if (m.office === 'governador') {
    u.assemblyBase = Math.min(94, Math.round((u.assemblyBase ?? 0) + 1 + next(rng) * 2 + s.character.attributes.negotiation / 40));
    return `Você negociou com líderes da Alesp: base estimada de ${u.assemblyBase} deputados (maioria simples: 48).`;
  }
  const who = govRef(s, m.office).h;
  return `Reuniões com o governo (${who.name}): relação +${g.toFixed(1)}.`;
}

export function seekCommittee(s: GameState, rng: RngState): string {
  const u = s.player.mandate!.upper!;
  const chance = clamp(15 + s.player.partyRel.influence * 0.4 + s.character.attributes.articulation * 0.3 + upperAlignment(s) * 15, 5, 80) / 100;
  if (next(rng) < chance) {
    u.committeeRole = pick(rng, ['Presidência da comissão de Saúde', 'Presidência da comissão de Segurança', 'Relatoria do orçamento', 'Presidência da comissão de Educação', 'Vice-liderança do partido']);
    return `Você conquistou: ${u.committeeRole}. Seus projetos ganham força.`;
  }
  return 'A bancada preferiu outro nome para a comissão desta vez.';
}

export function oversight(s: GameState, rng: RngState): string {
  const m = s.player.mandate!;
  const u = m.upper!;
  const g = 1.5 + s.character.attributes.communication / 40 + next(rng) * 1.5;
  s.player.recognition = clamp(s.player.recognition + g);
  u.relationGov = clamp(u.relationGov - (upperAlignment(s) > 0.6 ? 6 : 3));
  m.approval = clamp(m.approval + 0.6);
  return `Fiscalização e pedidos de informação ao Executivo: reconhecimento +${g.toFixed(1)}; relação com o governo cai.`;
}

export function visitBase(s: GameState, rng: RngState, region: string): string {
  const m = s.player.mandate!;
  const u = m.upper!;
  addGoodwill(s, region, 2 + next(rng) * 2);
  s.player.base = clamp(s.player.base + 1.5 + s.character.attributes.charisma / 50);
  u.awayFromBase = Math.max(0, u.awayFromBase - 2);
  m.approval = clamp(m.approval + 0.4);
  return `Agenda na base (${REGIONS.find((r) => r.id === region)?.name ?? region}): base +${(1.5 + s.character.attributes.charisma / 50).toFixed(1)}.`;
}

// ---------------- Outras fontes de recursos (ajuste pós-Fase 5) ----------------
// REGRA REAL: indicações ao Executivo não são obrigatórias (dependem de decisão do governo); emendas de bancada
// estadual são impositivas (CF art. 166 §12) e as de comissão não são. Valores de 2026: R$ 11,2 bi de bancada
// (~R$ 500 mi por estado) e R$ 12,1 bi de comissão (LOA 2026). Como cada bancada/comissão reparte o dinheiro
// entre os membros é decisão política interna — aqui é PROPOSTA de jogo.

const KIND_LABEL = { individual: 'emenda individual', indicacao: 'indicação ao governo', bancada: 'emenda de bancada', comissao: 'emenda de comissão' } as const;
/** Teto anual de indicações atendidas (R$ mi) — PROPOSTA. */
export const INDICATION_CAP: Record<string, number> = { deputado_estadual: 30, deputado_federal: 60, senador: 90 };

export function yearKindTotal(u: UpperMandate, year: number, kind: string) {
  return u.amendments.filter((a) => a.month.year === year && (a.kind ?? 'individual') === kind).reduce((x, a) => x + a.value, 0);
}

/** Pede ao Executivo uma transferência voluntária para a sua região. Sai mais fácil para quem é da base. */
export function requestIndication(s: GameState, rng: RngState, param: string): string {
  const m = s.player.mandate!;
  const u = m.upper!;
  const [region, theme, v] = param.split('|');
  const value = Number(v) || 5;
  const left = (INDICATION_CAP[m.office] ?? 0) - yearKindTotal(u, s.month.year, 'indicacao');
  if (left < value) return `O governo já atendeu o que costuma atender de um parlamentar neste ano (teto de jogo: R$ ${INDICATION_CAP[m.office]} mi).`;
  const align = upperAlignment(s);
  const chance = clamp(8 + align * 40 + u.relationGov * 0.35 + s.character.attributes.negotiation * 0.1 - value * 0.6, 3, 85) / 100;
  const who = govRef(s, m.office).h;
  if (next(rng) < chance) {
    u.amendments.push({ region, theme, value, month: { ...s.month }, paid: false, kind: 'indicacao' });
    u.relationGov = clamp(u.relationGov - 2);
    return `${who.name} atendeu sua indicação: R$ ${value} mi para ${theme} na região ${REGIONS.find((r) => r.id === region)?.name}. Em troca, o governo espera seu voto nas votações importantes.`;
  }
  return `O governo de ${who.name} não atendeu a indicação desta vez (chance era de ~${Math.round(chance * 100)}%). Estar na base e votar com o governo ajuda.`;
}

/** Vota com o governo numa matéria importante: melhora a relação, mas custa com o eleitorado se o projeto é impopular. */
export function voteWithGov(s: GameState, rng: RngState): string {
  const m = s.player.mandate!;
  const u = m.upper!;
  const unpopular = next(rng) < 0.4;
  u.relationGov = clamp(u.relationGov + 6 + s.character.attributes.articulation / 25);
  if (unpopular) { m.approval = clamp(m.approval - 1.5); s.character.attributes.popularity = clamp(s.character.attributes.popularity - 0.8); }
  return `Você votou com o governo numa matéria importante${unpopular ? ' — impopular na sua base: aprovação −1,5' : ''}. Relação com o governo melhora.`;
}

/** Fatia da emenda de bancada estadual (federal e senador). Uma vez por ano, de janeiro a março. */
export function claimBancada(s: GameState, rng: RngState, param: string): string {
  const m = s.player.mandate!;
  const u = m.upper!;
  if (yearKindTotal(u, s.month.year, 'bancada') > 0) return 'Você já tem sua fatia da emenda de bancada deste ano.';
  const [region, theme] = param.split('|');
  const partySeats = s.stateWorld.camaraSeats[s.player.partyId ?? ''] ?? 0;
  const base = 500 / 73; // ~R$ 6,8 mi por parlamentar paulista se a divisão fosse igual
  const factor = clamp(0.5 + partySeats / 20 + s.character.attributes.articulation / 100 + (u.committeeRole ? 0.3 : 0) + (next(rng) - 0.5) * 0.4, 0.4, 2.2);
  const value = Math.round(base * factor);
  u.amendments.push({ region, theme, value, month: { ...s.month }, paid: false, kind: 'bancada' });
  return `Na divisão da emenda de bancada de SP (~R$ 500 mi), você ficou com R$ ${value} mi para ${theme} na região ${REGIONS.find((r) => r.id === region)?.name}. Emenda de bancada é impositiva.`;
}

/** Emenda de comissão: não é impositiva; quem preside comissão ou é próximo da liderança tem acesso. */
export function claimCommission(s: GameState, rng: RngState, param: string): string {
  const m = s.player.mandate!;
  const u = m.upper!;
  if (yearKindTotal(u, s.month.year, 'comissao') > 0) return 'Você já conseguiu emenda de comissão neste ano.';
  const [region, theme] = param.split('|');
  const chance = clamp(10 + (u.committeeRole ? 35 : 0) + s.player.partyRel.influence * 0.3 + upperAlignment(s) * 15, 5, 80) / 100;
  if (next(rng) >= chance) return `As lideranças não incluíram você na divisão das emendas de comissão (chance ~${Math.round(chance * 100)}%). Presidir comissão ajuda.`;
  const value = Math.round(8 + next(rng) * (u.committeeRole ? 30 : 12));
  u.amendments.push({ region, theme, value, month: { ...s.month }, paid: false, kind: 'comissao' });
  return `Você conseguiu R$ ${value} mi em emenda de comissão para ${theme} na região ${REGIONS.find((r) => r.id === region)?.name}. Não é impositiva: o pagamento depende do governo.`;
}

/** Esquema ilegal com prefeitura/ONG/empreiteira beneficiada pela emenda. Crime (corrupção passiva, peculato). */
export function amendmentScheme(s: GameState, rng: RngState, param: string): string {
  const m = s.player.mandate!;
  const u = m.upper!;
  const indicated = u.amendments.filter((a) => a.month.year === s.month.year).reduce((x, a) => x + a.value, 0);
  if (indicated <= 0) return 'Não há emendas indicadas neste ano para servir de esquema.';
  const pct = 0.05 + next(rng) * 0.05;
  const value = Math.round(indicated * pct * 1_000_000);
  if (param === 'caixa') {
    s.flags.caixaDoisReserva = Number(s.flags.caixaDoisReserva ?? 0) + value;
  } else {
    s.finances.cash += value;
  }
  s.flags.esquemaEmendas = Number(s.flags.esquemaEmendas ?? 0) + 1;
  s.flags.esquemaUltimo = s.month.year * 12 + s.month.month - 1;
  return param === 'caixa'
    ? `Você combinou com os beneficiários das emendas um "retorno" de ${(pct * 100).toFixed(0)}%: R$ ${value.toLocaleString('pt-BR')} guardados por fora para a próxima campanha. Isso é crime e caixa dois — o risco de investigação cresce a cada vez.`
    : `Você combinou com os beneficiários das emendas um "retorno" de ${(pct * 100).toFixed(0)}%: R$ ${value.toLocaleString('pt-BR')} no seu bolso. Isso é crime — o risco de investigação cresce a cada vez.`;
}

/** Risco mensal de investigação dos esquemas (PROPOSTA). */
export function schemeInvestigation(s: GameState, rng: RngState): string[] {
  const n = Number(s.flags.esquemaEmendas ?? 0);
  if (!n || s.flags.esquemaInvestigado) return [];
  const p = 0.012 * n + (s.player.recognition > 60 ? 0.008 : 0);
  if (next(rng) >= p) return [];
  s.flags.esquemaInvestigado = true;
  const notes = ['OPERAÇÃO POLICIAL: investigação aponta que beneficiários das suas emendas devolviam parte do dinheiro. Busca e apreensão no seu gabinete.'];
  s.character.attributes.popularity = clamp(s.character.attributes.popularity - 10);
  s.player.credibility = clamp((s.player.credibility ?? 60) - 15);
  s.flags.vantagemIndevida = Number(s.flags.vantagemIndevida ?? 0) + 1;
  const m = s.player.mandate;
  if (m) m.approval = clamp(m.approval - 12);
  s.crises.push({ id: `cr_esq_${s.month.year}_${s.month.month}`, targetId: 'character_player', targetName: s.character.name, topic: 'esquema', headline: `Operação investiga desvio de emendas no gabinete de ${s.character.name}`, truth: 'verdadeira', outletId: 'tvmetropole', severity: 90, month: { ...s.month }, deadline: s.month.year * 12 + s.month.month, status: 'ativa', response: null, outcome: null, origin: 'esquema com emendas' });
  if (m && next(rng) < 0.25 + n * 0.1) {
    s.flags.cassado = true;
    s.flags.perdaMandatoEsquema = true;
    notes.push('O processo por quebra de decoro avança: a Casa aprovou a perda do seu mandato (CF art. 55). Com condenação, vem a inelegibilidade (LC 64/90, Lei da Ficha Limpa).');
  }
  return notes;
}

export { KIND_LABEL as FUNDING_KIND_LABEL };

// ---------------- Governador ----------------

export function startStateProgram(s: GameState, rng: RngState, area: string): string {
  const m = s.player.mandate!;
  const u = m.upper!;
  const a = STATE_AREAS.find((x) => x.id === area)!;
  if ((u.programs ?? []).some((p) => p.area === area)) return `Já há um programa em andamento em ${a.label}.`;
  const months = 10 + Math.floor(next(rng) * 8) - Math.round(s.character.attributes.management / 25);
  (u.programs ??= []).push({ id: `sp_${area}_${s.month.year}`, label: `Programa estadual — ${a.label}`, monthsLeft: Math.max(6, months), area });
  return `Programa lançado em ${a.label} (~${Math.max(6, months)} meses). Precisa de base na Alesp para o orçamento: com menos de 48 deputados, atrasos ficam mais prováveis.`;
}

export function transferToCity(s: GameState, rng: RngState): string {
  const m = s.player.mandate!;
  const mayorParty = s.government.mayor.partyId;
  const align = partyAlignment(s.player.partyId, mayorParty, s.stateWorld.governorCoalition);
  const v = Math.round(150 + next(rng) * 350);
  s.city.cash += v;
  s.city.loa.areas.subprefeituras += v;
  m.approval = clamp(m.approval + 0.8 + align);
  return `Convênio com a Prefeitura de São Paulo: R$ ${v} mi para obras na capital${align > 0.6 ? ' — o prefeito aliado divide os créditos' : ' — o prefeito de oposição tenta capitalizar a obra'}.`;
}

// ---------------- Passo mensal ----------------

export function upperMonthlyStep(s: GameState, rng: RngState): string[] {
  const m = s.player.mandate;
  if (!m || !isUpperOffice(m.office)) return [];
  const u = (m.upper ??= newUpper(m.office));
  const notes: string[] = [];
  // Recomposição anual do saldo de emendas.
  if (s.month.month === 1 && AMENDMENT_BUDGET[m.office]) u.amendmentBudget = AMENDMENT_BUDGET[m.office];
  for (const b of u.bills) {
    if (b.status !== 'tramitando') continue;
    b.monthsLeft -= 1;
    if (b.monthsLeft > 0) continue;
    // Fase 15: projeto do tema da sua comissão anda mais; presidindo a comissão, ainda mais (PROPOSTA).
    const lg = u.leg; const hk = m.office === 'deputado_estadual' ? 'alesp' : m.office === 'deputado_federal' ? 'camara' : 'senado';
    const cdef = lg?.committee ? UPPER_COMMITTEES[hk].find((c) => c.id === lg.committee) : null;
    const themeFit = cdef?.themes.includes(b.theme) ? (lg?.chairUntil && lg.chairUntil > s.month.year * 12 + s.month.month ? 18 : 8) : 0;
    const chance = clamp(12 + u.relationGov * 0.25 + s.character.attributes.articulation * 0.2 + (u.committeeRole ? 12 : 0) + themeFit + upperAlignment(s) * 10, 5, 80) / 100;
    if (next(rng) < chance) {
      b.status = 'aprovado';
      m.approval = clamp(m.approval + 2);
      s.player.recognition = clamp(s.player.recognition + 2);
      notes.push(`Seu projeto "${b.title}" foi aprovado e virou lei.`);
    } else {
      b.status = 'arquivado';
      notes.push(`Seu projeto "${b.title}" não avançou e foi arquivado.`);
    }
  }
  for (const a of u.amendments) {
    if (a.paid) continue;
    const kindBoost = a.kind === 'indicacao' ? 0.1 : a.kind === 'comissao' ? -0.03 + upperAlignment(s) * 0.1 : 0;
    if (next(rng) < 0.1 + u.relationGov / 300 + kindBoost) {
      a.paid = true;
      if (isBrRegion(a.region)) {
        nationalAmendmentPaid(s, a.region, a.value);
        notes.push(`${KIND_LABEL[a.kind ?? 'individual'][0].toUpperCase()}${KIND_LABEL[a.kind ?? 'individual'].slice(1)} paga: R$ ${a.value} mi chegaram a municípios do ${brName(a.region)}.`);
        continue;
      }
      addGoodwill(s, a.region, Math.min(12, 2 + a.value / 3));
      s.player.base = clamp(s.player.base + Math.min(3, a.value / 6));
      notes.push(`${KIND_LABEL[a.kind ?? 'individual'][0].toUpperCase()}${KIND_LABEL[a.kind ?? 'individual'].slice(1)} paga: R$ ${a.value} mi chegaram à região ${REGIONS.find((r) => r.id === a.region)?.name ?? a.region}.`);
    }
  }
  if (m.office === 'deputado_federal' || m.office === 'senador') {
    // Agenda em Brasília afasta da base (PROPOSTA).
    u.awayFromBase = Math.min(20, u.awayFromBase + 1);
    s.player.base = clamp(s.player.base - u.awayFromBase * 0.03);
  }
  if (m.office === 'governador' || m.office === 'secretario_estadual') {
    const ind = (u.stateIndicators ??= Object.fromEntries(STATE_AREAS.map((a) => [a.id, 50])));
    for (const a of STATE_AREAS) ind[a.id] = clamp(ind[a.id] + (50 - ind[a.id]) * 0.02 + normal(rng, 0, 0.8) - 0.15);
    for (const p of u.programs ?? []) {
      const slow = m.office === 'governador' && (u.assemblyBase ?? 0) < 48 && next(rng) < 0.35;
      if (!slow) p.monthsLeft -= 1;
      if (p.monthsLeft <= 0) { ind[p.area] = clamp(ind[p.area] + 10 + s.character.attributes.management / 15); m.approval = clamp(m.approval + 3); notes.push(`${p.label} entregue: indicador da área sobe.`); }
    }
    u.programs = (u.programs ?? []).filter((p) => p.monthsLeft > 0);
    const avg = STATE_AREAS.reduce((acc, a) => acc + ind[a.id], 0) / STATE_AREAS.length;
    if (m.office === 'governador') {
      m.approval = clamp(m.approval + (50 - m.approval) * 0.04 + (avg - 50) * 0.04 + ((u.assemblyBase ?? 0) >= 48 ? 0.2 : -0.4) + normal(rng, 0, 1));
      s.stateWorld.governorApproval = m.approval;
      if (next(rng) < 0.03) {
        const area = pick(rng, STATE_AREAS);
        ind[area.id] = clamp(ind[area.id] - 8);
        m.approval = clamp(m.approval - 2);
        notes.push(`Crise em ${area.label}: indicador cai e a oposição na Alesp cobra explicações.`);
      }
    } else {
      m.approval = clamp(m.approval + (avg - 50) * 0.03 + normal(rng, 0, 0.6));
      u.relationGov = clamp(u.relationGov - 0.5);
      if (u.relationGov < 18) { s.flags.exoneradoEstadual = true; notes.push('O governador decidiu trocar o comando da pasta: você foi exonerado(a).'); }
    }
  } else {
    m.approval = clamp(m.approval + (50 - m.approval) * 0.02 + normal(rng, 0, 0.6) + (u.bills.some((b) => b.status === 'tramitando') ? 0.1 : -0.1));
    u.relationGov = clamp(u.relationGov + (50 - u.relationGov) * 0.01);
  }
  return notes;
}

/** Texto curto sobre a posição do mandato para a interface. */
export function upperSummary(s: GameState, m: Mandate): string {
  const ref = govRef(s, m.office).h;
  return `${UPPER_LABEL[m.office] ?? m.office} · ${m.since.slice(0, 4)}–${m.until.slice(0, 4)} · Executivo de referência: ${ref.name} (${partyById(ref.partyId)?.acronym})${ref.real ? '' : ' — personagem do jogo'}`;
}
