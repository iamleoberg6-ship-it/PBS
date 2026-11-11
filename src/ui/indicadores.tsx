import { useState } from 'react';
import {
  GOVPROFILE_RULES, GOV_AREA_LABEL, INDICATORS, INDICATOR_RULES, MOBILITY_SOURCE, REGIONAL_IDS, REGIONAL_REAL, REGIONS, SUBPREF_SOURCE, aiModeled, governments,
  indicatorById, indicatorChange, indicatorValue, partyById, playerEffect, playerSphere, profileForParty, regionalValue, subprefValue,
  type GameState, type GovArea, type Sphere,
} from '../engine';

const SPHERE_LABEL: Record<Sphere, string> = { cidade: 'Cidade de São Paulo', estado: 'Estado de São Paulo', brasil: 'Brasil' };
const fmt = (v: number, dec: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export function Indicadores({ s }: { s: GameState }) {
  const [sphere, setSphere] = useState<Sphere>(playerSphere(s));
  const defs = INDICATORS.filter((d) => d.sphere === sphere);
  const st = s.indicators;
  const pending = (st?.pending ?? []).filter((p) => indicatorById(p.ind)?.sphere === sphere);
  const hist = st?.history ?? [];
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Indicadores sociais</h2>
          <p>Como estão a cidade, o estado e o país — e quanto disso vem do seu trabalho.</p>
        </div>
      </div>
      <div className="pill-row" style={{ marginBottom: 12 }}>
        {(Object.keys(SPHERE_LABEL) as Sphere[]).map((k) => (
          <button key={k} className="btn btn-sm" style={sphere === k ? { background: 'var(--accent)', color: '#fff', borderColor: 'transparent' } : undefined} onClick={() => setSphere(k)}>{SPHERE_LABEL[k]}{playerSphere(s) === k && s.player.mandate ? ' · seu mandato' : ''}</button>
        ))}
      </div>

      <GovCard s={s} sphere={sphere} />

      <div className="grid g-3">
        {defs.map((d) => {
          const v = indicatorValue(s, d.id);
          const ch = indicatorChange(s, d.id);
          const mine = playerEffect(s, d.id);
          const good = ch >= 0;
          return (
            <div key={d.id} className="card">
              <div className="small muted">{d.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, margin: '4px 0' }}>{fmt(v, d.decimals)} <span className="small muted" style={{ fontWeight: 400 }}>{d.unit}</span></div>
              <div className="small" style={{ color: Math.abs(ch) < 0.05 ? undefined : good ? 'var(--blue)' : 'var(--red)' }}>
                {Math.abs(ch) < 0.05 ? 'Estável' : `${good ? 'Melhorou' : 'Piorou'} ${fmt(Math.abs(ch), 1)}%`} desde o dado de partida ({fmt(d.base, d.decimals)} em {d.year})
              </div>
              {Math.abs(mine) >= 10 ** -d.decimals / 2 && <div className="small" style={{ color: 'var(--accent)', marginTop: 2 }}>Seu efeito: {mine > 0 ? '+' : ''}{fmt(mine, d.decimals)} {d.unit}</div>}
              <div className="small muted" style={{ marginTop: 6 }}><b>Competência:</b> {d.competence}</div>
              <div className="small muted"><b>Como influenciar:</b> {d.levers}</div>
              <div className="small muted" style={{ marginTop: 4 }}><span className="tag real" style={{ marginRight: 4 }}>DADO REAL</span>{d.source}</div>
            </div>
          );
        })}
      </div>

      {sphere === 'cidade' && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Por região da capital</h3>
          <div className="table-wrap"><table>
            <thead><tr><th>Região</th>{REGIONAL_IDS.map((id) => <th key={id} className="num">{indicatorById(id)!.label}<div><span className={`tag ${REGIONAL_REAL.has(id) ? 'real' : 'proposta'}`}>{REGIONAL_REAL.has(id) ? 'DADO REAL' : 'PARÂMETRO'}</span></div></th>)}</tr></thead>
            <tbody>{REGIONS.map((r) => (
              <tr key={r.id} className={r.id === s.player.homeRegion ? 'mine' : ''}>
                <td><b>{r.name}</b>{r.id === s.player.homeRegion && <span className="tag ok" style={{ marginLeft: 4 }}>sua base</span>}<div className="small muted">renda {r.income}</div></td>
                {REGIONAL_IDS.map((id) => { const d = indicatorById(id)!; const ex = st?.mineRegion[r.id]?.[id] ?? 0; return <td key={id} className="num">{fmt(regionalValue(s, id, r.id), d.decimals)}{ex > 0.05 && <div className="small" style={{ color: 'var(--accent)' }}>seu efeito: {fmt(ex, 1)}%</div>}</td>; })}
              </tr>
            ))}</tbody>
          </table></div>
          <p className="small muted">Mortalidade infantil e homicídios: {SUBPREF_SOURCE}, agregados por região pela população (Censo 2022). Deslocamento: {MOBILITY_SOURCE}, por zona. Colunas marcadas como PARÂMETRO usam a renda da região (estimativa do jogo).</p>
          <details style={{ marginTop: 8 }}>
            <summary className="small"><b>Ver as 32 subprefeituras</b></summary>
            <div className="table-wrap"><table>
              <thead><tr><th>Subprefeitura</th><th>Região do jogo</th><th className="num">Mortalidade infantil (por mil)</th><th className="num">Homicídios (por 100 mil)</th><th className="num">População (2022)</th></tr></thead>
              <tbody>{REGIONS.flatMap((r) => r.subprefeituras.map((sp) => (
                <tr key={sp.name} className={r.id === s.player.homeRegion ? 'mine' : ''}>
                  <td>{sp.name}</td><td className="small">{r.name}</td>
                  <td className="num">{fmt(subprefValue(s, 'c_mortinf', sp.name, r.id) ?? 0, 1)}</td>
                  <td className="num">{fmt(subprefValue(s, 'c_homic', sp.name, r.id) ?? 0, 1)}</td>
                  <td className="num">{sp.pop2022.toLocaleString('pt-BR')}</td>
                </tr>
              )))}</tbody>
            </table></div>
          </details>
        </div>
      )}

      <div className="grid g-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Seus efeitos em andamento</h3>
          {pending.length ? pending.slice(0, 12).map((p, i) => {
            const d = indicatorById(p.ind)!;
            return <p key={i} className="small">• <b>{p.source}</b> → {d.label.toLowerCase()}{p.region ? ` em ${REGIONS.find((r) => r.id === p.region)?.name}` : ''}: falta {fmt(p.pct, 1)}% de melhora, em {p.left} {p.left === 1 ? 'mês' : 'meses'}</p>;
          }) : <p className="small muted">Nada em andamento nesta esfera. {sphere === 'cidade' ? 'Vereador: indicações atendidas, emendas executadas e leis sancionadas.' : sphere === 'estado' ? 'Deputado estadual: emendas pagas e leis aprovadas. Governador: programas estaduais.' : 'Deputado federal/senador: emendas para o Brasil e leis aprovadas. Governo federal: ações dos ministérios.'}</p>}
        </div>
        <div className="card">
          <h3>Evolução anual</h3>
          {hist.length ? (
            <div className="table-wrap"><table>
              <thead><tr><th>Indicador</th>{hist.slice(-5).map((h) => <th key={h.year} className="num">{h.year}</th>)}</tr></thead>
              <tbody>{defs.map((d) => <tr key={d.id}><td className="small">{d.label}</td>{hist.slice(-5).map((h) => <td key={h.year} className="num small">{h.values[d.id] !== undefined ? fmt(h.values[d.id], d.decimals) : '—'}</td>)}</tr>)}</tbody>
            </table></div>
          ) : <p className="small muted">O primeiro fechamento anual sai em dezembro.</p>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Regras</h3>
        {[...INDICATOR_RULES, ...GOVPROFILE_RULES].map((r) => <p key={r} className="small">{r}</p>)}
      </div>
    </>
  );
}

function GovCard({ s, sphere }: { s: GameState; sphere: Sphere }) {
  const g = governments(s)[sphere];
  const party = g.partyId ? partyById(g.partyId) : null;
  const prof = aiModeled(g) ? profileForParty(g.partyId) : null;
  const top = prof ? (Object.keys(prof.priority) as GovArea[]).sort((a, b) => prof.priority[b] - prof.priority[a]).slice(0, 3) : [];
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Quem governa: {g.office}</h3>
      <p className="small"><b>{g.name}</b>{party ? ` (${party.acronym})` : ''} — {g.isPlayer ? 'você' : g.real ? 'pessoa real' : 'personagem do jogo'}</p>
      {g.isPlayer && <p className="small muted">As decisões são suas: secretarias, orçamento, programas e impostos.</p>}
      {g.real && <p className="small muted">Pessoa real em exercício: o jogo não decide por ela. Os indicadores desta esfera seguem a tendência de fundo e a economia.</p>}
      {prof && (
        <>
          <p className="small"><span className="tag proposta" style={{ marginRight: 4 }}>PERFIL DO PARTIDO</span>{prof.summary}</p>
          {prof.classified && <p className="small muted">Postura fiscal: {prof.fiscal === 'ajuste' ? 'ajuste' : prof.fiscal === 'expansao' ? 'expansão' : 'neutra'} · Impostos: {prof.tax} · Segurança: {prof.security} · Mais peso em: {top.map((a) => GOV_AREA_LABEL[a]).join(', ')}</p>}
        </>
      )}
    </div>
  );
}
