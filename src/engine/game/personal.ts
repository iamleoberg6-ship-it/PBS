// Vida pessoal do político (Fase 8): família, relacionamentos, exposição e ameaças, segurança, saúde, licença do cargo
// e herdeiro político. Tudo é FICÇÃO de gameplay com personagens do jogo, exceto as regras marcadas como REGRA REAL
// (PERSONAL_RULES). Ameaças nunca envolvem pessoas reais e não têm descrição gráfica.

import { monthIndex } from '../calendar';
import { createRng, next, type RngState } from '../rng';
import { generalPosition } from '../data/ideology';
import type { Character, GameState, StartStatus } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const grow = (cur: number, gain: number) => (gain > 0 ? clamp(cur + gain * Math.pow(1 - cur / 100, 1.6)) : clamp(cur + gain));
const now = (s: GameState) => monthIndex(s.month);
const pickOne = <T,>(rng: RngState, arr: T[]) => arr[Math.floor(next(rng) * arr.length)];

export type FamilyRelation = 'conjuge' | 'companheiro' | 'filho' | 'pai' | 'mae' | 'irmao';
export type Trait = 'apoiador' | 'reservado' | 'ambicioso' | 'problematico';
export type Marital = 'solteiro' | 'namorando' | 'casado' | 'uniao_estavel' | 'divorciado';
export type Security = 'nenhuma' | 'privada' | 'policial' | 'oficial';

export interface FamilyMember {
  id: string;
  name: string;
  relation: FamilyRelation;
  gender: 'F' | 'M';
  birthYear: number;
  /** Como a pessoa está com você (0–100). */
  mood: number;
  trait: Trait;
  /** Interesse em seguir carreira política (0–100). */
  politicalInterest: number;
  politics?: { office: 'vereador' | 'deputado_estadual'; year: number; status: 'pre' | 'eleito' | 'derrotado'; since?: number; until?: number; seated?: boolean } | null;
  /** Ex-político (pais de quem começa como herdeiro): só contexto. */
  formerOffice?: string;
  employedByPlayer?: 'direto' | 'cruzado';
  /** Ex-cônjuge depois do divórcio. */
  ex?: boolean;
}
export interface Friend { id: string; name: string; kind: 'amigo' | 'mentor' | 'ex_socio'; trust: number }
export interface Rival { name: string; intensity: number; since: number }
export interface Romance { name: string; gender: 'F' | 'M'; birthYear: number; affinity: number; stage: 'conhecendo' | 'namoro'; since: number; public: boolean }
export interface Threat { month: number; level: number; text: string; gendered: boolean; response?: string }
export interface Leave { office: string; since: number; until: number; reason: 'interesse' | 'saude' | 'ameaca' | 'nascimento'; paid: boolean }

export interface PersonalState {
  marital: Marital;
  family: FamilyMember[];
  romance: Romance | null;
  friends: Friend[];
  rival: Rival | null;
  /** Estresse acumulado (0–100). */
  stress: number;
  /** Saúde geral (0–100). Mecânica genérica: o jogo não simula doenças específicas. */
  health: number;
  /** Exposição pública (0–100), recalculada todo mês. */
  exposure: number;
  /** Tensão recente: embates, adversário pessoal, crises (decai). */
  heat: number;
  threats: Threat[];
  security: Security;
  securityUntil: number;
  privateSecurity: boolean;
  leave: Leave | null;
  /** Meses de licença "para interesse particular" usados por ano (limite de 120 dias por sessão legislativa). */
  leaveUsed: Record<string, number>;
  therapy: boolean;
  lastFamilyTime: number;
  highStressMonths: number;
  reducedAgendaUntil: number;
  lastHealthEvent: number;
  promisedTimeUntil: number;
  heirId: string | null;
  generation: number;
  ancestors: { name: string; peak: string; until: number }[];
  occurrences: number;
  /** Sorteio próprio da vida pessoal (não altera o resto da simulação). */
  rng: RngState;
  /** Mês previsto para o nascimento de um filho (0 = nenhum). */
  babyDue?: number;
  /** Quem está gestando: a personagem ou o(a) parceiro(a). Adoção: 'adocao'. */
  babyBy?: 'player' | 'partner' | 'adocao';
}

export interface FamilyInput {
  marital: Marital;
  partnerName?: string;
  partnerGender?: 'F' | 'M';
  children: { name?: string; age: number; gender?: 'F' | 'M' }[];
  parentsAlive?: boolean;
}

export const MARITAL_LABEL: Record<Marital, string> = { solteiro: 'Solteiro(a)', namorando: 'Namorando', casado: 'Casado(a)', uniao_estavel: 'União estável', divorciado: 'Divorciado(a)' };
export const TRAIT_LABEL: Record<Trait, string> = { apoiador: 'apoia sua carreira', reservado: 'prefere privacidade', ambicioso: 'tem ambição política', problematico: 'vive se metendo em confusão' };
export const SECURITY_LABEL: Record<Security, string> = { nenhuma: 'Sem segurança', privada: 'Segurança privada', policial: 'Proteção policial', oficial: 'Segurança oficial do cargo' };
export function relationLabel(m: FamilyMember): string {
  const f = m.gender === 'F';
  if (m.ex) return f ? 'Ex-esposa' : 'Ex-marido';
  return ({ conjuge: f ? 'Esposa' : 'Marido', companheiro: f ? 'Companheira' : 'Companheiro', filho: f ? 'Filha' : 'Filho', pai: 'Pai', mae: 'Mãe', irmao: f ? 'Irmã' : 'Irmão' } as Record<FamilyRelation, string>)[m.relation];
}

const FIRST_F = ['Ana', 'Beatriz', 'Camila', 'Daniela', 'Fernanda', 'Gabriela', 'Helena', 'Isabela', 'Juliana', 'Larissa', 'Marina', 'Natália', 'Patrícia', 'Renata', 'Sofia', 'Tatiana', 'Valentina', 'Alice', 'Laura', 'Cecília'];
const FIRST_M = ['André', 'Bruno', 'Caio', 'Daniel', 'Eduardo', 'Felipe', 'Gustavo', 'Henrique', 'Igor', 'João', 'Lucas', 'Marcelo', 'Mateus', 'Otávio', 'Pedro', 'Rafael', 'Samuel', 'Thiago', 'Vinícius', 'Heitor'];
const LAST = ['Almeida', 'Barros', 'Cardoso', 'Duarte', 'Esteves', 'Freitas', 'Gomes', 'Lacerda', 'Moura', 'Nogueira', 'Pacheco', 'Queiroz', 'Rezende', 'Siqueira', 'Teixeira', 'Valente'];
export const firstName = (rng: RngState, g: 'F' | 'M') => pickOne(rng, g === 'F' ? FIRST_F : FIRST_M);
const surnameOf = (name: string) => { const p = name.trim().split(/\s+/); return p.length > 1 ? p[p.length - 1] : LAST[name.length % LAST.length]; };
const randGender = (rng: RngState): 'F' | 'M' => (next(rng) < 0.5 ? 'F' : 'M');
function randTrait(rng: RngState, minor: boolean): Trait {
  const x = next(rng);
  if (minor) return x < 0.55 ? 'apoiador' : x < 0.85 ? 'reservado' : 'problematico';
  return x < 0.45 ? 'apoiador' : x < 0.73 ? 'reservado' : x < 0.87 ? 'ambicioso' : 'problematico';
}
export const memberAge = (s: GameState, m: FamilyMember) => s.month.year - m.birthYear;
export const characterAge = (s: GameState) => s.month.year - Number(s.character.birthDate.slice(0, 4));

const newId = (s: GameState, p: string) => `${p}_${now(s)}_${Math.floor(next(s.rng) * 1e9)}`;

/** Família inicial: escolhida pelo jogador na criação (estado civil, filhos, pais). Nomes e perfis são do jogo. */
export function initPersonal(input: FamilyInput | undefined, ch: Character, startStatus: StartStatus, profession: string, seed: number): PersonalState {
  const rng = createRng((seed ^ 0x5eed1) >>> 0);
  const fam = input ?? { marital: 'solteiro' as Marital, children: [], parentsAlive: true };
  const surname = surnameOf(ch.name);
  const by = Number(ch.birthDate.slice(0, 4));
  const family: FamilyMember[] = [];
  let k = 0;
  const id = () => `fam_${++k}`;
  if (fam.marital === 'casado' || fam.marital === 'uniao_estavel') {
    const g = fam.partnerGender ?? (ch.gender === 'Masculino' ? 'F' : ch.gender === 'Feminino' ? 'M' : randGender(rng));
    family.push({ id: id(), name: fam.partnerName?.trim() || `${firstName(rng, g)} ${pickOne(rng, LAST)}`, relation: fam.marital === 'casado' ? 'conjuge' : 'companheiro', gender: g, birthYear: by + Math.round((next(rng) - 0.5) * 6), mood: 65, trait: randTrait(rng, false), politicalInterest: Math.round(next(rng) * 30) });
  }
  for (const c of fam.children.slice(0, 5)) {
    const g = c.gender ?? randGender(rng);
    const age = Math.max(0, Math.min(60, Math.round(c.age)));
    const trait = randTrait(rng, age < 18);
    family.push({ id: id(), name: `${c.name?.trim() || firstName(rng, g)} ${surname}`, relation: 'filho', gender: g, birthYear: 2027 - age, mood: 70, trait, politicalInterest: Math.round(next(rng) * (trait === 'ambicioso' ? 90 : 40)) });
  }
  const herdeiro = startStatus === 'herdeiro';
  if (fam.parentsAlive !== false && by >= 1950) {
    family.push({ id: id(), name: `${firstName(rng, 'F')} ${surname}`, relation: 'mae', gender: 'F', birthYear: by - 27 - Math.floor(next(rng) * 6), mood: 75, trait: 'apoiador', politicalInterest: 10 });
    family.push({ id: id(), name: `${firstName(rng, 'M')} ${surname}`, relation: 'pai', gender: 'M', birthYear: by - 29 - Math.floor(next(rng) * 7), mood: 70, trait: herdeiro ? 'apoiador' : randTrait(rng, false), politicalInterest: herdeiro ? 80 : 15, formerOffice: herdeiro ? 'ex-deputado estadual (personagem do jogo)' : undefined });
  }
  const friends: Friend[] = [{ id: 'amigo_1', name: `${firstName(rng, randGender(rng))} ${pickOne(rng, LAST)}`, kind: 'amigo', trust: 70 }];
  if (startStatus !== 'independente') friends.push({ id: 'amigo_2', name: `${firstName(rng, randGender(rng))} ${pickOne(rng, LAST)}`, kind: 'mentor', trust: 55 });
  if (profession === 'empresario') friends.push({ id: 'amigo_3', name: `${firstName(rng, randGender(rng))} ${pickOne(rng, LAST)}`, kind: 'ex_socio', trust: 50 });
  return {
    marital: fam.marital === 'namorando' ? 'solteiro' : fam.marital,
    family,
    romance: fam.marital === 'namorando' ? { name: fam.partnerName?.trim() || `${firstName(rng, fam.partnerGender ?? randGender(rng))} ${pickOne(rng, LAST)}`, gender: fam.partnerGender ?? randGender(rng), birthYear: by, affinity: 55, stage: 'namoro', since: 2027 * 12, public: false } : null,
    friends, rival: null,
    stress: 20, health: 85, exposure: 0, heat: 0, threats: [], security: 'nenhuma', securityUntil: 0, privateSecurity: false,
    leave: null, leaveUsed: {}, therapy: false, lastFamilyTime: 2027 * 12, highStressMonths: 0, reducedAgendaUntil: 0, lastHealthEvent: 0, promisedTimeUntil: 0,
    heirId: null, generation: 1, ancestors: [], occurrences: 0, rng,
  };
}

export const partner = (s: GameState) => s.personal?.family.find((m) => (m.relation === 'conjuge' || m.relation === 'companheiro') && !m.ex) ?? null;
export const children = (s: GameState) => s.personal?.family.filter((m) => m.relation === 'filho') ?? [];
export const adultRelatives = (s: GameState) => s.personal?.family.filter((m) => !m.ex && memberAge(s, m) >= 18 && m.relation !== 'pai' && m.relation !== 'mae') ?? [];
export const onLeave = (s: GameState) => !!s.personal?.leave && !!s.player.mandate;

// ---------------- Exposição e ameaças ----------------

/** Peso do cargo na exposição pública (PROPOSTA). */
const OFFICE_EXPOSURE: Record<string, number> = { vereador: 15, deputado_estadual: 18, deputado_federal: 25, senador: 32, secretario: 14, secretario_estadual: 18, prefeito: 42, governador: 50, ministro: 40, vice_presidente: 45, presidente: 70 };
/** Pressão do cargo no estresse mensal (PROPOSTA). */
const OFFICE_STRESS: Record<string, number> = { vereador: 3, deputado_estadual: 4, deputado_federal: 4, senador: 4, secretario: 4, secretario_estadual: 5, prefeito: 7, governador: 8, ministro: 7, vice_presidente: 4, presidente: 10 };

export function computeExposure(s: GameState): number {
  const p = s.personal!;
  const office = s.player.mandate?.office ?? '';
  const pos = generalPosition(s.character.ideology);
  const extreme = pos === null ? 0 : Math.abs(pos - 5) / 5;
  const cand = s.player.candidacy?.status === 'registrada' ? (s.player.candidacy.office === 'presidente' ? 25 : ['prefeito', 'governador', 'senador'].includes(s.player.candidacy.office) ? 12 : 5) : 0;
  const crises = s.crises.filter((c) => c.status === 'ativa' && c.targetId === 'character_player').length * 6;
  let e = (OFFICE_EXPOSURE[office] ?? 0) + s.player.recognition * 0.35 + extreme * 18 + p.heat + cand + crises;
  if (onLeave(s)) e *= 0.45;
  return clamp(Math.round(e));
}

const THREAT_TEXT = [
  '',
  'Uma onda de ataques e xingamentos nas suas redes, com perfis anônimos.',
  'Mensagens diretas com ameaças contra você chegaram ao seu celular e ao gabinete.',
  'As ameaças passaram a citar sua família e a rotina dela.',
  'Um grupo hostil fez protesto na porta da sua casa e tentou intimidar quem estava lá.',
  'Uma intimidação séria: alguém seguiu seu carro e deixou um recado ameaçador. A polícia foi chamada.',
];

const officialSecurity = (s: GameState) => ['presidente', 'vice_presidente', 'governador'].includes(s.player.mandate?.office ?? '') || (s.player.candidacy?.status === 'registrada' && s.player.candidacy.office === 'presidente');
export function currentSecurity(s: GameState): Security {
  const p = s.personal!;
  if (officialSecurity(s)) return 'oficial';
  if (p.securityUntil > now(s)) return 'policial';
  if (p.privateSecurity) return 'privada';
  return 'nenhuma';
}
const SECURITY_FACTOR: Record<Security, number> = { nenhuma: 1, privada: 0.6, policial: 0.45, oficial: 0.25 };
export const PRIVATE_SECURITY_COST = 18000;
export const THERAPY_COST = 1200;

function maybeThreat(s: GameState, rng: RngState): string | null {
  const p = s.personal!;
  const sec = currentSecurity(s);
  const chance = Math.pow(p.exposure / 100, 1.5) * 0.45 * SECURITY_FACTOR[sec];
  if (p.exposure < 12 || next(rng) >= chance) return null;
  let level = 1 + Math.floor(p.exposure / 22 + (next(rng) - 0.5));
  if (p.exposure < 45) level = Math.min(level, 3);
  level = Math.max(1, Math.min(5, level));
  const woman = s.character.gender === 'Feminino' && (!!s.player.mandate || !!s.player.candidacy);
  const gendered = woman && next(rng) < 0.5;
  const text = `${THREAT_TEXT[level]}${gendered ? ' Os ataques miram o fato de você ser mulher.' : ''}`;
  p.threats.push({ month: now(s), level, text, gendered });
  if (p.threats.length > 30) p.threats.splice(0, p.threats.length - 30);
  p.stress = clamp(p.stress + level * 4);
  for (const m of p.family) if (!m.ex) m.mood = clamp(m.mood - (level >= 3 ? level * 3 : level));
  if (s.pendingEvents.length === 0 || level >= 3) s.pendingEvents.push({ templateId: 'ameaca', vars: { level } });
  return `Ameaça (nível ${level}/5): ${text}`;
}

// ---------------- Licença do cargo ----------------

const LEGISLATIVE = ['vereador', 'deputado_estadual', 'deputado_federal', 'senador'];
const EXECUTIVE = ['prefeito', 'governador', 'presidente'];
export function leaveBlock(s: GameState): string | null {
  const o = s.player.mandate?.office;
  if (!o) return 'Você não tem mandato.';
  if (s.personal?.leave) return 'Você já está licenciado(a).';
  if (!LEGISLATIVE.includes(o) && !EXECUTIVE.includes(o)) return 'Cargo de livre nomeação não tem licença: quem quer sair pede exoneração.';
  if (s.player.candidacy?.status === 'registrada') return 'Não durante uma candidatura registrada.';
  return null;
}
/** Meses de licença "para tratar de interesse particular" ainda disponíveis no ano (120 dias ≈ 4 meses; CF art. 56, II). */
export const privateLeaveLeft = (s: GameState) => 4 - (s.personal?.leaveUsed[String(s.month.year)] ?? 0);

export function startLeave(s: GameState, months: number, reason: Leave['reason']): string {
  const p = s.personal!;
  const block = leaveBlock(s);
  if (block) return block;
  const o = s.player.mandate!.office;
  const legis = LEGISLATIVE.includes(o);
  const own = reason === 'saude' || reason === 'nascimento';
  if (legis && !own) months = Math.min(months, privateLeaveLeft(s));
  if (months <= 0) return 'Você já usou os 120 dias de licença por interesse particular deste ano (CF art. 56, II).';
  const paid = own || !legis;
  p.leave = { office: o, since: now(s), until: now(s) + months, reason, paid };
  if (legis && !own) p.leaveUsed[String(s.month.year)] = (p.leaveUsed[String(s.month.year)] ?? 0) + months;
  s.officePoints = 0;
  if (!paid) s.finances.monthlyIncome = 0;
  const who = legis ? 'O(a) suplente assume a cadeira enquanto isso.' : o === 'presidente' ? 'O vice-presidente assume interinamente (CF art. 79).' : 'O(a) vice assume interinamente.';
  return `Licença de ${months} ${months === 1 ? 'mês' : 'meses'} (${reason === 'saude' ? 'saúde' : reason === 'nascimento' ? 'nascimento de filho(a)' : reason === 'ameaca' ? 'segurança pessoal' : 'interesse particular'}${paid ? '' : ', sem remuneração'}). ${who} Você segue na política fora do cargo — partido, base e redes — com a sua agenda pessoal.`;
}
export function endLeave(s: GameState, early = false): string {
  const p = s.personal!;
  if (!p.leave) return 'Você não está licenciado(a).';
  p.leave = null;
  return early ? 'Você reassumiu o cargo antes do fim da licença.' : 'Fim da licença: você reassumiu o cargo.';
}

// ---------------- Herdeiro político ----------------

/** Inelegibilidade reflexa (CF art. 14 §7º): parentes até o 2º grau do chefe do Executivo não disputam no território dele, salvo se já titulares e candidatos à reeleição. */
export function reflexBlock(s: GameState, office: 'vereador' | 'deputado_estadual', member: FamilyMember): string | null {
  const o = s.player.mandate?.office;
  const incumbent = member.politics?.status === 'eleito' && member.politics.office === office;
  if (incumbent) return null;
  if (o === 'presidente') return 'Inelegibilidade reflexa: parente do presidente da República não pode concorrer em nenhum lugar do país (CF art. 14 §7º).';
  if (o === 'governador') return 'Inelegibilidade reflexa: parente do governador não pode concorrer no estado de SP (CF art. 14 §7º).';
  if (o === 'prefeito' && office === 'vereador') return 'Inelegibilidade reflexa: parente do prefeito não pode disputar vereador no município (CF art. 14 §7º).';
  return null;
}
const isMunYear = (y: number) => y >= 2028 && (y - 2028) % 4 === 0;
const isGenYear = (y: number) => y >= 2030 && (y - 2030) % 4 === 0;
export function heirCandidacyOptions(s: GameState): { value: string; label: string }[] {
  const y = s.month.year;
  const out: { value: string; label: string }[] = [];
  if (s.month.month > 7) return out;
  for (const m of adultRelatives(s)) {
    if (m.politics?.status === 'pre' || m.politicalInterest < 50) continue;
    if (m.politics?.status === 'eleito' && (m.politics.until ?? 0) > (y + 1) * 12 + 2) continue;
    if (isMunYear(y)) out.push({ value: `${m.id}|vereador`, label: `${m.name} — vereador(a) em ${y}` });
    if (isGenYear(y) && memberAge(s, m) >= 21) out.push({ value: `${m.id}|deputado_estadual`, label: `${m.name} — deputado(a) estadual em ${y}` });
  }
  return out;
}
export function launchHeir(s: GameState, param: string): string {
  const [id, office] = param.split('|') as [string, 'vereador' | 'deputado_estadual'];
  const m = s.personal!.family.find((x) => x.id === id);
  if (!m) return 'Parente não encontrado.';
  const block = reflexBlock(s, office, m);
  if (block) return block;
  if (!s.player.partyId) return 'Seu parente precisaria de um partido: filie-se para levar a candidatura à convenção.';
  m.politics = { office, year: s.month.year, status: 'pre' };
  s.personal!.heirId = m.id;
  return `${m.name} vai disputar ${office === 'vereador' ? 'a Câmara Municipal' : 'a Alesp'} em ${s.month.year} pelo seu partido. Seu reconhecimento ajuda — e sua rejeição também pesa. Resultado em outubro.`;
}
function resolveHeirs(s: GameState, rng: RngState): string[] {
  const out: string[] = [];
  if (s.month.month !== 10) return out;
  for (const m of s.personal!.family) {
    if (m.politics?.status !== 'pre' || m.politics.year !== s.month.year) continue;
    const block = reflexBlock(s, m.politics.office, m);
    if (block) { m.politics.status = 'derrotado'; out.push(`Candidatura de ${m.name} indeferida. ${block}`); continue; }
    const chance = Math.min(0.85, 0.12 + s.player.recognition / 160 + s.player.base / 300 + m.politicalInterest / 500 + ((s.player.credibility ?? 60) - 60) / 300);
    const won = next(rng) < chance;
    m.politics.status = won ? 'eleito' : 'derrotado';
    if (won) { const Y = m.politics.year; m.politics.since = m.politics.office === 'vereador' ? (Y + 1) * 12 : (Y + 1) * 12 + 2; m.politics.until = m.politics.office === 'vereador' ? (Y + 4) * 12 + 11 : (Y + 5) * 12 + 2; m.politics.seated = false; }
    m.mood = clamp(m.mood + (won ? 15 : -10));
    out.push(won ? `${m.name} foi eleito(a) ${m.politics.office === 'vereador' ? 'vereador(a)' : 'deputado(a) estadual'}! O sobrenome agora está em mais de um mandato.` : `${m.name} não se elegeu ${m.politics.office === 'vereador' ? 'vereador(a)' : 'deputado(a) estadual'}.`);
  }
  return out;
}

// ---------------- Passo mensal ----------------

export function personalMonthlyStep(s: GameState): string[] {
  const p = s.personal;
  if (!p) return [];
  const rng = p.rng;
  const out: string[] = [];
  const t = now(s);
  // Licença: fim automático; sem remuneração quando for por interesse particular de parlamentar.
  if (p.leave && (!s.player.mandate || s.player.mandate.office !== p.leave.office)) p.leave = null;
  if (p.leave && t >= p.leave.until) out.push(endLeave(s));
  if (p.leave) {
    s.officePoints = 0;
    if (!p.leave.paid) s.finances.monthlyIncome = 0;
    if (s.player.mandate) s.player.mandate.approval = clamp(s.player.mandate.approval - 0.4);
  }
  // Exposição e tensão.
  p.heat = clamp(p.heat * 0.85 + (p.rival ? p.rival.intensity / 25 : 0) + (s.player.mandate && s.player.mandate.approval < 35 ? 2 : 0));
  p.exposure = computeExposure(s);
  p.security = currentSecurity(s);
  const threat = maybeThreat(s, rng);
  if (threat) out.push(threat);
  // Custos pessoais (PARÂMETROS do jogo).
  if (p.privateSecurity && p.security !== 'oficial') s.finances.cash -= PRIVATE_SECURITY_COST;
  if (p.therapy) s.finances.cash -= THERAPY_COST;
  const pension = p.family.filter((m) => m.relation === 'filho' && memberAge(s, m) < 18).length && p.marital === 'divorciado' ? Math.round(Math.max(1500, s.finances.monthlyIncome * 0.1) * Math.min(3, p.family.filter((m) => m.relation === 'filho' && memberAge(s, m) < 18).length)) : 0;
  if (pension) s.finances.cash -= pension;
  // Estresse e saúde.
  const office = s.player.mandate?.office ?? '';
  const pt = partner(s);
  let d = (p.leave ? 0 : OFFICE_STRESS[office] ?? 0) + (s.player.candidacy?.status === 'registrada' ? 5 : 0) + s.crises.filter((c) => c.status === 'ativa' && c.targetId === 'character_player').length * 2 - 5;
  if (p.therapy) d -= 4;
  if (pt && pt.mood >= 60) d -= 2;
  if (p.leave) d -= 8;
  if (p.reducedAgendaUntil > t) d -= 10;
  p.stress = clamp(p.stress + d);
  p.highStressMonths = p.stress >= 75 ? p.highStressMonths + 1 : 0;
  const age = characterAge(s);
  if (p.stress >= 75) p.health = clamp(p.health - 3);
  else if (p.stress < 40) p.health = clamp(p.health + 2);
  if (age >= 60) p.health = clamp(p.health - 0.2);
  if (p.health < 40 && t - p.lastHealthEvent >= 6 && !s.pendingEvents.some((e) => e.templateId === 'saude_estresse')) { p.lastHealthEvent = t; s.pendingEvents.push({ templateId: 'saude_estresse', vars: {} }); }
  // Agenda pessoal do mês: estresse alto e saúde fraca tiram compromissos (PROPOSTA).
  let pen = 0;
  if (p.stress >= 80) pen += 1;
  if (p.health < 45) pen += 1;
  if (p.health < 25) pen += 1;
  if (p.reducedAgendaUntil > t) pen += 2;
  pen = Math.min(3, pen);
  if (pen) { s.actionPoints = Math.max(1, s.actionPoints - pen); out.push(`Desgaste pessoal: ${pen} compromisso(s) a menos na agenda pessoal este mês (estresse ${Math.round(p.stress)}, saúde ${Math.round(p.health)}).`); }
  // Família: quem fica muito tempo sem atenção se afasta.
  const away = t - p.lastFamilyTime;
  for (const m of p.family) {
    if (m.ex) { m.mood = clamp(m.mood + (m.mood < 40 ? 0.5 : -0.5)); continue; }
    const close = m.relation === 'conjuge' || m.relation === 'companheiro' || (m.relation === 'filho' && memberAge(s, m) < 18);
    if (close) m.mood = clamp(m.mood + (away >= 3 ? -3 : 1) - (p.stress >= 75 ? 1 : 0));
    else m.mood = clamp(m.mood + (m.mood < 60 ? 0.5 : -0.3));
    if (m.politicalInterest < 90 && m.trait === 'ambicioso' && memberAge(s, m) >= 16) m.politicalInterest = clamp(m.politicalInterest + 0.4);
  }
  if (p.promisedTimeUntil && t > p.promisedTimeUntil) {
    if (p.lastFamilyTime < p.promisedTimeUntil - 2 && pt) { pt.mood = clamp(pt.mood - 15); out.push(`Você prometeu mais tempo em casa e não cumpriu. ${pt.name} cobrou.`); }
    p.promisedTimeUntil = 0;
  }
  // Namoro esfria sem atenção.
  if (p.romance) { p.romance.affinity = clamp(p.romance.affinity - 2); if (p.romance.affinity <= 10) { out.push(`O relacionamento com ${p.romance.name} acabou: faltou tempo.`); p.romance = null; if (p.marital === 'namorando') p.marital = 'solteiro'; } }
  // Amizades e adversário pessoal.
  for (const f of p.friends) f.trust = clamp(f.trust - 0.3);
  if (p.rival) { p.rival.intensity = clamp(p.rival.intensity - 1.5); if (p.rival.intensity <= 5) { out.push(`${p.rival.name} parou de mirar você.`); p.rival = null; } }
  // Nepotismo: risco de vir a público.
  const hired = p.family.find((m) => m.employedByPlayer);
  if (hired && next(rng) < (hired.employedByPlayer === 'direto' ? 0.06 : 0.035)) out.push(exposeNepotism(s, hired));
  if (hired && !s.player.mandate) hired.employedByPlayer = undefined;
  out.push(...resolveHeirs(s, rng));
  if (p.babyDue && t >= p.babyDue) out.push(birth(s, rng));
  return out;
}

export function exposeNepotism(s: GameState, m: FamilyMember): string {
  const kind = m.employedByPlayer;
  m.employedByPlayer = undefined;
  if (s.player.team) s.player.team.members = s.player.team.members.filter((x) => x.relativeId !== m.id);
  s.player.credibility = clamp((s.player.credibility ?? 60) - 12);
  s.character.attributes.popularity = clamp(s.character.attributes.popularity - 3);
  if (s.player.mandate) s.player.mandate.approval = clamp(s.player.mandate.approval - 6);
  s.flags.nepotismo = Number(s.flags.nepotismo ?? 0) + 1;
  m.mood = clamp(m.mood - 10);
  return `NEPOTISMO EXPOSTO: a imprensa revelou ${kind === 'cruzado' ? `a troca de nomeações entre gabinetes para empregar ${m.name}` : `a nomeação de ${m.name}, seu(sua) parente, no gabinete`}. É vedado pela Súmula Vinculante 13 do STF e pode configurar improbidade (Lei 8.429/92, art. 11, XI). ${m.name} foi exonerado(a). Credibilidade −12.`;
}

// ---------------- Nascimento ----------------

export function birth(s: GameState, rng: RngState): string {
  const p = s.personal!;
  const g = randGender(rng);
  const surname = surnameOf(s.character.name);
  const adoption = p.babyBy === 'adocao';
  const baby: FamilyMember = { id: newId(s, 'fam'), name: `${firstName(rng, g)} ${surname}`, relation: 'filho', gender: g, birthYear: s.month.year - (adoption ? Math.floor(next(rng) * 4) : 0), mood: 85, trait: randTrait(rng, true), politicalInterest: Math.round(next(rng) * 40) };
  p.family.push(baby);
  p.babyDue = 0;
  p.babyBy = undefined;
  p.lastFamilyTime = now(s);
  p.stress = clamp(p.stress + 8);
  const pt = partner(s);
  if (pt) pt.mood = clamp(pt.mood + 12);
  s.player.recognition = clamp(s.player.recognition + 0.5);
  s.pendingEvents.push({ templateId: 'nascimento', vars: { name: baby.name } });
  return adoption ? `${baby.name} chegou à família pela adoção.` : `Nasceu ${baby.name}!`;
}

// ---------------- Ações (chamadas por personalActions.ts) ----------------

export function familyTime(s: GameState): string {
  const p = s.personal!;
  p.lastFamilyTime = now(s);
  p.stress = clamp(p.stress - 12);
  const close = p.family.filter((m) => !m.ex);
  for (const m of close) m.mood = clamp(m.mood + (m.relation === 'pai' || m.relation === 'mae' || m.relation === 'irmao' ? 5 : 10));
  if (!close.length) { p.stress = clamp(p.stress + 4); for (const f of p.friends) f.trust = clamp(f.trust + 4); return 'Sem família por perto, você passou o tempo com amigos. Estresse −8.'; }
  return `Tempo de qualidade em família: ${close.slice(0, 3).map((m) => m.name.split(' ')[0]).join(', ')}${close.length > 3 ? ' e outros' : ''}. Estresse −12, humor da família sobe.`;
}
export function rest(s: GameState): string {
  const p = s.personal!;
  p.stress = clamp(p.stress - 22);
  p.health = clamp(p.health + 3);
  return 'Você tirou uns dias de folga longe do celular. Estresse −22, saúde +3.';
}
export function meetFriends(s: GameState, rng: RngState): string {
  const p = s.personal!;
  p.stress = clamp(p.stress - 6);
  if (!p.friends.length) return 'Você saiu com colegas. Estresse −6.';
  const f = p.friends.reduce((a, b) => (a.trust <= b.trust ? a : b));
  f.trust = clamp(f.trust + 10);
  if (f.kind === 'mentor') {
    const k = next(rng) < 0.5 ? 'politicalKnowledge' : 'articulation';
    s.character.attributes[k] = clamp(s.character.attributes[k] + 1);
    return `Conversa longa com ${f.name}, seu(sua) mentor(a). ${k === 'politicalKnowledge' ? 'Conhecimento político' : 'Articulação'} +1, estresse −6.`;
  }
  return `Você reencontrou ${f.name}. A amizade se fortalece e o estresse cai.`;
}
export function meetPeople(s: GameState, rng: RngState): string {
  const p = s.personal!;
  p.stress = clamp(p.stress - 4);
  if (p.romance || partner(s)) return 'Você saiu para se distrair.';
  if (next(rng) < 0.35 + s.character.attributes.charisma / 400) {
    const g = randGender(rng);
    p.romance = { name: `${firstName(rng, g)} ${pickOne(rng, LAST)}`, gender: g, birthYear: Number(s.character.birthDate.slice(0, 4)) + Math.round((next(rng) - 0.5) * 8), affinity: 35, stage: 'conhecendo', since: now(s), public: false };
    return `Você conheceu ${p.romance.name} (personagem do jogo). Rolou conversa — vale marcar outro encontro.`;
  }
  return 'Noite agradável, mas ninguém especial desta vez.';
}
export function date(s: GameState, rng: RngState): string {
  const r = s.personal!.romance;
  if (!r) return 'Você não está saindo com ninguém.';
  const g = 8 + next(rng) * 8;
  r.affinity = clamp(r.affinity + g);
  s.personal!.stress = clamp(s.personal!.stress - 6);
  if (r.stage === 'conhecendo' && r.affinity >= 55) { r.stage = 'namoro'; s.personal!.marital = s.personal!.marital === 'divorciado' ? 'divorciado' : 'namorando'; return `Encontro ótimo: você e ${r.name} começaram a namorar.`; }
  return `Encontro com ${r.name}. Afinidade ${Math.round(r.affinity)}.`;
}
export function marry(s: GameState, kind: 'conjuge' | 'companheiro'): string {
  const p = s.personal!;
  const r = p.romance;
  if (!r) return 'Sem relacionamento.';
  p.family.push({ id: newId(s, 'fam'), name: r.name, relation: kind, gender: r.gender, birthYear: r.birthYear, mood: 80, trait: 'apoiador', politicalInterest: 10 });
  p.romance = null;
  p.marital = kind === 'conjuge' ? 'casado' : 'uniao_estavel';
  s.finances.cash -= kind === 'conjuge' ? 30000 : 5000;
  p.stress = clamp(p.stress - 10);
  return kind === 'conjuge' ? `Você se casou com ${r.name}. Festa para família e amigos (R$ 30 mil).` : `Você e ${r.name} registraram união estável em cartório.`;
}
/** Divórcio: partilha simplificada dos bens e pensão para filhos menores (valores fixados pelo juiz na vida real; aqui, parâmetros). */
export function divorce(s: GameState): string {
  const p = s.personal!;
  const pt = partner(s);
  if (!pt) return 'Sem cônjuge.';
  pt.ex = true;
  pt.mood = 30;
  p.marital = 'divorciado';
  s.finances.assets = Math.round(s.finances.assets * 0.7);
  s.finances.cash = Math.round(s.finances.cash * 0.85);
  p.stress = clamp(p.stress + 15);
  for (const c of children(s)) c.mood = clamp(c.mood - 12);
  const minors = children(s).filter((c) => memberAge(s, c) < 18).length;
  s.player.recognition = clamp(s.player.recognition + 1);
  return `Divórcio com ${pt.name}. Partilha de bens (SIMPLIFICAÇÃO: −30% dos bens, −15% do caixa)${minors ? `; pensão para ${minors} filho(s) menor(es) descontada todo mês` : ''}. A separação virou nota de coluna.`;
}

/** Passar o bastão: a partida continua com o(a) herdeiro(a) — um(a) filho(a) adulto(a) com interesse político. */
export function heirCandidates(s: GameState) {
  return children(s).filter((c) => memberAge(s, c) >= 18 && (c.politicalInterest >= 50 || c.politics?.status === 'eleito'));
}
export function batonBlock(s: GameState): string | null {
  if (!heirCandidates(s).length) return 'Nenhum(a) filho(a) adulto(a) com interesse em política.';
  if (s.player.mandate) return 'Passe o bastão sem mandato (ao fim do mandato atual).';
  if (s.player.candidacy) return 'Desista da candidatura antes.';
  return null;
}
export const peakOffice = (s: GameState) => s.player.careerHistory.length ? s.player.careerHistory[s.player.careerHistory.length - 1].office : s.player.partyId ? 'militante' : 'cidadão';

export const PERSONAL_RULES: { tag: 'REAL' | 'PARÂMETRO' | 'SIMPLIFICAÇÃO'; text: string }[] = [
  { tag: 'REAL', text: 'Ameaça é crime (Código Penal, art. 147); a ação penal depende da representação da vítima.' },
  { tag: 'REAL', text: 'Violência política contra a mulher: assediar, constranger, perseguir ou ameaçar candidata ou detentora de mandato, por menosprezo à condição de mulher, é crime (Código Eleitoral, art. 326-B, incluído pela Lei 14.192/2021).' },
  { tag: 'REAL', text: 'Difamação (Código Penal, art. 139) — base da ação contra o adversário pessoal.' },
  { tag: 'REAL', text: 'Nepotismo: nomear cônjuge, companheiro ou parente até o 3º grau em cargo de confiança, inclusive por nomeações recíprocas entre gabinetes, viola a Constituição (Súmula Vinculante 13 do STF) e é ato de improbidade (Lei 8.429/92, art. 11, XI).' },
  { tag: 'REAL', text: 'Licença-gestante de 120 dias e licença-paternidade são direitos de trabalhadores (CF art. 7º, XVIII e XIX). Adoção segue o Estatuto da Criança e do Adolescente (Lei 8.069/90).' },
  { tag: 'SIMPLIFICAÇÃO', text: 'Para quem tem mandato, a licença pelo nascimento é regulada pela Casa ou pelo Executivo; o jogo dá licença remunerada de 4 meses para quem gestou e de 1 mês para os demais. Adoção leva cerca de 12 meses (parâmetro).' },
  { tag: 'SIMPLIFICAÇÃO', text: 'Parente eleito(a) vereador(a) ocupa uma cadeira na posse, no lugar de um vereador fictício; a eleição do parente é sorteada à parte da apuração geral. Ao passar o bastão, você continua com o mandato que ele(a) tiver.' },
  { tag: 'REAL', text: 'Inelegibilidade reflexa: cônjuge e parentes até o 2º grau de prefeito, governador ou presidente não podem se candidatar no território do titular, salvo se já tiverem mandato e disputarem a reeleição (CF art. 14 §7º). O divórcio durante o mandato não afasta essa inelegibilidade (Súmula Vinculante 18 do STF).' },
  { tag: 'REAL', text: 'Deputado ou senador não perde o mandato quando licenciado por doença ou para tratar de interesse particular, sem remuneração, até 120 dias por sessão legislativa; o suplente é convocado (CF art. 56, II e §1º).' },
  { tag: 'SIMPLIFICAÇÃO', text: 'Vereador e deputado estadual seguem a mesma regra de licença do Congresso (as regras exatas estão na Lei Orgânica do Município e na Constituição do Estado). Prefeito, governador e presidente licenciados: o vice assume interinamente; o jogo considera a licença sempre autorizada.' },
  { tag: 'REAL', text: 'Presidente, vice e suas famílias têm segurança institucional (GSI); o governador de SP, pela Casa Militar. Na prática, a Polícia Federal faz a segurança dos candidatos a presidente.' },
  { tag: 'PARÂMETRO', text: `Exposição, chance e nível das ameaças, estresse, saúde, humor da família, segurança privada (R$ ${PRIVATE_SECURITY_COST.toLocaleString('pt-BR')}/mês), acompanhamento psicológico (R$ ${THERAPY_COST.toLocaleString('pt-BR')}/mês), partilha de bens e pensão são mecânicas do jogo. Familiares, pretendentes, amigos e adversários são personagens fictícios.` },
];

export { grow as personalGrow };
