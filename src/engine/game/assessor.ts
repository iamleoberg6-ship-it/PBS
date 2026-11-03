// Assessoria parlamentar jogável (Fase 4).
//
// [REAL] Assessor(a) de gabinete é cargo em comissão, de livre nomeação e exoneração pelo(a) vereador(a).
// [REAL] É vedado usar servidor público em campanha durante o expediente (Lei 9.504/97, art. 73, III).
// [FICÇÃO/PARÂMETRO] Demandas, confiança do(a) vereador(a), rede de contatos, faixas salariais e promoções são
//   mecânicas do jogo. Quando o(a) chefe é uma pessoa real, o jogo só gera tarefas institucionais comuns
//   (pareceres, agenda, atendimento); dilemas éticos envolvem apenas terceiros fictícios.

import { next, pick, type RngState } from '../rng';
import { REGIONS, regionById } from '../data/regions';
import { partyById } from '../data/parties';
import { PLAYER, adjustRel } from './relations';
import { THEME_LABEL, fileBill, isActive, nameOf } from './legislature';
import { ensurePlan } from './campaign';
import type { AttributeKey, GameState, StaffDemand, StaffJob } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

export const STAFF_RANKS = {
  assessor: { label: 'Assessor(a) parlamentar', salary: 9500 },
  assessor_especial: { label: 'Assessor(a) especial', salary: 14000 },
  chefe_gabinete: { label: 'Chefe de gabinete', salary: 19000 },
} as const;

export const STAFF_RULES = [
  '[REAL] Cargo em comissão, de livre nomeação e exoneração pelo(a) vereador(a).',
  '[REAL] Servidor não pode fazer campanha durante o expediente (Lei 9.504/97, art. 73, III).',
  '[PARÂMETRO] Salários por nível (R$ 9.500 / 14.000 / 19.000) são valores de jogo, não a tabela da Câmara.',
  '[FICÇÃO] Demandas do gabinete, confiança do(a) vereador(a) e rede de contatos são simulação; com chefe real, o jogo não cria condutas nem falas atribuídas a ele(a).',
];

const themes = () => Object.keys(THEME_LABEL);

export function hireAsStaff(s: GameState, bossId: string): StaffJob | null {
  const c = s.government.councillors.find((x) => x.id === bossId);
  if (!c) return null;
  const job: StaffJob = {
    bossId, bossName: c.name, bossPartyId: c.partyId, bossReal: c.real, rank: 'assessor', trust: 45, contacts: 10,
    specialty: null, demands: [], completed: 0, failed: 0, draftedBills: [], since: { ...s.month },
  };
  s.player.staff = job;
  s.player.job = 'assessor';
  s.finances.monthlyIncome = STAFF_RANKS.assessor.salary;
  generateDemands(s, s.rng);
  return job;
}

export function leaveStaff(s: GameState, reason: string) {
  if (!s.player.staff) return;
  s.player.careerHistory.forEach((h) => { if (h.to === null && h.office.includes('ssessor') || (h.to === null && h.office.includes('Chefe de gabinete'))) h.to = `${s.month.year}-${String(s.month.month).padStart(2, '0')}`; });
  s.player.staff = null;
  if (s.player.job === 'assessor') s.player.job = 'profissao';
  s.log.push({ month: { ...s.month }, kind: 'acao', text: reason });
}

function bossCommittee(s: GameState, job: StaffJob) {
  return s.legislature.committees.find((c) => c.members.includes(job.bossId)) ?? null;
}

/** Demandas do mês, de acordo com o nível e com o que acontece na Câmara. */
export function generateDemands(s: GameState, rng: RngState) {
  const job = s.player.staff;
  if (!job) return;
  const n = job.rank === 'chefe_gabinete' ? 3 : 2;
  const out: StaffDemand[] = job.demands.filter((d) => d.monthsLeft > 0);
  const comm = bossCommittee(s, job);
  const kinds: StaffDemand['kind'][] = ['parecer', 'minuta', 'agenda_bairro', 'atendimento', 'articulacao', 'redes', 'imprensa'];
  let guard = 0;
  while (out.length < n && guard++ < 20) {
    const kind = pick(rng, kinds);
    if (out.some((d) => d.kind === kind)) continue;
    const id = `dm_${s.month.year}_${s.month.month}_${out.length}_${Math.floor(next(rng) * 1e5)}`;
    const diff = Math.round(30 + next(rng) * 40 + (job.rank === 'chefe_gabinete' ? 10 : 0));
    if (kind === 'parecer') {
      const b = comm ? s.legislature.bills.find((x) => isActive(x) && x.committeeId === comm.id && ['ccj', 'merito', 'financas'].includes(x.stage)) : null;
      if (!b) continue;
      out.push({ id, kind, label: `Preparar o parecer do gabinete sobre o ${b.number} (${b.title}) na Comissão de ${comm!.name}`, attr: 'politicalKnowledge', difficulty: diff, monthsLeft: 1, billId: b.id });
    } else if (kind === 'minuta') {
      const theme = job.specialty && next(rng) < 0.6 ? job.specialty : pick(rng, themes());
      out.push({ id, kind, label: `Redigir a minuta de um projeto de lei sobre ${THEME_LABEL[theme].toLowerCase()}`, attr: 'politicalKnowledge', difficulty: diff + 5, monthsLeft: 2, theme });
    } else if (kind === 'agenda_bairro') {
      const r = pick(rng, REGIONS);
      out.push({ id, kind, label: `Organizar a agenda do gabinete na região ${r.name}`, attr: 'leadership', difficulty: diff, monthsLeft: 1, region: r.id });
    } else if (kind === 'atendimento') {
      out.push({ id, kind, label: 'Atender lideranças e encaminhar demandas de bairro à prefeitura', attr: 'communication', difficulty: diff - 5, monthsLeft: 1 });
    } else if (kind === 'articulacao') {
      out.push({ id, kind, label: 'Conversar com gabinetes de outras bancadas sobre a pauta do mês', attr: 'articulation', difficulty: diff, monthsLeft: 1 });
    } else if (kind === 'redes') {
      out.push({ id, kind, label: 'Produzir conteúdo e responder mensagens nas redes do gabinete', attr: 'communication', difficulty: diff - 10, monthsLeft: 1 });
    } else {
      out.push({ id, kind, label: 'Responder pedidos de informação da imprensa sobre o mandato', attr: 'communication', difficulty: diff, monthsLeft: 1 });
    }
  }
  job.demands = out;
}

export function demandChance(s: GameState, d: StaffDemand): number {
  const job = s.player.staff!;
  const a = s.character.attributes[d.attr as AttributeKey];
  const spec = d.theme && job.specialty === d.theme ? 12 : 0;
  return Math.max(0.1, Math.min(0.95, 0.5 + (a + spec + job.contacts * 0.15 - d.difficulty) / 80));
}

export function fulfillDemand(s: GameState, rng: RngState, demandId: string): string {
  const job = s.player.staff;
  if (!job) return 'Você não trabalha em gabinete.';
  const d = job.demands.find((x) => x.id === demandId);
  if (!d) return 'Demanda não encontrada.';
  job.demands = job.demands.filter((x) => x.id !== demandId);
  const ok = next(rng) < demandChance(s, d);
  const attrs = s.character.attributes;
  const learn = (k: AttributeKey, v: number) => { attrs[k] = clamp(attrs[k] + v); };
  if (!ok) {
    job.trust = clamp(job.trust - 3);
    job.failed++;
    learn(d.attr, 0.6);
    return `A tarefa saiu abaixo do esperado: ${d.label.toLowerCase()}. Confiança do gabinete −3 (você aprendeu com o erro).`;
  }
  job.completed++;
  job.trust = clamp(job.trust + 4 + (d.difficulty > 60 ? 2 : 0));
  learn(d.attr, 1.2);
  let extra = '';
  switch (d.kind) {
    case 'parecer': {
      const b = s.legislature.bills.find((x) => x.id === d.billId);
      learn('politicalKnowledge', 0.8);
      job.contacts = clamp(job.contacts + 2);
      if (b) extra = ` O parecer do ${b.number} foi apresentado pelo gabinete na comissão.`;
      break;
    }
    case 'minuta': {
      const b = fileBill(s, rng, d.theme ?? 'zeladoria', next(rng) < 0.5 ? 'regulacao' : 'programa');
      b.author = `bancada:${job.bossPartyId}`;
      b.history[0].text = `Protocolado pelo gabinete de ${job.bossName}; minuta redigida por você. Segue à Comissão de Constituição e Justiça.`;
      b.payload = { ...(b.payload ?? {}), redigidoPor: 'jogador' };
      job.draftedBills.push(b.id);
      if (!job.specialty) job.specialty = d.theme ?? null;
      extra = ` O gabinete protocolou o ${b.number}, com texto seu.${job.specialty === d.theme ? ` Você vira referência no tema ${THEME_LABEL[d.theme!].toLowerCase()}.` : ''}`;
      break;
    }
    case 'agenda_bairro': {
      s.player.base = clamp(s.player.base + 1.2);
      const plan = ensurePlan(s);
      if (plan && d.region) plan.regions[d.region].knowledge = clamp(plan.regions[d.region].knowledge + 4);
      s.flags[`regiao_${d.region}`] = Number(s.flags[`regiao_${d.region}`] ?? 0) + 1;
      extra = ` Você conheceu lideranças de ${regionById(d.region!)?.name}.`;
      break;
    }
    case 'atendimento':
      s.player.base = clamp(s.player.base + 1);
      job.contacts = clamp(job.contacts + 1);
      break;
    case 'articulacao': {
      job.contacts = clamp(job.contacts + 4);
      const others = s.government.councillors.filter((c) => c.id !== job.bossId && c.id !== PLAYER);
      const c = pick(rng, others);
      adjustRel(s, c.id, PLAYER, { trust: 4, affinity: 3 });
      extra = ` Você abriu canal com o gabinete de ${c.name}.`;
      break;
    }
    case 'redes':
      s.player.social.networks.instagram += Math.round(200 + next(rng) * 600);
      break;
    case 'imprensa':
      s.player.recognition = clamp(s.player.recognition + 0.8);
      break;
  }
  return `Tarefa entregue: ${d.label.toLowerCase()}. Confiança do gabinete +${d.difficulty > 60 ? 6 : 4}.${extra}`;
}

/** Iniciativas próprias do assessor (fora das demandas). */
export function staffInitiative(s: GameState, rng: RngState, kind: string): string {
  const job = s.player.staff!;
  const a = s.character.attributes;
  if (kind === 'estudar_pauta') {
    a.politicalKnowledge = clamp(a.politicalKnowledge + 1.5);
    job.contacts = clamp(job.contacts + 1);
    return 'Você acompanhou sessões e comissões e estudou a pauta. Conhecimento político +1,5.';
  }
  if (kind === 'bastidores') {
    job.contacts = clamp(job.contacts + 5 + a.articulation / 25);
    const c = pick(rng, s.government.councillors.filter((x) => x.id !== PLAYER));
    adjustRel(s, c.id, PLAYER, { trust: 3 });
    a.articulation = clamp(a.articulation + 0.8);
    return `Cafés e conversas de corredor: rede de contatos ${Math.round(job.contacts)}/100. Você se aproximou do gabinete de ${c.name}.`;
  }
  if (kind === 'base_propria') {
    s.player.base = clamp(s.player.base + 2.5);
    const visible = s.player.base > 25;
    if (visible) job.trust = clamp(job.trust - 3);
    return `Você trabalhou a própria base nos bairros.${visible ? ' O gabinete notou que você está construindo voo próprio (confiança −3).' : ''}`;
  }
  if (kind === 'representar') {
    if (job.rank !== 'chefe_gabinete') return 'Só a chefia de gabinete representa o mandato.';
    s.player.recognition = clamp(s.player.recognition + 1.5);
    s.player.partyRel.influence = clamp(s.player.partyRel.influence + 2);
    job.contacts = clamp(job.contacts + 3);
    return 'Você representou o gabinete em reuniões com a prefeitura e com o partido. Influência no partido +2.';
  }
  return 'Iniciativa desconhecida.';
}

export function askPromotion(s: GameState, rng: RngState): string {
  const job = s.player.staff!;
  const nextRank = job.rank === 'assessor' ? 'assessor_especial' : job.rank === 'assessor_especial' ? 'chefe_gabinete' : null;
  if (!nextRank) return 'Você já chefia o gabinete.';
  const need = nextRank === 'assessor_especial' ? { trust: 65, done: 6 } : { trust: 80, done: 14 };
  if (job.trust < need.trust || job.completed < need.done) return `Ainda não: a promoção pede confiança ≥ ${need.trust} e ${need.done} tarefas entregues (hoje: ${Math.round(job.trust)} e ${job.completed}).`;
  if (next(rng) < 0.7) {
    job.rank = nextRank;
    s.finances.monthlyIncome = STAFF_RANKS[nextRank].salary;
    s.player.careerHistory.push({ office: `${STAFF_RANKS[nextRank].label} — gabinete de ${job.bossName}`, from: `${s.month.year}-${String(s.month.month).padStart(2, '0')}`, to: null, note: 'Promoção' });
    return `Promoção: agora você é ${STAFF_RANKS[nextRank].label.toLowerCase()} (salário de jogo R$ ${STAFF_RANKS[nextRank].salary.toLocaleString('pt-BR')}).`;
  }
  return 'O gabinete adiou a decisão sobre sua promoção para os próximos meses.';
}

export function switchOffice(s: GameState, rng: RngState, bossId: string): string {
  const job = s.player.staff!;
  const c = s.government.councillors.find((x) => x.id === bossId);
  if (!c) return 'Vereador(a) não encontrado(a).';
  const p = 0.3 + job.contacts / 200 + s.player.partyRel.leadershipTrust / 300;
  if (next(rng) > p) return `O gabinete de ${c.name} não tinha vaga para você.`;
  adjustRel(s, job.bossId, PLAYER, { trust: -5 });
  const keepContacts = job.contacts;
  hireAsStaff(s, bossId);
  s.player.staff!.contacts = keepContacts;
  s.player.careerHistory.push({ office: `Assessor(a) — gabinete de ${c.name}`, from: `${s.month.year}-${String(s.month.month).padStart(2, '0')}`, to: null, note: 'Troca de gabinete' });
  return `Você foi para o gabinete de ${c.name} (${partyById(c.partyId)?.acronym}). Começa como assessor(a), com sua rede de contatos.`;
}

/** Fechamento mensal: cobra demandas vencidas, gera novas e avalia apoio a uma candidatura do jogador. */
export function staffMonthlyStep(s: GameState, rng: RngState): string[] {
  const job = s.player.staff;
  const out: string[] = [];
  if (!job) return out;
  if (!s.government.councillors.some((c) => c.id === job.bossId)) {
    leaveStaff(s, `O mandato de ${job.bossName} terminou e o gabinete foi desfeito. Você deixou o cargo de assessor(a).`);
    return out;
  }
  for (const d of job.demands) d.monthsLeft--;
  const expired = job.demands.filter((d) => d.monthsLeft <= 0);
  if (expired.length) {
    job.trust = clamp(job.trust - 6 * expired.length);
    job.failed += expired.length;
    out.push(`Demandas do gabinete não entregues: ${expired.map((d) => d.label.toLowerCase()).join('; ')}. Confiança −${6 * expired.length}.`);
  }
  job.demands = job.demands.filter((d) => d.monthsLeft > 0);
  job.trust = clamp(job.trust + (50 - job.trust) * 0.02);
  // Exoneração (livre nomeação) se a confiança desabar.
  if (job.trust < 20 && next(rng) < 0.5) {
    leaveStaff(s, `EXONERAÇÃO: ${job.bossName} exonerou você do gabinete (cargo de livre nomeação).`);
    return out;
  }
  // Projetos que você redigiu e viraram lei rendem prestígio nos bastidores.
  for (const id of job.draftedBills) {
    const b = s.legislature.bills.find((x) => x.id === id);
    if (b?.stage === 'lei' && !s.flags[`credito_${id}`]) {
      s.flags[`credito_${id}`] = true;
      job.trust = clamp(job.trust + 6);
      job.contacts = clamp(job.contacts + 5);
      s.player.partyRel.influence = clamp(s.player.partyRel.influence + 2);
      out.push(`O ${b.number}, que você redigiu, virou lei. Prestígio no gabinete e no partido.`);
    }
  }
  generateDemands(s, rng);
  return out;
}

/** Apoio do(a) chefe à candidatura do jogador (antes da convenção de 2028). */
export function bossEndorsement(s: GameState): string | null {
  const job = s.player.staff;
  const c = s.player.candidacy;
  if (!job || !c || s.flags.apoioChefe) return null;
  if (job.trust < 60) return null;
  s.flags.apoioChefe = true;
  s.player.partyRel.leadershipTrust = clamp(s.player.partyRel.leadershipTrust + 5);
  // O gabinete empresta estrutura: equipe de rua, lideranças e visibilidade nos bairros onde atua.
  s.player.base = clamp(s.player.base + 4 + job.contacts / 15);
  s.player.recognition = clamp(s.player.recognition + 3 + (job.rank === 'chefe_gabinete' ? 4 : job.rank === 'assessor_especial' ? 2 : 0));
  const plan = ensurePlan(s);
  if (plan) for (const r of REGIONS) if ((s.flags[`regiao_${r.id}`] as number) > 0) plan.regions[r.id].leaders = Math.min(5, plan.regions[r.id].leaders + 1);
  return `O gabinete de ${job.bossName} apoia sua pré-candidatura${c.office === 'vereador' && job.bossPartyId === s.player.partyId ? ' (vocês estarão na mesma lista: os votos de um ajudam o quociente do outro)' : ''}. Base +4 e lideranças das regiões onde você trabalhou.`;
}

export function staffBossOptions(s: GameState): { value: string; label: string }[] {
  return s.government.councillors
    .filter((c) => c.id !== PLAYER && (c.partyId === s.player.partyId || (s.player.partyId && partyById(c.partyId)?.federationId && partyById(c.partyId)?.federationId === partyById(s.player.partyId)?.federationId)))
    .map((c) => ({ value: c.id, label: `${c.name} (${partyById(c.partyId)?.acronym})${c.real ? ' — vereador(a) real; relação simulada' : ''}` }));
}

export const nameOfBoss = (s: GameState) => (s.player.staff ? nameOf(s, s.player.staff.bossId) : '');
