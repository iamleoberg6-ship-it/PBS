// Salvamento: versão, pacote de regras e estado do RNG ficam no save (regra de ouro do documento mestre).
// Carregar = parse → migração por formato (v1 → v2 → v3) → validação estrutural com reparo do que é seguro reparar.
// Erros fatais (sem personagem, sem calendário, pacote de regras desconhecido) recusam o save com mensagem clara.

import { refreshPool, teamOffice } from './team';
import { TIPS } from './tutorial';
import { GAMEPLAY, RULEPACK_BR_2028_MUN } from '../data/rulepack';
import { initStateWorld } from './general';
import { initOutlets } from './livingworld';
import { vacateCouncilSeat } from './careers';
import { PARTIES, partyById } from '../data/parties';
import { neutralIdeology } from '../data/ideology';
import { createRng } from '../rng';
import { SAVE_VERSION, type GameState } from './types';
import { initialCouncillors, seatsByParty } from './council';
import { initialSocial } from './social';
import { recomputeNetWorth } from './finance';
import { PROFESSIONS } from './create';
import { EVENTS } from './events';
import { COUNCILLOR_BIRTHS } from '../data/world';
import { councillorActors } from './actors';
import { buildPartyOrgs, defaultPartyRel, seedPlayerPartyRelations } from './partyorg';
import { emptyLegislature, fileBill, initLegislature } from './legislature';
import { createSecretariat } from './secretariat';
import { initCity } from './municipality';
import { pickHomeRegion } from './campaign';
import { hireAsStaff, staffBossOptions } from './assessor';
import { NUNES_2024_COALITION } from './create';

const KEY = 'pbs_save_slot_1';

export interface LoadReport {
  migratedFrom: number | null;
  repairs: string[];
  fatal: string[];
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Migração por formato: preenche o que versões antigas não tinham, de forma determinística. */
export function migrate(raw: Raw, report: LoadReport): Raw {
  const from = Number(raw.saveVersion ?? 0);
  if (from === SAVE_VERSION) return raw;
  report.migratedFrom = from;
  const s = raw;
  // v1 (protótipos 0.1/0.2) → v2: Câmara nominal, disputa de prefeito, pesquisas, ideologia, redes, notícias.
  s.government ??= {};
  if (!Array.isArray(s.government.councillors)) {
    s.government.councillors = initialCouncillors();
    report.repairs.push('Câmara nominal ausente: carregada a composição eleita em 2024.');
  }
  s.mayorRace ??= null;
  s.polls ??= [];
  s.news ??= [];
  if (s.character && !s.character.ideology) s.character.ideology = neutralIdeology();
  if (s.player && !s.player.social) {
    s.player.social = initialSocial(s.character?.profession ?? 'autonomo', createRng((s.rng?.seed ?? 1) + 7));
    report.repairs.push('Redes sociais ausentes: criadas a partir da profissão.');
  }
  // v2 → v3: bens pessoais e patrimônio derivado.
  if (s.finances && typeof s.finances.assets !== 'number') {
    const guess = Math.max(0, Number(s.finances.netWorth ?? 0) - Number(s.finances.cash ?? 0));
    s.finances.assets = guess || (PROFESSIONS[s.character?.profession as keyof typeof PROFESSIONS]?.cash ?? 0) * 2;
    report.repairs.push('Patrimônio: bens pessoais estimados a partir do save antigo.');
  }
  // v3 → v4: relação com o partido em cinco indicadores, atores, organizações partidárias, relações, livro de causas.
  if (s.player && !s.player.partyRel) {
    const st = Number(s.player.partyStanding ?? 0);
    s.player.partyRel = s.player.partyId
      ? { ...defaultPartyRel(), leadershipTrust: st, internalPopularity: Math.round(st * 0.8), influence: Math.round(st * 0.5), perceivedLoyalty: 55, mobilization: Math.round((s.player.base ?? 0) * 0.4) }
      : defaultPartyRel();
    delete s.player.partyStanding;
    report.repairs.push('Relação com o partido convertida em cinco indicadores (confiança da direção, popularidade interna, influência, fidelidade percebida, mobilização).');
  }
  s.player && (s.player.actionUse ??= {});
  for (const c of s.government?.councillors ?? []) {
    if (c.birthDate === undefined) { const b = COUNCILLOR_BIRTHS[c.name]; c.birthDate = b?.date ?? null; c.birthPrecision = b?.precision ?? null; }
  }
  s.contests ??= [];
  s.promises ??= [];
  s.ledger ??= [];
  s.relations ??= {};
  if (!s.actors || !s.partyOrgs) {
    s.actors = {};
    s.partyOrgs = {};
    const rng = createRng((s.rng?.seed ?? 1) + 11);
    councillorActors(s as GameState, rng);
    buildPartyOrgs(s as GameState, rng);
    seedPlayerPartyRelations(s as GameState, rng);
    report.repairs.push('Partidos ganharam diretório, executiva e facções (gerados para esta partida).');
  }
  // v4 → v5: motor legislativo (comissões, projetos, blocos, Mesa, CPI) e secretarias com indicadores.
  if (!s.legislature) {
    const rng = createRng((s.rng?.seed ?? 1) + 23);
    if (Array.isArray(s.government?.mayorCoalition) && s.government.mayorCoalition.join() === 'party_real_mdb,party_real_pl' && (s.month?.year ?? 2027) < 2029) {
      s.government.mayorCoalition = NUNES_2024_COALITION;
      report.repairs.push('Base do prefeito atualizada para a coligação de 12 partidos de 2024.');
    }
    s.legislature = emptyLegislature();
    initLegislature(s as GameState, rng);
    const pres = s.government?.councilPresident;
    if (pres?.personId) { s.legislature.presidentId = pres.personId; s.legislature.mesaYear = pres.year ?? null; }
    const m = s.player?.mandate;
    if (m?.office === 'vereador' && Array.isArray(m.projects)) {
      for (const p of m.projects.filter((x: Raw) => x.status === 'tramitando')) {
        const b = fileBill(s as GameState, rng, THEMES_FOR_MIGRATION.includes(p.theme) ? p.theme : 'zeladoria', 'regulacao');
        b.title = p.title;
      }
      m.projects = [];
    }
    if (m?.office === 'secretario' && !m.secretariat) {
      m.secretariat = createSecretariat(String(m.portfolio ?? ''));
      m.portfolio = m.secretariat.name;
    }
    report.repairs.push('Câmara Municipal ganhou comissões, projetos com tramitação, blocos e Mesa (gerados para esta partida).');
  }
  // v5 → v6: Prefeitura com orçamento, limites fiscais, secretarias da IA e contas.
  if (!s.city) {
    s.city = initCity(s as GameState, createRng((s.rng?.seed ?? 1) + 37));
    const m = s.player?.mandate;
    if (m?.office === 'secretario' && m.secretariat) m.secretariat.budget = s.city.loa.areas[m.secretariat.portfolio] ?? m.secretariat.budget;
    report.repairs.push('Prefeitura ganhou orçamento (base real de 2025–2027), limites fiscais e secretariado.');
  }
  // v6 → v7: região de moradia, campanha territorial e gabinete parlamentar jogável.
  if (s.player && !s.player.homeRegion) {
    const rng = createRng((s.rng?.seed ?? 1) + 43);
    s.player.homeRegion = pickHomeRegion(rng);
    s.player.staff ??= null;
    if (s.player.job === 'assessor' && !s.player.staff && !s.player.mandate) {
      const opts = staffBossOptions(s as GameState);
      if (opts.length) hireAsStaff(s as GameState, opts[0].value);
      else s.player.job = 'profissao';
    }
    report.repairs.push('Personagem ganhou região de moradia; gabinete parlamentar e campanha territorial ativados.');
  }
  // v7 → v8 (Fase 5): mundo estadual/federal, crises de imagem, promessas, conquistas e ciclos após 2028.
  if (!s.stateWorld) {
    s.stateWorld = initStateWorld();
    s.generalElections ??= [];
    s.crises ??= [];
    s.outlets ??= initOutlets();
    s.communityPromises ??= [];
    s.achievements ??= [];
    s.ending ??= null;
    if (s.player) {
      s.player.credibility ??= 60;
      s.player.consecutiveTermsGovernador ??= 0;
      s.player.regionalGoodwill ??= {};
      if (s.player.candidacy && !s.player.candidacy.year) s.player.candidacy.year = 2028;
    }
    if (s.flags && s.flags.expedienteDecidido) s.flags.expediente_2028 = true;
    s.flags.saidas2026 = true;
    // Saves já depois de fev/mar 2027: aplica agora as saídas reais de 2026 (suplentes fictícios assumem).
    const tNow = (s.month?.year ?? 2027) * 12 + (s.month?.month ?? 1) - 1;
    for (const d of s.stateWorld.pendingDepartures.filter((x: Raw) => x.posseMonth <= tNow)) vacateCouncilSeat(s as GameState, d.councillorId, 'eleito(a) deputado(a) em 2026 — fato real');
    s.stateWorld.pendingDepartures = s.stateWorld.pendingDepartures.filter((x: Raw) => x.posseMonth > tNow);
    report.repairs.push('Fase 5: eleições gerais (Alesp, Câmara, Senado, governo), crises de imagem, promessas públicas e conquistas ativadas; a partida agora segue até 2036.');
  }
  s.saveVersion = SAVE_VERSION;
  return s;
}

const THEMES_FOR_MIGRATION = ['zeladoria', 'saude', 'educacao', 'mobilidade', 'cultura', 'gcm', 'meioambiente', 'habitacao'];

const clamp = (v: unknown, a = 0, b = 100) => Math.max(a, Math.min(b, Number.isFinite(v as number) ? (v as number) : a));

/** Validação estrutural + reparos seguros. Retorna o relatório (vazio = íntegro). */
export function validateState(s: GameState, report: LoadReport = { migratedFrom: null, repairs: [], fatal: [] }): LoadReport {
  // Fatais
  if (!s || typeof s !== 'object') { report.fatal.push('Arquivo vazio ou inválido.'); return report; }
  if (!s.character?.name || !s.character.birthDate) report.fatal.push('Personagem ausente ou incompleto.');
  if (!s.month || !Number.isInteger(s.month.year) || s.month.month < 1 || s.month.month > 12) report.fatal.push('Data da partida inválida.');
  if (!s.rng || !Number.isFinite(s.rng.state)) report.fatal.push('Estado do gerador aleatório ausente (reprodutibilidade comprometida).');
  if (s.rulepackId !== RULEPACK_BR_2028_MUN.id && !/^BR-20\d\d-(MUN|GER)-proj$/.test(s.rulepackId)) report.fatal.push(`Pacote de regras ${s.rulepackId} não está disponível nesta versão.`);
  if (report.fatal.length) return report;

  // Atributos e indicadores dentro de 0..100
  for (const [k, v] of Object.entries(s.character.attributes)) {
    if (!Number.isFinite(v) || v < 0 || v > 100) { s.character.attributes[k as keyof typeof s.character.attributes] = clamp(v); report.repairs.push(`Atributo ${k} fora do intervalo foi ajustado.`); }
  }
  for (const k of ['recognition', 'base'] as const) {
    const v = s.player[k];
    if (!Number.isFinite(v) || v < 0 || v > 100) { s.player[k] = clamp(v); report.repairs.push(`Indicador ${k} fora do intervalo foi ajustado.`); }
  }
  for (const k of ['internalPopularity', 'leadershipTrust', 'influence', 'perceivedLoyalty', 'mobilization'] as const) {
    const v = s.player.partyRel[k];
    if (!Number.isFinite(v) || v < 0 || v > 100) { s.player.partyRel[k] = clamp(v); report.repairs.push(`Indicador partidário ${k} fora do intervalo foi ajustado.`); }
  }
  if (s.month.year < 2027 || s.month.year > 2033) report.repairs.push('Data fora do período do protótipo (2027–2032).');

  // Finanças: valores finitos, caixa não negativo, patrimônio coerente
  const f = s.finances;
  for (const k of ['cash', 'assets', 'debts', 'monthlyIncome', 'monthlyExpenses'] as const) {
    if (!Number.isFinite(f[k])) { f[k] = 0; report.repairs.push(`Finanças: ${k} inválido zerado.`); }
  }
  if (f.cash < 0) { f.debts += -f.cash; f.cash = 0; report.repairs.push('Caixa negativo convertido em dívida.'); }
  const expected = Math.round(f.cash + f.assets - f.debts);
  if (f.netWorth !== expected) { recomputeNetWorth(s); report.repairs.push('Patrimônio líquido recalculado (caixa + bens − dívidas).'); }

  // Partido do jogador existe e histórico é coerente
  if (s.player.partyId && !partyById(s.player.partyId)) { report.repairs.push(`Partido ${s.player.partyId} desconhecido: jogador ficou sem partido.`); s.player.partyId = null; s.player.filiationDate = null; }
  const open = s.player.partyHistory.filter((h) => h.to === null);
  if (open.length > 1) { open.slice(0, -1).forEach((h) => (h.to = h.from)); report.repairs.push('Histórico de filiação com mais de uma filiação aberta foi corrigido.'); }

  // Câmara: 55 cadeiras, sem duplicidade, partidos válidos, bancadas coerentes
  const ids = new Set<string>();
  const before = s.government.councillors.length;
  s.government.councillors = s.government.councillors.filter((c) => {
    if (ids.has(c.id) || !partyById(c.partyId)) return false;
    ids.add(c.id);
    return true;
  });
  if (s.government.councillors.length !== before) report.repairs.push('Vereadores duplicados ou com partido inválido foram removidos.');
  if (s.government.councillors.length !== 55) report.repairs.push(`Câmara com ${s.government.councillors.length} vereadores (esperado: 55).`);
  const seats = seatsByParty(s.government.councillors);
  if (JSON.stringify(seats) !== JSON.stringify(s.government.councilSeatsByParty)) { s.government.councilSeatsByParty = seats; report.repairs.push('Bancadas recalculadas a partir da lista de vereadores.'); }

  // Partidos em tempo de execução para todos os partidos
  for (const p of PARTIES) if (!s.parties[p.id]) { s.parties[p.id] = { momentum: 0, leaderName: 'Direção partidária' }; report.repairs.push(`Partido ${p.acronym} sem estado de simulação: criado.`); }

  // Eventos pendentes com modelo existente
  const valid = new Set(EVENTS.map((e) => e.id));
  const pend = s.pendingEvents.length;
  s.pendingEvents = s.pendingEvents.filter((e) => valid.has(e.templateId));
  if (s.pendingEvents.length !== pend) report.repairs.push('Eventos pendentes desconhecidos foram descartados.');

  // Organizações partidárias: atores referenciados existem; participação das facções soma 1.
  for (const org of Object.values(s.partyOrgs)) {
    const missing = [org.directorate.presidentId, ...org.directorate.executive.map((e) => e.actorId), ...org.factions.map((f) => f.leaderId)]
      .filter((id) => id !== 'character_player' && !s.actors[id]);
    if (missing.length) { report.repairs.push(`Diretório ${org.partyId}: ${missing.length} dirigente(s) inexistente(s) removido(s).`); org.directorate.executive = org.directorate.executive.filter((e) => e.actorId === 'character_player' || s.actors[e.actorId]); }
    const sum = org.factions.reduce((a, f) => a + f.share, 0);
    if (org.factions.length && Math.abs(sum - 1) > 0.01) { org.factions.forEach((f) => (f.share = f.share / sum)); report.repairs.push(`Facções do ${org.partyId} renormalizadas.`); }
  }
  for (const k of Object.keys(s.relations)) {
    const [a, b] = k.split('|');
    const ok = (id: string) => id === 'character_player' || !!s.actors[id];
    if (!ok(a) || !ok(b)) { delete s.relations[k]; report.repairs.push('Relação com personagem inexistente descartada.'); }
  }
  if (s.player.partyId && s.partyOrgs[s.player.partyId] === undefined) report.repairs.push('Partido do jogador sem organização.');

  // Câmara: comissões só com vereadores em exercício; votos registrados só para projetos existentes.
  if (!s.legislature || !Array.isArray(s.legislature.committees)) {
    s.legislature = emptyLegislature();
    initLegislature(s, createRng(s.rng.seed + 29));
    report.repairs.push('Estado da Câmara ausente: comissões e blocos recriados.');
  } else {
    const members = new Set(s.government.councillors.map((c) => c.id));
    const assigned = s.legislature.committees.flatMap((c) => c.members);
    if (assigned.some((id) => !members.has(id)) || assigned.length !== members.size) {
      initLegislature(s, createRng(s.rng.seed + 31));
      report.repairs.push('Comissões inconsistentes com a composição da Câmara foram recompostas.');
    }
    const billIds = new Set(s.legislature.bills.map((b) => b.id));
    for (const id of Object.keys(s.legislature.playerVotes)) if (!billIds.has(id)) delete s.legislature.playerVotes[id];
  }

  // Prefeitura
  if (!s.city || !s.city.loa) { s.city = initCity(s, createRng(s.rng.seed + 41)); report.repairs.push('Estado da Prefeitura ausente: recriado.'); }
  for (const k of ['debt', 'cash', 'contingency', 'activity', 'priceLevel'] as const) if (!Number.isFinite(s.city[k])) { s.city[k] = k === 'activity' || k === 'priceLevel' ? 1 : 0; report.repairs.push(`Prefeitura: ${k} inválido corrigido.`); }

  // Redes sociais
  for (const [k, v] of Object.entries(s.player.social.networks)) {
    if (!Number.isFinite(v) || v < 0) { s.player.social.networks[k as keyof typeof s.player.social.networks] = 0; report.repairs.push(`Seguidores inválidos em ${k} foram zerados.`); }
  }
  return report;
}

export function loadSave(text: string): { state: GameState; report: LoadReport } {
  const report: LoadReport = { migratedFrom: null, repairs: [], fatal: [] };
  let raw: Raw;
  try { raw = JSON.parse(text); } catch { throw new Error('O texto não é um save válido (JSON corrompido).'); }
  if (typeof raw.saveVersion === 'number' && raw.saveVersion > SAVE_VERSION) throw new Error(`Save da versão ${raw.saveVersion}, mais nova que esta versão do jogo (${SAVE_VERSION}).`);
  const migrated = migrate(raw, report) as GameState;
  upgradeWithinV8(migrated as Raw, report);
  validateState(migrated, report);
  if (report.fatal.length) throw new Error(report.fatal.join(' '));
  return { state: migrated, report };
}


/** Ajustes incrementais dentro da versão 8 (rodam em todo carregamento; são idempotentes). */
function upgradeWithinV8(s: Raw, report: LoadReport) {
  // Vereadores reais eleitos deputados em 2026 (saves v8 criados antes desta correção).
  if (s.stateWorld && !s.flags?.saidas2026) {
    s.flags.saidas2026 = true;
    const t = (s.month?.year ?? 2027) * 12 + (s.month?.month ?? 1) - 1;
    const real = initStateWorld().pendingDepartures;
    s.stateWorld.pendingDepartures = [...real.filter((d) => d.posseMonth > t), ...s.stateWorld.pendingDepartures.filter((d: Raw) => !d.real2026)];
    if (t < 2029 * 12) for (const d of real.filter((x) => x.posseMonth <= t)) if (s.government.councillors.some((c: Raw) => c.id === d.councillorId)) vacateCouncilSeat(s as GameState, d.councillorId, 'eleito(a) deputado(a) em 2026 — fato real');
    report.repairs.push('Vereadores reais eleitos deputados em 2026 deixam a Câmara; suplentes fictícios do mesmo partido assumem.');
  }
  s.floorVotes ??= [];
  // Guia (Fase 6): partidas já em andamento não reveem a introdução; só as dicas de recursos novos.
  if (!s.tutorial) {
    const elapsed = ((s.month?.year ?? 2027) - 2027) * 12 + (s.month?.month ?? 1) - 1;
    s.tutorial = { enabled: true, seen: elapsed >= 3 ? TIPS.map((x) => x.id).filter((id) => id !== 'equipe' && id !== 'intro_porque') : [] };
  }
  // Equipe do gabinete (ajuste pós-Fase 5): currículos disponíveis já no mês do carregamento.
  if (teamOffice(s as GameState) && !s.player.team?.pool?.length && s.rng) refreshPool(s as GameState, s.rng);
  // Cotas de emendas com valores reais de 2026 (ajuste pós-Fase 5).
  const um = s.player?.mandate?.upper;
  if (um && !s.flags.cotaEmendas2026) {
    s.flags.cotaEmendas2026 = true;
    const cota = ({ deputado_estadual: 13, deputado_federal: 40, senador: 73 } as Record<string, number>)[s.player.mandate.office];
    if (cota) {
      const used = (um.amendments ?? []).filter((a: Raw) => a.month?.year === s.month?.year).reduce((x: number, a: Raw) => x + (a.value ?? 0), 0);
      um.amendmentBudget = Math.max(0, cota - used);
    }
  }
  // Agenda do cargo (ajuste pós-Fase 5): saves antigos começam o mês com a agenda cheia.
  if (s.officePoints === undefined) {
    const o = s.player?.mandate?.office ?? (s.player?.staff ? 'assessor' : null);
    s.officePoints = o ? GAMEPLAY.officePointsPerMonth.value[o] ?? 0 : 0;
  }
}

/** Compatibilidade: devolve só o estado. */
export function deserialize(text: string): GameState {
  return loadSave(text).state;
}

const BACKUP_KEY = 'pbs_save_backups';
export interface SaveBackup { key: string; name: string; month: string; createdAt: string; savedAt: string; text: string }

function readBackups(): SaveBackup[] {
  try { return JSON.parse(localStorage.getItem(BACKUP_KEY) ?? '[]'); } catch { return []; }
}

/** Grava a partida. Se o espaço guardava OUTRA partida, ela vai para as cópias de segurança (até 3) em vez de ser apagada. */
export function saveLocal(state: GameState): boolean {
  try {
    const prev = localStorage.getItem(KEY);
    if (prev) {
      try {
        const head = JSON.parse(prev);
        if (head.createdAt && head.createdAt !== state.createdAt) {
          const list = readBackups().filter((b) => b.createdAt !== head.createdAt);
          list.unshift({ key: `bk_${Date.now()}`, name: head.character?.name ?? '—', month: `${String(head.month?.month ?? '').padStart(2, '0')}/${head.month?.year ?? ''}`, createdAt: head.createdAt, savedAt: new Date().toISOString(), text: prev });
          localStorage.setItem(BACKUP_KEY, JSON.stringify(list.slice(0, 3)));
        }
      } catch { /* save anterior ilegível: guarda como cópia bruta */
        const list = readBackups();
        list.unshift({ key: `bk_${Date.now()}`, name: 'save ilegível', month: '—', createdAt: `raw_${Date.now()}`, savedAt: new Date().toISOString(), text: prev });
        localStorage.setItem(BACKUP_KEY, JSON.stringify(list.slice(0, 3)));
      }
    }
    localStorage.setItem(KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function listBackups(): Omit<SaveBackup, 'text'>[] {
  return readBackups().map(({ text: _t, ...rest }) => rest);
}
export function backupText(key: string): string | null {
  return readBackups().find((b) => b.key === key)?.text ?? null;
}

/** Diagnóstico do espaço de save: existe? carrega? qual erro? (para não "sumir" com uma partida que falhou ao carregar). */
export function localSaveStatus(): { exists: boolean; error: string | null; raw: string | null } {
  try {
    const t = localStorage.getItem(KEY);
    if (!t) return { exists: false, error: null, raw: null };
    try { loadSave(t); return { exists: true, error: null, raw: t }; } catch (e) { return { exists: true, error: (e as Error).message, raw: t }; }
  } catch { return { exists: false, error: null, raw: null }; }
}

export function loadLocal(): GameState | null {
  try {
    const t = localStorage.getItem(KEY);
    return t ? loadSave(t).state : null;
  } catch {
    return null;
  }
}
