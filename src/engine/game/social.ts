// Redes sociais (mecânica de jogo — PROPOSTA). Plataformas reais, números simulados.
import { next, normal, type RngState } from '../rng';
import type { GameState, NetworkId, ProfessionId, SocialState } from './types';

export const NETWORKS: { id: NetworkId; label: string; growth: number; risk: number; voteConversion: number; perk: string }[] = [
  { id: 'instagram', label: 'Instagram', growth: 1.0, risk: 0.04, voteConversion: 1.0, perk: 'Equilíbrio: alcance local e base nos bairros.' },
  { id: 'x', label: 'X (Twitter)', growth: 0.7, risk: 0.08, voteConversion: 0.6, perk: 'Fala com jornalistas e lideranças: mais cobertura na imprensa e articulação.' },
  { id: 'youtube', label: 'YouTube', growth: 0.55, risk: 0.03, voteConversion: 1.2, perk: 'Cresce devagar, mas conteúdo longo gera confiança (popularidade).' },
  { id: 'tiktok', label: 'TikTok', growth: 1.6, risk: 0.09, voteConversion: 0.55, perk: 'Cresce rápido entre jovens; converte menos em voto e polemiza mais.' },
];

export const LEVELS = [0, 1_000, 5_000, 20_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 3_000_000, 10_000_000];

export function levelOf(followers: number): { level: number; progress: number; next: number | null } {
  let level = 0;
  for (let i = 0; i < LEVELS.length; i++) if (followers >= LEVELS[i]) level = i;
  const nextT = LEVELS[level + 1] ?? null;
  const progress = nextT === null ? 1 : (followers - LEVELS[level]) / (nextT - LEVELS[level]);
  return { level: level + 1, progress, next: nextT };
}

export function initialSocial(profession: ProfessionId, rng: RngState): SocialState {
  const base = (lo: number, hi: number) => Math.round(lo + next(rng) * (hi - lo));
  if (profession === 'influenciador') {
    return {
      focus: 'instagram',
      networks: { instagram: base(900_000, 1_400_000), x: base(40_000, 120_000), youtube: base(400_000, 800_000), tiktok: base(700_000, 1_300_000) },
    };
  }
  const mult = profession === 'jornalista' ? 6 : profession === 'lider_comunitario' || profession === 'sindicalista' ? 2.5 : 1;
  return {
    focus: 'instagram',
    networks: { instagram: Math.round(base(400, 1_800) * mult), x: Math.round(base(80, 600) * mult * (profession === 'jornalista' ? 3 : 1)), youtube: base(0, 150), tiktok: base(0, 400) },
  };
}

/** Crescimento mensal: a rede em foco cresce bem; as demais crescem pouco ou perdem seguidores. */
export function monthlySocialGrowth(s: GameState, rng: RngState): string | null {
  const a = s.character.attributes;
  const skill = (a.communication * 0.6 + a.charisma * 0.4) / 50; // ~1 para atributos médios
  const fame = 1 + s.player.recognition / 60;
  let note: string | null = null;
  for (const n of NETWORKS) {
    const f = s.player.social.networks[n.id];
    if (n.id === s.player.social.focus) {
      const organic = (300 + f * 0.008 * (1 - Math.min(0.95, f / 12_000_000))) * n.growth * skill * fame * Math.max(0.4, 1 + normal(rng, 0, 0.25));
      s.player.social.networks[n.id] = Math.round(f + organic);
    } else {
      s.player.social.networks[n.id] = Math.max(0, Math.round(f * (1 + normal(rng, 0.002, 0.004))));
    }
  }
  return note;
}

/** Produção de conteúdo concentrada na rede em foco (ação de agenda). */
export function produceContent(s: GameState, rng: RngState): { gained: number; polemic: boolean; network: NetworkId } {
  const net = NETWORKS.find((n) => n.id === s.player.social.focus)!;
  const a = s.character.attributes;
  const influencer = s.character.profession === 'influenciador';
  const f = s.player.social.networks[net.id];
  const polemic = next(rng) < Math.max(0.01, net.risk * (influencer ? 0.6 : 1) - a.communication / 1500);
  const skill = (a.communication * 0.7 + a.charisma * 0.3) / 50;
  const gained = Math.round((800 + f * 0.012 * (1 - Math.min(0.95, f / 12_000_000))) * net.growth * skill * (influencer ? 1.4 : 1) * Math.max(0.3, 1 + normal(rng, 0, 0.35)) * (polemic ? 0.5 : 1));
  s.player.social.networks[net.id] = f + gained;
  return { gained, polemic, network: net.id };
}

export function totalFollowers(social: SocialState): number {
  return Object.values(social.networks).reduce((x, y) => x + y, 0);
}

/** Alcance digital convertido em pontos eleitorais (0..12). Só uma parte dos seguidores vota em SP. */
export function digitalScore(social: SocialState): number {
  let eff = 0;
  for (const n of NETWORKS) eff += social.networks[n.id] * n.voteConversion;
  return Math.max(0, Math.min(12, (Math.log10(1 + eff) - 3) * 3.4));
}

export function setSocialFocus(state: GameState, focus: NetworkId): GameState {
  if (state.player.social.focus === focus) return state;
  const s: GameState = structuredClone(state);
  s.player.social.focus = focus;
  return s;
}
