import { useEffect, useState } from 'react';
import { isDesktop, listSaveFiles, readSaveFile, savesFolder, type SaveFileInfo } from './desktop';
import { backupText, listBackups, loadSave, localSaveStatus, type GameState } from '../engine';

export function Start({ hasSave, onNew, onContinue, onImport }: { hasSave: boolean; onNew: () => void; onContinue: () => void; onImport: (s: GameState) => void }) {
  const [importing, setImporting] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [pending, setPending] = useState<{ state: GameState; repairs: string[]; from: number | null } | null>(null);
  const status = localSaveStatus();
  const backups = listBackups();
  const [copied, setCopied] = useState('');
  const [files, setFiles] = useState<SaveFileInfo[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  useEffect(() => { if (isDesktop) { listSaveFiles().then(setFiles); savesFolder().then(setFolder); } }, []);
  const openFile = (f: File) => {
    f.text().then((t) => { setText(t); setErr(''); setImporting(true); try { const { state, report } = loadSave(t); if (report.repairs.length || report.migratedFrom !== null) setPending({ state, repairs: report.repairs, from: report.migratedFrom }); else onImport(state); } catch (e) { setErr((e as Error).message || 'Arquivo inválido.'); } });
  };
  const restore = (text: string) => {
    try {
      const { state } = loadSave(text);
      onImport(state);
    } catch (e) { setErr((e as Error).message); setImporting(true); }
  };
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
          <label className="btn" style={{ cursor: 'pointer' }}>Abrir arquivo de save
            <input type="file" accept=".json,application/json,text/plain" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) openFile(f); e.currentTarget.value = ''; }} />
          </label>
          <button className="btn" onClick={() => setImporting(true)}>Colar save</button>
        </div>
        {status.exists && status.error && (
          <div className="callout" style={{ marginTop: 16, color: 'var(--ink)' }}>
            <b>Há uma partida salva, mas ela não carregou nesta versão.</b> Ela NÃO foi apagada. Erro: <span className="mono small">{status.error}</span>
            <div style={{ marginTop: 8 }}><button className="btn btn-sm" onClick={() => { navigator.clipboard?.writeText(status.raw ?? '').then(() => setCopied('Save copiado: mande para correção.'), () => setCopied('Não deu para copiar automaticamente.')); }}>Copiar save</button> <span className="small">{copied}</span></div>
            <p className="small" style={{ marginTop: 6 }}>Atenção: "Nova carreira" guarda esta partida nas cópias de segurança abaixo antes de começar outra.</p>
          </div>
        )}
        {isDesktop && files.length > 0 && (
          <div className="callout" style={{ marginTop: 16, color: 'var(--ink)' }}>
            <b>Partidas salvas em arquivo</b>{folder && <span className="small"> — pasta {folder}</span>}
            {files.slice(0, 8).map((f) => (
              <div key={f.name} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                <span className="small">{f.name === 'autosave' ? 'Salvamento automático (último mês jogado)' : f.name} · {new Date(f.modified * 1000).toLocaleString('pt-BR')}</span>
                <button className="btn btn-sm" onClick={() => { readSaveFile(f.name).then((t) => { if (t) restore(t); }); }}>Carregar</button>
              </div>
            ))}
          </div>
        )}
        {backups.length > 0 && (
          <div className="callout" style={{ marginTop: 16, color: 'var(--ink)' }}>
            <b>Cópias de segurança</b> (partidas substituídas por outra neste navegador):
            {backups.map((b) => (
              <div key={b.key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                <span className="small">{b.name} · {b.month} · guardada em {new Date(b.savedAt).toLocaleString('pt-BR')}</span>
                <button className="btn btn-sm" onClick={() => { const t = backupText(b.key); if (t) restore(t); }}>Restaurar</button>
                <button className="btn btn-sm" onClick={() => { const t = backupText(b.key); if (t) navigator.clipboard?.writeText(t).then(() => setCopied('Cópia copiada.')); }}>Copiar</button>
              </div>
            ))}
          </div>
        )}
        <div className="start-foot">
          Partidos e federações reais conforme o TSE em 30/10/2026. Figuras públicas aparecem só com dados de registro público. Candidatos e eventos gerados pelo jogo são fictícios.
        </div>
      </div>
      {importing && (
        <div className="overlay" onClick={() => setImporting(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--ink)' }}>
            <h2>Importar save</h2>
            <p>Cole o texto exportado de uma partida (ou use "Abrir arquivo de save" no menu).</p>
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
