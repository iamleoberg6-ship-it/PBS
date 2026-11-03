import { useState } from 'react';
import {
  NETWORKS, OUTLETS, digitalScore, levelOf, monthLabel, outletById, totalFollowers,
  type GameState, type NetworkId,
} from '../engine';

export const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
    : n >= 1_000 ? `${(n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(Math.round(n));

export function Redes({ s, setFocus }: { s: GameState; setFocus: (n: NetworkId) => void }) {
  const soc = s.player.social;
  return (
    <>
      <div className="page-head">
        <div><h2>Redes sociais</h2><p>Escolha em qual rede você vai se dedicar neste mês. A rede em foco cresce sozinha todo mês, e a ação "Produzir conteúdo nas redes" publica nela.</p></div>
        <div className="top-stat" style={{ color: 'var(--ink)' }}><b className="big-number" style={{ fontSize: 26 }}>{compact(totalFollowers(soc))}</b><small style={{ color: 'var(--ink-3)' }}>seguidores somados</small></div>
      </div>
      <div className="grid g-2">
        {NETWORKS.map((n) => {
          const f = soc.networks[n.id];
          const lv = levelOf(f);
          const focus = soc.focus === n.id;
          return (
            <div key={n.id} className="card" style={{ borderColor: focus ? 'var(--gold)' : undefined, boxShadow: focus ? '0 0 0 2px var(--gold-soft)' : undefined }}>
              <div className="card-title"><h3>{n.label}</h3>{focus ? <span className="tag derivada">foco do mês</span> : <button className="btn btn-sm" onClick={() => setFocus(n.id)}>Focar este mês</button>}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span className="big-number">{compact(f)}</span><span className="muted">seguidores</span>
              </div>
              <div className="meter-label" style={{ marginTop: 10 }}><span>Nível {lv.level}</span><span>{lv.next ? `próximo nível: ${compact(lv.next)}` : 'nível máximo'}</span></div>
              <div className="bar gold"><i style={{ width: `${lv.progress * 100}%` }} /></div>
              <p className="small muted" style={{ marginTop: 10 }}>{n.perk}</p>
            </div>
          );
        })}
      </div>
      <div className="callout" style={{ marginTop: 16 }}>
        Força digital na eleição: <b>{digitalScore(soc).toFixed(1)}</b> de 12 pontos. Só parte dos seguidores mora e vota em São Paulo, e cada rede converte de um jeito (YouTube e Instagram convertem mais que TikTok). Plataformas reais, números simulados.
      </div>
    </>
  );
}

const SECTIONS = ['Todas', 'Sobre você', 'Eleições', 'Câmara', 'Prefeitura', 'Partidos', 'Cidade', 'Brasil'] as const;

export function Noticias({ s }: { s: GameState }) {
  const [sec, setSec] = useState<(typeof SECTIONS)[number]>('Todas');
  const items = [...s.news].reverse().filter((n) => sec === 'Todas' || (sec === 'Sobre você' ? n.aboutPlayer : n.section === sec));
  return (
    <>
      <div className="page-head"><div><h2>Notícias</h2><p>O que a imprensa está publicando. Cobertura positiva aumenta seu reconhecimento; veículos de linha editorial distante da sua tendem a ser mais críticos.</p></div></div>
      <div className="tabs">{SECTIONS.map((x) => <button key={x} className={`tab ${sec === x ? 'active' : ''}`} onClick={() => setSec(x)}>{x}</button>)}</div>
      <div className="grid g-main">
        <div className="grid" style={{ alignContent: 'start' }}>
          {items.length === 0 && <div className="card muted">Nenhuma notícia nesta seção ainda. Avance o mês.</div>}
          {items.slice(0, 60).map((n) => {
            const o = outletById(n.outletId);
            return (
              <article key={n.id} className="card" style={{ padding: 14, borderLeft: `4px solid ${n.tone === 'positivo' ? 'var(--accent)' : n.tone === 'critico' ? 'var(--red)' : 'var(--line)'}` }}>
                <div className="small" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                  <b>{o.name}</b><span className="muted">{o.kind}</span><span className="muted">·</span><span className="muted">{monthLabel(n.month)}</span>
                  <span className="tag">{n.section}</span>{n.aboutPlayer && <span className="tag derivada">sobre você</span>}
                </div>
                <h3 style={{ fontSize: 17, lineHeight: 1.25, marginBottom: 4 }}>{n.headline}</h3>
                <div className="small" style={{ color: 'var(--ink-2)' }}>{n.lead}</div>
              </article>
            );
          })}
        </div>
        <div className="card" style={{ alignSelf: 'start' }}>
          <h3>Veículos</h3>
          {OUTLETS.map((o) => <div key={o.id} style={{ marginBottom: 8 }}><b>{o.name}</b><div className="small muted">{o.kind} · alcance {o.reach >= 2 ? 'muito alto' : o.reach >= 1.2 ? 'alto' : 'médio'}</div></div>)}
          <p className="small muted">Todos os veículos e notícias são fictícios. Pessoas reais só aparecem em fatos de registro público ou em resultados marcados como simulação.</p>
        </div>
      </div>
    </>
  );
}

export function Headlines({ s }: { s: GameState }) {
  const items = [...s.news].reverse().slice(0, 4);
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      {items.map((n) => (
        <div key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--paper-2)' }}>
          <div className="small muted">{outletById(n.outletId).name}</div>
          <div style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.3 }}>{n.headline}</div>
        </div>
      ))}
    </div>
  );
}
