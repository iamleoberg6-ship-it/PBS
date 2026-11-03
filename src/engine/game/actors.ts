// Registro único de atores políticos (Plano §8). Pessoas reais entram só com fatos públicos
// (nome, partido, cargo, votos); traços de comportamento são SEMPRE simulados, com a mesma
// metodologia para todos, e a interface os marca como tal.

import { int, next, type RngState } from '../rng';
import { EXPERT_SCALE } from '../data/ideology';
import { fictionalName } from './names';
import type { Actor, ActorRole, GameState } from './types';

export function randomTraits(rng: RngState): Actor['traits'] {
  return { ambition: int(rng, 20, 90), loyalty: int(rng, 20, 90), pragmatism: int(rng, 20, 90), articulation: int(rng, 25, 85), charisma: int(rng, 25, 85) };
}

export function newActor(rng: RngState, id: string, role: ActorRole, partyId: string | null, opts: Partial<Actor> = {}): Actor {
  const traits = opts.traits ?? randomTraits(rng);
  const goal: Actor['goal'] = traits.ambition > 72 ? (role === 'vereador' ? 'presidir_camara' : 'presidir_diretorio') : traits.ambition > 50 ? (role === 'vereador' ? 'reeleicao' : 'fortalecer_faccao') : 'nenhum';
  return {
    id, role, partyId,
    name: opts.name ?? fictionalName(rng),
    real: opts.real ?? false,
    traits,
    ideology: opts.ideology ?? (partyId ? EXPERT_SCALE[partyId]?.value ?? null : null),
    influence: opts.influence ?? int(rng, 15, 60),
    goal: opts.goal ?? goal,
    factionId: opts.factionId ?? null,
  };
}

/** Vereadores atuais viram atores. Ideologia = posição do partido (sem atribuir opinião individual a pessoa real). */
export function councillorActors(s: GameState, rng: RngState): void {
  for (const c of s.government.councillors) {
    if (c.id === 'character_player' || s.actors[c.id]) continue;
    s.actors[c.id] = newActor(rng, c.id, 'vereador', c.partyId, {
      name: c.name, real: c.real, influence: Math.min(90, Math.round(20 + Math.log10(Math.max(1000, c.votes)) * 10 - 30 + next(rng) * 10)),
    });
  }
}
