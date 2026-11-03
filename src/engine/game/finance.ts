// Finanças pessoais do personagem. Separadas das contas do partido e da campanha.
import { GAMEPLAY } from '../data/rulepack';
import type { GameState } from './types';

export function recomputeNetWorth(s: GameState): void {
  const f = s.finances;
  f.netWorth = Math.round(f.cash + f.assets - f.debts);
}

/** Fechamento mensal: renda, despesas, rendimento dos bens, juros e amortização de dívida. Devolve mensagens relevantes. */
export function closePersonalMonth(s: GameState): string[] {
  const f = s.finances;
  const notes: string[] = [];
  f.cash += f.monthlyIncome - f.monthlyExpenses;
  f.assets = Math.round(f.assets * (1 + GAMEPLAY.assetMonthlyReturn.value));
  if (f.debts > 0) {
    const interest = Math.round(f.debts * GAMEPLAY.debtMonthlyInterest.value);
    f.debts += interest;
    const reserve = f.monthlyExpenses * GAMEPLAY.cashReserveMonths.value;
    const pay = Math.max(0, Math.min(f.debts, f.cash - reserve));
    if (pay > 0) {
      f.cash -= pay;
      f.debts -= pay;
      notes.push(f.debts === 0 ? 'Você quitou suas dívidas pessoais.' : `Você amortizou R$ ${pay.toLocaleString('pt-BR')} da dívida.`);
    }
  }
  if (f.cash < 0) {
    f.debts += -f.cash;
    f.cash = 0;
    notes.push('Seu caixa pessoal ficou negativo e virou dívida (juros de 2% ao mês, parâmetro de jogo).');
  }
  f.cash = Math.round(f.cash);
  recomputeNetWorth(s);
  return notes;
}
