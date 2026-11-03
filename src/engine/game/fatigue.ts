// Desgaste por repetição (Plano de Evolução §12.2): repetir a mesma ação rende cada vez menos.
// PROPOSTA de gameplay:
//  - no mesmo mês: 1ª vez 100%, 2ª vez 60%, 3ª vez 35%;
//  - em meses seguidos: os dois primeiros meses rendem cheio; depois cai 12% por mês, até o piso de 55%;
//  - pular um mês zera a sequência.
// Só os GANHOS são reduzidos (custos e perdas continuam inteiros).
// Não se aplica ao trabalho de cargo (assessoria, mandatos, prefeitura, secretarias, governo): ver WORK_CATEGORIES em actions.ts.

import { monthIndex } from '../calendar';
import { TRACKED } from './ledger';
import type { GameState } from './types';

const SAME_MONTH = [1, 0.6, 0.35];

export function fatigueMultiplier(s: GameState, actionId: string): { mult: number; reason: string | null } {
  const u = s.player.actionUse[actionId];
  if (!u) return { mult: 1, reason: null };
  const now = monthIndex(s.month);
  const thisMonth = u.lastMonth === now ? u.thisMonth : 0;
  const streakIfUsed = u.lastMonth === now ? u.streak : u.lastMonth === now - 1 ? u.streak + 1 : 1;
  const monthF = SAME_MONTH[Math.min(thisMonth, SAME_MONTH.length - 1)];
  const streakF = Math.max(0.55, 1 - 0.12 * Math.max(0, streakIfUsed - 2));
  const mult = Math.round(monthF * streakF * 100) / 100;
  if (mult >= 1) return { mult: 1, reason: null };
  const parts = [];
  if (monthF < 1) parts.push(`já feita ${thisMonth}× este mês`);
  if (streakF < 1) parts.push(`${streakIfUsed} meses seguidos`);
  return { mult, reason: parts.join(' e ') };
}

export function registerUse(s: GameState, actionId: string): void {
  const now = monthIndex(s.month);
  const u = s.player.actionUse[actionId];
  if (!u) { s.player.actionUse[actionId] = { lastMonth: now, streak: 1, thisMonth: 1 }; return; }
  if (u.lastMonth === now) { u.thisMonth += 1; return; }
  u.streak = u.lastMonth === now - 1 ? u.streak + 1 : 1;
  u.lastMonth = now;
  u.thisMonth = 1;
}

/** Reduz os ganhos entre o estado anterior (`prev`, intocado) e o atual (`s`) pelo multiplicador. */
export function dampenGains(s: GameState, prev: GameState, mult: number): void {
  if (mult >= 1) return;
  for (const t of TRACKED) {
    if (t.key === 'followers') continue;
    const d = t.get(s) - t.get(prev);
    if (d > 0) t.set(s, t.get(prev) + d * mult);
  }
  for (const k of Object.keys(s.player.social.networks) as (keyof typeof s.player.social.networks)[]) {
    const d = s.player.social.networks[k] - prev.player.social.networks[k];
    if (d > 0) s.player.social.networks[k] = Math.round(prev.player.social.networks[k] + d * mult);
  }
  const a = s.player.candidacy?.account;
  const b = prev.player.candidacy?.account;
  if (a && b && a.donations > b.donations) a.donations = Math.round(b.donations + (a.donations - b.donations) * mult);
}
