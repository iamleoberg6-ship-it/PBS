// Datas do jogo. O turno é mensal: o estado guarda {year, month} (month 1..12).

export interface GameMonth {
  year: number;
  month: number;
}

export const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function monthLabel(m: GameMonth): string {
  const name = MONTHS_PT[m.month - 1];
  return `${name[0].toUpperCase()}${name.slice(1)} de ${m.year}`;
}

export function addMonths(m: GameMonth, n: number): GameMonth {
  const idx = m.year * 12 + (m.month - 1) + n;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function monthIndex(m: GameMonth): number {
  return m.year * 12 + (m.month - 1);
}

export function sameMonth(a: GameMonth, b: GameMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

/** ISO 'YYYY-MM-DD' -> GameMonth */
export function isoToMonth(iso: string): GameMonth {
  const [y, mo] = iso.split('-').map(Number);
  return { year: y, month: mo };
}

/** Primeiro domingo de um mês (UTC). */
export function firstSunday(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month - 1, 1));
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Último domingo de um mês (UTC). */
export function lastSunday(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function addMonthsIso(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

/** Idade completa em anos numa data ISO. */
export function ageAt(birthIso: string, atIso: string): number {
  const [by, bm, bd] = birthIso.split('-').map(Number);
  const [ay, am, ad] = atIso.split('-').map(Number);
  let age = ay - by;
  if (am < bm || (am === bm && ad < bd)) age--;
  return age;
}

export function formatIsoPt(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/** Converte um mês de jogo numa data ISO (dia 1), para comparações com prazos. */
export function monthToIso(m: GameMonth, day = 1): string {
  return `${m.year}-${String(m.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
