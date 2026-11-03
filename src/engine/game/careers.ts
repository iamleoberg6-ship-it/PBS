// Transições de carreira do jogador (Fase 5): fim de mandato, renúncia para concorrer, posse em cargos
// estaduais/federais e vagas abertas na Câmara Municipal.

import { PROFESSIONS } from './create';
import { ballotName, randomBirthDate } from './names';
import { partyById } from '../data/parties';
import { PLAYER } from './relations';
import { initLegislature } from './legislature';
import { newUpper, UPPER_LABEL, UPPER_SALARIES } from './upper';
import type { GameState, Mandate } from './types';

const ym = (s: GameState) => `${s.month.year}-${String(s.month.month).padStart(2, '0')}`;

export function newMandate(office: Mandate['office'], since: string, until: string): Mandate {
  return {
    office, since, until, stance: 'independente', approval: 50, relationExecutive: 50,
    councilBase: 0, projects: [], councilPresident: false, priorityArea: null, portfolio: null, budgetShare: 40,
  };
}

/** Encerra o mandato atual do jogador (fim de prazo, renúncia, exoneração, cassação). */
/**
 * Memória do eleitor (Fase 6, PROPOSTA): quem já disputou eleição ou exerceu mandato não volta ao anonimato.
 * Os votos recebidos e os cargos exercidos criam um piso de reconhecimento, abaixo do qual o esquecimento natural não leva.
 * scope 'estado': só parte dos votos estaduais vem da capital (o reconhecimento do jogo é medido na cidade).
 */
export function rememberVotes(s: GameState, votes: number, scope: 'cidade' | 'estado' = 'cidade') {
  if (!votes || votes <= 0) return;
  const cityVotes = scope === 'estado' ? votes * 0.45 : votes;
  const floor = Math.min(40, 6 + (cityVotes / 1000) * 1.2);
  s.player.recognitionFloor = Math.max(s.player.recognitionFloor ?? 0, Math.round(floor * 10) / 10);
  s.player.recognition = Math.min(100, Math.max(s.player.recognition, s.player.recognitionFloor) + Math.min(5, cityVotes / 6000));
}

const OFFICE_FLOOR: Record<string, number> = { assessor: 10, vereador: 28, secretario: 26, deputado_estadual: 32, deputado_federal: 36, secretario_estadual: 30, senador: 45, prefeito: 50, governador: 55 };

export function endMandate(s: GameState, text: string) {
  const prev = s.player.mandate?.office;
  if (prev) s.player.recognitionFloor = Math.max(s.player.recognitionFloor ?? 0, OFFICE_FLOOR[prev] ?? 0);
  s.player.careerHistory.forEach((h) => { if (h.to === null) h.to = ym(s); });
  s.player.mandate = null;
  s.player.job = 'profissao';
  s.finances.monthlyIncome = PROFESSIONS[s.character.profession].income;
  s.log.push({ month: { ...s.month }, kind: 'mandato', text });
}

/** A vaga de um vereador que deixa a Câmara vai para o suplente da mesma lista (Código Eleitoral art. 112; simplificado). */
export function vacateCouncilSeat(s: GameState, councillorId: string, reason: string): string | null {
  const idx = s.government.councillors.findIndex((c) => c.id === councillorId);
  if (idx < 0) return null;
  const old = s.government.councillors[idx];
  // Suplente: personagem do jogo da mesma lista (simplificação — a ordem real de suplência não é guardada no save).
  const seated = new Set(s.government.councillors.map((c) => c.id));
  // Suplente fictício do mesmo partido (mesma linha ideológica); a pessoa real que seria convocada não é modelada.
  const supId = `suplente_${old.id}_${s.month.year}`;
  const name = ballotName(s.rng);
  s.government.councillors[idx] = { ...old, id: seated.has(supId) ? `${supId}b` : supId, name, real: false, votes: Math.round(old.votes * 0.35), birthDate: randomBirthDate(s.rng, 1960, 1998), birthPrecision: 'exata' };
  initLegislature(s, s.rng);
  return `${old.name} deixou a Câmara Municipal (${reason}). Assume ${name} (${partyById(old.partyId)?.acronym ?? old.partyId}), suplente — personagem do jogo.`;
}

/** Desincompatibilização: o jogador sai do cargo executivo para disputar outro (CF art. 14 §6º; LC 64/90). */
export function resignForCandidacy(s: GameState): string {
  const m = s.player.mandate!;
  const y = s.player.candidacy?.year ?? s.month.year;
  s.flags[`desincomp_${y}`] = true;
  const office = m.office;
  if (office === 'prefeito') {
    s.government.mayor = { ...s.government.viceMayor };
    endMandate(s, `Você renunciou à Prefeitura para disputar a eleição de ${y} (CF art. 14 §6º). O(a) vice assume.`);
    return 'Renúncia apresentada. O(a) vice-prefeito(a) assume até o fim do mandato.';
  }
  if (office === 'secretario') {
    const sec = m.secretariat;
    if (sec) {
      s.city.secretariats[sec.portfolio] = sec;
      s.city.secretaries[sec.portfolio] = { portfolio: sec.portfolio, name: 'Secretário(a) interino(a) (personagem do jogo)', partyId: null, kind: 'tecnico', competence: 55, since: { ...s.month } };
    }
    endMandate(s, `Você deixou a secretaria municipal para concorrer em ${y} (desincompatibilização — LC 64/90 art. 1º).`);
    return 'Afastamento definitivo registrado. A pasta fica com um(a) interino(a).';
  }
  if (office === 'governador') {
    s.stateWorld.governor = { ...s.stateWorld.governor, id: 'vice_gov', name: 'Vice-governador(a) (personagem do jogo)', isPlayer: false };
    endMandate(s, `Você renunciou ao governo do Estado para disputar outro cargo em ${y} (CF art. 14 §6º). O(a) vice assume.`);
    return 'Renúncia apresentada. O(a) vice-governador(a) assume.';
  }
  endMandate(s, `Você deixou o cargo para concorrer em ${y}.`);
  return 'Afastamento registrado.';
}

/** Posse num cargo estadual/federal (deputado, senador, governador, secretário estadual). */
export function startUpperMandate(s: GameState, office: Mandate['office'], since: string, until: string, note: string) {
  if (s.player.mandate) {
    const prev = s.player.mandate.office;
    // Vereador eleito deputado: a vaga na Câmara Municipal vai para o suplente.
    if (prev === 'vereador') {
      const msg = vacateCouncilSeat(s, PLAYER, 'posse em outro cargo');
      if (msg) s.log.push({ month: { ...s.month }, kind: 'camara', text: msg });
    }
    endMandate(s, `Você deixou o cargo de ${prev} para tomar posse como ${UPPER_LABEL[office] ?? office}.`);
  }
  s.player.mandate = newMandate(office, since, until);
  s.player.mandate.upper = newUpper(office);
  s.player.mandate.approval = 52;
  s.player.job = null;
  s.finances.monthlyIncome = UPPER_SALARIES[office as keyof typeof UPPER_SALARIES]?.value ?? s.finances.monthlyIncome;
  s.player.careerHistory.push({ office: UPPER_LABEL[office] ?? office, from: ym(s), to: null, note });
  s.log.push({ month: { ...s.month }, kind: 'mandato', text: `Você tomou posse como ${UPPER_LABEL[office] ?? office} (${since.split('-').reverse().join('/')} a ${until.split('-').reverse().join('/')}).` });
}

/** Mandatos que vencem nesta data (comparação por mês). */
export function mandateExpired(s: GameState): boolean {
  const m = s.player.mandate;
  if (!m) return false;
  const [y, mo] = m.until.split('-').map(Number);
  return s.month.year * 12 + s.month.month > y * 12 + mo;
}

export const isMunicipalMandate = (o: string | undefined) => o === 'vereador' || o === 'prefeito' || o === 'secretario';
