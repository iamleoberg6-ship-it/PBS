/**
 * Fase 13 — Cenas em tela cheia e a noite da apuração.
 * Arte em pixel desenhada em código (SVG com shape-rendering crispEdges), sons gerados por WebAudio.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { apuracaoData, partyById, type ApuracaoRef, type GameState, type Scene, type SceneTone } from '../engine';
import { REGIONS } from '../engine/data/regions';
import { partyColor } from './format';

// ---------------------------------------------------------------------------------------------
// Som (opcional, desligável)
// ---------------------------------------------------------------------------------------------
const SOUND_KEY = 'pbs_som';
export function soundOn(): boolean { try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch { return true; } }
export function setSoundOn(v: boolean) { try { localStorage.setItem(SOUND_KEY, v ? '1' : '0'); } catch { /* sem armazenamento */ } }
let ctx: AudioContext | null = null;
function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.05) {
  if (!soundOn()) return;
  try {
    ctx = ctx ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    const t0 = ctx.currentTime + start;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  } catch { /* navegador sem áudio */ }
}
export const sfx = {
  tick: () => tone(1400, 0, 0.03, 'square', 0.015),
  vitoria: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.11, i === 5 ? 0.5 : 0.12)),
  derrota: () => [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.22, 0.3, 'triangle', 0.06)),
  tenso: () => [440, 466, 440, 466].forEach((f, i) => tone(f, i * 0.16, 0.14, 'sawtooth', 0.025)),
  alegre: () => [659, 784, 988].forEach((f, i) => tone(f, i * 0.09, 0.14)),
  neutro: () => [523, 659].forEach((f, i) => tone(f, i * 0.12, 0.16, 'triangle', 0.05)),
};

// ---------------------------------------------------------------------------------------------
// Pixel art
// ---------------------------------------------------------------------------------------------
type Pal = Record<string, string>;
function Sprite({ rows, pal, x, y, k = 1, cls }: { rows: string[]; pal: Pal; x: number; y: number; k?: number; cls?: string }) {
  const rects: ReactNode[] = [];
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) rects.push(<rect key={`${i}-${j}`} x={x + i * k} y={y + j * k} width={k} height={k} fill={c} />); } });
  return <g className={cls}>{rects}</g>;
}
const PERSON = ['..HHH..', '.HSSSH.', '..SSS..', '...S...', '.CCCCC.', 'CCCWCCC', 'S.CCC.S', '..CCC..', '..P.P..', '..P.P..', '.BB.BB.'];
const PERSON_F = ['..HHH..', '.HSSSH.', 'HHSSSHH', 'H..S..H', '.CCCCC.', 'CCCWCCC', 'S.CCC.S', '.CCCCC.', '..P.P..', '..P.P..', '.BB.BB.'];
const BABY = ['..SSS..', '.SSSSS.', '.SSSSS.', '..SSS..', '.WWWWW.', 'WWWWWWW', '.WWWWW.'];
const HEART = ['.R.R.', 'RRRRR', 'RRRRR', '.RRR.', '..R..'];
const URNA = ['GGGGGGGGGGGGGG', 'GDDDDDDGKKKKKG', 'GDLLLLDGKwKwKG', 'GDLLLLDGKKKKKG', 'GDLLLLDGKwKwKG', 'GDDDDDDGKKKKKG', 'GGGGGGGGKgggKG', 'GGGGGGGGGGGGGG', '.GG........GG.'];
const BOX = ['.OOOOOOOOO.', 'OoOOOOOOOoO', 'OOOOOOOOOOO', 'OOOTTTTTOOO', 'OOOOOOOOOOO', 'OOOOOOOOOOO', 'OOOOOOOOOOO'];
const PHONE = ['KKKKKKKK', 'KRRRRRRK', 'KRRWWRRK', 'KRRWWRRK', 'KRRWWRRK', 'KRRWWRRK', 'KRRRRRRK', 'KRRWWRRK', 'KRRRRRRK', 'KKKggKKK'];
const CAMERA = ['..KKK...', 'KKKKKKKK', 'KGGWWGGK', 'KGWLLWGK', 'KGWLLWGK', 'KGGWWGGK', 'KKKKKKKK'];

const SKY: Record<SceneTone, [string, string, string]> = {
  vitoria: ['#151a3a', '#2a2f6a', '#4a3f8a'],
  alegre: ['#ff9f6b', '#ffc98a', '#ffe7b0'],
  derrota: ['#1a2030', '#273246', '#36445c'],
  tenso: ['#2a0f18', '#4a1a26', '#6b2430'],
  neutro: ['#2b2c55', '#5a4a7a', '#b0708a'],
};
function Backdrop({ tone }: { tone: SceneTone }) {
  const [a, b, c] = SKY[tone];
  return <>
    <rect x={0} y={0} width={160} height={30} fill={a} /><rect x={0} y={30} width={160} height={20} fill={b} /><rect x={0} y={50} width={160} height={40} fill={c} />
    {(tone === 'vitoria' || tone === 'derrota' || tone === 'neutro') && [[12, 6], [40, 14], [70, 4], [104, 10], [131, 5], [150, 16], [25, 22], [88, 20]].map(([x, y], i) => <rect key={i} className="px-twinkle" style={{ animationDelay: `${i * 0.37}s` }} x={x} y={y} width={1} height={1} fill="#fff6e3" />)}
    {tone === 'alegre' && <><rect x={118} y={10} width={12} height={12} fill="#fff1a8" /><rect x={116} y={12} width={16} height={8} fill="#fff1a8" /></>}
  </>;
}
const ground = (fill = '#1b1f3b') => <rect x={0} y={78} width={160} height={12} fill={fill} />;
function Skyline({ fill = '#1b1f3b' }: { fill?: string }) {
  const b = [[0, 60, 10], [11, 52, 8], [20, 64, 14], [36, 48, 6], [43, 58, 12], [57, 66, 18], [118, 56, 10], [129, 62, 12], [142, 50, 7], [150, 60, 10]];
  return <>{b.map(([x, y, w], i) => <rect key={i} x={x} y={y} width={w} height={78 - y} fill={fill} />)}</>;
}
function Fireworks() {
  const bursts = [[30, 18, '#ffc61a'], [80, 10, '#2ce8f5'], [128, 20, '#ff6f9f'], [55, 26, '#10a04e']] as const;
  return <>{bursts.map(([x, y, c], i) => <g key={i} className="px-burst" style={{ animationDelay: `${i * 0.45}s`, transformOrigin: `${x}px ${y}px` }}>
    {[[-6, 0], [6, 0], [0, -6], [0, 6], [-4, -4], [4, 4], [-4, 4], [4, -4]].map(([dx, dy], j) => <rect key={j} x={x + dx} y={y + dy} width={1.5} height={1.5} fill={c} />)}
    <rect x={x - 0.5} y={y - 0.5} width={1.5} height={1.5} fill="#fff" />
  </g>)}</>;
}
function Rain() { return <>{Array.from({ length: 34 }, (_, i) => <rect key={i} className="px-rain" style={{ animationDelay: `${(i * 0.13) % 1.1}s` }} x={(i * 47) % 160} y={(i * 23) % 70} width={0.6} height={3} fill="#9fb3d9" opacity={0.6} />)}</>; }
function Flashes() { return <>{[[20, 30], [140, 26], [34, 58], [126, 60]].map(([x, y], i) => <circle key={i} className="px-flash" style={{ animationDelay: `${i * 0.31}s` }} cx={x} cy={y} r={7} fill="#fff" />)}</>; }

function Brasilia() {
  return <g>
    <rect x={60} y={40} width={8} height={30} fill="#d8dce8" /><rect x={70} y={40} width={8} height={30} fill="#d8dce8" /><rect x={68} y={52} width={2} height={2} fill="#d8dce8" />
    <rect x={30} y={70} width={100} height={8} fill="#e8ecf4" /><rect x={34} y={64} width={18} height={6} fill="#e8ecf4" /><rect x={36} y={62} width={14} height={2} fill="#e8ecf4" />
    <rect x={102} y={66} width={20} height={4} fill="#e8ecf4" /><rect x={105} y={62} width={14} height={4} fill="#e8ecf4" /><rect x={108} y={60} width={8} height={2} fill="#e8ecf4" />
    <rect x={90} y={44} width={1} height={26} fill="#8a8fa8" /><rect x={91} y={44} width={8} height={5} fill="#10a04e" /><rect x={93} y={45} width={4} height={3} fill="#ffc61a" /><rect x={94} y={46} width={2} height={1} fill="#2a78dc" />
  </g>;
}
function Palacio() {
  return <g>
    <rect x={40} y={48} width={80} height={30} fill="#efe6d2" /><rect x={36} y={44} width={88} height={5} fill="#d9cdb2" /><rect x={56} y={36} width={48} height={8} fill="#d9cdb2" />
    {Array.from({ length: 9 }, (_, i) => <rect key={i} x={44 + i * 9} y={50} width={3} height={28} fill="#cfc2a4" />)}
    <rect x={74} y={62} width={12} height={16} fill="#5a4030" />
    <rect x={79} y={20} width={1} height={16} fill="#8a8fa8" /><rect x={80} y={20} width={10} height={6} fill="#10a04e" /><rect x={82} y={21} width={6} height={4} fill="#ffc61a" /><rect x={84} y={22} width={2} height={2} fill="#2a78dc" />
  </g>;
}
function Predio({ cross }: { cross?: boolean }) {
  return <g>
    <rect x={58} y={26} width={44} height={52} fill="#c9cfdf" />
    {Array.from({ length: 6 }, (_, r) => Array.from({ length: 5 }, (_, c) => <rect key={`${r}${c}`} x={62 + c * 8} y={30 + r * 7} width={4} height={4} fill={(r * 5 + c) % 3 ? '#ffe7a0' : '#7f88a8'} />))}
    <rect x={74} y={68} width={12} height={10} fill="#3e4373" />
    {cross && <><rect x={77} y={14} width={6} height={10} fill="#e43b44" /><rect x={74} y={17} width={12} height={4} fill="#e43b44" /></>}
  </g>;
}
const ppl = (body: string, hair = '#3a2a1a', skin = '#f0c8a0'): Pal => ({ H: hair, S: skin, C: body, W: '#fff', P: '#2a2f4a', B: '#1b1f3b' });

function SceneArt({ sc, s }: { sc: Scene; s: GameState }) {
  const k = sc.kind;
  const ME = String(s.character.gender).toUpperCase().startsWith('F') ? PERSON_F : PERSON;
  let body: ReactNode = null;
  if (k === 'posse') {
    const o = sc.office ?? '';
    const big = ['deputado_federal', 'senador', 'presidente', 'vice_presidente', 'ministro'].includes(o) ? <Brasilia /> : ['governador'].includes(o) ? <Palacio /> : <Predio />;
    const sash = ['prefeito', 'governador', 'presidente'].includes(o);
    body = <>{big}<Sprite rows={ME} pal={{ ...ppl('#1b1f3b'), W: sash ? '#ffc61a' : '#fff' }} x={74} y={62} k={1.4} /><Sprite rows={PERSON} pal={ppl('#8b4fd1', '#6b3a1a')} x={50} y={66} k={1.1} /><Sprite rows={PERSON} pal={ppl('#10a04e', '#111')} x={102} y={66} k={1.1} /><Fireworks /></>;
  } else if (k === 'nascimento') {
    body = <><g transform="translate(-34 0)"><Predio cross /></g><Sprite rows={PERSON} pal={ppl('#2a78dc')} x={84} y={56} k={2} /><Sprite rows={PERSON} pal={ppl('#ff6f9f', '#6b3a1a')} x={104} y={56} k={2} /><Sprite rows={BABY} pal={{ S: '#f0c8a0', W: '#fff6e3' }} x={97} y={63} k={1.1} /><Sprite rows={HEART} pal={{ R: '#ff6f9f' }} x={92} y={38} k={1.6} cls="px-float" /><Sprite rows={HEART} pal={{ R: '#e43b44' }} x={112} y={44} k={1.2} cls="px-float px-d1" /></>;
  } else if (k === 'casamento') {
    body = <><Sprite rows={ME} pal={ppl('#1b1f3b')} x={64} y={52} k={2.2} /><Sprite rows={PERSON} pal={ppl('#fff8f0', '#6b3a1a')} x={82} y={52} k={2.2} /><Sprite rows={HEART} pal={{ R: '#ff6f9f' }} x={76} y={36} k={2} cls="px-float" /></>;
  } else if (k === 'separacao' || k === 'exoneracao' || k === 'cassacao' || k === 'fim_mandato') {
    body = <><Skyline fill="#232a3d" />{k !== 'fim_mandato' && <Rain />}<Sprite rows={ME} pal={ppl('#3e4373')} x={70} y={54} k={2.2} />{k !== 'separacao' && <Sprite rows={BOX} pal={{ O: '#b07a40', o: '#8a5a2a', T: '#fff6e3' }} x={90} y={66} k={1.8} />}</>;
  } else if (k === 'escandalo') {
    body = <><rect x={44} y={18} width={72} height={56} fill="#f4efe2" /><rect x={48} y={22} width={64} height={8} fill="#1b1f3b" /><text x={80} y={28.5} textAnchor="middle" fontSize={6} fontWeight={800} fill="#fff6e3" fontFamily="Rubik, sans-serif" letterSpacing={0.6}>URGENTE</text><rect x={48} y={33} width={64} height={3} fill="#e43b44" />{[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={48} y={40 + i * 5} width={i % 2 ? 40 : 64} height={2} fill="#9aa1b8" />)}<rect x={94} y={44} width={18} height={20} fill="#9aa1b8" /><Sprite rows={CAMERA} pal={{ K: '#1b1f3b', G: '#5a5f7a', W: '#fff', L: '#2ce8f5' }} x={12} y={58} k={1.6} /><Sprite rows={CAMERA} pal={{ K: '#1b1f3b', G: '#5a5f7a', W: '#fff', L: '#2ce8f5' }} x={134} y={52} k={1.6} /><Flashes /></>;
  } else if (k === 'nomeacao' || k === 'promocao') {
    body = <><Predio /><rect x={40} y={70} width={80} height={8} fill="#8a5a2a" /><rect x={66} y={64} width={28} height={6} fill="#1b1f3b" /><rect x={68} y={66} width={24} height={2} fill="#ffc61a" /><Sprite rows={ME} pal={ppl('#2a78dc')} x={74} y={44} k={1.6} />{k === 'promocao' && <Fireworks />}</>;
  } else if (k === 'filiacao') {
    const col = s.player.partyId ? partyColor(s.player.partyId) : '#e43b44';
    body = <><Skyline /><rect x={58} y={20} width={2} height={58} fill="#8a8fa8" /><rect x={60} y={20} width={40} height={24} fill={col} className="px-wave" /><text x={80} y={36} textAnchor="middle" fontSize={8} fontWeight={800} fill="#fff" fontFamily="Rubik, sans-serif">{partyById(s.player.partyId ?? '')?.acronym ?? ''}</text><Sprite rows={ME} pal={ppl('#fff')} x={86} y={58} k={1.8} /></>;
  } else if (k === 'ameaca') {
    body = <><Skyline fill="#1a0a10" /><Sprite rows={PHONE} pal={{ K: '#1b1f3b', R: '#3a1018', W: '#ffc61a', g: '#5a5f7a' }} x={70} y={20} k={3.2} cls="px-shake" />{[[40, 26], [106, 34], [46, 46]].map(([x, y], i) => <g key={i} className="px-float" style={{ animationDelay: `${i * 0.4}s` }}><rect x={x} y={y} width={18} height={9} fill="#fff6e3" /><rect x={x + 3} y={y + 9} width={3} height={2} fill="#fff6e3" /><text x={x + 9} y={y + 7} textAnchor="middle" fontSize={7} fontWeight={800} fill="#e43b44" fontFamily="Rubik, sans-serif">!!!</text></g>)}</>;
  } else if (k === 'sucessao' || k === 'fim_carreira') {
    body = <><Skyline fill="#3a2a4a" /><Sprite rows={PERSON} pal={ppl('#5a4a7a', '#c8c8c8')} x={66} y={54} k={2.2} />{k === 'sucessao' && <Sprite rows={PERSON} pal={ppl('#10a04e')} x={86} y={58} k={1.8} />}</>;
  } else {
    body = <><Skyline /><Sprite rows={URNA} pal={{ G: '#c9cfdf', D: '#3e4373', L: '#2ce8f5', K: '#1b1f3b', w: '#fff', g: '#10a04e' }} x={66} y={54} k={2} /></>;
  }
  return (
    <svg className="scene-art" viewBox="0 0 160 90" shapeRendering="crispEdges" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <Backdrop tone={sc.tone} />
      {k !== 'escandalo' && ground(sc.tone === 'alegre' ? '#5a7a3a' : '#1b1f3b')}
      {body}
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------
// Cena genérica
// ---------------------------------------------------------------------------------------------
function SceneCard({ sc, s, onNext, last }: { sc: Scene; s: GameState; onNext: () => void; last: boolean }) {
  useEffect(() => { sfx[sc.tone](); }, [sc.id]);
  return (
    <div className={`scene tone-${sc.tone}`} role="dialog" aria-modal="true" aria-label={sc.title}>
      <SceneArt sc={sc} s={s} />
      <div className="scene-text">
        <div className="scene-kicker">{sc.kicker}</div>
        <h1 className="scene-title">{sc.title}</h1>
        {sc.text && <p className="scene-body">{sc.text}</p>}
        <button className="btn btn-gold scene-next" onClick={onNext} autoFocus>{last ? 'Continuar' : 'Próximo'} →</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Noite da apuração
// ---------------------------------------------------------------------------------------------
function hash(str: string): number { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');
const pct = (n: number) => (n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
const DURATION = 13000;

function useCount(key: string) {
  const [t, setT] = useState(0);
  const [speed, setSpeed] = useState(1);
  const raf = useRef(0); const last = useRef(0); const sp = useRef(1);
  sp.current = speed;
  useEffect(() => {
    setT(0); last.current = performance.now();
    const loop = (now: number) => { const dt = now - last.current; last.current = now; setT((x) => { const nx = Math.min(1, x + (dt * sp.current) / DURATION); if (nx < 1) raf.current = requestAnimationFrame(loop); return nx; }); };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [key]);
  return { t, finish: () => setT(1), speed, setSpeed };
}

export function Apuracao({ s, refe, onClose }: { s: GameState; refe: ApuracaoRef; onClose: () => void }) {
  const data = useMemo(() => apuracaoData(s, refe), [s, refe]);
  const key = `${refe.level}-${refe.year}-${refe.round}-${refe.office}`;
  const { t, finish, speed, setSpeed } = useCount(key);
  const lastStep = useRef(-1);
  const done = t >= 1;
  const p = 1 - Math.pow(1 - t, 1.7); // seções totalizadas
  // ordem ilustrativa de chegada das regiões
  const order = useMemo(() => [...REGIONS].map((r) => r.id).sort((a, b) => hash(a + key) - hash(b + key)), [key]);
  useEffect(() => { const step = Math.floor(p * 20); if (step !== lastStep.current) { lastStep.current = step; if (!done) sfx.tick(); } }, [p, done]);
  useEffect(() => { if (done && data) (data.outcome === 'eleito' ? sfx.vitoria : data.outcome === 'segundo_turno' ? sfx.tenso : sfx.derrota)(); }, [done]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') { if (done) onClose(); else finish(); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [done]);
  if (!data) return null;

  const R = order.length;
  const regionsFrac = (q: number) => order.map((id, i) => ({ id, f: Math.max(0, Math.min(1, q * R - i * 0.85)) }));
  const playerProgress = (q: number) => {
    if (!data.regions || !Object.keys(data.regions).length) return q;
    const tot = Object.values(data.regions).reduce((a, b) => a + b, 0) || 1;
    const raw = regionsFrac(q).reduce((a, r) => a + (data.regions![r.id] ?? 0) * r.f, 0) / tot;
    const scale = regionsFrac(1).reduce((a, r) => a + (data.regions![r.id] ?? 0) * r.f, 0) / tot || 1;
    return Math.min(1, raw / scale);
  };
  const shown = data.candidates.map((c) => {
    const drift = c.isPlayer ? 0 : (hash(c.id + key) - 0.5) * 0.3;
    const f = done ? 1 : c.isPlayer ? 0.55 * playerProgress(p) + 0.45 * p : Math.max(0, p * (1 + drift * (1 - p)));
    return { ...c, now: c.votes * Math.min(1, f) };
  });
  const sorted = [...shown].sort((a, b) => b.now - a.now);
  const countedValid = Math.max(1, data.validVotes * p);
  const maxV = Math.max(...shown.map((c) => c.now), 1);
  const me = shown.find((c) => c.isPlayer)!;
  const pos = sorted.indexOf(sorted.find((c) => c.isPlayer)!) + 1;
  const arrived = regionsFrac(p).filter((r) => r.f > 0 && r.f < 1).map((r) => REGIONS.find((x) => x.id === r.id)?.name).filter(Boolean);
  const minutes = 17 * 60 + Math.round(t * 230);
  const clock = `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
  const stamp = data.outcome === 'eleito' ? 'ELEITO(A)!' : data.outcome === 'segundo_turno' ? '2º TURNO!' : 'NÃO ELEITO(A)';
  const tone: SceneTone = data.outcome === 'eleito' ? 'vitoria' : data.outcome === 'segundo_turno' ? 'tenso' : 'derrota';

  return (
    <div className={`apuracao tone-${tone}`} role="dialog" aria-modal="true" aria-label={data.title}>
      <div className="apu-head">
        <div>
          <div className="scene-kicker">{refe.round === 2 ? '2º turno' : 'Noite da apuração'} · {refe.year}</div>
          <h1 className="apu-title">{(() => { const x = data.title.replace('Apuração — ', ''); return x.charAt(0).toUpperCase() + x.slice(1); })()}</h1>
          <div className="apu-sub">{data.subtitle}</div>
        </div>
        <div className="apu-clock"><b>{clock}</b><span>horário de Brasília</span></div>
      </div>
      <div className="apu-progress">
        <div className="apu-progress-label"><span>Seções totalizadas</span><b>{pct(p)}</b></div>
        <div className="bar gold apu-bar"><i style={{ width: `${p * 100}%` }} /></div>
        <div className="apu-ticker">{done ? 'Totalização concluída.' : arrived.length ? `Chegando urnas de: ${arrived.join(' · ')}` : 'Fecharam as urnas. Começa a contagem.'}</div>
      </div>

      <div className="apu-board">
        {data.mode === 'proporcional' && <div className="apu-note">Lista {data.listLabel}: posição dentro da lista; percentuais sobre os votos válidos já apurados. {done ? `A lista fez ${data.seats} cadeira(s); a linha mostra o corte.` : 'Quantas cadeiras a lista faz só se sabe no fim (quociente eleitoral e sobras).'}</div>}
        {sorted.map((c, i) => (
          <div key={c.id}>
            {data.mode === 'proporcional' && done && i === data.seats && <div className="apu-cut">— linha de corte · {data.seats} vaga(s) da lista —</div>}
            {data.mode === 'majoritaria' && done && data.seats > 1 && i === data.seats && <div className="apu-cut">— {data.seats} vagas —</div>}
            <div className={`apu-row ${c.isPlayer ? 'me' : ''} ${done && c.elected ? 'won' : ''}`}>
              <div className="apu-pos">{i + 1}º</div>
              <div className="apu-name"><b>{c.name}{c.isPlayer ? ' (você)' : ''}</b>{data.mode === 'majoritaria' && <span>{c.label}</span>}</div>
              <div className="apu-bar-wrap"><div className={`bar ${c.isPlayer ? 'gold' : 'blue'}`}><i style={{ width: `${(c.now / maxV) * 100}%` }} /></div></div>
              <div className="apu-votes"><b>{fmt(c.now)}</b><span>{pct(c.now / countedValid)}</span></div>
            </div>
          </div>
        ))}
      </div>

      {!done && <div className="apu-live">Você: <b>{fmt(me.now)}</b> votos · {pos}º {data.mode === 'proporcional' ? 'na lista' : 'lugar'}</div>}
      {done && (
        <div className={`apu-stamp stamp-${data.outcome}`}>
          <div className="stamp">{stamp}</div>
          <p>{data.outcomeText}</p>
          {data.outcome === 'eleito' && <div className="confetti" aria-hidden>{Array.from({ length: 40 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 10) * 0.12}s`, background: ['#ffc61a', '#10a04e', '#2a78dc', '#e43b44', '#ff6f9f'][i % 5] }} />)}</div>}
        </div>
      )}
      <div className="apu-actions">
        {!done && <button className="btn" onClick={() => setSpeed(speed === 1 ? 3 : 1)}>{speed === 1 ? 'Acelerar ×3' : 'Velocidade normal'}</button>}
        {!done && <button className="btn" onClick={finish}>Pular para o resultado</button>}
        {done && <button className="btn btn-gold" onClick={onClose} autoFocus>Continuar →</button>}
      </div>
      <div className="apu-foot">Números finais calculados pelo jogo (quociente, sobras e maioria absoluta conforme a lei). A ordem em que as urnas chegam na tela é ilustrativa.</div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Fila de cenas
// ---------------------------------------------------------------------------------------------
export function SceneQueue({ s, scenes, onDone }: { s: GameState; scenes: Scene[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [scenes]);
  const sc = scenes[i];
  if (!sc) return null;
  const next = () => (i + 1 < scenes.length ? setI(i + 1) : onDone());
  return (
    <div className="scene-overlay">
      {sc.kind === 'apuracao' && sc.apuracao ? <Apuracao key={sc.id} s={s} refe={sc.apuracao} onClose={next} /> : <SceneCard key={sc.id} sc={sc} s={s} onNext={next} last={i + 1 === scenes.length} />}
    </div>
  );
}
