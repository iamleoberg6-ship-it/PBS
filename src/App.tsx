import { Component, useState, type ReactNode } from 'react';
import { loadLocal, type GameState } from './engine';
import { Start } from './ui/Start';
import { Creation } from './ui/Creation';
import { Game } from './ui/Game';

type Screen = { id: 'start' } | { id: 'create' } | { id: 'game'; state: GameState };

/** Qualquer erro fora das páginas cai aqui: o save continua guardado e dá para voltar ao menu. */
class AppBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="start"><div className="start-inner">
        <h1 style={{ fontSize: 32 }}>Algo deu errado</h1>
        <p className="lede">Sua partida continua salva neste navegador. Volte ao menu e tente "Continuar partida salva". Se o erro se repetir, use "Copiar save" no menu e mande o texto para correção.</p>
        <p className="small mono">{this.state.error}</p>
        <button className="btn btn-gold" onClick={() => { this.setState({ error: null }); this.props.onReset(); }}>Voltar ao menu</button>
      </div></div>
    );
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ id: 'start' });
  return <AppBoundary onReset={() => setScreen({ id: 'start' })}><AppInner screen={screen} setScreen={setScreen} /></AppBoundary>;
}

function AppInner({ screen, setScreen }: { screen: Screen; setScreen: (s: Screen) => void }) {
  const saved = screen.id === 'start' ? loadLocal() : null;
  if (screen.id === 'create') return <Creation onBack={() => setScreen({ id: 'start' })} onStart={(state) => setScreen({ id: 'game', state })} />;
  if (screen.id === 'game') return <Game key={screen.state.createdAt} initial={screen.state} onExit={() => setScreen({ id: 'start' })} />;
  return (
    <Start
      hasSave={!!saved}
      onNew={() => setScreen({ id: 'create' })}
      onContinue={() => { const st = loadLocal(); if (st) setScreen({ id: 'game', state: st }); }}
      onImport={(state) => setScreen({ id: 'game', state })}
    />
  );
}
