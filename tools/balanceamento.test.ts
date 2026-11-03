import { it } from 'vitest';
import { createGame, advanceMonth, availableActions, performAction, resolveEvent, GAMEPLAY, fatigueMultiplier } from '../src/engine';
// Robô "diligente": usa todos os compromissos, variando ações (sujeito ao desgaste).
const PREF = ['pleitear','corpo_a_corpo','comunicacao','arrecadar','comicio','pre_campanha','comunidade','redes','atividade_partidaria','aproximar_faccao','mobilizar_filiados','estudar','rede_contatos'];
function run(ap: number, seed: number, office: 'vereador'|'prefeito') {
  const pref = [...PREF];
  GAMEPLAY.actionPointsPerMonth.value = ap;
  let s = createGame({ name:'T', birthDate:'1990-03-03', gender:'x', education:'s', profession:'professor', startStatus:'filiado', startPartyId:'party_real_psb', bio:'', attributeBonus:{communication:10,articulation:20,charisma:10}, seed });
  while (!(s.month.year===2028&&s.month.month===11)) {
    while (s.pendingEvents.length) s = resolveEvent(s, 0);
    let guard = 0;
    while (s.actionPoints > 0 && guard++ < 20) {
      // escolhe a ação disponível de maior rendimento (respeitando o desgaste)
      const opts = availableActions(s).filter(a => a.status===null && pref.includes(a.def.id) && s.actionPoints >= a.def.cost);
      if (!opts.length) break;
      const a = opts.sort((x,y)=> (fatigueMultiplier(s,y.def.id).mult - fatigueMultiplier(s,x.def.id).mult) || pref.indexOf(x.def.id)-pref.indexOf(y.def.id))[0];
      const before = s.actionPoints;
      s = performAction(s, a.def.id, a.def.id==='pleitear'?office:a.def.params?.(s)[0]?.value);
      if (s.actionPoints === before) pref.splice(pref.indexOf(a.def.id),1);
    }
    s = advanceMonth(s);
  }
  const e = s.elections[0];
  return { votes: e.playerVotes ?? 0, elected: e.playerElected, rec: Math.round(s.player.recognition), base: Math.round(s.player.base), trust: Math.round(s.player.partyRel.leadershipTrust) };
}
it('balance', () => {
  for (const ap of [3,5]) for (const office of ['vereador','prefeito'] as const) {
    const rs = [1,2,3,4,5,6].map(seed => run(ap, seed, office));
    const avg = (k: keyof typeof rs[0]) => Math.round(rs.reduce((a,r)=>a+Number(r[k]),0)/rs.length);
    console.log(`AP=${ap} ${office}: votos médios ${avg('votes')}, eleitos ${rs.filter(r=>r.elected).length}/6, reconhecimento ${avg('rec')}, base ${avg('base')}, confiança ${avg('trust')}`);
  }
  GAMEPLAY.actionPointsPerMonth.value = 5;
}, 120000);
