import { useState } from 'react';
import { loadSave, type GameState } from '../engine';

export function Start({ hasSave, onNew, onContinue, onImport }: { hasSave: boolean; onNew: () => void; onContinue: () => void; onImport: (s: GameState) => void }) {
  const [importing, setImporting] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [pending, setPending] = useState<{ state: GameState; repairs: string[]; from: number | null } | null>(null);
  return (
    <div className="start">
      <div className="start-inner">
        <div className="start-kicker">Protótipo jogável · v0.1</div>
        <h1>Political<br />Brazilian<br />Simulator</h1>
        <div className="stripe" />
        <p className="lede" style={{ marginTop: 18 }}>Brasil. Sua carreira. Seu poder. Comece como cidadão comum em São Paulo, construa base, filie-se a um partido real e dispute as eleições municipais de 2028, com as regras eleitorais de verdade.</p>
        <div className="start-actions">
          <button className="btn btn-gold" onClick={onNew}>Nova carreira</button>
          {hasSave && <button className="btn" onClick={onContinue}>Continuar partida salva</button>}
          <button className="btn" onClick={() => setImporting(true)}>Importar save</button>
        </div>
        <div className="start-foot">
          Partidos e federações reais conforme o TSE em 30/10/2026. Figuras públicas aparecem só com dados de registro público. Candidatos e eventos gerados pelo jogo são fictícios.
        </div>
      </div>
      {importing && (
        <div className="overlay" onClick={() => setImporting(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--ink)' }}>
            <h2>Importar save</h2>
            <p>Cole o texto exportado de uma partida.</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} />
            {err && <p style={{ color: 'var(--red)' }}>{err}</p>}
            {pending && (
              <div className="callout" style={{ marginTop: 10 }}>
                {pending.from !== null && <p style={{ margin: '0 0 6px' }}>Save da versão {pending.from} atualizado para a versão atual.</p>}
                {pending.repairs.length > 0 && <><b>Ajustes feitos para manter a partida íntegra:</b><ul style={{ margin: '6px 0' }}>{pending.repairs.map((r, i) => <li key={i}>{r}</li>)}</ul></>}
                <button className="btn btn-primary btn-sm" onClick={() => onImport(pending.state)}>Continuar com a partida</button>
              </div>
            )}
            <div className="modal-options" style={{ flexDirection: 'row' }}>
              <button className="btn btn-primary" onClick={() => {
                try {
                  const { state, report } = loadSave(text);
                  if (report.repairs.length || report.migratedFrom !== null) setPending({ state, repairs: report.repairs, from: report.migratedFrom });
                  else onImport(state);
                } catch (e) { setErr((e as Error).message || 'Texto inválido.'); }
              }}>Carregar</button>
              <button className="btn" onClick={() => setImporting(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
