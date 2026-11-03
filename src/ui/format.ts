import { allListIds, listIdForParty } from '../engine';

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const num = (n: number) => Math.round(n).toLocaleString('pt-BR');
export const pct = (n: number, d = 1) => `${(n * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`;

// Cores neutras e estáveis por agremiação (não reproduzem identidade visual dos partidos).
const PALETTE = ['#2b5c8a', '#1f7a5a', '#c8962e', '#8a5bb0', '#b4432f', '#2e8a8a', '#6b7785', '#a0527a', '#4f7d2b', '#d07a2c', '#3b4a9a', '#7a6a3a', '#5a8fb8', '#9a3f5a', '#3f8f6a', '#b8a03a', '#6a4a8a', '#4a6a5a'];
const ids = allListIds();
export function listColor(listId: string): string {
  const i = ids.indexOf(listId);
  return PALETTE[(i >= 0 ? i : 0) % PALETTE.length];
}
export function partyColor(partyId: string): string {
  return listColor(listIdForParty(partyId));
}
