import { useState } from 'react';
import {
  AREA_BASE_2027, AREA_KEYS, FISCAL_RULES, FISCAL_SOURCES, METAS_PACKAGES, MIN_EDUCATION, MIN_HEALTH, PERSONNEL_ALERT, PERSONNEL_MAX, PERSONNEL_PRUDENTIAL,
  CREDIT_LIMIT, DEBT_LIMIT, cityPerformance, correntes, creditRatio, debtRatio, draftChecks, educationRatio, healthRatio, loaBalance, metasProgress,
  monthLabel, netDebt, partyById, performance, personnelRatio, personnelStatus, portfolioById, rclEstimate, secretariatOf, totalExpense, totalRevenue,
  type AreaKey, type GameState, type LoaBudget,
} from '../engine';

const bi = (v: number) => `R$ ${(v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bi`;
const mi = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')} mi`;
const pc = (v: number) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const TAG: Record<string, string> = { REAL: 'real', DERIVADA: 'derivada', 'SIMPLIFICAÇÃO': 'fed', 'PARÂMETRO': 'proposta' };

function Limit({ label, value, max, marks, minimum, note }: { label: string; value: number; max: number; marks?: number[]; minimum?: boolean; note: string }) {
  const scale = max * 1.25;
  const bad = minimum ? value < max : value > max;
  const warn = !bad && marks?.some((m) => value > m);
  return (
    <div className="meter">
      <div className="meter-label"><span>{label}</span><span>{minimum ? 'mínimo' : 'limite'} {pc(max)}</span></div>
      <div className="meter-value" style={{ color: bad ? 'var(--red)' : warn ? '#8a6516' : undefined }}>{pc(value)}</div>
      <div className="bar" style={{ position: 'relative' }}>
        <i style={{ width: `${Math.min(100, (value / scale) * 100)}%`, background: bad ? 'var(--red)' : warn ? 'var(--gold)' : undefined }} />
        {[...(marks ?? []), max].map((m) => <span key={m} style={{ position: 'absolute', left: `${(m / scale) * 100}%`, top: -3, width: 2, height: 12, background: 'var(--ink-2)' }} />)}
      </div>
      <div className="small muted" style={{ marginTop: 4 }}>{note}</div>
    </div>
  );
}

export function Governo({ s, openDraft, adjust }: { s: GameState; openDraft: () => void; adjust: (key: string, pct: number) => void }) {
  const c = s.city;
  const isMayor = s.player.mandate?.office === 'prefeito';
  const [tab, setTab] = useState<'financas' | 'orcamento' | 'secretarias' | 'contas' | 'regras'>('financas');
  const L = c.loa;
  const pr = personnelRatio(s);
  const expectedRev = (totalRevenue(L) / 12) * c.ytd.months;
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Prefeitura de São Paulo</h2>
          <p>{isMayor ? 'Seu governo' : `Prefeito(a): ${s.government.mayor.name} (${partyById(s.government.mayor.partyId)?.acronym})`} · exercício de {L.year} · LOA {L.status === 'base' ? 'de referência' : L.status} · {isMayor ? `aprovação ${Math.round(s.player.mandate!.approval)}` : `avaliação simulada ${Math.round(c.approval)}`}</p>
        </div>
      </div>
      <div className="tabs">
        {([['financas', 'Finanças e limites'], ['orcamento', 'Orçamento'], ['secretarias', 'Secretarias'], ['contas', 'Contas e calendário'], ['regras', 'Regras e fontes']] as const).map(([id, l]) => <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{l}</button>)}
      </div>

      {tab === 'financas' && (
        <>
          <div className="meters">
            <Limit label="Despesa com pessoal / RCL" value={pr} max={PERSONNEL_MAX} marks={[PERSONNEL_ALERT, PERSONNEL_PRUDENTIAL]} note={`LRF: alerta 54%, prudencial 57%, máximo 60% · situação: ${personnelStatus(pr)}`} />
            <Limit label="Educação (receita de impostos)" value={educationRatio(s)} max={MIN_EDUCATION} minimum note="Lei Orgânica, art. 208: 31%" />
            <Limit label="Saúde (receita de impostos)" value={healthRatio(s)} max={MIN_HEALTH} minimum note="LC 141/2012: 15%" />
            <Limit label="Dívida consolidada líquida / RCL" value={debtRatio(s)} max={DEBT_LIMIT} note="Senado, Res. 40/2001: 120%" />
            <Limit label="Operações de crédito no ano / RCL" value={creditRatio(s)} max={CREDIT_LIMIT} note="Senado, Res. 43/2001: 16%" />
          </div>
          <div className="grid g-2">
            <div className="card">
              <div className="card-title"><h3>Execução de {L.year}</h3><span className="small muted">{c.ytd.months} mês(es)</span></div>
              <table><tbody>
                <tr><td>Receita arrecadada</td><td className="num">{bi(c.ytd.revenue)}</td><td className="num small muted">previsto até agora {bi(expectedRev)}</td></tr>
                <tr><td>Despesa executada</td><td className="num">{bi(c.ytd.expense)}</td><td className="num small muted">{c.contingency > 0 ? `contingenciamento ${pc(c.contingency)}` : 'sem contingenciamento'}</td></tr>
                <tr><td><b>Resultado no ano</b></td><td className="num"><b style={{ color: c.ytd.revenue - c.ytd.expense < 0 ? 'var(--red)' : 'var(--accent)' }}>{mi(c.ytd.revenue - c.ytd.expense)}</b></td><td /></tr>
                <tr><td>Receita corrente líquida (12 meses, estimada)</td><td className="num">{bi(rclEstimate(s))}</td><td /></tr>
                <tr><td>Caixa</td><td className="num">{bi(c.cash)}</td><td /></tr>
                <tr><td>Dívida bruta · líquida</td><td className="num">{bi(c.debt)}</td><td className="num small">{bi(netDebt(c))}</td></tr>
                <tr><td>Atividade econômica (índice do jogo)</td><td className="num">{c.activity.toFixed(3)}</td><td className="num small muted">ISS e ITBI acompanham</td></tr>
              </tbody></table>
              <p className="small muted" style={{ marginTop: 8 }}>Ponto de partida real: em 2025 a cidade arrecadou R$ 123,5 bi (ISS R$ 37,5 bi; IPTU R$ 16,1 bi), RCL de R$ 100,7 bi, pessoal em 28,1% da RCL e dívida líquida em 19,6% da RCL.</p>
            </div>
            <div className="card">
              <h3>Receitas previstas na LOA {L.year}</h3>
              <table><tbody>
                {([['ISS', L.revenue.iss], ['IPTU', L.revenue.iptu], ['ITBI', L.revenue.itbi], ['Transferências (ICMS, IPVA, FPM, Fundeb, SUS…)', L.revenue.transf], ['Outras receitas correntes', L.revenue.outras], ['Operações de crédito', L.revenue.credito], ['Outras receitas de capital', L.revenue.capitalOutras]] as [string, number][]).map(([l, v]) => <tr key={l}><td>{l}</td><td className="num">{bi(v)}</td><td className="num small muted">{pc(v / totalRevenue(L))}</td></tr>)}
                <tr><td><b>Total</b></td><td className="num"><b>{bi(totalRevenue(L))}</b></td><td /></tr>
              </tbody></table>
              {c.pendingTaxes.length > 0 && <p className="small">Mudanças tributárias aprovadas: {c.pendingTaxes.map((t) => `${t.tax.toUpperCase()} ${t.change > 0 ? '+' : ''}${Math.round(t.change * 100)}% a partir de ${t.effectiveYear}`).join('; ')}.</p>}
              <p className="small muted">{L.source}</p>
            </div>
          </div>
        </>
      )}

      {tab === 'orcamento' && <Orcamento s={s} isMayor={isMayor} openDraft={openDraft} adjust={adjust} />}

      {tab === 'secretarias' && (
        <>
          <p className="small muted">Desempenho médio das pastas: <b>{cityPerformance(s) > 0.05 ? 'melhorando' : cityPerformance(s) < -0.05 ? 'piorando' : 'estável'}</b>. Secretários(as) são personagens do jogo.{isMayor ? ' Nomeie pela ação "Nomear secretário(a)".' : ''}</p>
          <div className="grid g-2">
            {AREA_KEYS.map((k) => {
              const sec = secretariatOf(s, k);
              const who = c.secretaries[k];
              const def = portfolioById(k)!;
              if (!sec) return null;
              const perf = performance(sec);
              const funding = (L.areas[k] * (1 - c.contingency * 0.6)) / (AREA_BASE_2027[k].total * c.priceLevel);
              return (
                <div className="card" key={k}>
                  <div className="card-title"><h3>{def.name}</h3><span className={`tag ${perf > 0.05 ? 'ok' : perf < -0.05 ? 'no' : ''}`}>{perf > 0.05 ? 'melhorando' : perf < -0.05 ? 'piorando' : 'estável'}</span></div>
                  <div className="small">{who ? <>{who.name} · {who.kind === 'tecnico' ? 'técnico(a)' : who.kind === 'interino' ? 'interino(a)' : `indicação do ${partyById(who.partyId ?? '')?.acronym ?? 'partido'}`} · competência {who.competence}</> : '—'}{who?.name === s.character.name && <span className="tag ok" style={{ marginLeft: 6 }}>você</span>}</div>
                  <div className="small">Orçamento {bi(L.areas[k])} · {funding < 0.97 ? <span style={{ color: 'var(--red)' }}>abaixo da referência ({pc(funding)})</span> : funding > 1.03 ? <span style={{ color: 'var(--accent)' }}>reforçado ({pc(funding)})</span> : 'na referência'} · equipe {Math.round(sec.capacity)}</div>
                  <div style={{ marginTop: 6 }}>{sec.indicators.map((i) => { const d = i.value - i.start; const good = i.better === 'up' ? d > 0 : d < 0; return <div key={i.key} className="small">{i.label}: <b>{Math.abs(i.value) >= 100 ? Math.round(i.value).toLocaleString('pt-BR') : i.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</b> {i.unit} <span style={{ color: Math.abs(d) < 1e-6 ? 'var(--ink-3)' : good ? 'var(--accent)' : 'var(--red)' }}>({d > 0 ? '+' : ''}{Math.abs(d) >= 100 ? Math.round(d).toLocaleString('pt-BR') : d.toLocaleString('pt-BR', { maximumFractionDigits: 1 })})</span></div>; })}</div>
                  <div className="small muted" style={{ marginTop: 4 }}>{sec.programs.filter((p) => p.phase !== 'entregue').length} programa(s) em andamento · {sec.programs.filter((p) => p.phase === 'entregue').length} entregue(s){sec.crisis ? ` · crise: ${sec.crisis.label}` : ''}</div>
                </div>
              );
            })}
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>Indicadores começam em valores simulados plausíveis (não são estatísticas oficiais). Cortes de orçamento aceleram a piora; reforços freiam.</p>
        </>
      )}

      {tab === 'contas' && (
        <div className="grid g-2">
          <div className="card">
            <h3>Calendário fiscal</h3>
            <table><tbody>
              <tr><td>LDO do próximo ano</td><td>até 15/04</td><td>{c.ldo[String(s.month.year + 1)]?.status ?? 'não enviada'}</td></tr>
              <tr><td>LOA do próximo ano</td><td>até 30/09 · voto até 31/12</td><td>{s.legislature.bills.find((b) => b.payload?.tipo === 'loa' && Number(b.payload.year) === s.month.year + 1)?.stage ?? 'não enviada'}</td></tr>
              <tr><td>Plano Plurianual</td><td>1º ano do mandato, com a LOA</td><td>{c.ppa ? `${c.ppa.period}: ${c.ppa.status}` : '—'}</td></tr>
              <tr><td>Programa de Metas</td><td>90 dias após a posse</td><td>{c.metas ? `${METAS_PACKAGES[c.metas.pkg]?.label} (${monthLabel(c.metas.presentedAt)})` : '—'}</td></tr>
              <tr><td>Parecer do TCM</td><td>junho (contas do ano anterior)</td><td /></tr>
              <tr><td>Julgamento na Câmara</td><td>agosto (2/3 para derrubar o parecer)</td><td /></tr>
            </tbody></table>
            {c.metas && <>
              <h4 style={{ marginTop: 12 }}>Programa de Metas — andamento</h4>
              {metasProgress(s).map((m) => <div key={m.area} className="small">{portfolioById(m.area)?.name}: {m.now > m.start + 0.1 ? <span style={{ color: 'var(--accent)' }}>meta em dia</span> : m.now < m.start - 0.05 ? <span style={{ color: 'var(--red)' }}>regredindo</span> : 'sem avanço claro'}</div>)}
            </>}
          </div>
          <div className="card">
            <h3>Histórico e contas</h3>
            {c.history.length === 0 && <p className="small muted">O primeiro exercício fecha em dezembro.</p>}
            <div className="table-wrap"><table>
              <thead><tr><th>Ano</th><th className="num">Receita</th><th className="num">Resultado</th><th className="num">Pessoal</th><th className="num">Educ.</th><th className="num">Saúde</th><th>Parecer TCM / Câmara</th></tr></thead>
              <tbody>{[...c.history].reverse().map((h) => { const t = c.tcm.find((x) => x.year === h.year); return (
                <tr key={h.year}><td>{h.year}{h.mayorWasPlayer && <span className="tag ok" style={{ marginLeft: 4 }}>você</span>}</td><td className="num">{bi(h.revenue)}</td><td className="num" style={{ color: h.result < 0 ? 'var(--red)' : undefined }}>{mi(h.result)}</td><td className="num">{pc(h.personnelRatio)}</td><td className="num">{pc(h.educationRatio)}</td><td className="num">{pc(h.healthRatio)}</td>
                  <td className="small">{t ? `${t.opinion === 'contrario' ? 'contrário' : t.opinion === 'favoravel_ressalvas' ? 'favorável c/ ressalvas' : 'favorável'} · ${t.judgment}${t.votes !== undefined ? ` (${t.votes} votos)` : ''}` : 'aguarda parecer'}</td></tr>); })}</tbody>
            </table></div>
          </div>
        </div>
      )}

      {tab === 'regras' && (
        <div className="card">
          <h3>Regras fiscais no jogo</h3>
          {FISCAL_RULES.map((r) => <div key={r.id} className="small" style={{ marginBottom: 6 }}><span className={`tag ${TAG[r.tag]}`} style={{ marginRight: 6 }}>{r.tag}</span>{r.text} <span className="muted">({r.source})</span></div>)}
          <h4 style={{ marginTop: 12 }}>Fontes dos números reais</h4>
          {FISCAL_SOURCES.map((f) => <div key={f} className="small muted">• {f}</div>)}
          <p className="small muted" style={{ marginTop: 8 }}>Parâmetros do jogo (não são previsões): inflação de 4% ao ano, crescimento real de 1,5%, custo e prazo da dívida, divisão do pessoal por área e orçamento das áreas sem fonte.</p>
        </div>
      )}
    </>
  );
}

function Orcamento({ s, isMayor, openDraft, adjust }: { s: GameState; isMayor: boolean; openDraft: () => void; adjust: (key: string, pct: number) => void }) {
  const c = s.city;
  const d = c.draft;
  const canEdit = isMayor && s.month.month >= 7 && s.month.month <= 9 && !s.legislature.bills.some((b) => b.payload?.tipo === 'loa' && Number(b.payload.year) === s.month.year + 1);
  const show: LoaBudget = canEdit && d ? d : c.loa;
  const prev = c.loa;
  const chk = canEdit && d ? draftChecks(s, d) : null;
  return (
    <>
      {isMayor && !canEdit && <div className="callout" style={{ marginBottom: 12 }}>O projeto de orçamento do ano seguinte é montado de julho a setembro e enviado até 30/09. Fora dessa janela, a tabela mostra a LOA em execução.</div>}
      {canEdit && !d && <div className="callout" style={{ marginBottom: 12 }}>A Fazenda já tem a previsão de receitas para {s.month.year + 1}. <button className="btn btn-sm btn-primary" onClick={openDraft}>Abrir rascunho da LOA {s.month.year + 1}</button></div>}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) minmax(280px, 1fr)' }}>
        <div className="card">
          <div className="card-title"><h3>{show === d ? `Projeto de LOA ${d!.year}` : `LOA ${show.year}`}</h3><span className="small muted">{show.source}</span></div>
          <div className="table-wrap" style={{ maxHeight: 'none' }}><table>
            <thead><tr><th>Área</th><th className="num">Total</th>{show === d && <th className="num">vs. {prev.year}</th>}<th>Base</th>{show === d && <th />}</tr></thead>
            <tbody>
              {AREA_KEYS.map((k: AreaKey) => (
                <tr key={k}>
                  <td>{portfolioById(k)!.name}</td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{bi(show.areas[k])}</td>
                  {show === d && <td className="num small" style={{ color: show.areas[k] < prev.areas[k] ? 'var(--red)' : undefined }}>{pc(show.areas[k] / prev.areas[k] - 1)}</td>}
                  <td>{AREA_BASE_2027[k].real ? <span className="tag real" title={AREA_BASE_2027[k].note}>ancorado em fonte</span> : <span className="tag proposta" title={AREA_BASE_2027[k].note}>estimativa</span>}</td>
                  {show === d && <td style={{ whiteSpace: 'nowrap' }}>{[-0.05, -0.01, 0.01, 0.05].map((p) => <button key={p} className="btn btn-sm" style={{ padding: '2px 6px', marginLeft: 2 }} onClick={() => adjust(k, p)}>{p > 0 ? '+' : '−'}{Math.abs(p * 100)}%</button>)}</td>}
                </tr>
              ))}
              <tr><td>Pessoal (ativos e inativos, inclui o lotado nas áreas)</td><td className="num">{bi(show.personnel)}</td>{show === d && <td />}<td /><td /></tr>
              <tr><td>Serviço da dívida</td><td className="num">{bi(show.debtService)}</td>{show === d && <td />}<td /><td /></tr>
              <tr><td>Demais órgãos (obras, administração, Câmara, encargos)</td><td className="num">{bi(show.other)}</td>{show === d && <td />}<td />{show === d && <td>{[-0.05, -0.01, 0.01, 0.05].map((p) => <button key={p} className="btn btn-sm" style={{ padding: '2px 6px', marginLeft: 2 }} onClick={() => adjust('other', p)}>{p > 0 ? '+' : '−'}{Math.abs(p * 100)}%</button>)}</td>}</tr>
              <tr><td>Reserva de contingência</td><td className="num" style={{ color: show.reserve < 0 ? 'var(--red)' : undefined }}>{bi(show.reserve)}</td>{show === d && <td />}<td /><td /></tr>
            </tbody>
          </table></div>
        </div>
        <div className="card">
          <h3>Fechamento</h3>
          <table><tbody>
            <tr><td>Receita prevista</td><td className="num">{bi(totalRevenue(show))}</td></tr>
            <tr><td>Despesa fixada (sem reserva)</td><td className="num">{bi(totalExpense(show) - show.reserve)}</td></tr>
            <tr><td>Saldo para reserva</td><td className="num" style={{ color: loaBalance({ ...show, reserve: 0 }) < 0 ? 'var(--red)' : 'var(--accent)' }}>{mi(loaBalance({ ...show, reserve: 0 }))}</td></tr>
            <tr><td>Operações de crédito previstas</td><td className="num">{bi(show.revenue.credito)} {show === d && <>{[-1, 1].map((p) => <button key={p} className="btn btn-sm" style={{ padding: '2px 6px', marginLeft: 2 }} onClick={() => adjust('credito', p)}>{p > 0 ? '+' : '−'}R$ 1 bi</button>)}</>}</td></tr>
            <tr><td>Educação / impostos</td><td className="num">{pc((show.areas.educacao * 1.12) / (correntes(show) - show.revenue.outras))}</td></tr>
            <tr><td>Saúde / impostos</td><td className="num">{pc((show.areas.saude * 0.85) / (correntes(show) - show.revenue.outras))}</td></tr>
          </tbody></table>
          {chk && (chk.ok ? <p className="small" style={{ color: 'var(--accent)' }}>O projeto fecha e cumpre os mínimos. Envie pela ação "Enviar o projeto de LOA à Câmara".</p> : chk.issues.map((i) => <p key={i} className="small" style={{ color: 'var(--red)' }}>{i}</p>))}
          <p className="small muted">Cortar uma área acelera a piora dos indicadores da pasta; reforçar freia e libera programas. A Câmara vota a LOA e costuma reestimar a receita com emendas.</p>
        </div>
      </div>
    </>
  );
}
