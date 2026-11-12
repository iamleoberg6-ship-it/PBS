/** Fase 15 — Painéis do trabalho legislativo (deputados e senador) e das regiões do estado (governador). */
import {
  STATE_REGION_STATS, MAP_STATE, UPPER_COMMITTEES, UPPER_LEG_RULES, chooseCommittee, cpiReport, giveParecer, houseOf, isChair, isLeader, legState, partyShare,
  type GameState,
} from '../engine';

type Apply = (f: (s: GameState) => GameState) => void;
const monthName = (i: number) => { const y = Math.floor((i - 1) / 12), m = ((i - 1) % 12) + 1; return `${String(m).padStart(2, '0')}/${y}`; };

export function LegislativoPanel({ s, apply }: { s: GameState; apply: Apply }) {
  const h = houseOf(s); const l = legState(s);
  if (!h || !l) return null;
  const list = UPPER_COMMITTEES[h];
  const def = list.find((c) => c.id === l.committee);
  const pend = l.relatorias.filter((r) => r.status === 'pendente');
  const done = l.relatorias.filter((r) => r.status !== 'pendente').slice(-4).reverse();
  const c = l.cpi;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title"><h3>Trabalho legislativo</h3><span className="small muted">bancada com {Math.round(partyShare(s) * 100)}% da casa</span></div>
      {!def ? (
        <>
          <p className="small">Todo parlamentar integra uma comissão permanente. Peça uma vaga: a bancada indica, respeitando a proporcionalidade. As comissões mais disputadas (CCJ e Finanças/Economia) são mais difíceis para quem chega.</p>
          {l.committeeAsked === s.month.year * 12 + s.month.month && <p className="small" style={{ color: 'var(--red)' }}>Você já pediu vaga este mês.</p>}
          <div className="committee-grid">{list.map((x) => <button key={x.id} className="btn btn-sm" disabled={l.committeeAsked === s.month.year * 12 + s.month.month} onClick={() => apply((st) => chooseCommittee(st, x.id))}><b>{x.sigla}</b> · {x.name.replace('Comissão de ', '')}</button>)}</div>
        </>
      ) : (
        <div className="pill-row" style={{ marginBottom: 8 }}>
          <span className="tag ok">Titular da {def.sigla}</span>
          <span className="small">{def.name}</span>
          {isChair(s) && <span className="tag real">Presidente da comissão até {monthName(l.chairUntil!)}</span>}
          {isLeader(s) && <span className="tag derivada">Líder da bancada até {monthName(l.leaderUntil!)}</span>}
        </div>
      )}

      {pend.length > 0 && <h4 style={{ marginTop: 12 }}>Relatorias à espera do seu parecer</h4>}
      {pend.map((r) => (
        <div key={r.id} className="relatoria">
          <div><b>{r.title}</b> {r.pec && <span className="tag">PEC</span>} <span className="tag">{r.byGov ? 'do governo' : 'de parlamentares'}</span></div>
          <p className="small">{r.summary} Prazo: até {monthName(r.month + 2)}, ou a relatoria é redistribuída.</p>
          <div className="pill-row">
            <button className="btn btn-sm btn-primary" onClick={() => apply((st) => giveParecer(st, r.id, 'favoravel'))}>Parecer favorável</button>
            <button className="btn btn-sm btn-gold" disabled={s.actionPoints < 1} onClick={() => apply((st) => giveParecer(st, r.id, 'substitutivo'))}>Substitutivo negociado (1 compromisso)</button>
            <button className="btn btn-sm" onClick={() => apply((st) => giveParecer(st, r.id, 'contrario'))}>Parecer contrário</button>
          </div>
          <p className="small muted">Favorável: a matéria vai ao plenário{r.byGov ? ' e agrada ao governo' : ''}. Substitutivo: você negocia o texto e ganha votos e credibilidade. Contrário: a comissão pode arquivar{r.byGov ? ', mas o governo não gosta' : ''}.</p>
        </div>
      ))}
      {done.length > 0 && <>
        <h4 style={{ marginTop: 12 }}>Últimas relatorias</h4>
        {done.map((r) => <div key={r.id} className="small" style={{ marginBottom: 4 }}><b>{r.title}</b> · {r.status === 'redistribuida' ? 'redistribuída (sem parecer)' : r.outcome}</div>)}
      </>}
      {def && pend.length === 0 && done.length === 0 && <p className="small muted">Nenhuma relatoria ainda. Elas chegam de fevereiro a dezembro; presidindo a comissão, chegam mais.</p>}

      {c && c.status !== 'encerrada' && (
        <div className="cpi">
          <h4>CPI: {c.label}</h4>
          {c.status === 'coletando' && <>
            <div className="bar red" style={{ margin: '6px 0' }}><i style={{ width: `${(c.signatures / c.needed) * 100}%` }} /></div>
            <p className="small">{c.signatures} de {c.needed} assinaturas (1/3 da casa). Use a ação "Colher assinaturas para uma CPI" em Trabalho do cargo.</p>
          </>}
          {c.status === 'instalada' && <p className="small">Instalada{c.relator ? ', com você na relatoria' : ''}: faltam {c.monthsLeft} mês(es). Depoimentos e documentos dão exposição e desgastam o governo.</p>}
          {c.status === 'relatorio' && <>
            <p className="small">O prazo acabou e o relatório final é seu. O relatório é enviado ao Ministério Público, que decide se abre processos.</p>
            <div className="pill-row">
              <button className="btn btn-sm btn-primary" onClick={() => apply((st) => cpiReport(st, 'duro'))}>Relatório duro: pedir indiciamentos</button>
              <button className="btn btn-sm" onClick={() => apply((st) => cpiReport(st, 'acordo'))}>Relatório brando: acordo com o governo</button>
            </div>
          </>}
        </div>
      )}
      {c?.status === 'encerrada' && <p className="small muted" style={{ marginTop: 8 }}>Última CPI ({c.label}): relatório {c.report === 'duro' ? 'duro, com pedidos de indiciamento' : 'brando'}.</p>}
      <details style={{ marginTop: 10 }}><summary className="small"><b>Regras</b></summary>{UPPER_LEG_RULES.map((r) => <div key={r} className="small">{r}</div>)}</details>
    </div>
  );
}

export function RegioesEstadoPanel({ s }: { s: GameState }) {
  const m = s.player.mandate; const u = m?.upper;
  if (!m || m.office !== 'governador' || !u) return null;
  const rows = MAP_STATE.shapes.map((x) => ({ id: x.id, name: x.name, st: STATE_REGION_STATS[x.id], inv: u.regionInvest?.[x.id] ?? 0, ap: u.regionApproval?.[x.id] ?? m.approval })).sort((a, b) => b.st.pop - a.st.pop);
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title"><h3>Regiões do estado</h3><span className="small muted">mapa em Política e país › Indicadores</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Região intermediária (IBGE)</th><th className="num">População</th><th className="num">IDHM</th><th className="num">Investido</th><th className="num">Sua aprovação</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td>{r.name}</td><td className="num">{r.st.pop.toLocaleString('pt-BR')}</td><td className="num">{r.st.idhm.toFixed(3)}</td><td className="num">{r.inv ? `R$ ${r.inv.toLocaleString('pt-BR')} mi` : '—'}</td><td className="num">{Math.round(r.ap)}</td></tr>)}</tbody>
      </table></div>
      <p className="small muted" style={{ marginTop: 6 }}>Use "Investir numa região do estado" em Trabalho do cargo. A aprovação estadual é a média das regiões, ponderada pela população. População: IBGE, Censo 2022; IDHM 2010: Atlas Brasil (derivado).</p>
    </div>
  );
}
