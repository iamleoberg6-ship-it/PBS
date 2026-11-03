import {
  CAMPAIGN_RULES, REGIONS, SEGMENTS, STAFF_RANKS, STAFF_RULES, TEAM_ROLES, THEMES, THEME_LABEL, campaignFactor, demandChance, monthLabel, partyById,
  regionWeights, regionalIntention, regionPop, spendingLimit,
  type GameState, type TeamRole,
} from '../engine';
import { brl, num, pct } from './format';

type Act = (id: string, param?: string) => void;
const TAG: Record<string, string> = { REAL: 'real', PARÂMETRO: 'proposta' };

export function Campanha({ s, act }: { s: GameState; act: Act }) {
  const c = s.player.candidacy;
  const plan = c?.plan;
  const home = REGIONS.find((r) => r.id === s.player.homeRegion);
  if (!c) {
    return (
      <>
        <div className="page-head"><div><h2>Campanha</h2><p>Você mora na região {home?.name}. Pleiteie uma candidatura para montar o plano.</p></div></div>
        <Territorio s={s} />
      </>
    );
  }
  const acc = c.account;
  const total = acc.fefc + acc.donations + acc.ownFunds + (acc.fundoPartidario ?? 0);
  const limit = spendingLimit(c.office);
  const w = regionWeights();
  return (
    <>
      <div className="page-head"><div><h2>Campanha {c.year ?? 2028} — {({ prefeito: 'Prefeitura', vereador: 'Câmara Municipal', deputado_estadual: 'Assembleia Legislativa', deputado_federal: 'Câmara dos Deputados', senador: 'Senado', governador: 'Governo do Estado' } as Record<string, string>)[c.office]}</h2><p>Situação: {c.status.replace('_', ' ')} · você mora em {home?.name} · fator territorial {plan ? campaignFactor(s).toFixed(2) : '—'} (1,00 = campanha sem trabalho regional)</p></div></div>
      {!plan && <div className="callout">O plano é criado na primeira ação de pré-campanha ou campanha (ou ajuste-o abaixo).</div>}
      {plan && (
        <div className="grid g-2">
          <div className="card">
            <h3>Plano</h3>
            <div className="small muted">Regiões prioritárias (até 3)</div>
            <div className="pill-row" style={{ margin: '4px 0 10px' }}>{REGIONS.map((r) => <button key={r.id} className="btn btn-sm" style={plan.focus.includes(r.id) ? { background: 'var(--accent)', color: '#fff', borderColor: 'transparent' } : undefined} onClick={() => act('plano_campanha', `foco|${r.id}`)}>{r.name}</button>)}</div>
            <div className="small muted">Temas (até 3)</div>
            <div className="pill-row" style={{ margin: '4px 0 10px' }}>{THEMES.map((t) => <button key={t.value} className="btn btn-sm" style={plan.themes.includes(t.value) ? { background: 'var(--accent)', color: '#fff', borderColor: 'transparent' } : undefined} onClick={() => act('plano_campanha', `tema|${t.value}`)}>{THEME_LABEL[t.value]}</button>)}</div>
            <div className="small muted">Segmentos-alvo (até 2) — não associados a partidos</div>
            <div className="pill-row" style={{ margin: '4px 0 10px' }}>{SEGMENTS.map((g) => <button key={g.id} className="btn btn-sm" style={plan.segments.includes(g.id) ? { background: 'var(--accent)', color: '#fff', borderColor: 'transparent' } : undefined} onClick={() => act('plano_campanha', `seg|${g.id}`)}>{g.name}</button>)}</div>
            <div className="small muted">Tom</div>
            <div className="pill-row" style={{ marginTop: 4 }}>{(['propositivo', 'contraste', 'ataque'] as const).map((t) => <button key={t} className="btn btn-sm" style={plan.tone === t ? { background: 'var(--accent)', color: '#fff', borderColor: 'transparent' } : undefined} onClick={() => act('plano_campanha', `tom|${t}`)}>{t}</button>)}</div>
            <p className="small muted" style={{ marginTop: 8 }}>Temas que batem com as prioridades de uma região aumentam a intenção ali. Ataques tiram votos do adversário, mas sobem sua rejeição.</p>
          </div>
          <div className="card">
            <h3>Equipe e finanças</h3>
            <table><tbody>
              {(Object.keys(TEAM_ROLES) as TeamRole[]).map((k) => <tr key={k}><td>{TEAM_ROLES[k].label}</td><td>{plan.team[k] ? <span className="tag ok">contratada</span> : <span className="tag">não</span>}</td><td className="small muted">{TEAM_ROLES[k].note}</td></tr>)}
            </tbody></table>
            <table style={{ marginTop: 10 }}><tbody>
              <tr><td>FEFC (partido)</td><td className="num">{brl(acc.fefc)}</td></tr>
              <tr><td>Fundo Partidário</td><td className="num">{brl(acc.fundoPartidario ?? 0)}</td></tr>
              <tr><td>Doações de pessoas físicas</td><td className="num">{brl(acc.donations)}</td></tr>
              <tr><td>Recursos próprios</td><td className="num">{brl(acc.ownFunds)}</td></tr>
              <tr><td><b>Gasto / disponível</b></td><td className="num"><b>{brl(acc.spent)} / {brl(total)}</b></td></tr>
              <tr><td>Limite legal de gastos</td><td className="num">{brl(limit)} ({pct(acc.spent / limit, 1)})</td></tr>
            </tbody></table>
            {acc.byCategory && <div className="small muted" style={{ marginTop: 6 }}>Despesas: {Object.entries(acc.byCategory).map(([k, v]) => `${k.replace('_', ' ')} ${brl(v)}`).join(' · ')}</div>}
            {plan.accountability && <div className="callout" style={{ marginTop: 8 }}>Prestação de contas: <b>{plan.accountability.status.replace('_', ' ')}</b>{plan.accountability.notes.length ? ` — ${plan.accountability.notes.join(' ')}` : ''}</div>}
          </div>
        </div>
      )}
      {plan && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title"><h3>Mapa da campanha</h3><span className="small muted">intenção relativa = conhecimento × avaliação × temas × (1 − rejeição) × influência local</span></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Região</th><th className="num">Eleitorado (peso)</th><th>Prioridades</th><th className="num">Presença</th><th className="num">Conhecem você</th><th className="num">Rejeição</th><th className="num">Lideranças</th><th className="num">Intenção relativa</th></tr></thead>
            <tbody>{REGIONS.map((r) => { const rc = plan.regions[r.id]; return (
              <tr key={r.id} className={plan.focus.includes(r.id) ? 'mine' : ''}>
                <td><b>{r.name}</b>{r.id === s.player.homeRegion && <span className="tag ok" style={{ marginLeft: 4 }}>casa</span>}<div className="small muted">renda {r.income} (parâmetro)</div></td>
                <td className="num">{pct(w[r.id], 1)}</td>
                <td className="small">{r.priorities.map((t) => THEME_LABEL[t]).join(', ')}</td>
                <td className="num">{Math.round(rc.presence)}</td>
                <td className="num">{Math.round(rc.knowledge)}%</td>
                <td className="num">{Math.round(rc.rejection)}%</td>
                <td className="num">{rc.leaders}</td>
                <td className="num">{(regionalIntention(s, plan, r.id) * 100).toFixed(1)}</td>
              </tr>); })}</tbody>
          </table></div>
          {plan.internalPolls.length > 0 && (() => { const p = plan.internalPolls[plan.internalPolls.length - 1]; return <p className="small">Última pesquisa interna ({monthLabel(p.month)}): intenção média {p.overall.toFixed(1)}, rejeição {p.rejection.toFixed(0)}%. Melhor região: {REGIONS.slice().sort((a, b) => p.byRegion[b.id] - p.byRegion[a.id])[0].name}.</p>; })()}
        </div>
      )}
      <Territorio s={s} />
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Regras da campanha</h3>
        {CAMPAIGN_RULES.map((r, i) => <div key={i} className="small" style={{ marginBottom: 5 }}><span className={`tag ${TAG[r.tag] ?? ''}`} style={{ marginRight: 6 }}>{r.tag}</span>{r.text}</div>)}
      </div>
    </>
  );
}

function Territorio({ s }: { s: GameState }) {
  void s;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>As 8 regiões da cidade</h3>
      <div className="table-wrap"><table>
        <thead><tr><th>Região</th><th>Subprefeituras</th><th className="num">População (Censo 2022)</th><th>Nota</th></tr></thead>
        <tbody>{REGIONS.map((r) => <tr key={r.id}><td><b>{r.name}</b></td><td className="small">{r.subprefeituras.map((x) => x.name).join(', ')}</td><td className="num">{num(regionPop(r))}</td><td className="small muted">{r.note}</td></tr>)}</tbody>
      </table></div>
      <p className="small muted">População real por subprefeitura (IBGE, Censo 2022). Agrupamento em regiões, perfis de renda, prioridades e inclinações são parâmetros do jogo.</p>
    </div>
  );
}

export function GabineteParlamentar({ s, act }: { s: GameState; act: Act }) {
  const j = s.player.staff;
  if (!j) return <div className="card"><p>Você não trabalha em gabinete. Use "Buscar cargo de assessor(a) parlamentar" no Gabinete (exige filiação e confiança da direção ≥ 30).</p></div>;
  const ranks = Object.keys(STAFF_RANKS) as (keyof typeof STAFF_RANKS)[];
  return (
    <>
      <div className="page-head"><div><h2>Gabinete de {j.bossName}</h2><p>{STAFF_RANKS[j.rank].label} · {partyById(j.bossPartyId)?.acronym} · desde {monthLabel(j.since)}{j.bossReal ? ' · vereador(a) real: a relação de trabalho e as demandas são simulação do jogo' : ''}</p></div></div>
      <div className="meters">
        <div className="meter"><div className="meter-label"><span>Confiança do gabinete</span></div><div className="meter-value">{Math.round(j.trust)}</div><div className={`bar ${j.trust < 30 ? 'red' : ''}`}><i style={{ width: `${j.trust}%` }} /></div></div>
        <div className="meter"><div className="meter-label"><span>Rede de bastidores</span></div><div className="meter-value">{Math.round(j.contacts)}</div><div className="bar blue"><i style={{ width: `${j.contacts}%` }} /></div></div>
        <div className="meter"><div className="meter-label"><span>Entregas / falhas</span></div><div className="meter-value">{j.completed} / {j.failed}</div></div>
        <div className="meter"><div className="meter-label"><span>Especialidade</span></div><div className="meter-value" style={{ fontSize: 16 }}>{j.specialty ? THEME_LABEL[j.specialty] : '—'}</div></div>
        <div className="meter"><div className="meter-label"><span>Carreira</span></div><div className="small">{ranks.map((r) => <div key={r} style={{ fontWeight: r === j.rank ? 700 : 400 }}>{STAFF_RANKS[r].label} — {brl(STAFF_RANKS[r].salary)}</div>)}</div></div>
      </div>
      <div className="grid g-2">
        <div className="card">
          <h3>Demandas do mês</h3>
          {j.demands.length === 0 && <p className="small muted">Nenhuma demanda aberta.</p>}
          {j.demands.map((d) => (
            <div key={d.id} style={{ borderTop: '1px solid var(--line)', padding: '8px 0' }}>
              <b>{d.label}</b>
              <div className="small muted">Exige {d.attr === 'politicalKnowledge' ? 'conhecimento político' : d.attr === 'communication' ? 'comunicação' : d.attr === 'articulation' ? 'articulação' : 'liderança'} · dificuldade {d.difficulty} · chance {Math.round(demandChance(s, d) * 100)}% · {d.monthsLeft > 1 ? `prazo de ${d.monthsLeft} meses` : 'vence no fim do mês'}</div>
              <button className="btn btn-sm btn-primary" style={{ marginTop: 4 }} disabled={(s.officePoints ?? 0) + s.actionPoints < 1 || s.pendingEvents.length > 0} onClick={() => act('cumprir_demanda', d.id)}>Fazer (1 compromisso)</button>
            </div>
          ))}
          <p className="small muted" style={{ marginTop: 8 }}>Demanda não entregue derruba a confiança (−6). Confiança abaixo de 20 pode levar à exoneração.</p>
        </div>
        <div className="card">
          <h3>Projetos que você redigiu</h3>
          {j.draftedBills.length === 0 && <p className="small muted">Nenhum ainda. Minutas viram projetos da bancada do gabinete; se virarem lei, rendem prestígio.</p>}
          {j.draftedBills.map((id) => { const b = s.legislature.bills.find((x) => x.id === id); return b ? <div key={id} className="small">{b.number} — {b.title} · <b>{b.stage}</b></div> : null; })}
          <h4 style={{ marginTop: 12 }}>Caminho até a candidatura</h4>
          <p className="small">Com confiança ≥ 60, o gabinete apoia sua pré-candidatura na convenção de 2028: base, reconhecimento e lideranças das regiões onde você organizou agenda.</p>
          <h4 style={{ marginTop: 12 }}>Regras</h4>
          {STAFF_RULES.map((r) => <div key={r} className="small">{r}</div>)}
        </div>
      </div>
    </>
  );
}
