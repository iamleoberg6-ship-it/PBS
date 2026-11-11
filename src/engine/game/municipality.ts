// Prefeitura de São Paulo: orçamento, execução, limites fiscais, ciclo LDO/LOA/PPA, Programa de Metas,
// secretariado e prestação de contas (Fase 3).
//
// Base real: execução 2025 e LOA/PLOA 2026/LDO 2027 (data/spfinance.ts). Regras: rules/fiscal.ts.
// A cidade funciona com ou sem o jogador na prefeitura: com prefeito da IA as decisões são automáticas.

import { next, normal, pick, type RngState } from '../rng';
import { addMonths, monthIndex } from '../calendar';
import { AREA_BASE_2027, AREA_KEYS, EXEC_2025, LDO_2027_TOTAL, MACRO, RCL_RATIO, DTP_RATIO, type AreaKey } from '../data/spfinance';
import {
  CREDIT_LIMIT, DEBT_LIMIT, MIN_EDUCATION, MIN_HEALTH, PERSONNEL_MAX, PERSONNEL_PRUDENTIAL, TCM_OVERRIDE_VOTES,
  inArt42Window, inPersonnelFreeze, personnelStatus, taxEffectiveYear,
} from '../rules/fiscal';
import { applyEffects, pressureOf, createSecretariat, freeBudget, performance, portfolioById, stepSecretariatCore } from './secretariat';
import { fictionalName } from './names';
import { pushNews } from './news';
import { mayorProfile, secretariatPriority } from './govprofile';
import { partyById } from '../data/parties';
import type { Bill, City, CitySecretary, GameState, LoaBudget, Secretariat, YearResult } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const r0 = (v: number) => Math.round(v);
/** Ano final do mandato municipal em curso (2028, 2032, 2036…). */
export function mandateEndYear(year: number): number {
  return 2028 + Math.ceil(Math.max(0, year - 2028) / 4) * 4;
}

/** Calibração (DERIVADA): fatores que levam o gasto da área ao conceito legal de aplicação mínima. */
const EDU_ACCOUNTING = 1.12; // inclui inativos da educação e despesas de MDE lançadas fora da pasta
const HEALTH_ACCOUNTING = 0.85; // exclui recursos do SUS federal, que não contam como aplicação própria

// ---------------- Orçamento de base (2027) ----------------
export function baseLoa2027(): LoaBudget {
  const g = LDO_2027_TOTAL / EXEC_2025.total; // ≈ 1,12
  const rev = {
    iptu: r0(EXEC_2025.revenue.iptu * g), iss: r0(EXEC_2025.revenue.iss * g), itbi: r0(EXEC_2025.revenue.itbi * g),
    transf: r0(EXEC_2025.revenue.transf * g), outras: r0(EXEC_2025.revenue.outrasCorrentes * g), credito: 8000, capitalOutras: 0,
  };
  rev.capitalOutras = LDO_2027_TOTAL - (rev.iptu + rev.iss + rev.itbi + rev.transf + rev.outras + rev.credito);
  const personnel = r0(EXEC_2025.pessoal * g);
  const debtService = 2400;
  const areas: Record<string, number> = {};
  for (const k of AREA_KEYS) areas[k] = AREA_BASE_2027[k].total;
  const nonPers = AREA_KEYS.reduce((a, k) => a + areas[k] - personnel * AREA_BASE_2027[k].staffShare, 0);
  const reserve = 300;
  const other = LDO_2027_TOTAL - personnel - debtService - nonPers - reserve;
  return { year: 2027, revenue: rev, personnel, debtService, areas, other: r0(other), reserve, status: 'base', source: 'LDO 2027 (receita total real); composição estimada a partir da execução de 2025 e do PLOA 2026' };
}

export const totalRevenue = (l: LoaBudget) => Object.values(l.revenue).reduce((a, b) => a + b, 0);
export const correntes = (l: LoaBudget) => l.revenue.iptu + l.revenue.iss + l.revenue.itbi + l.revenue.transf + l.revenue.outras;
export const impostos = (l: LoaBudget) => l.revenue.iptu + l.revenue.iss + l.revenue.itbi + l.revenue.transf;
export const staffIn = (l: LoaBudget, k: AreaKey) => l.personnel * AREA_BASE_2027[k].staffShare;
export const nonPersonnel = (l: LoaBudget, k: AreaKey) => Math.max(0, l.areas[k] - staffIn(l, k));
export function totalExpense(l: LoaBudget): number {
  return l.personnel + l.debtService + AREA_KEYS.reduce((a, k) => a + nonPersonnel(l, k), 0) + l.other + l.reserve;
}
/** Saldo do projeto: receita prevista menos despesa fixada. A LOA precisa fechar (≥ 0, o resto vira reserva). */
export const loaBalance = (l: LoaBudget) => totalRevenue(l) - totalExpense(l);

/** Área de referência corrigida pela inflação, para medir corte ou reforço. */
export function referenceArea(s: GameState, k: AreaKey): number {
  return AREA_BASE_2027[k].total * s.city.priceLevel;
}
export function areaFunding(s: GameState, k: AreaKey): number {
  if (!s.city) return 1;
  return (s.city.loa.areas[k] * (1 - s.city.contingency * 0.6)) / referenceArea(s, k);
}

// ---------------- Indicadores fiscais ----------------
export function rclEstimate(s: GameState): number {
  const c = s.city;
  if (c.ytd.months >= 3) return (c.ytd.correntes / c.ytd.months) * 12 * RCL_RATIO;
  return correntes(c.loa) * RCL_RATIO;
}
export function personnelRatio(s: GameState): number {
  const c = s.city;
  const pers = c.ytd.months >= 1 ? (c.ytd.personnel / c.ytd.months) * 12 : c.loa.personnel;
  return (pers * DTP_RATIO) / rclEstimate(s);
}
export function educationRatio(s: GameState): number {
  const c = s.city;
  const spend = c.ytd.months >= 1 ? ((c.ytd.byArea.educacao ?? 0) / c.ytd.months) * 12 : c.loa.areas.educacao;
  const base = c.ytd.months >= 1 ? (c.ytd.impostos / c.ytd.months) * 12 : impostos(c.loa);
  return (spend * EDU_ACCOUNTING) / base;
}
export function healthRatio(s: GameState): number {
  const c = s.city;
  const spend = c.ytd.months >= 1 ? ((c.ytd.byArea.saude ?? 0) / c.ytd.months) * 12 : c.loa.areas.saude;
  const base = c.ytd.months >= 1 ? (c.ytd.impostos / c.ytd.months) * 12 : impostos(c.loa);
  return (spend * HEALTH_ACCOUNTING) / base;
}
export const netDebt = (c: City) => c.debt - Math.max(0, c.cash);
export const debtRatio = (s: GameState) => netDebt(s.city) / rclEstimate(s);
export const creditRatio = (s: GameState) => s.city.ytd.credit / rclEstimate(s);
export function cityPerformance(s: GameState): number {
  const vals = AREA_KEYS.map((k) => { const sec = secretariatOf(s, k); return sec ? performance(sec) : 0; });
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// ---------------- Secretariado ----------------
export function secretariatOf(s: GameState, k: string): Secretariat | null {
  const m = s.player.mandate;
  if (m?.office === 'secretario' && m.secretariat?.portfolio === k) return m.secretariat;
  return s.city?.secretariats[k] ?? null;
}

function aiSecretary(rng: RngState, portfolio: string, kind: CitySecretary['kind'], partyId: string | null, month: GameState['month']): CitySecretary {
  const competence = kind === 'tecnico' ? 55 + next(rng) * 30 : kind === 'politico' ? 30 + next(rng) * 35 : 30 + next(rng) * 15;
  return { portfolio, name: fictionalName(rng), partyId, kind, competence: Math.round(competence), since: { ...month } };
}

export function initCity(s: GameState, rng: RngState): City {
  const loa = baseLoa2027();
  const coalition = s.government.mayorCoalition;
  const secretaries: Record<string, CitySecretary> = {};
  const secretariats: Record<string, Secretariat> = {};
  for (const k of AREA_KEYS) {
    const political = next(rng) < 0.5 && coalition.length > 0;
    secretaries[k] = aiSecretary(rng, k, political ? 'politico' : 'tecnico', political ? pick(rng, coalition) : null, s.month);
    const sec = createSecretariat(k);
    sec.budget = loa.areas[k];
    sec.capacity = Math.round(30 + secretaries[k].competence * 0.5);
    sec.approval = 50;
    secretariats[k] = sec;
  }
  return {
    loa, nextLoa: null, draft: null,
    ytd: emptyYtd(),
    activity: 1, priceLevel: 1, iptuIndex: 1, issIndex: 1, pendingTaxes: [],
    debt: 25000, cash: 25000 - EXEC_2025.dcl, contingency: 0, pendingCredit: [],
    secretaries, secretariats, history: [], tcm: [], ldo: {}, metas: null, ppa: null, approval: 52,
  };
}
const emptyYtd = (): City['ytd'] => ({ revenue: 0, correntes: 0, impostos: 0, expense: 0, personnel: 0, byArea: {}, credit: 0, months: 0 });

/** Ao assumir a prefeitura, o jogador encontra os cargos com interinos até nomear o secretariado. */
export function resetSecretariatForNewMayor(s: GameState, rng: RngState) {
  for (const k of AREA_KEYS) {
    s.city.secretaries[k] = aiSecretary(rng, k, 'interino', null, s.month);
    const sec = s.city.secretariats[k];
    if (sec) sec.capacity = Math.round(30 + s.city.secretaries[k].competence * 0.5);
  }
}

export function appointSecretary(s: GameState, rng: RngState, portfolio: string, kind: 'tecnico' | 'politico', partyId: string | null): string {
  const def = portfolioById(portfolio);
  if (!def) return 'Pasta desconhecida.';
  const sec = aiSecretary(rng, portfolio, kind, partyId, s.month);
  s.city.secretaries[portfolio] = sec;
  const ss = s.city.secretariats[portfolio];
  if (ss) ss.capacity = clamp(ss.capacity * 0.5 + (30 + sec.competence * 0.5) * 0.5);
  if (kind === 'politico' && partyId) {
    const inBase = s.government.mayorCoalition.includes(partyId);
    if (!inBase) s.government.mayorCoalition.push(partyId);
    return `${sec.name} (${partyById(partyId)?.acronym}) assume a Secretaria de ${def.name}. Indicação política: competência ${sec.competence}/100.${inBase ? '' : ` O ${partyById(partyId)?.acronym} passa a integrar o governo.`}`;
  }
  return `${sec.name}, perfil técnico, assume a Secretaria de ${def.name}. Competência ${sec.competence}/100.`;
}

function aiSecretariatStep(s: GameState, rng: RngState, k: AreaKey, sec: Secretariat, notes: string[]) {
  const who = s.city.secretaries[k];
  const comp = who?.competence ?? 50;
  sec.monthsInOffice++;
  const res = stepSecretariatCore(sec, rng, { funding: areaFunding(s, k) });
  const pr = pressureOf(k);
  sec.approval = clamp((sec.approval ?? 50) + (res.delivered * 3) / pr - res.crisisSeverity * 0.6 * pr - (res.crisisStarted ? 3 : 0));
  const target = 45 + performance(sec) * 30 - (sec.crisis ? 6 : 0) - (pr - 1) * 18;
  sec.approval = clamp(sec.approval + (target - sec.approval) * 0.15 + normal(rng, 0, 0.8));
  // Gestão da IA: lança programas, faz a ação própria da pasta e responde a crises conforme a competência.
  const def = portfolioById(k)!;
  if (next(rng) < (0.12 + comp / 400) * secretariatPriority(s, k) && !sec.programs.some((p) => ['planejamento', 'licitacao', 'execucao'].includes(p.phase))) {
    const opt = def.programs.filter((p) => !sec.programs.some((x) => x.id === p.id) && p.cost <= freeBudget(sec));
    if (opt.length) {
      const p = pick(rng, opt);
      sec.programs.push({ id: p.id, label: p.label, phase: 'planejamento', monthsLeft: p.plan, cost: p.cost, effects: p.effects, delayed: false });
    }
  }
  if (next(rng) < 0.2 * secretariatPriority(s, k) && freeBudget(sec) >= def.special.cost) {
    sec.extraSpent += def.special.cost;
    applyEffects(sec, def.special.effects, 0.4 + comp / 200);
  }
  if (sec.crisis && next(rng) < comp / 160) sec.crisis = null;
  for (const n of res.notes) if (n.startsWith('Crise') || n.startsWith('Entrega')) notes.push(n);
}

// ---------------- Previsão e projeto de LOA ----------------
/** Previsão da Fazenda para o ano seguinte (com os tributos que já entram em vigor). */
export function forecastLoa(s: GameState, year: number): LoaBudget {
  const c = s.city;
  const g = (1 + MACRO.inflation) * (1 + MACRO.realGrowth * c.activity);
  // Tributos aprovados entram na LOA quando passam a valer (ver closeFiscalYear), para não contar duas vezes.
  void year;
  const L = c.loa;
  const rev = {
    iptu: r0(L.revenue.iptu * g),
    iss: r0(L.revenue.iss * g),
    itbi: r0(L.revenue.itbi * g), transf: r0(L.revenue.transf * g), outras: r0(L.revenue.outras * g),
    credito: r0(Math.min(L.revenue.credito, 3000, rclEstimate(s) * CREDIT_LIMIT)), capitalOutras: r0(L.revenue.capitalOutras * (1 + MACRO.inflation)),
  };
  const personnel = r0(L.personnel * (1 + MACRO.inflation * 0.8));
  const debtService = r0(c.debt * (MACRO.interestRate * 0.55 + 1 / 20)); // juros (custo médio × parcela onerosa) + amortização
  const areas: Record<string, number> = {};
  for (const k of AREA_KEYS) areas[k] = r0(L.areas[k] * (1 + MACRO.inflation));
  const draft: LoaBudget = { year, revenue: rev, personnel, debtService, areas, other: r0(L.other * (1 + MACRO.inflation)), reserve: 0, status: 'rascunho', source: 'Projeto do Executivo (simulação)' };
  enforceMinimums(draft);
  const bal = loaBalance(draft);
  draft.other = r0(draft.other + (bal > 0 ? bal * 0.7 : bal));
  draft.reserve = Math.max(0, r0(loaBalance(draft)));
  if (draft.reserve < 400) { draft.other -= 400 - draft.reserve; draft.reserve = 400; } // reserva mínima (PARÂMETRO)
  return draft;
}

/** A Fazenda ajusta Educação e Saúde para os mínimos legais (com folga), tirando dos demais órgãos. */
export function enforceMinimums(d: LoaBudget) {
  const imp = impostos(d);
  const needEdu = (imp * (MIN_EDUCATION + 0.006)) / EDU_ACCOUNTING;
  const needHealth = (imp * (MIN_HEALTH + 0.04)) / HEALTH_ACCOUNTING;
  for (const [k, need] of [['educacao', needEdu], ['saude', needHealth]] as const) {
    if (d.areas[k] < need) { d.other = r0(d.other - (need - d.areas[k])); d.areas[k] = r0(need); }
  }
}

export function openDraft(state: GameState): GameState {
  const s: GameState = structuredClone(state);
  s.city.draft = forecastLoa(s, s.month.year + 1);
  return s;
}

/** Ajuste do rascunho pelo prefeito (não gasta compromisso de agenda). key: área, 'other' ou 'credito'; pct: variação. */
export function adjustDraft(state: GameState, key: string, pct: number): GameState {
  const s: GameState = structuredClone(state);
  const d = s.city.draft;
  if (!d) return state;
  if (key === 'credito') d.revenue.credito = Math.max(0, r0(d.revenue.credito + pct * 1000));
  else if (key === 'other') d.other = Math.max(0, r0(d.other * (1 + pct)));
  else if (key in d.areas) {
    const k = key as AreaKey;
    const minArea = staffIn(d, k);
    d.areas[k] = Math.max(r0(minArea), r0(d.areas[k] * (1 + pct)));
  }
  d.reserve = 0;
  d.reserve = r0(loaBalance(d));
  return s;
}

export function draftChecks(s: GameState, d: LoaBudget): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (d.reserve < 0) issues.push(`Despesa fixada supera a receita prevista em R$ ${(-d.reserve).toLocaleString('pt-BR')} mi: o orçamento precisa fechar.`);
  const imp = impostos(d);
  if ((d.areas.educacao * EDU_ACCOUNTING) / imp < MIN_EDUCATION) issues.push(`Educação abaixo do mínimo de 31% da Lei Orgânica (${((d.areas.educacao * EDU_ACCOUNTING / imp) * 100).toFixed(1)}%).`);
  if ((d.areas.saude * HEALTH_ACCOUNTING) / imp < MIN_HEALTH) issues.push('Saúde abaixo do mínimo de 15%.');
  if (d.revenue.credito > rclEstimate(s) * CREDIT_LIMIT) issues.push('Operações de crédito acima de 16% da RCL.');
  return { ok: issues.length === 0, issues };
}

// ---------------- Projetos fiscais na Câmara ----------------
function fiscalBill(s: GameState, title: string, kind: 'orcamento' | 'tributo', payload: Record<string, string | number>, salience: number, publicSupport: number, rng: RngState): Bill {
  s.legislature.billSeq += 1;
  const yk = `plseq_${s.month.year}`;
  s.flags[yk] = Number(s.flags[yk] ?? 0) + 1;
  const b: Bill = {
    id: `pl_${monthIndex(s.month)}_${s.legislature.billSeq}`, number: `PL ${s.flags[yk]}/${s.month.year}`, title, theme: 'zeladoria', author: 'executivo', kind,
    executiveInitiativeOnly: false, slant: 0, salience, publicSupport, stage: 'financas', monthsInStage: 0, committeeId: 'financas', rapporteurId: null,
    executivePosition: 'favor', commitments: [], vote: null, vetoVote: null, scheduled: false, urgent: true, parecer: null,
    history: [{ month: { ...s.month }, text: 'Enviado pelo Executivo; segue à Comissão de Finanças e Orçamento.' }], payload,
  };
  const c = s.legislature.committees.find((x) => x.id === 'financas');
  b.rapporteurId = c?.members.length ? pick(rng, c.members.filter((m) => m !== 'character_player').length ? c.members.filter((m) => m !== 'character_player') : c.members) : null;
  s.legislature.bills.push(b);
  return b;
}

export function sendLdo(s: GameState, rng: RngState, target: 'equilibrio' | 'expansionista' | 'austero'): string {
  const y = s.month.year + 1;
  s.city.ldo[String(y)] = { target, status: 'enviada' };
  const b = fiscalBill(s, `LDO ${y} — diretrizes orçamentárias (meta ${target === 'austero' ? 'de superávit' : target === 'expansionista' ? 'de expansão do investimento' : 'de equilíbrio'})`, 'orcamento', { tipo: 'ldo', year: y }, 35, 0, rng);
  return `${b.number}: LDO ${y} enviada à Câmara (prazo da Lei Orgânica: 15 de abril).`;
}

export function sendPloa(s: GameState, rng: RngState): string {
  const d = s.city.draft ?? forecastLoa(s, s.month.year + 1);
  const chk = draftChecks(s, d);
  if (!chk.ok) return `O projeto não pode ser enviado: ${chk.issues.join(' ')}`;
  d.status = 'rascunho';
  s.city.draft = d;
  const withPpa = (s.month.year - 2025) % 4 === 0; // 1º ano de cada mandato (2025, 2029, 2033…)
  if (withPpa) s.city.ppa = { period: `${s.month.year + 1}–${s.month.year + 4}`, status: 'enviado' };
  const b = fiscalBill(s, `LOA ${d.year} — orçamento de R$ ${(totalRevenue(d) / 1000).toFixed(1).replace('.', ',')} bi${withPpa ? ` e PPA ${s.month.year + 1}–${s.month.year + 4}` : ''}`, 'orcamento', { tipo: 'loa', year: d.year, ppa: withPpa ? 1 : 0 }, 55, 0, rng);
  return `${b.number}: projeto da LOA ${d.year} enviado à Câmara${withPpa ? ' junto com o Plano Plurianual' : ''} (prazo: 30 de setembro).`;
}

export function sendTaxBill(s: GameState, rng: RngState, tax: 'iptu' | 'iss', change: number): string {
  const up = change > 0;
  const label = tax === 'iptu' ? `${up ? 'Atualiza' : 'Reduz'} a planta genérica de valores do IPTU (${up ? '+' : ''}${Math.round(change * 100)}% na arrecadação)` : `${up ? 'Eleva' : 'Reduz'} alíquotas do ISS de serviços selecionados (${up ? '+' : ''}${Math.round(change * 100)}% na arrecadação; faixa legal de 2% a 5%)`;
  const b = fiscalBill(s, label, 'tributo', { tax, change }, up ? 75 : 50, up ? -0.75 : 0.6, rng);
  return `${b.number} enviado: ${label}. Vale a partir do ano seguinte à publicação${tax === 'iss' ? ' e 90 dias depois dela' : ''} (CF art. 150).`;
}

/** Chamado pela Câmara quando um projeto vira lei. */
export function onLawEnacted(s: GameState, b: Bill, rng: RngState): string | null {
  if (!b.payload || !s.city) return null;
  if (b.payload.tipo === 'ldo') {
    const y = String(b.payload.year);
    if (s.city.ldo[y]) s.city.ldo[y].status = 'aprovada';
    return `LDO ${y} aprovada.`;
  }
  if (b.payload.tipo === 'loa') {
    const d = s.city.draft ?? forecastLoa(s, Number(b.payload.year));
    // Emendas da Câmara: na prática paulistana a Câmara reestima a receita e distribui o acréscimo (ex.: LOA 2026).
    const extra = r0(totalRevenue(d) * (0.004 + next(rng) * 0.01));
    d.revenue.outras += extra;
    for (const [k, w] of [['saude', 0.3], ['subprefeituras', 0.3], ['habitacao', 0.2], ['cultura', 0.2]] as const) d.areas[k] += r0(extra * w);
    d.status = 'aprovada';
    d.source = 'LOA aprovada pela Câmara (simulação)';
    s.city.nextLoa = d;
    s.city.draft = null;
    if (Number(b.payload.ppa) && s.city.ppa) s.city.ppa.status = 'aprovado';
    return `LOA ${d.year} aprovada, com emendas da Câmara que somaram R$ ${extra.toLocaleString('pt-BR')} mi (reestimativa de receita).`;
  }
  if (b.kind === 'tributo') {
    const tax = String(b.payload.tax) as 'iptu' | 'iss';
    const change = Number(b.payload.change);
    const ey = taxEffectiveYear(s.month.year, s.month.month, tax === 'iptu');
    s.city.pendingTaxes.push({ tax, change, effectiveYear: ey });
    if (s.player.mandate?.office === 'prefeito') s.player.mandate.approval = clamp(s.player.mandate.approval - change * 60);
    return `Lei tributária publicada: ${tax.toUpperCase()} ${change > 0 ? '+' : ''}${Math.round(change * 100)}% a partir de 1º/01/${ey}.`;
  }
  return null;
}

// ---------------- Decisões do prefeito ----------------
export function setContingency(s: GameState, pct: number): string {
  const prev = s.city.contingency;
  s.city.contingency = Math.max(0, Math.min(0.3, pct));
  const m = s.player.mandate;
  if (m) m.approval = clamp(m.approval - Math.max(0, s.city.contingency - prev) * 25);
  return s.city.contingency > 0
    ? `Decreto de contingenciamento: ${Math.round(s.city.contingency * 100)}% do custeio e dos investimentos ficam bloqueados (LRF art. 9º). As secretarias sentem o corte.`
    : 'Contingenciamento suspenso: execução normal do orçamento.';
}

export function requestCredit(s: GameState, amount: number, area: string): string {
  const c = s.city;
  const rcl = rclEstimate(s);
  if (personnelStatus(personnelRatio(s)) === 'excedido') return 'Bloqueado: com a despesa de pessoal acima do limite, o Município não pode contratar operações de crédito (LRF art. 23 §3º).';
  if (inArt42Window(s.month.year, s.month.month, mandateEndYear(s.month.year))) return 'Bloqueado: nos dois últimos quadrimestres do mandato não se contrai obrigação sem caixa para pagá-la (LRF art. 42).';
  if (c.ytd.credit + amount + c.pendingCredit.reduce((a, p) => a + p.amount, 0) > rcl * CREDIT_LIMIT) return `Bloqueado: operações de crédito do ano passariam de 16% da RCL (R$ ${r0(rcl * CREDIT_LIMIT).toLocaleString('pt-BR')} mi).`;
  if (netDebt(c) + amount > rcl * DEBT_LIMIT) return 'Bloqueado: a dívida consolidada líquida passaria de 1,2 vez a RCL.';
  c.pendingCredit.push({ amount, area, readyAt: addMonths(s.month, 2) });
  return `Pedido de operação de crédito de R$ ${amount.toLocaleString('pt-BR')} mi enviado para verificação de limites (STN/Senado). Liberação prevista em 2 meses, para ${portfolioById(area)?.name ?? area}.`;
}

export function raiseSalaries(s: GameState, pct: number): string {
  if (inPersonnelFreeze(s.month.year, s.month.month, mandateEndYear(s.month.year))) return 'Bloqueado: aumento de despesa com pessoal nos 180 dias finais do mandato é nulo (LRF art. 21).';
  const st = personnelStatus(personnelRatio(s));
  if (st === 'prudencial' || st === 'excedido') return 'Bloqueado: acima do limite prudencial, reajustes ficam vedados (LRF art. 22).';
  s.city.loa.personnel = r0(s.city.loa.personnel * (1 + pct));
  for (const sec of Object.values(s.city.secretariats)) sec.capacity = clamp(sec.capacity + pct * 40);
  const m = s.player.mandate;
  if (m) m.approval = clamp(m.approval + pct * 30);
  return `Reajuste de ${Math.round(pct * 100)}% aos servidores. Folha anual sobe para R$ ${s.city.loa.personnel.toLocaleString('pt-BR')} mi; equipes mais motivadas.`;
}

export const METAS_PACKAGES: Record<string, { label: string; areas: AreaKey[] }> = {
  social: { label: 'Cidade que cuida: saúde, educação e assistência', areas: ['saude', 'educacao', 'assistencia'] },
  urbano: { label: 'Cidade que funciona: mobilidade, zeladoria e habitação', areas: ['mobilidade', 'subprefeituras', 'habitacao'] },
  seguranca: { label: 'Cidade segura e verde: segurança, zeladoria e meio ambiente', areas: ['seguranca', 'subprefeituras', 'meioambiente'] },
  juventude: { label: 'Cidade jovem: educação, cultura e esporte', areas: ['educacao', 'cultura', 'esportes'] },
};

export function presentMetas(s: GameState, pkg: string): string {
  const p = METAS_PACKAGES[pkg] ?? METAS_PACKAGES.social;
  const start: Record<string, number> = {};
  for (const k of p.areas) start[k] = performance(secretariatOf(s, k)!);
  s.city.metas = { pkg, areas: p.areas, start, presentedAt: { ...s.month } };
  if (s.player.mandate) s.player.mandate.priorityArea = p.areas[0];
  return `Programa de Metas apresentado: ${p.label}. As metas serão cobradas pelo desempenho dessas pastas até o fim do mandato (LOM art. 69-A).`;
}

export function metasProgress(s: GameState): { area: string; start: number; now: number }[] {
  const m = s.city.metas;
  if (!m) return [];
  return m.areas.map((k) => ({ area: k, start: m.start[k] ?? 0, now: performance(secretariatOf(s, k)!) }));
}

// ---------------- Passo mensal ----------------
export function cityMonthlyStep(s: GameState, rng: RngState): string[] {
  const notes: string[] = [];
  const c = s.city;
  if (!c) return notes;
  const isPlayerMayor = s.player.mandate?.office === 'prefeito';
  // Economia: atividade com reversão à média.
  c.activity = Math.max(0.85, Math.min(1.12, c.activity + (1 - c.activity) * 0.08 + normal(rng, 0, 0.006)));
  c.priceLevel *= Math.pow(1 + MACRO.inflation, 1 / 12);
  // Receita realizada no mês.
  const L = c.loa;
  const act = c.activity;
  const rev = {
    iptu: L.revenue.iptu / 12,
    iss: (L.revenue.iss / 12) * act,
    itbi: (L.revenue.itbi / 12) * (act * act),
    transf: (L.revenue.transf / 12) * act,
    outras: (L.revenue.outras / 12),
    capitalOutras: L.revenue.capitalOutras / 12,
  };
  const corr = rev.iptu + rev.iss + rev.itbi + rev.transf + rev.outras;
  const credit = c.pendingCredit.filter((p) => monthIndex(p.readyAt) <= monthIndex(s.month));
  let creditIn = (L.revenue.credito / 12);
  for (const p of credit) {
    creditIn += p.amount;
    c.loa.areas[p.area] = (c.loa.areas[p.area] ?? 0) + p.amount;
    notes.push(`Operação de crédito liberada: R$ ${p.amount.toLocaleString('pt-BR')} mi para ${portfolioById(p.area)?.name ?? p.area}.`);
  }
  c.pendingCredit = c.pendingCredit.filter((p) => !credit.includes(p));
  const revenue = corr + rev.capitalOutras + creditIn;
  // Despesa executada.
  const cut = c.contingency;
  let areasSpend = 0;
  for (const k of AREA_KEYS) {
    const np = nonPersonnel(L, k) * (1 - cut);
    const spend = (np + staffIn(L, k)) / 12;
    c.ytd.byArea[k] = (c.ytd.byArea[k] ?? 0) + spend;
    areasSpend += np / 12;
  }
  const expense = L.personnel / 12 + L.debtService / 12 + areasSpend + (L.other * (1 - cut * 0.5)) / 12;
  c.ytd.revenue += revenue;
  c.ytd.correntes += corr;
  c.ytd.impostos += rev.iptu + rev.iss + rev.itbi + rev.transf;
  c.ytd.expense += expense;
  c.ytd.personnel += L.personnel / 12;
  c.ytd.credit += creditIn;
  c.ytd.months += 1;
  c.cash += revenue - expense;
  c.debt += creditIn - c.debt / MACRO.amortizationYears / 12 / 1.33; // amortização em ~20 anos (PARÂMETRO)
  // Secretarias da IA.
  for (const k of AREA_KEYS) {
    const sec = c.secretariats[k];
    if (!sec || secretariatOf(s, k) !== sec) continue;
    if (s.month.month === 1) { sec.executed = 0; sec.extraSpent = 0; }
    sec.budget = r0(L.areas[k]);
    aiSecretariatStep(s, rng, k, sec, isPlayerMayor ? notes : []);
  }
  // Avaliação do governo da IA (o prefeito-jogador é tratado em turn.ts).
  const perf = cityPerformance(s);
  if (!isPlayerMayor) c.approval = clamp(c.approval + (50 + perf * 25 - c.contingency * 30 - c.approval) * 0.08 + normal(rng, 0, 0.7));
  // Alertas fiscais (quadrimestrais: abril, agosto, dezembro).
  if ([4, 8, 12].includes(s.month.month) && isPlayerMayor) {
    const pr = personnelRatio(s);
    const st = personnelStatus(pr);
    if (st !== 'ok') notes.push(`Relatório de Gestão Fiscal: despesa com pessoal em ${(pr * 100).toFixed(1)}% da RCL — ${st === 'alerta' ? 'o Tribunal de Contas emitiu alerta' : st === 'prudencial' ? 'acima do limite prudencial: reajustes e admissões vedados' : 'ACIMA DO LIMITE: corte obrigatório em dois quadrimestres'}.`);
    if (educationRatio(s) < MIN_EDUCATION) notes.push(`Atenção: aplicação em educação em ${(educationRatio(s) * 100).toFixed(1)}%, abaixo dos 31% da Lei Orgânica.`);
    if (healthRatio(s) < MIN_HEALTH) notes.push(`Atenção: aplicação em saúde em ${(healthRatio(s) * 100).toFixed(1)}%, abaixo dos 15% exigidos.`);
  }
  return notes;
}

/** Fechamento do exercício (chamado na virada para janeiro, antes de zerar o acumulado). */
export function closeFiscalYear(s: GameState, rng: RngState): string[] {
  const c = s.city;
  const notes: string[] = [];
  const year = c.loa.year;
  const res: YearResult = {
    year, revenue: r0(c.ytd.revenue), expense: r0(c.ytd.expense), result: r0(c.ytd.revenue - c.ytd.expense),
    rcl: r0(rclEstimate(s)), personnelRatio: personnelRatio(s), educationRatio: educationRatio(s), healthRatio: healthRatio(s),
    debtRatio: debtRatio(s), creditOps: r0(c.ytd.credit), mayorWasPlayer: s.player.mandate?.office === 'prefeito',
  };
  c.history.push(res);
  if (c.cash < 0) { c.debt += -c.cash; c.cash = 0; notes.push(`Exercício de ${year} fechou sem caixa suficiente: o déficit virou dívida.`); }
  notes.push(`Exercício de ${year} encerrado: receita R$ ${(res.revenue / 1000).toFixed(1)} bi, despesa R$ ${(res.expense / 1000).toFixed(1)} bi, resultado ${res.result >= 0 ? 'superávit' : 'déficit'} de R$ ${Math.abs(res.result).toLocaleString('pt-BR')} mi.`);
  // Novo orçamento.
  const nextYear = year + 1;
  if (c.nextLoa && c.nextLoa.year === nextYear) {
    c.loa = c.nextLoa;
  } else {
    const p = forecastLoa(s, nextYear);
    p.status = 'prorrogada';
    enforceMinimums(p);
    p.source = 'Sem LOA votada: orçamento anterior corrigido (Lei Orgânica, art. 140)';
    c.loa = p;
    notes.push(`Sem LOA aprovada para ${nextYear}: vale o orçamento anterior corrigido pela inflação.`);
  }
  // Tributos que passam a valer: a arrecadação prevista da nova LOA é ajustada (o excesso vira superávit).
  for (const t of c.pendingTaxes.filter((x) => x.effectiveYear === nextYear)) {
    c.loa.revenue[t.tax] = r0(c.loa.revenue[t.tax] * (1 + t.change));
    if (t.tax === 'iptu') c.iptuIndex *= 1 + t.change; else c.issIndex *= 1 + t.change;
    notes.push(`Entra em vigor a mudança no ${t.tax.toUpperCase()} (${t.change > 0 ? '+' : ''}${Math.round(t.change * 100)}%).`);
  }
  c.pendingTaxes = c.pendingTaxes.filter((x) => x.effectiveYear > nextYear);
  c.nextLoa = null;
  c.contingency = 0;
  c.ytd = emptyYtd();
  void rng;
  return notes;
}

/** Parecer prévio do TCM (junho) e julgamento das contas pela Câmara (agosto). */
export function tcmStep(s: GameState, rng: RngState): string[] {
  const c = s.city;
  const notes: string[] = [];
  if (s.month.month === 6) {
    const r = c.history.find((h) => h.year === s.month.year - 1);
    if (r && !c.tcm.some((t) => t.year === r.year)) {
      const reasons: string[] = [];
      if (r.educationRatio < MIN_EDUCATION) reasons.push(`educação em ${(r.educationRatio * 100).toFixed(1)}% (mínimo 31%)`);
      if (r.healthRatio < MIN_HEALTH) reasons.push(`saúde em ${(r.healthRatio * 100).toFixed(1)}% (mínimo 15%)`);
      if (r.personnelRatio > PERSONNEL_MAX) reasons.push(`pessoal em ${(r.personnelRatio * 100).toFixed(1)}% da RCL (limite 60%)`);
      if (r.debtRatio > DEBT_LIMIT) reasons.push('dívida acima de 1,2 vez a RCL');
      const ressalvas: string[] = [];
      if (r.personnelRatio > PERSONNEL_PRUDENTIAL) ressalvas.push('pessoal acima do limite prudencial');
      if (r.result < -0.03 * r.revenue) ressalvas.push('déficit orçamentário relevante');
      const opinion = reasons.length ? 'contrario' : ressalvas.length ? 'favoravel_ressalvas' : 'favoravel';
      c.tcm.push({ year: r.year, opinion, reasons: [...reasons, ...ressalvas], judgment: 'pendente' });
      if (r.mayorWasPlayer) notes.push(`Tribunal de Contas do Município: parecer prévio ${opinion === 'contrario' ? 'CONTRÁRIO' : opinion === 'favoravel_ressalvas' ? 'favorável com ressalvas' : 'favorável'} às contas de ${r.year}${reasons.length || ressalvas.length ? ` (${[...reasons, ...ressalvas].join('; ')})` : ''}.`);
    }
  }
  if (s.month.month === 8) {
    for (const t of c.tcm.filter((x) => x.judgment === 'pendente')) {
      const r = c.history.find((h) => h.year === t.year);
      if (!r) continue;
      if (!r.mayorWasPlayer) { t.judgment = t.opinion === 'contrario' ? 'rejeitadas' : 'aprovadas'; continue; }
      // Parecer contrário só cai com 2/3 a favor das contas (37); parecer favorável só cai com 37 votos contra.
      let pro = 0;
      let against = 0;
      for (const cl of s.government.councillors) {
        const bloc = s.legislature.blocs[cl.id] ?? 'independente';
        const pPro = (bloc === 'base' ? 0.92 : bloc === 'independente' ? 0.5 : bloc === 'oposicao' ? 0.12 : 0.03) - (t.opinion === 'contrario' ? 0.15 : 0);
        const pAgainst = (bloc === 'base' ? 0.02 : bloc === 'independente' ? 0.15 : bloc === 'oposicao' ? 0.5 : 0.8) + (t.opinion === 'contrario' ? 0.25 : 0);
        const r = next(rng);
        if (r < pPro) pro++;
        else if (r < pPro + pAgainst) against++;
      }
      t.votes = pro;
      const approved = t.opinion === 'contrario' ? pro >= TCM_OVERRIDE_VOTES : against < TCM_OVERRIDE_VOTES;
      t.judgment = approved ? 'aprovadas' : 'rejeitadas';
      const m = s.player.mandate;
      if (approved) notes.push(`Câmara aprovou as contas de ${t.year} (${pro} votos favoráveis${t.opinion === 'contrario' ? '; a base derrubou o parecer contrário do TCM' : ''}).`);
      else {
        if (m) m.approval = clamp(m.approval - 8);
        s.flags[`contasRejeitadas_${t.year}`] = true;
        notes.push(`CONTAS REJEITADAS: a Câmara rejeitou as contas de ${t.year} (${t.opinion === 'contrario' ? `${pro} votos favoráveis; eram necessários ${TCM_OVERRIDE_VOTES} para derrubar o parecer contrário` : `${against} votos contrários derrubaram o parecer favorável`}). Rejeição por irregularidade insanável pode gerar inelegibilidade, se a Justiça Eleitoral reconhecer ato doloso de improbidade (LC 64/90, art. 1º, I, "g").`);
        pushNews(s, rng, { section: 'Prefeitura', headline: `Câmara rejeita contas de ${t.year} da gestão ${s.character.name}`, lead: `Parecer do Tribunal de Contas apontou ${t.reasons.join('; ')}.`, aboutPlayer: true, tone: 'critico', outlets: ['tvmetropole', 'canal24', 'diariopaulistano'] });
      }
    }
  }
  return notes;
}

/** Calendário fiscal automático (IA) e lembretes para o prefeito-jogador. */
export function fiscalCalendar(s: GameState, rng: RngState): string[] {
  const notes: string[] = [];
  const y = s.month.year;
  const isPlayerMayor = s.player.mandate?.office === 'prefeito';
  const mo = s.month.month;
  if (mo === 4) {
    if (!s.city.ldo[String(y + 1)]) {
      if (isPlayerMayor) {
        notes.push(`Prazo da LDO ${y + 1} terminou (15/04) sem envio. A Prefeitura enviou o texto padrão da Fazenda; a Câmara cobrou o descumprimento.`);
        if (s.player.mandate) s.player.mandate.approval = clamp(s.player.mandate.approval - 2);
      }
      sendLdo(s, rng, 'equilibrio');
    }
  }
  if (mo === 9 && !s.legislature.bills.some((b) => b.payload?.tipo === 'loa' && Number(b.payload.year) === y + 1)) {
    if (isPlayerMayor) {
      notes.push(`Prazo da LOA ${y + 1} terminou (30/09) sem envio: a Fazenda protocolou a proposta padrão.`);
      if (s.player.mandate) s.player.mandate.approval = clamp(s.player.mandate.approval - 3);
    } else aiAdjustDraft(s, rng);
    if (!s.city.draft || !draftChecks(s, s.city.draft).ok) s.city.draft = forecastLoa(s, y + 1);
    notes.push(sendPloa(s, rng));
  }
  // Prefeito personagem do jogo: no 3º mês do mandato, envia à Câmara a mudança tributária do seu perfil (precisa ser aprovada).
  const prof = mayorProfile(s);
  if (prof && prof.tax !== 'manter' && (y - 2029) % 4 === 0 && mo === 3) {
    notes.push(prof.tax === 'reduzir' ? sendTaxBill(s, rng, 'iss', -0.04) : sendTaxBill(s, rng, 'iptu', 0.05));
  }
  if (mo === 11 || mo === 6) {
    // A LOA precisa ser votada até 31/12 e a LDO no 1º semestre: a Presidência inclui na Ordem do Dia.
    for (const b of s.legislature.bills) if (b.kind === 'orcamento' && b.stage === 'plenario') b.scheduled = true;
  }
  if (isPlayerMayor && (y - 2029) % 4 === 0 && mo === 4 && !s.city.metas) {
    notes.push('O prazo de 90 dias do Programa de Metas (LOM art. 69-A) venceu sem apresentação. A imprensa e a Câmara cobram.');
    if (s.player.mandate) s.player.mandate.approval = clamp(s.player.mandate.approval - 4);
  }
  return notes;
}

function aiAdjustDraft(s: GameState, rng: RngState) {
  const d = forecastLoa(s, s.month.year + 1);
  // Prefeito personagem do jogo: reforça a área prioritária do perfil ideológico; corta um pouco a menos prioritária se fizer ajuste.
  const prof = mayorProfile(s);
  const ranked = prof ? [...AREA_KEYS].sort((a, b) => secretariatPriority(s, b) - secretariatPriority(s, a)) : null;
  const pri = ranked ? ranked[0] : pick(rng, AREA_KEYS);
  d.areas[pri] = r0(d.areas[pri] * (prof?.fiscal === 'expansao' ? 1.06 : 1.04));
  if (ranked && prof?.fiscal === 'ajuste') { const low = ranked[ranked.length - 1]; d.areas[low] = r0(d.areas[low] * 0.97); }
  d.reserve = 0;
  d.reserve = r0(loaBalance(d));
  if (d.reserve < 0) { d.other = r0(d.other + d.reserve); d.reserve = 0; }
  s.city.draft = d;
}

/** Contingenciamento automático da IA se a arrecadação ficar muito abaixo do previsto. */
export function aiFiscalPolicy(s: GameState) {
  if (s.player.mandate?.office === 'prefeito') return;
  const c = s.city;
  if (c.ytd.months >= 4) {
    const expected = (totalRevenue(c.loa) / 12) * c.ytd.months;
    const prof = mayorProfile(s);
    c.contingency = c.ytd.revenue < expected * (prof?.fiscal === 'ajuste' ? 0.99 : 0.97) ? (prof?.fiscal === 'ajuste' ? 0.1 : prof?.fiscal === 'expansao' ? 0.05 : 0.08) : 0;
  }
}

export function citySummaryForMayorApproval(s: GameState): number {
  return cityPerformance(s) * 12 - s.city.contingency * 15;
}

export const isMayorPlayer = (s: GameState) => s.player.mandate?.office === 'prefeito';

