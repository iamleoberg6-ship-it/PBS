import { useEffect, useState } from 'react';
import {
  GAMEPLAY, advanceMonth, setPlayerVote, openDraft, adjustDraft, changeParty, setSocialFocus, currentPhaseLabel, eventById, monthLabel, performAction, resolveEvent, saveLocal, serialize,
  type GameState,
} from '../engine';
import { brl } from './format';
import { Cidade, Eleicoes, Gabinete, Historico, Partidos, Personagem, Regras } from './pages';
import { Noticias, Redes } from './media';
import { MeuPartido } from './party';
import { Camara } from './camara';
import { Secretaria } from './secretaria';
import { Governo } from './governo';

const PAGES = [
  ['gabinete', 'Gabinete'],
  ['personagem', 'Personagem'],
  ['meupartido', 'Meu partido'],
  ['partidos', 'Partidos'],
  ['redes', 'Redes sociais'],
  ['noticias', 'Notícias'],
  ['eleicoes', 'Eleições 2028'],
  ['governo', 'Prefeitura'],
  ['camara', 'Câmara Municipal'],
  ['secretaria', 'Minha secretaria'],
  ['cidade', 'Vereadores e cidade'],
  ['historico', 'Histórico'],
  ['regras', 'Regras'],
] as const;
type PageId = (typeof PAGES)[number][0];

export function Game({ initial, onExit }: { initial: GameState; onExit: () => void }) {
  const [s, setS] = useState<GameState>(initial);
  const [page, setPage] = useState<PageId>('gabinete');
  const [toast, setToast] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => { saveLocal(s); }, [s]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t); }, [toast]);

  const act = (id: string, param?: string) => {
    const next = performAction(s, id, param);
    if (next !== s) {
      setS(next);
      setToast(next.log[next.log.length - 1]?.text ?? '');
    }
  };
  const advance = () => {
    const before = s.log.length;
    const next = advanceMonth(s);
    setS(next);
    const fresh = next.log.slice(before).filter((l) => l.kind === 'eleicao' || l.kind === 'mandato');
    if (fresh.some((l) => l.kind === 'eleicao') && next.elections.length > s.elections.length) setPage('eleicoes');
    setToast(fresh[fresh.length - 1]?.text ?? `Avançou para ${monthLabel(next.month)}.`);
  };

  const ev = s.pendingEvents[0];
  const tpl = ev ? eventById(ev.templateId) : undefined;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">PBS<span>.</span></div>
        <div>
          <div className="top-date">{monthLabel(s.month)}</div>
          <div className="top-phase">{currentPhaseLabel(s)}</div>
        </div>
        <div className="top-spacer" />
        <div className="ap" title="Compromissos livres na agenda deste mês">
          {Array.from({ length: GAMEPLAY.actionPointsPerMonth.value }, (_, i) => <span key={i} className={`ap-dot ${i < s.actionPoints ? 'on' : ''}`} />)}
        </div>
        <div className="top-stat"><b>{brl(s.finances.cash)}</b><small>caixa pessoal</small></div>
        <button className="btn btn-gold" onClick={advance} disabled={s.gameOver || !!ev}>
          {s.gameOver ? 'Fim do protótipo' : ev ? 'Responda o evento' : 'Avançar mês →'}
        </button>
      </header>
      <nav className="sidebar">
        {PAGES.filter(([id]) => id !== 'secretaria' || !!s.player.mandate?.secretariat).map(([id, label]) => (
          <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>{label}</button>
        ))}
        <div className="nav-sep" />
        <button className="nav-item" onClick={() => setExporting(true)}>Exportar save</button>
        <button className="nav-item" onClick={onExit}>Menu inicial</button>
        <div className="side-foot">Salvo automaticamente neste navegador.</div>
      </nav>
      <main className="main">
        {page === 'gabinete' && <Gabinete s={s} act={act} />}
        {page === 'personagem' && <Personagem s={s} />}
        {page === 'meupartido' && <MeuPartido s={s} />}
        {page === 'partidos' && <Partidos s={s} changeParty={(id) => { const n = changeParty(s, id); setS(n); setToast(n.log[n.log.length - 1]?.text ?? ''); }} />}
        {page === 'redes' && <Redes s={s} setFocus={(n) => setS(setSocialFocus(s, n))} />}
        {page === 'noticias' && <Noticias s={s} />}
        {page === 'eleicoes' && <Eleicoes s={s} />}
        {page === 'governo' && <Governo s={s} openDraft={() => setS(openDraft(s))} adjust={(k, p) => setS(adjustDraft(s, k, p))} />}
        {page === 'camara' && <Camara s={s} vote={(id, c) => setS(setPlayerVote(s, id, c))} />}
        {page === 'secretaria' && <Secretaria s={s} />}
        {page === 'cidade' && <Cidade s={s} />}
        {page === 'historico' && <Historico s={s} />}
        {page === 'regras' && <Regras s={s} />}
      </main>

      {ev && tpl && (
        <div className="overlay">
          <div className="modal" role="dialog" aria-modal="true">
            <div className="small mono muted">ACONTECIMENTO · {monthLabel(s.month).toUpperCase()}</div>
            <h2>{tpl.title(s, ev.vars)}</h2>
            <p>{tpl.body(s, ev.vars)}</p>
            <div className="modal-options">
              {tpl.options(s, ev.vars).map((o, i) => (
                <button key={i} className="btn" onClick={() => { const n = resolveEvent(s, i); setS(n); setToast(n.log[n.log.length - 1]?.text ?? ''); }}>
                  <span>{o.label}</span>{o.hint && <small>{o.hint}</small>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {exporting && (
        <div className="overlay" onClick={() => setExporting(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Exportar save</h2>
            <p>Copie e guarde este texto para continuar em outro navegador ou computador.</p>
            <textarea readOnly value={serialize(s)} onFocus={(e) => e.currentTarget.select()} />
            <div className="modal-options" style={{ flexDirection: 'row' }}>
              <button className="btn btn-primary" onClick={() => { navigator.clipboard?.writeText(serialize(s)).then(() => setToast('Save copiado.'), () => setToast('Não deu para copiar automaticamente: selecione o texto e copie.')); }}>Copiar</button>
              <button className="btn" onClick={() => setExporting(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
