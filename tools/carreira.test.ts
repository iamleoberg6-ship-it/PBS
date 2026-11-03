// Robô de carreira longa (Fase 5): joga de 2027 a 2036 tentando subir de cargo a cada eleição,
// faz promessas, responde crises e usa as ações de cada mandato. Mede cargos alcançados e desfechos.
// Rodar: npm run balance
import { it, expect } from 'vitest';
import { createGame, advanceMonth, availableActions, performAction, resolveEvent, nextElection, monthIndex, REGIONS, type GameState, type NewGameInput } from '../src/engine';

const LADDER: Record<string, string> = { none: 'vereador', vereador: 'deputado_estadual', deputado_estadual: 'deputado_federal', deputado_federal: 'senador', prefeito: 'governador', secretario: 'deputado_estadual', senador: 'governador', governador: 'senador' };
const PREFS = [
  'responder_crise', 'renunciar_concorrer', 'pleitear', 'coligacao', 'cumprir_promessa', 'promessa_comunidade',
  'gov_alesp', 'gov_programa', 'gov_convenio', 'up_comissao', 'up_emenda', 'up_projeto', 'up_articular', 'up_base',
  'programa_metas', 'nomear_secretario', 'zeladoria', 'negociar_estado_uniao', 'lancar_programa', 'acompanhar_programa',
  'projeto_lei', 'articular_votos', 'atender_base', 'emendas',
  'montar_equipe', 'plano_campanha', 'arrecadar', 'corpo_a_corpo', 'comunicacao', 'comicio', 'lideranca_local',
  'pre_campanha', 'comunidade', 'redes', 'atividade_partidaria', 'rede_contatos',
];
const ONCE = new Set(['promessa_comunidade', 'cumprir_promessa', 'up_emenda', 'gov_programa', 'projeto_lei', 'up_projeto']);

function choose(s: GameState, id: string, opts: { value: string; label: string }[]): string | undefined {
  if (id === 'pleitear') {
    const ne = nextElection(monthIndex(s.month));
    const cur = s.player.mandate?.office ?? 'none';
    let want = LADDER[cur] ?? 'vereador';
    if (ne.kind === 'municipal') want = cur === 'vereador' && s.player.recognition > 45 ? 'prefeito' : 'vereador';
    if (ne.kind === 'geral' && (want === 'vereador' || want === 'prefeito')) want = 'deputado_estadual';
    return opts.find((o) => o.value === want)?.value ?? opts[0]?.value;
  }
  if (id === 'responder_crise') {
    const c = s.crises.find((x) => x.status === 'ativa' && x.targetId === 'character_player');
    const r = c?.truth === 'falsa' ? 'desmentir' : c?.truth === 'distorcida' ? 'explicar' : 'desculpas';
    return opts.find((o) => o.value.endsWith(`|${r}`))?.value;
  }
  if (id === 'comunicacao') return 'digital';
  return opts[(s.month.month * 3 + s.month.year) % Math.max(1, opts.length)]?.value;
}

function play(seed: number, input: Partial<NewGameInput>) {
  let s = createGame({ name: 'Bot', birthDate: '1980-05-05', gender: 'x', education: 's', bio: '', attributeBonus: { articulation: 12, communication: 12, management: 10 }, seed, homeRegion: REGIONS[seed % REGIONS.length].id, profession: 'advogado', startStatus: 'militante', startPartyId: 'party_real_psd', ...(input as NewGameInput) });
  (s as GameState).player.recognition = Math.max(s.player.recognition, 18); // perfil com algum histórico local
  let guard = 0;
  while (!s.gameOver && guard++ < 200) {
    while (s.pendingEvents.length) s = resolveEvent(s, 0);
    // Equipe do gabinete: nomeia os currículos mais confiáveis que couberem (tarefa sugerida na ficha).
    for (const c of [...(s.player.team?.pool ?? [])].sort((x, y) => y.honestyEstimate - x.honestyEstimate)) s = performAction(s, 'eq_nomear', `${c.id}|ativo`);
    const done = new Set<string>();
    let g = 0;
    while (s.actionPoints > 0 && g++ < 12) {
      const avail = availableActions(s).filter((a) => a.status === null && a.def.cost <= s.actionPoints && a.def.id !== 'encerrar_carreira');
      const openP = s.communityPromises.filter((p) => p.status === 'aberta' || p.status === 'em_andamento').length;
      const a = PREFS.map((id) => avail.find((x) => x.def.id === id)).find((x) => x && !((ONCE.has(x.def.id) || x.def.cost === 0) && done.has(x.def.id)) && !(x.def.id === 'promessa_comunidade' && (openP >= 2 || s.month.month < 8 || s.month.month > 9)));
      if (!a) break;
      const opts = a.def.params?.(s) ?? [];
      const before = s.actionPoints;
      s = performAction(s, a.def.id, opts.length ? choose(s, a.def.id, opts) : undefined);
      done.add(a.def.id);
      if (s.actionPoints === before && a.def.cost > 0) break;
    }
    s = advanceMonth(s);
  }
  return s;
}

it('carreira longa: cargos alcançados e desfechos até 2036', () => {
  const rows: string[] = [];
  const peaks: Record<string, number> = {};
  for (const [label, input] of [['advogado PSD', {}], ['influenciador PL', { profession: 'influenciador', startPartyId: 'party_real_pl' }], ['professor PT', { profession: 'professor', startPartyId: 'party_real_pt' }]] as const) {
    for (let seed = 1; seed <= 4; seed++) {
      const s = play(seed, input as Partial<NewGameInput>);
      expect(s.gameOver).toBe(true);
      const offices = s.player.careerHistory.map((h) => h.office.replace(' de São Paulo', '').replace(' por SP', ''));
      for (const o of new Set(offices)) peaks[o] = (peaks[o] ?? 0) + 1;
      rows.push(`${label} #${seed}: ${offices.join(' → ') || '—'} | final: ${s.ending?.title} (${s.ending?.score}) | promessas ✓${s.communityPromises.filter((p) => p.status === 'cumprida').length} ✗${s.communityPromises.filter((p) => p.status === 'quebrada').length} | crises ${s.crises.filter((c) => c.targetId === 'character_player').length} | cred ${Math.round(s.player.credibility ?? 0)} | conquistas ${s.achievements.length}`);
    }
  }
  console.log(rows.join('\n'));
  console.log('Cargos (nº de partidas em que foram exercidos):', JSON.stringify(peaks));
}, 600_000);
