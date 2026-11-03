// Equipe do gabinete do jogador (pós-Fase 5): assessores comissionados que o jogador nomeia quando tem mandato
// legislativo.
//
// [REAL] Os cargos de gabinete são cargos em comissão, de livre nomeação e exoneração pelo(a) parlamentar.
// [REAL] Limites de lotação por gabinete:
//   - Câmara Municipal de SP: até 18 cargos de livre indicação (1 chefe de gabinete + 17 assessores) — Lei 16.972/2018.
//   - Alesp: mínimo de 16 e máximo de 32 cargos em comissão — LC estadual 1.136/2011, art. 7º.
//   - Câmara dos Deputados: 5 a 25 secretários parlamentares; verba de gabinete de R$ 165.806,07/mês em 2026
//     (Ato da Mesa 243/2026); jornada de 40h com frequência atestada mensalmente pelo(a) deputado(a).
//   - Senado: até 50 cargos comissionados por gabinete (Guia do Parlamentar / Regulamento Administrativo).
// [REAL] "Rachadinha" (devolução de parte do salário do servidor ao parlamentar) é tratada pela Justiça como peculato
//   (CP art. 312) e improbidade; o funcionário fantasma (pago sem trabalhar) também. Ambos podem levar à perda do
//   mandato por quebra de decoro (CF art. 55) e, com condenação, à inelegibilidade (LC 64/90).
//
// [SIMPLIFICAÇÃO] O jogo não pede que você nomeie 18–50 pessoas: você escolhe a EQUIPE-CHAVE (até 5–7 nomes, conforme o
//   cargo), e o restante da lotação real fica abstrato (já está embutido no rendimento das ações do mandato). Isso evita
//   micro-gestão de dezenas de fichas sem perder o que importa: quem faz o quê, com que qualidade e com que caráter.
// [PROPOSTA] Atributos, honestidade, lealdade, faixas salariais, verba da equipe-chave, efeitos mensais das tarefas e
//   probabilidades de denúncia/investigação são parâmetros de jogo. Assessores são sempre pessoas fictícias.

import { next, normal, pick, type RngState } from '../rng';
import { REGIONS } from '../data/regions';
import { NETWORKS } from './social';
import { THEME_LABEL, fileBill, isActive } from './legislature';
import { PLAYER } from './relations';
import { addGoodwill } from './campaign';
import { UPPER_THEMES, isLegislatorUpper, upperBill } from './upper';
import { fictionalName } from './names';
import type { GameMonth } from '../calendar';
import type { GameState } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const mi = (m: GameMonth) => m.year * 12 + (m.month - 1);

export type TeamTask = 'redes' | 'imprensa' | 'base' | 'atendimento' | 'articulacao' | 'legislativo' | 'gestao';
export type TeamOrigin = 'mercado' | 'partido' | 'cabo' | 'militante';
export type TeamSkill = 'communication' | 'politicalKnowledge' | 'articulation' | 'management';

export interface TeamMember {
  id: string;
  name: string;
  role: 'chefe' | 'assessor';
  origin: TeamOrigin;
  salary: number;
  skills: Record<TeamSkill, number>;
  /** Honestidade real (0–100): oculta. Define a propensão a topar rachadinha ou virar fantasma. */
  honesty: number;
  /** O que o jogador vê na ficha: avaliação de referências, pode errar. */
  honestyEstimate: number;
  loyalty: number;
  task: TeamTask;
  /** Região (base) ou tema (legislativo). */
  taskParam: string | null;
  /** ativo; fantasma (nomeado para não trabalhar, por ordem sua); relapso (sumiu por conta própria). */
  status: 'ativo' | 'fantasma' | 'relapso';
  /** Fração do salário devolvida ao jogador (0 = não participa). */
  rachadinha: number;
  progress: number;
  hiredAt: GameMonth;
  lastOutput: string;
}

export interface TeamState {
  members: TeamMember[];
  pool: TeamMember[];
  poolMonth: number;
  /** Ex-assessores que participaram de rachadinha e saíram ressentidos: risco de denúncia. */
  exParticipants: { name: string; resentment: number; until: number }[];
  report: string[];
}

export const TASK_LABEL: Record<TeamTask, string> = {
  redes: 'Redes sociais',
  imprensa: 'Imprensa e crises',
  base: 'Agenda na base',
  atendimento: 'Atendimento ao público',
  articulacao: 'Articulação política',
  legislativo: 'Minutas e pareceres',
  gestao: 'Chefia de gabinete',
};

export const TASK_SKILL: Record<TeamTask, TeamSkill> = {
  redes: 'communication', imprensa: 'communication', base: 'articulation', atendimento: 'management',
  articulacao: 'articulation', legislativo: 'politicalKnowledge', gestao: 'management',
};

export const SKILL_LABEL: Record<TeamSkill, string> = {
  communication: 'Comunicação', politicalKnowledge: 'Técnica legislativa', articulation: 'Articulação', management: 'Organização',
};

export const ORIGIN_LABEL: Record<TeamOrigin, string> = {
  mercado: 'Profissional de mercado',
  partido: 'Indicação do partido',
  cabo: 'Cabo eleitoral da base',
  militante: 'Militante da campanha',
};

/** Limites reais (informativos) e da equipe-chave (jogo). */
export const TEAM_LIMITS: Record<string, { realLimit: string; slots: number; budget: number; salary: [number, number]; source: string }> = {
  vereador: { realLimit: 'até 18 cargos (1 chefe + 17 assessores)', slots: 5, budget: 45_000, salary: [4_000, 16_000], source: 'Lei municipal 16.972/2018' },
  deputado_estadual: { realLimit: 'de 16 a 32 cargos em comissão', slots: 6, budget: 55_000, salary: [4_500, 18_000], source: 'LC estadual 1.136/2011, art. 7º' },
  deputado_federal: { realLimit: '5 a 25 secretários parlamentares; verba de R$ 165.806,07/mês (2026)', slots: 6, budget: 60_000, salary: [1_711, 12_979], source: 'Ato da Mesa 243/2026' },
  senador: { realLimit: 'até 50 cargos comissionados', slots: 7, budget: 75_000, salary: [5_000, 22_000], source: 'Regulamento Administrativo do Senado' },
};

export const TEAM_RULES = [
  '[REAL] Assessores de gabinete são cargos em comissão, de livre nomeação e exoneração pelo(a) parlamentar.',
  '[REAL] Limites de lotação: Câmara Municipal de SP até 18 (Lei 16.972/2018); Alesp 16 a 32 (LC 1.136/2011); Câmara dos Deputados 5 a 25 secretários, verba R$ 165.806,07/mês em 2026 (Ato da Mesa 243/2026); Senado até 50.',
  '[REAL] Rachadinha e funcionário fantasma são tratados como peculato (CP art. 312) e improbidade; podem levar à perda do mandato (CF art. 55) e à inelegibilidade (LC 64/90).',
  '[SIMPLIFICAÇÃO] Você nomeia só a equipe-chave (5 a 7 pessoas); o resto da lotação real fica abstrato.',
  '[PROPOSTA] Atributos, honestidade, verba da equipe-chave, efeitos das tarefas e riscos de denúncia são parâmetros de jogo. Todos os assessores são fictícios.',
];

export function teamOffice(s: GameState): string | null {
  const o = s.player.mandate?.office;
  return o && TEAM_LIMITS[o] ? o : null;
}

export function ensureTeam(s: GameState): TeamState {
  return (s.player.team ??= { members: [], pool: [], poolMonth: -1, exParticipants: [], report: [] });
}

export function teamPayroll(t: TeamState) {
  return t.members.reduce((x, m) => x + m.salary, 0);
}

/** Tarefas possíveis no cargo atual. */
export function taskOptions(_s: GameState): { value: TeamTask; label: string }[] {
  return (['redes', 'imprensa', 'base', 'atendimento', 'articulacao', 'legislativo'] as TeamTask[]).map((t) => ({ value: t, label: TASK_LABEL[t] }));
}

export function themeOptionsForTeam(s: GameState) {
  if (s.player.mandate?.office === 'vereador') return Object.entries(THEME_LABEL).map(([value, label]) => ({ value, label }));
  return UPPER_THEMES.map((t) => ({ value: t.value, label: t.label }));
}

function makeCandidate(s: GameState, rng: RngState, i: number, role: 'chefe' | 'assessor'): TeamMember {
  const office = teamOffice(s) ?? 'vereador';
  const lim = TEAM_LIMITS[office];
  const origin: TeamOrigin = pick(rng, ['mercado', 'mercado', 'partido', 'cabo', 'militante'] as TeamOrigin[]);
  const base = { mercado: 55, partido: 42, cabo: 38, militante: 40 }[origin];
  const honestyMean = { mercado: 62, partido: 50, cabo: 40, militante: 70 }[origin];
  const sk = (bonus = 0) => Math.round(clamp(base + bonus + normal(rng, 0, 14), 10, 95));
  const skills: Record<TeamSkill, number> = { communication: sk(), politicalKnowledge: sk(), articulation: sk(origin === 'cabo' ? 12 : origin === 'partido' ? 8 : 0), management: sk(role === 'chefe' ? 10 : 0) };
  // Especialidade: um atributo mais forte.
  const strong = pick(rng, Object.keys(skills) as TeamSkill[]);
  skills[strong] = Math.round(clamp(skills[strong] + 10 + next(rng) * 12, 10, 97));
  const honesty = Math.round(clamp(honestyMean + normal(rng, 0, 20), 3, 98));
  const avg = (skills.communication + skills.politicalKnowledge + skills.articulation + skills.management) / 4;
  const [lo, hi] = lim.salary;
  const salary = Math.round((lo + (hi - lo) * clamp((avg - 25) / 60, 0, 1) * (role === 'chefe' ? 1 : 0.85) + normal(rng, 0, (hi - lo) * 0.06)) / 50) * 50;
  const defaultTask: TeamTask = role === 'chefe' ? 'gestao' : ({ communication: 'redes', politicalKnowledge: 'legislativo', articulation: 'articulacao', management: 'atendimento' } as const)[strong];
  return {
    id: `tm_${s.month.year}_${s.month.month}_${i}_${Math.floor(next(rng) * 1e6)}`,
    name: fictionalName(rng), role, origin,
    salary: Math.max(lo, Math.min(hi, salary)), skills, honesty,
    honestyEstimate: Math.round(clamp(honesty + normal(rng, 0, 10), 0, 100)),
    loyalty: Math.round(clamp((origin === 'militante' ? 70 : origin === 'mercado' ? 45 : 55) + normal(rng, 0, 12))),
    task: defaultTask, taskParam: null, status: 'ativo', rachadinha: 0, progress: 0, hiredAt: { ...s.month }, lastOutput: '',
  };
}

/** Banco de currículos do mês (renova todo mês enquanto houver mandato). */
export function refreshPool(s: GameState, rng: RngState, force = false) {
  if (!teamOffice(s)) return;
  const t = ensureTeam(s);
  const now = mi(s.month);
  if (!force && t.poolMonth === now && t.pool.length) return;
  t.poolMonth = now;
  const hasChief = t.members.some((m) => m.role === 'chefe');
  t.pool = [];
  if (!hasChief) t.pool.push(makeCandidate(s, rng, 0, 'chefe'), makeCandidate(s, rng, 1, 'chefe'));
  while (t.pool.length < (hasChief ? 5 : 6)) t.pool.push(makeCandidate(s, rng, t.pool.length, 'assessor'));
}

export function hireMember(s: GameState, _rng: RngState, param: string): string {
  const [id, mode] = param.split('|');
  const office = teamOffice(s);
  if (!office) return 'Só com mandato legislativo você nomeia assessores.';
  const t = ensureTeam(s);
  const lim = TEAM_LIMITS[office];
  const c = t.pool.find((x) => x.id === id);
  if (!c) return 'Esse currículo não está mais disponível.';
  if (t.members.length >= lim.slots) return `Sua equipe-chave está completa (${lim.slots}).`;
  if (c.role === 'chefe' && t.members.some((m) => m.role === 'chefe')) return 'Você já tem chefe de gabinete.';
  if (teamPayroll(t) + c.salary > lim.budget) return 'O salário não cabe na verba da equipe-chave.';
  t.pool = t.pool.filter((x) => x.id !== id);
  c.hiredAt = { ...s.month };
  if (mode === 'fantasma') {
    c.status = 'fantasma';
    s.flags.fantasmasNomeados = Number(s.flags.fantasmasNomeados ?? 0) + 1;
  }
  t.members.push(c);
  if (c.origin === 'partido') {
    s.player.partyRel.leadershipTrust = clamp(s.player.partyRel.leadershipTrust + 3);
    s.player.partyRel.perceivedLoyalty = clamp(s.player.partyRel.perceivedLoyalty + 2);
  }
  if (c.origin === 'cabo') s.player.base = clamp(s.player.base + 1);
  if (c.origin === 'militante') s.player.partyRel.internalPopularity = clamp(s.player.partyRel.internalPopularity + 1.5);
  const extra = mode === 'fantasma'
    ? ' Nomeado(a) sem precisar aparecer: é funcionário fantasma — ILEGAL (peculato). A frequência é atestada por você todo mês.'
    : ` Tarefa inicial: ${TASK_LABEL[c.task]}.`;
  return `${c.name} nomeado(a) ${c.role === 'chefe' ? 'chefe de gabinete' : 'assessor(a)'} (${ORIGIN_LABEL[c.origin].toLowerCase()}, R$ ${c.salary.toLocaleString('pt-BR')}).${extra}`;
}

export function fireMember(s: GameState, _rng: RngState, id: string): string {
  const t = ensureTeam(s);
  const m = t.members.find((x) => x.id === id);
  if (!m) return 'Assessor não encontrado.';
  t.members = t.members.filter((x) => x.id !== id);
  if (m.origin === 'partido') s.player.partyRel.leadershipTrust = clamp(s.player.partyRel.leadershipTrust - 3);
  let note = `${m.name} foi exonerado(a).`;
  if (m.rachadinha > 0) {
    const resentment = clamp(100 - m.loyalty + 20);
    t.exParticipants.push({ name: m.name, resentment, until: mi(s.month) + 36 });
    note += ' Ele(a) sabe da rachadinha e saiu contrariado(a): o risco de denúncia continua.';
  }
  return note;
}

export function assignTask(s: GameState, param: string): string {
  const [id, task, p] = param.split('|') as [string, TeamTask, string | undefined];
  const t = ensureTeam(s);
  const m = t.members.find((x) => x.id === id);
  if (!m) return 'Assessor não encontrado.';
  if (m.role === 'chefe' && task !== 'gestao' && !TASK_LABEL[task]) return 'Tarefa inválida.';
  if (!TASK_LABEL[task]) return 'Tarefa inválida.';
  m.task = task;
  m.taskParam = p ?? (task === 'base' ? s.player.homeRegion : task === 'legislativo' ? themeOptionsForTeam(s)[0].value : null);
  if (task !== 'legislativo') m.progress = 0;
  const where = task === 'base' ? ` (${REGIONS.find((r) => r.id === m.taskParam)?.name ?? m.taskParam})` : task === 'legislativo' ? ` (${themeOptionsForTeam(s).find((x) => x.value === m.taskParam)?.label ?? m.taskParam})` : '';
  const warn = m.status !== 'ativo' ? ' Atenção: essa pessoa não está trabalhando de fato.' : '';
  return `${m.name} agora cuida de: ${TASK_LABEL[task]}${where}.${warn}`;
}

/** Chance de aceitar rachadinha — depende da honestidade (oculta), da lealdade e do tamanho da devolução. */
export function rachadinhaAcceptance(m: TeamMember, share: number) {
  const dishonesty = (100 - m.honesty) / 100;
  let p = Math.pow(dishonesty, 1.4) * (0.6 + m.loyalty / 250) - (share >= 0.7 ? 0.12 : share >= 0.5 ? 0.05 : 0);
  if (m.status === 'fantasma') p += 0.3; // quem recebe sem trabalhar costuma topar devolver
  return clamp(p, 0.02, 0.97);
}

export function proposeRachadinha(s: GameState, rng: RngState, param: string): string {
  const [id, sh] = param.split('|');
  const share = Math.max(0.1, Math.min(0.8, Number(sh) || 0.3));
  const t = ensureTeam(s);
  const m = t.members.find((x) => x.id === id);
  if (!m) return 'Assessor não encontrado.';
  if (m.rachadinha > 0) return `${m.name} já devolve parte do salário.`;
  if (next(rng) < rachadinhaAcceptance(m, share)) {
    m.rachadinha = share;
    s.flags.rachadinha = Number(s.flags.rachadinha ?? 0) + 1;
    return `${m.name} topou: devolverá ${Math.round(share * 100)}% do salário (≈ R$ ${Math.round(m.salary * share).toLocaleString('pt-BR')}/mês). Isso é peculato: cada mês aumenta o risco de denúncia, operação e perda do mandato.`;
  }
  m.loyalty = clamp(m.loyalty - 25);
  const denounceP = (m.honesty / 100) * 0.3;
  if (next(rng) < denounceP) {
    t.members = t.members.filter((x) => x.id !== m.id);
    s.flags.rachadinha = Number(s.flags.rachadinha ?? 0) + 1;
    return [`${m.name} recusou, pediu exoneração e levou a proposta ao Ministério Público.`, ...exposeRachadinha(s, rng, `denúncia de ${m.name}`)].join(' ');
  }
  if (m.honesty > 70 && next(rng) < 0.5) {
    t.members = t.members.filter((x) => x.id !== m.id);
    return `${m.name} recusou e pediu exoneração. Por enquanto, não foi além disso.`;
  }
  return `${m.name} recusou, constrangido(a). A lealdade caiu e a conversa fica na memória dele(a).`;
}

export function stopRachadinha(s: GameState, id: string): string {
  const m = ensureTeam(s).members.find((x) => x.id === id);
  if (!m || !m.rachadinha) return 'Nada a encerrar.';
  m.rachadinha = 0;
  m.loyalty = clamp(m.loyalty + 5);
  return `Você parou de cobrar a devolução de ${m.name}. O que já aconteceu continua podendo vir à tona.`;
}

export function regularizeGhost(s: GameState, id: string): string {
  const m = ensureTeam(s).members.find((x) => x.id === id);
  if (!m || m.status === 'ativo') return 'Nada a regularizar.';
  m.status = 'ativo';
  m.loyalty = clamp(m.loyalty - (m.honesty < 40 ? 10 : 0));
  return `${m.name} passa a cumprir expediente. Tarefa: ${TASK_LABEL[m.task]}.`;
}

/** Investigação de rachadinha. */
export function exposeRachadinha(s: GameState, rng: RngState, origin: string): string[] {
  const t = ensureTeam(s);
  s.flags.rachadinhaInvestigada = true;
  const n = Number(s.flags.rachadinha ?? 1);
  s.character.attributes.popularity = clamp(s.character.attributes.popularity - 10);
  s.player.credibility = clamp((s.player.credibility ?? 60) - 15);
  s.flags.vantagemIndevida = Number(s.flags.vantagemIndevida ?? 0) + 1;
  const mm = s.player.mandate;
  if (mm) mm.approval = clamp(mm.approval - 12);
  for (const x of t.members) x.rachadinha = 0;
  s.crises.push({ id: `cr_rach_${s.month.year}_${s.month.month}`, targetId: 'character_player', targetName: s.character.name, topic: 'rachadinha', headline: `MP investiga "rachadinha" no gabinete de ${s.character.name}`, truth: 'verdadeira', outletId: 'tvmetropole', severity: 85, month: { ...s.month }, deadline: mi(s.month) + 1, status: 'ativa', response: null, outcome: null, origin });
  const notes = [`INVESTIGAÇÃO: o Ministério Público apura devolução de salários no seu gabinete (${origin}). Quebra de sigilo bancário dos assessores.`];
  if (mm && next(rng) < 0.2 + n * 0.08) {
    s.flags.cassado = true;
    s.flags.perdaMandatoEsquema = true;
    notes.push('O Conselho de Ética recomendou e o plenário aprovou a perda do seu mandato por quebra de decoro (CF art. 55).');
  }
  return notes;
}

function exposeGhost(s: GameState, m: TeamMember, ordered: boolean): string {
  s.flags.fantasmaExposto = Number(s.flags.fantasmaExposto ?? 0) + 1;
  const mm = s.player.mandate;
  s.character.attributes.popularity = clamp(s.character.attributes.popularity - (ordered ? 6 : 3));
  if (mm) mm.approval = clamp(mm.approval - (ordered ? 7 : 3));
  s.player.credibility = clamp((s.player.credibility ?? 60) - (ordered ? 8 : 3));
  if (ordered) s.flags.vantagemIndevida = Number(s.flags.vantagemIndevida ?? 0) + 1;
  s.crises.push({ id: `cr_fant_${m.id}`, targetId: 'character_player', targetName: s.character.name, topic: 'fantasma', headline: `Assessor(a) de ${s.character.name} recebe sem aparecer no trabalho`, truth: 'verdadeira', outletId: 'diariopaulistano', severity: ordered ? 65 : 35, month: { ...s.month }, deadline: mi(s.month) + 1, status: 'ativa', response: null, outcome: null, origin: ordered ? 'funcionário fantasma nomeado' : 'assessor relapso' });
  return ordered
    ? `REPORTAGEM: ${m.name}, do seu gabinete, recebe salário sem trabalhar — e a frequência foi atestada por você.`
    : `REPORTAGEM: ${m.name}, do seu gabinete, quase nunca aparece. Você não sabia, mas atestou a frequência: a cobrança cai sobre o seu mandato.`;
}

/** Passo mensal: produção da equipe, desvios, devoluções e riscos. */
export function teamMonthlyStep(s: GameState, rng: RngState): string[] {
  const t = s.player.team;
  const notes: string[] = [];
  const office = teamOffice(s);
  if (t && !office && t.members.length) {
    notes.push(`Fim do mandato: sua equipe de ${t.members.length} assessor(es) foi exonerada.`);
    for (const m of t.members) if (m.rachadinha > 0) t.exParticipants.push({ name: m.name, resentment: clamp(100 - m.loyalty), until: mi(s.month) + 36 });
    t.members = [];
    t.pool = [];
  }
  if (!t) return notes;
  const now = mi(s.month);
  // Ex-participantes ressentidos podem denunciar (também depois do mandato).
  t.exParticipants = t.exParticipants.filter((x) => x.until > now);
  if (!s.flags.rachadinhaInvestigada) {
    for (const x of t.exParticipants) {
      if (next(rng) < (x.resentment / 100) * 0.025) { notes.push(...exposeRachadinha(s, rng, `denúncia de ex-assessor(a) ${x.name}`)); break; }
    }
  }
  if (!office) { t.report = []; return notes; }

  const chief = t.members.find((m) => m.role === 'chefe' && m.status === 'ativo');
  const chiefBoost = chief ? 1 + chief.skills.management / 400 : 1;
  const report: string[] = [];
  let approvalGain = 0;
  const mm = s.player.mandate!;
  for (const m of t.members) {
    // Desvio espontâneo: quem tem pouca honestidade pode parar de aparecer.
    if (m.status === 'ativo' && m.honesty < 45 && next(rng) < (45 - m.honesty) / 1200 * (chief ? 0.6 : 1)) {
      m.status = 'relapso';
    }
    // Lealdade caminha devagar: rachadinha corrói, salário alto e tempo de casa ajudam.
    m.loyalty = clamp(m.loyalty + (m.rachadinha > 0 ? -0.6 * m.rachadinha * 2 : 0.15));
    if (m.status !== 'ativo') {
      m.lastOutput = m.status === 'fantasma' ? 'Não trabalha (nomeado como fantasma).' : 'Sem produção: frequência irregular.';
      if (m.status === 'fantasma') {
        if (m.origin === 'cabo') s.player.base = clamp(s.player.base + 0.3);
        if (m.origin === 'partido') s.player.partyRel.leadershipTrust = clamp(s.player.partyRel.leadershipTrust + 0.25);
      }
      report.push(`${m.name}: ${m.lastOutput}`);
      continue;
    }
    if (m.role === 'chefe' && m.task === 'gestao') {
      m.lastOutput = `Coordena a equipe (+${Math.round((chiefBoost - 1) * 100)}% na produção dos demais).`;
      report.push(`${m.name}: ${m.lastOutput}`);
      continue;
    }
    const q = (m.skills[TASK_SKILL[m.task]] / 50) * chiefBoost * Math.max(0.4, 1 + normal(rng, 0, 0.2));
    switch (m.task) {
      case 'redes': {
        const net = NETWORKS.find((n) => n.id === s.player.social.focus)!;
        const f = s.player.social.networks[net.id];
        const gained = Math.round((250 + f * 0.004 * (1 - Math.min(0.95, f / 12_000_000))) * net.growth * q);
        s.player.social.networks[net.id] = f + gained;
        m.lastOutput = `+${gained.toLocaleString('pt-BR')} seguidores em ${net.label}.`;
        break;
      }
      case 'imprensa': {
        s.player.recognition = clamp(s.player.recognition + 0.15 * q);
        s.player.credibility = clamp((s.player.credibility ?? 60) + 0.1 * q);
        const active = s.crises.filter((c) => c.status === 'ativa' && c.targetId === 'character_player');
        for (const c of active) c.severity = clamp(c.severity - 3 * q);
        m.lastOutput = active.length ? `Trabalhou ${active.length} crise(s) com a imprensa (gravidade reduzida).` : `Notas e entrevistas: reconhecimento +${(0.15 * q).toFixed(2)}.`;
        break;
      }
      case 'base': {
        const region = m.taskParam ?? s.player.homeRegion;
        addGoodwill(s, region, 0.8 * q);
        s.player.base = clamp(s.player.base + 0.3 * q);
        if (mm.upper) mm.upper.awayFromBase = Math.max(0, mm.upper.awayFromBase - 0.5 * q);
        m.lastOutput = `Agenda em ${REGIONS.find((r) => r.id === region)?.name ?? region}: base +${(0.3 * q).toFixed(2)}.`;
        break;
      }
      case 'atendimento': {
        approvalGain += 0.15 * q;
        m.lastOutput = 'Atendeu pedidos de eleitores e encaminhou demandas.';
        break;
      }
      case 'articulacao': {
        s.player.partyRel.leadershipTrust = clamp(s.player.partyRel.leadershipTrust + 0.15 * q);
        if (mm.upper) mm.upper.relationGov = clamp(mm.upper.relationGov + 0.3 * q);
        else mm.relationExecutive = clamp(mm.relationExecutive + 0.3 * q);
        m.lastOutput = `Conversas com partido e governo (relação +${(0.3 * q).toFixed(2)}).`;
        break;
      }
      case 'legislativo': {
        m.progress += 14 * q + next(rng) * 6;
        const theme = m.taskParam ?? themeOptionsForTeam(s)[0].value;
        if (m.progress >= 100) {
          m.progress = 0;
          if (mm.office === 'vereador') {
            if (s.legislature.bills.filter((b) => b.author === PLAYER && isActive(b)).length < 4) {
              const b = fileBill(s, rng, theme, 'regulacao');
              m.lastOutput = `Minuta pronta: você protocolou o ${b.number} (${b.title}).`;
              notes.push(`Sua assessoria entregou uma minuta e você protocolou o ${b.number}.`);
            } else m.lastOutput = 'Minuta pronta, mas você já tem 4 projetos tramitando: ficou na gaveta.';
          } else if (isLegislatorUpper(mm.office) && mm.upper) {
            if (mm.upper.bills.filter((b) => b.status === 'tramitando').length < 6) {
              upperBill(s, rng, theme);
              m.lastOutput = 'Minuta pronta: você apresentou um novo projeto.';
              notes.push('Sua assessoria entregou uma minuta e você apresentou um novo projeto.');
            } else m.lastOutput = 'Minuta pronta, mas já há 6 projetos seus tramitando: ficou na gaveta.';
          }
        } else m.lastOutput = `Minuta sobre ${themeOptionsForTeam(s).find((x) => x.value === theme)?.label.toLowerCase() ?? theme}: ${Math.round(m.progress)}%.`;
        break;
      }
      default:
        m.lastOutput = '';
    }
    report.push(`${m.name}: ${m.lastOutput}`);
  }
  if (approvalGain) mm.approval = clamp(mm.approval + Math.min(0.6, approvalGain));

  // Rachadinha: devolução mensal e risco.
  const rach = t.members.filter((m) => m.rachadinha > 0);
  if (rach.length) {
    const total = Math.round(rach.reduce((x, m) => x + m.salary * m.rachadinha, 0));
    s.finances.cash += total;
    s.flags.rachadinhaTotal = Number(s.flags.rachadinhaTotal ?? 0) + total;
    report.push(`Devoluções de salário recebidas: R$ ${total.toLocaleString('pt-BR')} (ilegal).`);
    if (!s.flags.rachadinhaInvestigada) {
      const p = rach.reduce((x, m) => x + 0.004 + (1 - m.loyalty / 100) * 0.01 + (m.honesty / 100) * 0.006, 0) + (s.player.recognition > 60 ? 0.003 : 0);
      if (next(rng) < p) notes.push(...exposeRachadinha(s, rng, 'movimentação bancária atípica (Coaf)'));
    }
  }
  // Fantasmas e relapsos: a imprensa e o controle checam frequência.
  for (const m of t.members) {
    if (m.status === 'ativo' || s.crises.some((c) => c.id === `cr_fant_${m.id}`)) continue;
    const p = m.status === 'fantasma' ? 0.007 + (s.player.recognition > 60 ? 0.004 : 0) : 0.004;
    if (next(rng) < p) notes.push(exposeGhost(s, m, m.status === 'fantasma'));
  }
  t.report = report;
  return notes;
}

/** Resumo para a interface. */
export function teamSummary(s: GameState) {
  const office = teamOffice(s);
  const t = s.player.team;
  if (!office || !t) return null;
  const lim = TEAM_LIMITS[office];
  return { office, lim, payroll: teamPayroll(t), free: lim.budget - teamPayroll(t), slotsLeft: lim.slots - t.members.length };
}

/** Avaliação textual da ficha (o que o jogador vê ao escolher). */
export function honestyLabel(v: number) {
  return v >= 75 ? 'íntegro(a)' : v >= 55 ? 'confiável' : v >= 35 ? 'duvidoso(a)' : 'pouco confiável';
}
