import { useState } from 'react';
import { causesFor, labelOf, monthLabel, type GameState } from '../engine';
import { brl } from './format';

export function CausesModal({ s, indicator, onClose }: { s: GameState; indicator: string; onClose: () => void }) {
  const items = [...causesFor(s, indicator, 3)].reverse();
  const total = items.filter((e) => e.month.year === s.month.year && e.month.month === s.month.month).reduce((a, e) => a + e.delta, 0);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="small mono muted">POR QUE MUDOU?</div>
        <h2>{labelOf(indicator)}</h2>
        <p className="small">Variações dos últimos 3 meses, com a causa de cada uma. Neste mês: <b>{total > 0 ? '+' : ''}{total.toFixed(1)}</b>.</p>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {items.length === 0 && <p className="muted">Sem variações registradas.</p>}
          {items.map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--paper-2)' }}>
              <span className="small"><span className="muted">{monthLabel(e.month)} · </span>{e.cause}</span>
              <b className="mono" style={{ color: e.delta >= 0 ? 'var(--accent)' : 'var(--red)' }}>{e.delta > 0 ? '+' : ''}{indicator === 'cash' || indicator === 'followers' ? Math.round(e.delta).toLocaleString('pt-BR') : e.delta.toFixed(1)}</b>
            </div>
          ))}
        </div>
        <div className="modal-options" style={{ flexDirection: 'row' }}><button className="btn" onClick={onClose}>Fechar</button></div>
      </div>
    </div>
  );
}

const fmt = (money: boolean, key: string, v: number) => (money ? brl(v) : key === 'followers' ? Math.round(v).toLocaleString('pt-BR') : v.toFixed(1));

/** Resumo do último mês: cada indicador que mudou, quanto e as principais causas. */
export function MonthReport({ s, onWhy }: { s: GameState; onWhy: (key: string) => void }) {
  const [open, setOpen] = useState(true);
  const r = s.monthReport;
  if (!r || !r.length) return null;
  return (
    <div className="card month-report" style={{ marginBottom: 16 }}>
      <div className="card-title">
        <h3>O que mudou no último mês</h3>
        <button className="btn btn-sm btn-ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Recolher' : 'Mostrar'}</button>
      </div>
      {open && (
        <ul className="report-list">
          {r.map((it) => (
            <li key={it.key}>
              <button className="report-head" onClick={() => onWhy(it.key)} title="Ver o histórico de causas">
                <span>{it.label}</span>
                <b className="mono" style={{ color: it.total >= 0 ? 'var(--accent)' : 'var(--red)' }}>{it.total > 0 ? '+' : ''}{fmt(it.money, it.key, it.total)}</b>
              </button>
              <span className="small muted">{it.causes.map((c) => `${c.cause} (${c.delta > 0 ? '+' : ''}${fmt(it.money, it.key, c.delta)})`).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
