// Ações da vida pessoal (Fase 8). Categoria própria, sem custo de agenda do cargo.

import { monthIndex } from '../calendar';
import { next, type RngState } from '../rng';
import { BASE_ATTRIBUTES, PROFESSIONS, initialPartyRel } from './create';
import { initialSocial } from './social';
import { computeEnding } from './endings';
import { BR_REGIONS } from './national';
import { seatsByParty } from './council';
import { initLegislature } from './legislature';
import { newMandate, startUpperMandate } from './careers';
import {
  PRIVATE_SECURITY_COST, THERAPY_COST, batonBlock, characterAge, computeExposure, date, endLeave, familyTime, heirCandidacyOptions, heirCandidates,
  launchHeir, leaveBlock, meetFriends, meetPeople, memberAge, partner, peakOffice, privateLeaveLeft, rest, startLeave, type FamilyMember,
} from './personal';
import type { ActionDef } from './actions';
import type { Attributes, GameState, ProfessionId } from './types';

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const now = (s: GameState) => monthIndex(s.month);
const has = (s: GameState) => !!s.personal;

export const PERSONAL_ACTIONS: ActionDef[] = [
  {
    id: 'pv_familia', fatigue: false, label: 'Tempo com a família', category: 'Vida pessoal', cost: 1,
    description: 'Jantar, fim de semana, escola dos filhos. Reduz o estresse e melhora o humor da família. Três meses sem isso e quem está perto começa a se afastar.',
    availability: (s) => (has(s) ? null : 'hidden'),
    apply: (s) => familyTime(s),
  },
  {
    id: 'pv_descanso', fatigue: false, label: 'Tirar uns dias de folga', category: 'Vida pessoal', cost: 2,
    description: 'Dias longe do celular. Estresse −22, saúde +3.',
    availability: (s) => (has(s) ? null : 'hidden'),
    apply: (s) => rest(s),
  },
  {
    id: 'pv_amigos', fatigue: false, label: 'Encontrar amigos ou o(a) mentor(a)', category: 'Vida pessoal', cost: 1,
    description: 'Mantém as amizades (personagens do jogo). Conversa com mentor(a) ensina política.',
    availability: (s) => (has(s) ? null : 'hidden'),
    apply: (s, rng) => meetFriends(s, rng),
  },
  {
    id: 'pv_conhecer', fatigue: false, label: 'Sair para conhecer pessoas', category: 'Vida pessoal', cost: 1,
    description: 'Para quem está solteiro(a): pode começar um relacionamento (carisma ajuda).',
    availability: (s) => (!has(s) ? 'hidden' : partner(s) || s.personal!.romance ? 'hidden' : null),
    apply: (s, rng) => meetPeople(s, rng),
  },
  {
    id: 'pv_encontro', fatigue: false, label: 'Encontro', category: 'Vida pessoal', cost: 1,
    description: 'Tempo com quem você está conhecendo ou namorando. Sem atenção, a relação esfria.',
    availability: (s) => (s.personal?.romance ? null : 'hidden'),
    apply: (s, rng) => date(s, rng),
  },
  {
    id: 'pv_terapia', fatigue: false, label: 'Acompanhamento psicológico', category: 'Vida pessoal', cost: 0,
    description: `Começa ou encerra sessões regulares: estresse cai mais rápido todo mês. R$ ${THERAPY_COST.toLocaleString('pt-BR')}/mês (parâmetro).`,
    availability: (s) => (has(s) ? null : 'hidden'),
    params: (s) => [{ value: s.personal?.therapy ? 'parar' : 'comecar', label: s.personal?.therapy ? 'Encerrar o acompanhamento' : 'Começar o acompanhamento' }],
    apply: (s, _r, param) => { s.personal!.therapy = param === 'comecar'; return s.personal!.therapy ? 'Você começou um acompanhamento psicológico.' : 'Você encerrou o acompanhamento.'; },
  },
  {
    id: 'pv_seguranca', fatigue: false, label: 'Segurança privada', category: 'Vida pessoal', cost: 0,
    description: `Contrata ou dispensa segurança privada para você e a família: reduz a chance de ameaças (R$ ${PRIVATE_SECURITY_COST.toLocaleString('pt-BR')}/mês, parâmetro). Presidente, vice e governador já têm segurança oficial.`,
    availability: (s) => (has(s) ? null : 'hidden'),
    params: (s) => [{ value: s.personal?.privateSecurity ? 'dispensar' : 'contratar', label: s.personal?.privateSecurity ? 'Dispensar a segurança' : `Contratar (R$ ${PRIVATE_SECURITY_COST.toLocaleString('pt-BR')}/mês)` }],
    apply: (s, _r, param) => { s.personal!.privateSecurity = param === 'contratar'; return s.personal!.privateSecurity ? 'Equipe de segurança privada contratada.' : 'Segurança privada dispensada.'; },
  },
  {
    id: 'pv_recolher', fatigue: false, label: 'Baixar a exposição por um tempo', category: 'Vida pessoal', cost: 1,
    description: 'Menos embates e menos aparições: a tensão em torno de você cai, mas o reconhecimento também.',
    availability: (s) => (has(s) ? null : 'hidden'),
    apply: (s) => { const p = s.personal!; p.heat = clamp(p.heat - 12); s.player.recognition = clamp(s.player.recognition - 1); p.exposure = computeExposure(s); return `Você saiu dos holofotes por um tempo. Exposição agora ${p.exposure}.`; },
  },
  {
    id: 'pv_licenca', fatigue: false, label: 'Pedir licença do cargo', category: 'Vida pessoal', cost: 0,
    description: 'Afasta você do mandato por um tempo, sem perder o cargo. Parlamentar: até 120 dias por ano por interesse particular, sem salário, ou por saúde (CF art. 56, II). Prefeito, governador e presidente: o vice assume interinamente. Durante a licença você atua só fora do cargo (partido, base, redes).',
    availability: (s) => { if (!has(s) || !s.player.mandate) return 'hidden'; const b = leaveBlock(s); return b === 'Você já está licenciado(a).' ? 'hidden' : b; },
    paramLabel: 'Duração e motivo',
    params: (s) => {
      const legis = ['vereador', 'deputado_estadual', 'deputado_federal', 'senador'].includes(s.player.mandate?.office ?? '');
      const left = legis ? privateLeaveLeft(s) : 4;
      const out: { value: string; label: string }[] = [];
      for (const m of [1, 2, 3, 4].filter((x) => x <= left)) out.push({ value: `${m}|ameaca`, label: `${m} ${m === 1 ? 'mês' : 'meses'} — segurança pessoal${legis ? ' (interesse particular, sem salário)' : ''}` });
      for (const m of [1, 2, 3, 4].filter((x) => x <= left)) out.push({ value: `${m}|interesse`, label: `${m} ${m === 1 ? 'mês' : 'meses'} — interesse particular / família${legis ? ' (sem salário)' : ''}` });
      if ((s.personal?.health ?? 100) < 60) for (const m of [1, 2]) out.push({ value: `${m}|saude`, label: `${m} ${m === 1 ? 'mês' : 'meses'} — saúde (com salário)` });
      return out;
    },
    apply: (s, _r, param) => { const [m, r] = (param ?? '1|interesse').split('|'); return startLeave(s, Number(m), r as 'interesse' | 'saude' | 'ameaca'); },
  },
  {
    id: 'pv_retornar', fatigue: false, label: 'Reassumir o cargo', category: 'Vida pessoal', cost: 0,
    description: 'Encerra a licença antes do prazo. A agenda do cargo volta no próximo mês.',
    availability: (s) => (s.personal?.leave ? null : 'hidden'),
    apply: (s) => endLeave(s, true),
  },
  {
    id: 'pv_familia_campanha', fatigue: false, label: 'Levar a família para a campanha', category: 'Vida pessoal', cost: 1,
    description: 'Cônjuge ou companheiro(a) na agenda de campanha. Quem apoia sua carreira rende muito; quem prefere privacidade se desgasta.',
    availability: (s) => (s.player.candidacy?.status === 'registrada' && partner(s) ? null : 'hidden'),
    apply: (s, rng) => {
      const pt = partner(s)!;
      const good = pt.trait === 'apoiador' || pt.trait === 'ambicioso';
      const pts = good ? 4 + next(rng) * 2 : 1.5;
      s.player.candidacy!.campaignPoints += pts;
      pt.mood = clamp(pt.mood + (good ? 2 : -10));
      return good ? `${pt.name} brilhou na agenda de campanha. Campanha +${pts.toFixed(1)}.` : `${pt.name} foi, mas a contragosto: rendeu pouco e cansou a relação.`;
    },
  },
  {
    id: 'pv_herdeiro', fatigue: false, label: 'Lançar um parente na política', category: 'Vida pessoal', cost: 1,
    description: 'Um parente adulto com interesse em política disputa vereador (anos municipais) ou deputado estadual (anos gerais) pelo seu partido. Inelegibilidade reflexa: parente do prefeito, governador ou presidente não concorre no território do titular (CF art. 14 §7º).',
    availability: (s) => (!has(s) ? 'hidden' : heirCandidacyOptions(s).length ? null : 'hidden'),
    paramLabel: 'Quem e para quê', params: (s) => heirCandidacyOptions(s),
    apply: (s, _r, param) => launchHeir(s, param!),
  },
  {
    id: 'pv_exonerar_parente', fatigue: false, label: 'Exonerar parente do gabinete', category: 'Vida pessoal', cost: 0,
    description: 'Desfaz a nomeação irregular antes que vire escândalo (Súmula Vinculante 13).',
    availability: (s) => (s.personal?.family.some((m) => m.employedByPlayer) ? null : 'hidden'),
    apply: (s) => { const m = s.personal!.family.find((x) => x.employedByPlayer)!; m.employedByPlayer = undefined; m.mood = clamp(m.mood - 8); return `${m.name} deixou o cargo. A irregularidade parou por aqui.`; },
  },
  {
    id: 'pv_processar_rival', fatigue: false, label: 'Processar o adversário por difamação', category: 'Vida pessoal', cost: 1,
    description: 'Queixa-crime por difamação (Código Penal, art. 139). Custa R$ 15 mil de advogado (parâmetro). Se ganhar, os ataques param; se perder, viram notícia.',
    availability: (s) => (s.personal?.rival ? (s.finances.cash < 15000 ? 'Precisa de R$ 15 mil.' : null) : 'hidden'),
    apply: (s, rng) => {
      const r = s.personal!.rival!;
      s.finances.cash -= 15000;
      if (next(rng) < 0.5 + s.character.attributes.politicalKnowledge / 400) { s.personal!.rival = null; s.personal!.heat = clamp(s.personal!.heat - 8); return `A Justiça deu razão a você contra ${r.name}. Os ataques pararam.`; }
      r.intensity = clamp(r.intensity + 10);
      return `O processo contra ${r.name} não andou, e ele(a) usou isso para atacar mais.`;
    },
  },
  {
    id: 'pv_pazes', fatigue: false, label: 'Tentar fazer as pazes com o adversário', category: 'Vida pessoal', cost: 1,
    description: 'Conversa de bastidor. Depende de Negociação.',
    availability: (s) => (s.personal?.rival ? null : 'hidden'),
    apply: (s, rng) => {
      const r = s.personal!.rival!;
      if (next(rng) * 100 < s.character.attributes.negotiation - r.intensity / 3 + 25) { s.personal!.rival = null; return `Você e ${r.name} baixaram as armas.`; }
      r.intensity = clamp(r.intensity + 4);
      return `${r.name} recusou a conversa.`;
    },
  },
  {
    id: 'pv_bastao', fatigue: false, label: 'Passar o bastão a um(a) filho(a)', category: 'Vida pessoal', cost: 0,
    description: 'Você se aposenta da política e a partida continua com um(a) filho(a) adulto(a) que tenha interesse em política: herda parte do seu reconhecimento, da sua base e da sua rejeição, e o mesmo partido. Se o(a) herdeiro(a) já tem mandato, você continua jogando com esse mandato.',
    availability: (s) => (!has(s) || !children(s).length ? 'hidden' : batonBlock(s)),
    paramLabel: 'Herdeiro(a)', params: (s) => heirCandidates(s).map((c) => ({ value: c.id, label: `Continuar como ${c.name} (${memberAge(s, c)} anos)${heirInOffice(s, c) ? ` — com o mandato de ${c.politics!.office === 'vereador' ? 'vereador(a)' : 'deputado(a) estadual'}` : ''}` })),
    apply: (s, rng, param) => switchToHeir(s, rng, param!),
  },
  {
    id: 'pv_sair_pela_familia', fatigue: false, label: 'Deixar a vida pública pela família', category: 'Vida pessoal', cost: 0,
    description: 'Encerra a partida: você escolhe a família e a vida fora da política.',
    availability: (s) => (!has(s) || !s.personal!.family.some((m) => !m.ex) ? 'hidden' : s.player.candidacy?.status === 'registrada' ? 'Não durante uma candidatura registrada.' : null),
    apply: (s) => { s.ending = computeEnding(s, 'familia'); s.gameOver = true; return `Fim de carreira: ${s.ending.title}.`; },
  },
];

function children(s: GameState) { return s.personal?.family.filter((m) => m.relation === 'filho') ?? []; }

/** Troca o personagem pelo(a) herdeiro(a), no mesmo mundo e no mesmo mês (PROPOSTA). */
export function switchToHeir(s: GameState, rng: RngState, heirId: string): string {
  const p = s.personal!;
  const h = p.family.find((m) => m.id === heirId);
  if (!h) return 'Herdeiro(a) não encontrado(a).';
  const old = s.character;
  const oldPeak = peakOffice(s);
  const oldPartner = partner(s);
  const profs: ProfessionId[] = ['advogado', 'economista', 'professor', 'empresario', 'jornalista', 'servidor'];
  const prof = profs[Math.floor(next(rng) * profs.length)];
  const attrs = { ...BASE_ATTRIBUTES } as Attributes;
  for (const k of Object.keys(attrs) as (keyof Attributes)[]) {
    if (k === 'popularity') continue;
    attrs[k] = clamp(Math.round(BASE_ATTRIBUTES[k] + (PROFESSIONS[prof].mods[k] ?? 0) + (old.attributes[k] - BASE_ATTRIBUTES[k]) * 0.35 + (next(rng) - 0.5) * 8 + 4));
  }
  attrs.popularity = clamp(Math.round(old.attributes.popularity * 0.3));
  const ideology = { ...old.ideology };
  for (const k of Object.keys(ideology) as (keyof typeof ideology)[]) ideology[k] = Math.max(-100, Math.min(100, Math.round(ideology[k] + (next(rng) - 0.5) * 30)));
  const date = `${s.month.year}-${String(s.month.month).padStart(2, '0')}-01`;
  s.character = { ...old, name: h.name, birthDate: `${h.birthYear}-06-15`, gender: h.gender === 'F' ? 'Feminino' : 'Masculino', profession: prof, startStatus: 'herdeiro', bio: `Filho(a) de ${old.name}.`, education: 'Ensino superior', attributes: attrs, ideology };
  const pl = s.player;
  const partyId = pl.partyId;
  pl.recognition = clamp(Math.max(4, pl.recognition * 0.35));
  pl.base = clamp(pl.base * 0.4);
  pl.credibility = clamp(55 + ((pl.credibility ?? 60) - 60) * 0.5);
  pl.candidacy = null;
  pl.staff = null;
  pl.team = undefined;
  pl.job = 'profissao';
  pl.careerHistory = [];
  pl.consecutiveTermsPrefeito = 0;
  pl.consecutiveTermsGovernador = 0;
  pl.recognitionFloor = 0;
  pl.regionalGoodwill = Object.fromEntries(Object.entries(pl.regionalGoodwill ?? {}).map(([k, v]) => [k, v * 0.5]));
  pl.partyRel = initialPartyRel('herdeiro', !!partyId);
  pl.filiationDate = partyId ? date : null;
  pl.partyHistory = partyId ? [{ partyId, from: date, to: null }] : [];
  pl.actionUse = {};
  pl.social = initialSocial(prof, rng);
  s.finances.cash = Math.round(Math.max(0, s.finances.cash) * 0.3) + PROFESSIONS[prof].cash;
  s.finances.monthlyIncome = PROFESSIONS[prof].income;
  s.finances.monthlyExpenses = Math.round(Math.max(1200, PROFESSIONS[prof].income * 0.65));
  s.finances.assets = PROFESSIONS[prof].cash * 2;
  s.finances.debts = 0;
  if (s.national) for (const r of BR_REGIONS) { s.national.player[r].recognition *= 0.3; s.national.player[r].approval = 50; }
  const fam: FamilyMember[] = [{ id: `fam_ant_${now(s)}`, name: old.name, relation: old.gender === 'Feminino' ? 'mae' : 'pai', gender: old.gender === 'Feminino' ? 'F' : 'M', birthYear: Number(old.birthDate.slice(0, 4)), mood: 80, trait: 'apoiador', politicalInterest: 90, formerOffice: oldPeak }];
  if (oldPartner) fam.push({ ...oldPartner, relation: oldPartner.gender === 'F' ? 'mae' : 'pai', politicalInterest: 10 });
  for (const c of p.family.filter((m) => m.relation === 'filho' && m.id !== h.id)) fam.push({ ...c, relation: 'irmao', employedByPlayer: undefined });
  const generation = p.generation + 1;
  s.personal = {
    ...p,
    marital: 'solteiro', family: fam, romance: null,
    friends: [{ id: `mentor_${now(s)}`, name: old.name, kind: 'mentor', trust: 85 }, ...p.friends.filter((f) => f.kind === 'mentor').map((f) => ({ ...f, trust: f.trust * 0.6 }))],
    rival: null, stress: 20, health: 90, exposure: 0, heat: 0, threats: [], security: 'nenhuma', securityUntil: 0, privateSecurity: false,
    leave: null, leaveUsed: {}, therapy: false, lastFamilyTime: now(s), highStressMonths: 0, reducedAgendaUntil: 0, lastHealthEvent: 0, promisedTimeUntil: 0,
    heirId: null, generation, ancestors: [...p.ancestors, { name: old.name, peak: oldPeak, until: now(s) }], occurrences: 0, rng: p.rng,
  };
  // Herdeiro(a) com mandato em curso: o jogador assume esse mandato.
  let office = '';
  const pol = h.politics;
  if (pol?.status === 'eleito' && pol.since !== undefined && pol.until !== undefined && now(s) >= pol.since && now(s) <= pol.until) {
    const ymd = (t: number, d: string) => `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-${d}`;
    if (pol.office === 'vereador') {
      const seat = s.government.councillors.find((c) => c.id === `heir_${h.id}`);
      if (seat) { seat.id = 'character_player'; seat.name = h.name; }
      s.player.mandate = newMandate('vereador', ymd(pol.since, '01'), ymd(pol.until, '31'));
      s.player.job = null;
      s.player.careerHistory.push({ office: 'Vereador(a) de São Paulo', from: `${Math.floor(pol.since / 12)}-01`, to: null, note: 'Eleito(a) antes de herdar a partida' });
      s.finances.monthlyIncome = SALARY_VEREADOR;
      if (seat) initLegislature(s, s.rng);
    } else {
      startUpperMandate(s, 'deputado_estadual', ymd(pol.since, '15'), ymd(pol.until, '14'), 'Eleito(a) antes de herdar a partida');
    }
    s.player.recognition = clamp(Math.max(s.player.recognition, 18));
    office = pol.office === 'vereador' ? ' Você segue no mandato de vereador(a).' : ' Você segue no mandato de deputado(a) estadual.';
  }
  s.personal.exposure = computeExposure(s);
  s.flags.passouBastao = generation;
  return `${old.name} se aposentou da política (${oldPeak}). A partida continua com ${h.name}, ${characterAge(s)} anos — ${generation}ª geração da família na política.${office}`;
}

const SALARY_VEREADOR = 18991.68;
export function heirInOffice(s: GameState, m: FamilyMember): boolean {
  const pol = m.politics;
  return !!pol && pol.status === 'eleito' && pol.since !== undefined && pol.until !== undefined && now(s) >= pol.since && now(s) <= pol.until;
}

/** Parente eleito(a) vereador(a) ocupa uma cadeira na Câmara na posse (SIMPLIFICAÇÃO: substitui um vereador fictício, de preferência do mesmo partido). */
export function seatHeirs(s: GameState): string[] {
  const out: string[] = [];
  for (const m of s.personal?.family ?? []) {
    const pol = m.politics;
    if (!pol || pol.status !== 'eleito' || pol.office !== 'vereador' || pol.seated || pol.since === undefined || now(s) < pol.since || now(s) > (pol.until ?? 0)) continue;
    // Eleito(a) na apuração: a cadeira já veio na posse da nova legislatura.
    if (s.government.councillors.some((c) => c.id === `heir_${m.id}`)) { pol.seated = true; out.push(`${m.name} tomou posse como vereador(a) de São Paulo.`); continue; }
    const pool = s.government.councillors.filter((c) => !c.real && c.id !== 'character_player' && !c.id.startsWith('heir_'));
    const same = pool.filter((c) => c.partyId === s.player.partyId).sort((a, b) => a.votes - b.votes);
    const target = same[0] ?? [...pool].sort((a, b) => a.votes - b.votes)[0];
    pol.seated = true;
    if (!target) { out.push(`${m.name} tomou posse como vereador(a) de São Paulo (a cadeira não é mostrada na lista da Câmara, que só tem vereadores reais nesta legislatura).`); continue; }
    Object.assign(target, { id: `heir_${m.id}`, name: m.name, partyId: s.player.partyId ?? target.partyId, electedIn: pol.year, birthDate: `${m.birthYear}-06-15`, birthPrecision: 'ano' });
    s.government.councilSeatsByParty = seatsByParty(s.government.councillors);
    out.push(`${m.name} tomou posse como vereador(a) de São Paulo.`);
  }
  return out;
}
