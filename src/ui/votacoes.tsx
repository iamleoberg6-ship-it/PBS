import { authorLabel, forecast, monthLabel, partyById, partyOrientation, type GameState, type VoteChoice } from '../engine';

const LABEL: Record<VoteChoice, string> = { S: 'Sim', N: 'Não', A: 'Abster' };
const pubText = (x: number) => (x > 0.35 ? 'a maioria apoia' : x > 0.1 ? 'apoio leve' : x < -0.35 ? 'a maioria rejeita' : x < -0.1 ? 'rejeição leve' : 'opinião dividida');
const govText = (p: string) => (p === 'favor' ? 'governo quer aprovar' : p === 'contra' ? 'governo quer derrubar' : 'governo neutro');

type Props = { s: GameState; voteBill: (id: string, c: VoteChoice | null) => void; voteFloor: (id: string, c: VoteChoice | null) => void; compact?: boolean };

/** Votações do mês: não custam agenda. Quem não vota segue a orientação da bancada. */
export function Votacoes({ s, voteBill, voteFloor, compact }: Props) {
  const m = s.player.mandate;
  if (!m) return null;
  const party = s.player.partyId ? partyById(s.player.partyId)?.acronym : 'sem partido';
  const Buttons = ({ current, onVote }: { current: VoteChoice | null | undefined; onVote: (c: VoteChoice) => void }) => (
    <div className="pill-row" style={{ marginTop: 6 }}>
      {(['S', 'N', 'A'] as VoteChoice[]).map((c) => (
        <button key={c} className={`btn btn-sm ${current === c ? 'btn-primary' : ''}`} onClick={() => onVote(c)}>{LABEL[c]}</button>
      ))}
    </div>
  );
  if (m.office === 'vereador') {
    const bills = s.legislature.bills.filter((b) => b.stage === 'plenario' && b.scheduled);
    const hist = [...s.legislature.voteHistory].reverse().slice(0, compact ? 3 : 6);
    return (
      <div className="card" style={{ marginBottom: 16, borderLeft: '5px solid var(--gold)' }}>
        <div className="card-title"><h3>Votações do mês — Câmara Municipal</h3><span className="small muted">não gastam agenda · voto conta no fechamento do mês</span></div>
        {bills.length === 0 && <p className="small muted">Nada pautado neste mês.</p>}
        {bills.map((b) => {
          const orient = partyOrientation(s, s.player.partyId, b);
          const f = forecast(s, b);
          return (
            <div key={b.id} style={{ marginBottom: 12 }}>
              <b>{b.number} — {b.title}</b>
              <div className="small">Autor: {authorLabel(s, b)} · {govText(b.executivePosition)} · opinião pública: {pubText(b.publicSupport)} · orientação do {party}: <b>{LABEL[orient]}</b> · previsão: {f.yes} sim × {f.no} não (precisa de 28 para aprovar)</div>
              <Buttons current={s.legislature.playerVotes[b.id]} onVote={(c) => voteBill(b.id, c)} />
            </div>
          );
        })}
        {hist.length > 0 && <div className="small muted" style={{ marginTop: 6 }}>Últimas: {hist.map((h) => `${h.title.split(' — ')[0]} ${h.outcome}${h.player ? ` (você: ${LABEL[h.player as VoteChoice]})` : ''}`).join(' · ')}</div>}
      </div>
    );
  }
  const open = s.floorVotes.filter((v) => !v.result);
  const done = s.floorVotes.filter((v) => v.result).slice(compact ? -3 : -6).reverse();
  if (!open.length && !done.length) return null;
  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: '5px solid var(--gold)' }}>
      <div className="card-title"><h3>Votações do mês — plenário</h3><span className="small muted">não gastam agenda · sem voto, você segue a bancada</span></div>
      {open.map((v) => (
        <div key={v.id} style={{ marginBottom: 12 }}>
          <b>{v.title}</b>{v.pec && <span className="tag derivada" style={{ marginLeft: 6 }}>PEC · 3/5</span>}
          <div className="small">{v.summary}</div>
          <div className="small">Autoria: {v.author === 'governo' ? 'Executivo' : 'parlamentares'} · {govText(v.govPosition)} · opinião pública: {pubText(v.publicSupport)} · orientação do {party}: <b>{LABEL[v.partyOrientation]}</b> · repercussão {Math.round(v.salience)}/100</div>
          <Buttons current={v.playerVote} onVote={(c) => voteFloor(v.id, c)} />
        </div>
      ))}
      {done.length > 0 && (
        <div className="small" style={{ marginTop: 6 }}>
          <b>Resultados recentes</b>
          {done.map((v) => <div key={v.id} className="muted">{monthLabel(v.month)}: {v.title} — {v.result!.outcome} ({v.result!.yes}×{v.result!.no}); você: {v.playerVote ? LABEL[v.playerVote] : '—'}; {v.effects}</div>)}
        </div>
      )}
      <p className="small muted" style={{ marginTop: 6 }}>Matérias fictícias e placares simulados. Votar contra o partido derruba lealdade e confiança da direção; contra o governo, a relação com ele; contra a opinião pública, a aprovação; contra a sua linha ideológica, a base.</p>
    </div>
  );
}
