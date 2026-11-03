import { dismissTip, pendingTip, setTutorial, type GameState } from '../engine';

/** Card do guia: mostra uma dica por vez, no topo da página atual. */
export function GuideCard({ s, setS, go }: { s: GameState; setS: (n: GameState) => void; go: (page: string) => void }) {
  const tip = pendingTip(s);
  if (!tip) return null;
  return (
    <div className="guide-card" role="note" aria-label="Guia do jogador">
      <div className="guide-kicker">Guia</div>
      <h3>{tip.title}</h3>
      <p>{tip.body}</p>
      <div className="pill-row">
        <button className="btn btn-sm btn-primary" onClick={() => setS(dismissTip(s, tip.id))}>Entendi</button>
        {tip.page && <button className="btn btn-sm" onClick={() => { setS(dismissTip(s, tip.id)); go(tip.page!); }}>{tip.pageLabel ?? 'Abrir'} →</button>}
        <button className="btn btn-sm btn-ghost" onClick={() => setS(setTutorial(s, false))}>Desligar o guia</button>
      </div>
    </div>
  );
}
