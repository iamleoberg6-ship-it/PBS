/**
 * Fase 14 — Mapas clicáveis: capital por subprefeitura, estado por região intermediária, Brasil por UF/região.
 * Contornos e números com fonte em src/engine/data/maps.ts. Cores: verde = melhor, vermelho = pior.
 */
import { Fragment, useMemo, useState } from 'react';
import {
  CITY_META, MAP_BR, MAP_CITY, MAP_STATE, STATE_REGION_STATS, SUBPREF_DATA, UF_REGION, UF_STATS,
  indicatorById, indicatorValue, regionalValue, subprefValue, capitalAreaPop, rgPop, rgIdhm, ufPop, ufIdhm, brRegionPop, DEMO_RULES, type GameState, type MapLayer,
} from '../engine';
import { REGIONS } from '../engine/data/regions';

type View = 'cidade' | 'estado' | 'brasil';
type Metric = { id: string; label: string; unit: string; better: 'up' | 'down' | null; tag: 'DADO REAL' | 'DERIVADA' | 'PARÂMETRO' | 'DO JOGO'; source: string; decimals: number };

const norm = (t: string) => t.normalize('NFD').toUpperCase().replace(/[^A-Z0-9]/g, '');
const ALIAS: Record<string, string> = { CASAVERDELIMAOCACHOEIRINHA: 'CASAVERDECACHOEIRINHA', PERUSANHANGUERA: 'PERUS' };
/** id do mapa → { nome do jogo, região do jogo, população 2022 } */
const CITY_INDEX = (() => {
  const out: Record<string, { name: string; region: string; pop: number }> = {};
  for (const r of REGIONS) for (const sp of r.subprefeituras) out[norm(sp.name)] = { name: sp.name, region: r.id, pop: sp.pop2022 };
  return out;
})();
const cityInfo = (mapId: string) => CITY_INDEX[ALIAS[mapId] ?? mapId];
const subprefKey = (name: string) => Object.keys(SUBPREF_DATA).find((k) => norm(k) === norm(name)) ?? name;

const fmt = (v: number | null | undefined, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const BR_NAME: Record<string, string> = { norte: 'Norte', nordeste: 'Nordeste', centro_oeste: 'Centro-Oeste', sudeste: 'Sudeste', sul: 'Sul' };

function color(t: number, better: Metric['better']) {
  // t em [0,1] dentro da faixa; pinta melhor = verde
  if (better === null) { const a = 0.15 + t * 0.75; return `rgba(42,120,220,${a})`; }
  const g = better === 'up' ? t : 1 - t;
  const stops = [[228, 59, 68], [255, 198, 26], [16, 160, 78]];
  const x = g * 2, i = Math.min(1, Math.floor(x)), f = x - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgb(${c.join(',')})`;
}

function MapSvg({ layer, values, metric, selected, onPick, outline }: { layer: MapLayer; values: Record<string, number | null>; metric: Metric; selected: string | null; onPick: (id: string) => void; outline?: (id: string) => string | undefined }) {
  const nums = Object.values(values).filter((v): v is number => v !== null && !Number.isNaN(v));
  const min = Math.min(...nums), max = Math.max(...nums);
  const [hover, setHover] = useState<string | null>(null);
  const hv = hover ? layer.shapes.find((x) => x.id === hover) : null;
  return (
    <div className="map-wrap">
      <svg viewBox={`-6 -6 ${layer.w + 12} ${layer.h + 12}`} className="map-svg" role="img" aria-label="Mapa">
        {layer.shapes.map((sh) => {
          const v = values[sh.id];
          const t = v === null || v === undefined || max === min ? 0.5 : (v - min) / (max - min);
          return <path key={sh.id} d={sh.d} fill={v === null || v === undefined ? '#d9d2bf' : color(t, metric.better)} stroke={outline?.(sh.id) ?? '#1b1f3b'} strokeWidth={sh.id === selected ? 4 : 1.2} className={`map-area ${sh.id === selected ? 'sel' : ''}`}
            onMouseEnter={() => setHover(sh.id)} onMouseLeave={() => setHover(null)} onClick={() => onPick(sh.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onPick(sh.id); }}>
            <title>{sh.name}</title>
          </path>;
        })}
        {selected && (() => { const sh = layer.shapes.find((x) => x.id === selected); return sh ? <path d={sh.d} fill="none" stroke="#ffc61a" strokeWidth={5} pointerEvents="none" /> : null; })()}
      </svg>
      <div className="map-hover">{hv ? <><b>{prettyName(hv.name)}</b> · {fmt(values[hv.id], metric.decimals)} {metric.unit}</> : 'Passe o dedo ou o mouse sobre o mapa; toque para ver a ficha.'}</div>
      <div className="map-legend">
        <span>{fmt(min, metric.decimals)}</span>
        <i style={{ background: `linear-gradient(90deg, ${color(0, metric.better)}, ${color(0.5, metric.better)}, ${color(1, metric.better)})` }} />
        <span>{fmt(max, metric.decimals)}</span>
        <span className="muted">{metric.unit}{metric.better ? ` · verde = melhor` : ''}</span>
      </div>
    </div>
  );
}
const prettyName = (n: string) => (n === n.toUpperCase() ? n.toLowerCase().replace(/(^|[\s-])([a-zà-ú])/g, (_m, a, b) => a + b.toUpperCase()).replace(/\bDe\b|\bDo\b|\bDa\b/g, (x) => x.toLowerCase()) : n);

function IdhmRows({ x, year }: { x: ReturnType<typeof rgIdhm>; year: number }) {
  if (!x) return null;
  const d = (v: number) => (Math.abs(v) < 0.0005 ? '' : ` (${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(3).replace('.', ',')})`);
  return <>
    <dt>IDHM ({year}, estimado)</dt><dd><b>{fmt(x.idhm, 3)}</b></dd>
    <dt className="muted">IDHM 2010 (Atlas)</dt><dd className="muted">{fmt(x.base.idhm, 3)}</dd>
    <dt>Educação</dt><dd>{fmt(x.e, 3)}<span className="muted small">{d(x.delta.e)}</span></dd>
    <dt>Longevidade</dt><dd>{fmt(x.l, 3)}<span className="muted small">{d(x.delta.l)}</span></dd>
    <dt>Renda</dt><dd>{fmt(x.r, 3)}<span className="muted small">{d(x.delta.r)}</span></dd>
  </>;
}

function Tag({ t }: { t: Metric['tag'] }) { return <span className={`tag ${t === 'DADO REAL' ? 'real' : t === 'DERIVADA' ? 'derivada' : 'proposta'}`}>{t}</span>; }

// ---------------------------------------------------------------------------------------------
function CityMap({ s }: { s: GameState }) {
  const lastVotes = [...s.elections].reverse().find((e) => e.playerVotesByRegion && Object.keys(e.playerVotesByRegion).length);
  const METRICS: Metric[] = [
    { id: 'c_mortinf', label: 'Mortalidade infantil', unit: 'por mil nasc. vivos', better: 'down', tag: 'DADO REAL', source: 'SMS-SP, CEInfo (2025), atualizado pela simulação', decimals: 1 },
    { id: 'c_homic', label: 'Homicídios', unit: 'por 100 mil hab.', better: 'down', tag: 'DADO REAL', source: 'SMS-SP, CEInfo (2024), atualizado pela simulação', decimals: 1 },
    { id: 'c_desloc', label: 'Tempo de deslocamento', unit: 'min/dia', better: 'down', tag: 'DADO REAL', source: 'Rede Nossa São Paulo/Ipec 2024 (por zona)', decimals: 0 },
    { id: 'densidade', label: 'Densidade', unit: 'hab./km²', better: null, tag: 'DERIVADA', source: `Censo 2022 projetado para ${s.month.year} (taxa 2010–2022 da capital) ÷ área GeoSampa`, decimals: 0 },
    { id: 'c_ideb', label: 'Ideb (anos iniciais)', unit: 'nota', better: 'up', tag: 'PARÂMETRO', source: 'valor da cidade (Inep) com variação por renda da região (parâmetro do jogo)', decimals: 1 },
    { id: 'c_esgoto', label: 'Esgoto coletado', unit: '%', better: 'up', tag: 'PARÂMETRO', source: 'valor da cidade com variação por região (parâmetro do jogo)', decimals: 1 },
    { id: 'c_cultura', label: 'Acesso a cultura', unit: 'índice', better: 'up', tag: 'PARÂMETRO', source: 'valor da cidade com variação por região (parâmetro do jogo)', decimals: 1 },
    ...(lastVotes ? [{ id: 'votos', label: `Seus votos (${lastVotes.year})`, unit: 'votos na região', better: null, tag: 'DO JOGO' as const, source: 'resultado da sua eleição, por região do jogo', decimals: 0 }] : []),
  ];
  const [m, setM] = useState(METRICS[0].id);
  const metric = METRICS.find((x) => x.id === m) ?? METRICS[0];
  const [sel, setSel] = useState<string | null>(null);
  const valueOf = (mapId: string, id: string): number | null => {
    const info = cityInfo(mapId); if (!info) return null;
    if (id === 'densidade') return capitalAreaPop(s, info.pop) / (CITY_META[mapId]?.km2 || 1);
    if (id === 'votos') return lastVotes?.playerVotesByRegion?.[info.region] ?? 0;
    if (id === 'c_mortinf' || id === 'c_homic') return subprefValue(s, id, subprefKey(info.name), info.region);
    return regionalValue(s, id, info.region);
  };
  const values = useMemo(() => Object.fromEntries(MAP_CITY.shapes.map((sh) => [sh.id, valueOf(sh.id, m)])), [s, m]);
  const info = sel ? cityInfo(sel) : null;
  const region = info ? REGIONS.find((r) => r.id === info.region) : null;
  return (
    <div className="map-grid">
      <div>
        <div className="pill-row map-metrics">{METRICS.map((x) => <button key={x.id} className={`btn btn-sm ${m === x.id ? 'btn-gold' : ''}`} onClick={() => setM(x.id)}>{x.label}</button>)}</div>
        <MapSvg layer={MAP_CITY} values={values} metric={metric} selected={sel} onPick={setSel} />
        <div className="small muted"><Tag t={metric.tag} /> {metric.source}</div>
      </div>
      <div className="map-panel card">
        {!info ? <p className="muted small">Toque numa subprefeitura para ver os indicadores dela. São 32 subprefeituras, agrupadas pelo jogo em 8 regiões.</p> : (
          <>
            <div className="scene-kicker" style={{ color: 'var(--ink-3)' }}>Subprefeitura · {region?.name}</div>
            <h3 style={{ fontSize: 20 }}>{info.name}</h3>
            <dl className="kv" style={{ marginTop: 10 }}>
              <dt>População ({s.month.year}, estimada)</dt><dd>{capitalAreaPop(s, info.pop).toLocaleString('pt-BR')}</dd>
              <dt className="muted">Censo 2022</dt><dd className="muted">{info.pop.toLocaleString('pt-BR')}</dd>
              <dt>Área</dt><dd>{CITY_META[sel!]?.km2} km²</dd>
              {METRICS.filter((x) => x.id !== 'densidade').map((x) => <Fragment key={x.id}><dt>{x.label} <span className="muted small">{x.tag === 'DADO REAL' ? '●' : '○'}</span></dt><dd>{fmt(valueOf(sel!, x.id), x.decimals)} <span className="muted small">{x.unit}</span></dd></Fragment>)}
            </dl>
            {region && <p className="small" style={{ marginTop: 10 }}>Renda da região: <b>{region.income}</b> · prioridades: {region.priorities.join(', ')}.</p>}
            {s.player.regionalGoodwill?.[info.region] !== undefined && <p className="small">Sua boa vontade na região: <b>{Math.round(s.player.regionalGoodwill[info.region])}</b>/100.</p>}
            <p className="small muted">● dado real (atualizado pela simulação) · ○ parâmetro ou dado do jogo</p>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function StateMap({ s }: { s: GameState }) {
  const gov = s.player.mandate?.office === 'governador' ? s.player.mandate.upper : null;
  const METRICS: Metric[] = [
    { id: 'idhm', label: `IDHM (${s.month.year})`, unit: 'índice 0–1', better: 'up', tag: 'DERIVADA', source: 'IDHM 2010 dos municípios (Atlas Brasil, ponderado pela população) + mudanças simuladas desde o início do jogo', decimals: 3 },
    { id: 'idhm_e', label: 'IDHM Educação', unit: 'índice', better: 'up', tag: 'DERIVADA', source: 'Atlas 2010 + efeito simulado do Ideb e de investimentos', decimals: 3 },
    { id: 'idhm_l', label: 'IDHM Longevidade', unit: 'índice', better: 'up', tag: 'DERIVADA', source: 'Atlas 2010 + efeito simulado da mortalidade infantil e de investimentos', decimals: 3 },
    { id: 'idhm_r', label: 'IDHM Renda', unit: 'índice', better: 'up', tag: 'DERIVADA', source: 'Atlas 2010 + efeito simulado da desocupação e de investimentos', decimals: 3 },
    { id: 'pop', label: `População (${s.month.year})`, unit: 'habitantes', better: null, tag: 'DERIVADA', source: 'Censo 2022 projetado com a taxa 2010–2022 de cada região', decimals: 0 },
    ...(gov ? [
      { id: 'inv', label: 'Investido pelo seu governo', unit: 'R$ mi', better: null, tag: 'DO JOGO' as const, source: 'ações "Investir numa região do estado"', decimals: 0 },
      { id: 'aprov', label: 'Sua aprovação', unit: '0–100', better: 'up' as const, tag: 'DO JOGO' as const, source: 'aprovação do governo por região (simulação)', decimals: 0 },
    ] : []),
  ];
  const [m, setM] = useState(gov ? 'aprov' : 'idhm');
  const metric = METRICS.find((x) => x.id === m)!;
  const [sel, setSel] = useState<string | null>(null);
  const est = (id: string, k: string): number | null => { if (k === 'pop') return rgPop(s, id); const x = rgIdhm(s, id); if (!x) return null; return k === 'idhm' ? x.idhm : k === 'idhm_e' ? x.e : k === 'idhm_l' ? x.l : x.r; };
  const values = Object.fromEntries(MAP_STATE.shapes.map((sh) => [sh.id, m === 'inv' ? Number(s.flags[`invRG_${sh.id}`] ?? gov?.regionInvest?.[sh.id] ?? 0) : m === 'aprov' ? (gov?.regionApproval?.[sh.id] ?? s.player.mandate?.approval ?? null) : est(sh.id, m)]));
  const st = sel ? STATE_REGION_STATS[sel] : null;
  const name = sel ? MAP_STATE.shapes.find((x) => x.id === sel)?.name : '';
  const total = Object.values(STATE_REGION_STATS).reduce((a, x) => a + x.pop, 0);
  const STATE_IND = ['e_mortinf', 'e_homic', 'e_ideb', 'e_desemp'].filter((id) => indicatorById(id));
  return (
    <div className="map-grid">
      <div>
        <div className="pill-row map-metrics">{METRICS.map((x) => <button key={x.id} className={`btn btn-sm ${m === x.id ? 'btn-gold' : ''}`} onClick={() => setM(x.id)}>{x.label}</button>)}</div>
        <MapSvg layer={MAP_STATE} values={values} metric={metric} selected={sel} onPick={setSel} />
        <div className="small muted"><Tag t={metric.tag} /> {metric.source}. Regiões: Regiões Geográficas Intermediárias do IBGE (2017).</div>
      </div>
      <div className="map-panel card">
        {!st ? <p className="muted small">Toque numa região para ver os dados. O estado tem 645 municípios em 11 regiões intermediárias do IBGE.</p> : (
          <>
            <div className="scene-kicker" style={{ color: 'var(--ink-3)' }}>Região intermediária (IBGE)</div>
            <h3 style={{ fontSize: 20 }}>{name}</h3>
            <dl className="kv" style={{ marginTop: 10 }}>
              <dt>População ({s.month.year}, estimada)</dt><dd>{rgPop(s, sel!).toLocaleString('pt-BR')}</dd>
              <dt className="muted">Censo 2022</dt><dd className="muted">{st.pop.toLocaleString('pt-BR')}</dd>
              <dt>Peso no estado</dt><dd>{fmt((st.pop / total) * 100, 1)}%</dd>
              <dt>Municípios</dt><dd>{st.nmun}</dd>
              <IdhmRows x={rgIdhm(s, sel!)} year={s.month.year} />
              {gov && <><dt>Investido pelo seu governo</dt><dd>R$ {fmt(gov.regionInvest?.[sel!] ?? 0, 0)} mi</dd><dt>Sua aprovação</dt><dd>{fmt(gov.regionApproval?.[sel!] ?? s.player.mandate?.approval, 0)}</dd></>}
            </dl>
            {STATE_IND.length > 0 && <>
              <h4 style={{ marginTop: 12 }}>Indicadores do estado (média estadual, simulação)</h4>
              <dl className="kv">{STATE_IND.map((id) => { const d = indicatorById(id)!; return <Fragment key={id}><dt>{d.label}</dt><dd>{fmt(indicatorValue(s, id), d.decimals ?? 1)} <span className="muted small">{d.unit}</span></dd></Fragment>; })}</dl>
              <p className="small muted">O jogo ainda não tem esses indicadores por região do estado; aparece a média estadual.</p>
            </>}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function BrazilMap({ s }: { s: GameState }) {
  const nat = s.national;
  const METRICS: Metric[] = [
    { id: 'idhm', label: `IDHM (${s.month.year}, por UF)`, unit: 'índice 0–1', better: 'up', tag: 'DERIVADA', source: 'IDHM 2010 (Atlas Brasil, municípios ponderados) + mudanças simuladas: renda da região (fórmula do PNUD), mortalidade infantil, Ideb e verbas federais', decimals: 3 },
    { id: 'pop', label: `População (${s.month.year}, por UF)`, unit: 'habitantes', better: null, tag: 'DERIVADA', source: 'Censo 2022 projetado com a taxa 2010–2022 de cada UF', decimals: 0 },
    { id: 'desemp', label: 'Desocupação (região)', unit: '%', better: 'down', tag: 'DADO REAL', source: 'IBGE/PNAD Contínua por região, atualizada pela simulação', decimals: 1 },
    { id: 'renda', label: 'Renda média (região)', unit: 'R$', better: 'up', tag: 'DADO REAL', source: 'IBGE/PNAD Contínua por região, atualizada pela simulação', decimals: 0 },
    ...(nat ? [{ id: 'proj', label: 'Sua projeção (região)', unit: 'reconhecimento 0–100', better: 'up' as const, tag: 'DO JOGO' as const, source: 'projeção nacional do jogador', decimals: 0 }] : []),
  ];
  const [m, setM] = useState('idhm');
  const metric = METRICS.find((x) => x.id === m) ?? METRICS[0];
  const [sel, setSel] = useState<string | null>(null);
  const valueOf = (uf: string, id: string): number | null => {
    const r = UF_REGION[uf]; const rd = nat?.regions?.[r];
    if (id === 'idhm') return ufIdhm(s, uf)?.idhm ?? null;
    if (id === 'pop') return ufPop(s, uf);
    if (id === 'desemp') return rd?.unemployment ?? null;
    if (id === 'renda') return rd?.income ?? null;
    if (id === 'proj') return nat?.player?.[r]?.recognition ?? null;
    return null;
  };
  const values = useMemo(() => Object.fromEntries(MAP_BR.shapes.map((sh) => [sh.id, valueOf(sh.id, m)])), [s, m]);
  const reg = sel ? UF_REGION[sel] : null;
  const rd = reg ? nat?.regions?.[reg] : null;
  const REGION_STROKE: Record<string, string> = { norte: '#1b1f3b', nordeste: '#1b1f3b', centro_oeste: '#1b1f3b', sudeste: '#1b1f3b', sul: '#1b1f3b' };
  return (
    <div className="map-grid">
      <div>
        <div className="pill-row map-metrics">{METRICS.map((x) => <button key={x.id} className={`btn btn-sm ${m === x.id ? 'btn-gold' : ''}`} onClick={() => setM(x.id)}>{x.label}</button>)}</div>
        <MapSvg layer={MAP_BR} values={values} metric={metric} selected={sel} onPick={setSel} outline={(id) => REGION_STROKE[UF_REGION[id]]} />
        <div className="small muted"><Tag t={metric.tag} /> {metric.source}.</div>
      </div>
      <div className="map-panel card">
        {!sel ? <p className="muted small">Toque num estado para ver os dados dele e da sua região.</p> : (
          <>
            <div className="scene-kicker" style={{ color: 'var(--ink-3)' }}>Região {BR_NAME[reg!]}</div>
            <h3 style={{ fontSize: 20 }}>{MAP_BR.shapes.find((x) => x.id === sel)?.name} ({sel})</h3>
            <dl className="kv" style={{ marginTop: 10 }}>
              <dt>População ({s.month.year}, estimada)</dt><dd>{ufPop(s, sel).toLocaleString('pt-BR')}</dd>
              <dt className="muted">Censo 2022</dt><dd className="muted">{UF_STATS[sel]?.pop.toLocaleString('pt-BR')}</dd>
              <IdhmRows x={ufIdhm(s, sel)} year={s.month.year} />
            </dl>
            {rd && <>
              <h4 style={{ marginTop: 12 }}>Região {rd.name}</h4>
              <dl className="kv">
                <dt>População ({s.month.year})</dt><dd>{brRegionPop(s, reg!).toLocaleString('pt-BR')}</dd>
                <dt>Eleitorado</dt><dd>{rd.electorate.toLocaleString('pt-BR')}</dd>
                <dt>Desocupação</dt><dd>{fmt(rd.unemployment, 1)}%</dd>
                <dt>Renda média</dt><dd>R$ {fmt(rd.income, 0)}</dd>
                {nat?.player?.[reg!] && <><dt>Seu reconhecimento</dt><dd>{fmt(nat.player[reg!].recognition, 0)}</dd><dt>Sua aprovação</dt><dd>{fmt(nat.player[reg!].approval, 0)}</dd></>}
                {nat?.funds?.[reg!] ? <><dt>Recursos que você levou</dt><dd>R$ {fmt(nat.funds[reg!], 0)} mi</dd></> : null}
              </dl>
            </>}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
export function defaultMapView(s: GameState): View {
  const o = s.player.mandate?.office ?? s.player.candidacy?.office ?? '';
  if (['presidente', 'vice_presidente', 'ministro'].includes(o)) return 'brasil';
  if (['governador', 'secretario_estadual', 'deputado_estadual', 'deputado_federal', 'senador'].includes(o)) return 'estado';
  return 'cidade';
}

export function Mapas({ s }: { s: GameState }) {
  const [v, setV] = useState<View>(defaultMapView(s));
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-title"><h3>Mapa</h3>
        <div className="pill-row">{([['cidade', 'Capital (subprefeituras)'], ['estado', 'Estado de SP (regiões)'], ['brasil', 'Brasil (estados)']] as [View, string][]).map(([id, l]) => <button key={id} className={`btn btn-sm ${v === id ? 'btn-primary' : ''}`} onClick={() => setV(id)}>{l}</button>)}</div>
      </div>
      {v === 'cidade' && <CityMap s={s} />}
      {v === 'estado' && <StateMap s={s} />}
      {v === 'brasil' && <BrazilMap s={s} />}
      <details style={{ marginTop: 10 }}><summary className="small"><b>Como os números andam com o tempo</b></summary>{DEMO_RULES.map((r) => <div key={r} className="small">{r}</div>)}</details>
    </div>
  );
}
