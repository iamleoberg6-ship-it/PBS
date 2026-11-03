// Divide um total inteiro proporcionalmente a pesos, pelo método dos maiores restos,
// garantindo que a soma das partes seja exatamente o total (sem perda ou ganho por arredondamento).
export function apportion(total: number, weights: number[]): number[] {
  const t = Math.max(0, Math.round(total));
  const wsum = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (weights.length === 0) return [];
  if (wsum <= 0) {
    const out = weights.map(() => 0);
    out[0] = t;
    return out;
  }
  const raw = weights.map((w) => (Math.max(0, w) / wsum) * t);
  const out = raw.map(Math.floor);
  let rest = t - out.reduce((s, v) => s + v, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k].i]++;
  return out;
}
