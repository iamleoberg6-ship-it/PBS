import { DISCRETIONARY_SHARE, SEC_RULES, freeBudget, performance, portfolioById, type GameState, type SecIndicator } from '../engine';

const PHASE_LABEL: Record<string, string> = { planejamento: 'Planejamento', licitacao: 'Licitação', execucao: 'Execução', entregue: 'Entregue', cancelado: 'Cancelado' };
const PHASES = ['planejamento', 'licitacao', 'execucao', 'entregue'];
const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('pt-BR') : (Math.round(v * 10) / 10).toLocaleString('pt-BR'));

function Indicator({ i }: { i: SecIndicator }) {
  const d = i.value - i.start;
  const good = i.better === 'up' ? d > 0 : d < 0;
  const color = Math.abs(d) < 1e-6 ? 'var(--ink-3)' : good ? 'var(--accent)' : 'var(--red)';
  return (
    <div className="meter">
      <div className="meter-label"><span>{i.label}</span><span className="tag proposta">simulado</span></div>
      <div className="meter-value">{fmt(i.value)} <span className="small muted">{i.unit}</span></div>
      <div className="small" style={{ color }}>{Math.abs(d) < 1e-6 ? 'sem mudança' : `${d > 0 ? '+' : ''}${fmt(d)} desde a posse`} · melhor quando {i.better === 'up' ? 'sobe' : 'cai'}</div>
    </div>
  );
}

const Bar = ({ label, value, red }: { label: string; value: number; red?: boolean }) => (
  <div className="meter">
    <div className="meter-label"><span>{label}</span></div>
    <div className="meter-value">{Math.round(value)}</div>
    <div className={`bar ${red ? 'red' : ''}`}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
  </div>
);

export function Secretaria({ s }: { s: GameState }) {
  const m = s.player.mandate;
  const sec = m?.secretariat;
  if (!m || !sec) return <div className="card"><p>Você não chefia uma secretaria.</p></div>;
  const def = portfolioById(sec.portfolio)!;
  const perf = performance(sec);
  const risk = sec.lowMonths >= 2 ? 'alto' : sec.lowMonths === 1 || m.relationExecutive < 35 || m.approval < 35 ? 'moderado' : 'baixo';
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Secretaria Municipal de {sec.name}</h2>
          <p>{sec.monthsInOffice} mês(es) no cargo · prefeito(a) {s.government.mayor.name} · cargo de livre nomeação e exoneração</p>
        </div>
      </div>
      {sec.crisis && <div className="callout" style={{ borderColor: 'var(--red)', marginBottom: 14 }}><b>Crise em curso:</b> {sec.crisis.label} (gravidade {sec.crisis.severity}/3). Use "Montar gabinete de crise" na agenda.</div>}

      <h3>Indicadores políticos</h3>
      <div className="meters">
        <Bar label="Aprovação da pasta" value={m.approval} red={m.approval < 35} />
        <Bar label="Relação com o prefeito" value={m.relationExecutive} red={m.relationExecutive < 35} />
        <Bar label="Relação com a Câmara" value={sec.relationCouncil} />
        <Bar label="Capacidade da equipe" value={sec.capacity} />
        <div className="meter">
          <div className="meter-label"><span>Risco de exoneração</span></div>
          <div className="meter-value" style={{ color: risk === 'alto' ? 'var(--red)' : risk === 'moderado' ? '#8a6516' : 'var(--accent)' }}>{risk}</div>
          <div className="small muted">relação com o prefeito &lt; 25 ou aprovação &lt; 28 por 3 meses</div>
        </div>
      </div>

      <h3>Indicadores sociais da pasta</h3>
      <div className="meters">{sec.indicators.map((i) => <Indicator key={i.key} i={i} />)}</div>
      <p className="small muted" style={{ marginTop: -6 }}>Desempenho geral da pasta: <b>{perf > 0.05 ? 'melhorando' : perf < -0.05 ? 'piorando' : 'estável'}</b>. Sem ação, a demanda cresce e os indicadores pioram aos poucos.</p>

      <div className="grid g-2" style={{ marginTop: 10 }}>
        <div className="card">
          <div className="card-title"><h3>Orçamento</h3><span className="tag proposta">ordem de grandeza simulada</span></div>
          <table><tbody>
            <tr><td>Orçamento anual da pasta</td><td className="num">R$ {sec.budget.toLocaleString('pt-BR')} mi</td></tr>
            <tr><td>Fatia livre para novos programas ({Math.round(DISCRETIONARY_SHARE * 100)}%)</td><td className="num">R$ {Math.round(sec.budget * DISCRETIONARY_SHARE).toLocaleString('pt-BR')} mi</td></tr>
            <tr><td><b>Disponível agora</b></td><td className="num"><b>R$ {freeBudget(sec).toLocaleString('pt-BR')} mi</b></td></tr>
            <tr><td>Executado no ano (programas e ações)</td><td className="num">R$ {Math.round(sec.executed).toLocaleString('pt-BR')} mi</td></tr>
          </tbody></table>
          <p className="small muted" style={{ marginTop: 8 }}>O restante do orçamento é custeio já comprometido (pessoal, contratos, manutenção). Não são os valores da Lei Orçamentária real.</p>
        </div>
        <div className="card">
          <h3>Programas</h3>
          {sec.programs.length === 0 && <p className="small muted">Nenhum programa lançado. Use "Lançar programa da pasta".</p>}
          {sec.programs.map((p) => (
            <div key={p.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{p.label}</b><span className={`tag ${p.phase === 'entregue' ? 'ok' : p.delayed ? 'no' : ''}`}>{PHASE_LABEL[p.phase]}{p.delayed ? ' · atrasado' : ''}</span></div>
              <div style={{ display: 'flex', gap: 3, margin: '5px 0' }}>{PHASES.map((ph, k) => <i key={ph} style={{ flex: 1, height: 6, borderRadius: 3, background: PHASES.indexOf(p.phase) >= k ? 'var(--accent)' : 'var(--paper-2)' }} />)}</div>
              <div className="small muted">R$ {p.cost} mi{p.phase !== 'entregue' ? ` · ${p.monthsLeft} mês(es) nesta fase` : ''} · efeito: {Object.entries(p.effects).map(([k, v]) => `${sec.indicators.find((i) => i.key === k)?.label.toLowerCase()} ${v > 0 ? '+' : ''}${fmt(v)}`).join('; ')}</div>
            </div>
          ))}
          <h4 style={{ marginTop: 14 }}>Catálogo da pasta</h4>
          {def.programs.map((p) => <div key={p.id} className="small" style={{ marginBottom: 4 }}><b>{p.label}</b> — R$ {p.cost} mi, ~{p.plan + p.lic + p.exec} meses. <span className="muted">{p.note}</span></div>)}
          <div className="small" style={{ marginTop: 8 }}><b>Ação própria da pasta:</b> {def.special.label} — {def.special.description}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>O que é real e o que é jogo</h3>
        {SEC_RULES.map((r, i) => <div key={i} className="small" style={{ marginBottom: 4 }}>{r}</div>)}
      </div>
    </>
  );
}
