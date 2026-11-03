import { causesFor, labelOf, monthLabel, type GameState } from '../engine';

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
