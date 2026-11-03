import { useState } from 'react';
import { loadLocal, type GameState } from './engine';
import { Start } from './ui/Start';
import { Creation } from './ui/Creation';
import { Game } from './ui/Game';

type Screen = { id: 'start' } | { id: 'create' } | { id: 'game'; state: GameState };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ id: 'start' });
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
