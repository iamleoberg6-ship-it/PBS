import {
  ECONOMY_SOURCES, FEDERAL_RULES, INDEX_LABEL, MINISTRIES, availableActions, cabinetAverage, federalModeled, ministryById, officePointsFor, partyById,
  playerIsPresident, playerIsVice, playerMinistry, type FedIndex, type GameState,
} from '../engine';
import { ActionCard } from './pages';

type Act = (id: string, param?: string) => void;
const acr = (id: string | null | undefined) => (id ? partyById(id)?.acronym ?? id : 'sem partido');
const STYLE_LABEL = { coalizao: 'Coalizão ampla', misto: 'Coalizão moderada', centralizador: 'Governo centralizado' } as const;

function Meter({ label, value, note, color }: { label: string; value: number; note?: string; color?: string }) {
  return (
    <div className="meter">
      <div className="meter-label"><span>{label}</span>{note && <span>{note}</span>}</div>
      <div className="meter-value">{Math.round(value)}</div>
      <div className={`bar ${color ?? ''}`}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  );
}

function Economy({ s }: { s: GameState }) {
  const e = s.federal!.economy;
  const items: [string, string, string][] = [
    ['Inflação (12 meses)', `${e.inflation.toFixed(1)}%`, e.inflation > 4.5 ? 'acima do teto da meta' : e.inflation < 1.5 ? 'abaixo do piso da meta' : 'dentro da meta (3% ± 1,5)'],
    ['PIB (ritmo anual)', `${e.growth.toFixed(1)}%`, ''],
    ['Desocupação', `${e.unemployment.toFixed(1)}%`, ''],
    ['Selic', `${e.selic.toFixed(2).replace('.', ',')}%`, 'Banco Central autônomo'],
    ['Dívida bruta', `${e.debt.toFixed(1)}% do PIB`, ''],
    ['Resultado primário', `${e.primary >= 0 ? '+' : ''}${e.primary.toFixed(2)}% do PIB`, e.primary < 0 ? 'déficit' : 'superávit'],
    ['Política fiscal', e.stance === 'ajuste' ? 'Ajuste' : e.stance === 'expansao' ? 'Expansionista' : 'Neutra', ''],
    ['Confiança do mercado', `${Math.round(e.confidence)}`, 'mecânica de jogo'],
  ];
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Economia nacional</h3>
      <div className="grid g-4" style={{ marginTop: 8 }}>
        {items.map(([k, v, n]) => <div key={k}><div className="small muted">{k}</div><div className="mono" style={{ fontSize: 18 }}>{v}</div>{n && <div className="small muted">{n}</div>}</div>)}
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>Ponto de partida real (dados de 2025/2026); daí em diante, simulação. {ECONOMY_SOURCES.join(' ')}</p>
    </div>
  );
}

function Indices({ s }: { s: GameState }) {
  const f = s.federal!;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Áreas do governo</h3>
      <p className="small muted">Índices de jogo (0–100, partem de 50): reagem devagar às ações dos ministérios e às leis aprovadas.</p>
      <div className="meters">{(Object.keys(INDEX_LABEL) as FedIndex[]).map((k) => <Meter key={k} label={INDEX_LABEL[k]} value={f.indices[k]} color={f.indices[k] < 45 ? 'red' : ''} />)}</div>
    </div>
  );
}

function Cabinet({ s }: { s: GameState }) {
  const f = s.federal!;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title"><h3>Ministério</h3><span className="small muted">{STYLE_LABEL[f.style]} · competência média {Math.round(cabinetAverage(f))}</span></div>
      <div className="table-wrap" style={{ maxHeight: 'none' }}>
        <table>
          <thead><tr><th>Pasta</th><th>Titular</th><th>Partido</th><th>Perfil</th><th>Competência</th></tr></thead>
          <tbody>
            {MINISTRIES.map((m) => {
              const c = f.cabinet[m.id];
              return (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{c ? (c.isPlayer ? <b>Você</b> : c.name) : '—'}{c?.scandal ? <span className="tag" style={{ marginLeft: 6, background: 'var(--red)', color: '#fff' }}>escândalo</span> : null}</td>
                  <td>{c ? acr(c.partyId) : '—'}</td>
                  <td className="small">{c ? (c.kind === 'tecnico' ? 'técnico' : 'político') : ''}</td>
                  <td className="mono">{c?.competence ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>Ministros são personagens do jogo. Estrutura simplificada: 13 pastas principais (o governo real tem cerca de 38).</p>
    </div>
  );
}

function Congress({ s }: { s: GameState }) {
  const f = s.federal!;
  return (
    <div className="meters" style={{ marginBottom: 16 }}>
      <div className="meter"><div className="meter-label"><span>Base na Câmara</span><span>de 513</span></div><div className="meter-value">{f.base.camara}</div><div className="bar blue"><i style={{ width: `${(f.base.camara / 513) * 100}%` }} /></div><div className="small muted">maioria 257 · PEC 308</div></div>
      <div className="meter"><div className="meter-label"><span>Base no Senado</span><span>de 81</span></div><div className="meter-value">{f.base.senado}</div><div className="bar blue"><i style={{ width: `${(f.base.senado / 81) * 100}%` }} /></div><div className="small muted">maioria 41 · PEC 49</div></div>
      <Meter label="Humor do Congresso" value={f.mood} note="com o governo" color={f.mood < 40 ? 'red' : 'gold'} />
      <div className="meter"><div className="meter-label"><span>Coalizão</span></div><div className="small" style={{ marginTop: 6 }}>{f.coalition.map((p) => acr(p)).join(', ') || '—'}</div></div>
    </div>
  );
}

function Proposals({ s }: { s: GameState }) {
  const f = s.federal!;
  if (!f.bills.length) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Propostas do governo no Congresso</h3>
      <ul className="report-list">
        {[...f.bills].reverse().slice(0, 10).map((b) => (
          <li key={b.id}>
            <span><b>{b.kind}</b> — {b.label}</span>
            <span className="small" style={{ color: b.status === 'aprovado' ? 'var(--accent)' : b.status === 'tramitando' ? 'var(--ink-3)' : 'var(--red)' }}>{b.status === 'tramitando' ? 'em tramitação' : b.status}{b.votes ? ` · ${b.votes}` : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sanctions({ s, decide }: { s: GameState; decide: (id: string, d: 'sancionar' | 'vetar' | null) => void }) {
  const f = s.federal!;
  const open = f.sanctions.filter((x) => !x.outcome);
  const done = f.sanctions.filter((x) => x.outcome).slice(-4).reverse();
  if (!open.length && !done.length) return null;
  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: open.length ? '5px solid var(--gold)' : undefined }}>
      <h3>Sanção ou veto</h3>
      <p className="small muted">Projetos aprovados pelo Congresso. Você sanciona ou veta até o fim do mês (CF art. 66: 15 dias úteis); sem decisão, o jogo sanciona. Veto pode ser derrubado por 257 deputados e 41 senadores. Não gasta agenda.</p>
      {open.map((x) => (
        <div key={x.id} className="vote-row" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <div style={{ flex: 1, minWidth: 220 }}><b>{x.title}</b><div className="small muted">{x.summary} · apoio popular {x.support > 0.3 ? 'alto' : x.support < -0.1 ? 'baixo' : 'dividido'}</div></div>
          <button className={`btn btn-sm ${x.decision === 'sancionar' ? 'btn-primary' : ''}`} onClick={() => decide(x.id, x.decision === 'sancionar' ? null : 'sancionar')}>Sancionar</button>
          <button className={`btn btn-sm ${x.decision === 'vetar' ? 'btn-primary' : ''}`} onClick={() => decide(x.id, x.decision === 'vetar' ? null : 'vetar')}>Vetar</button>
        </div>
      ))}
      {done.map((x) => <p key={x.id} className="small" style={{ marginTop: 6 }}><b>{x.title}:</b> {x.outcome}</p>)}
    </div>
  );
}

function MinistryPanel({ s }: { s: GameState }) {
  const ms = playerMinistry(s)!;
  const def = ministryById(ms.ministry)!;
  return (
    <>
      <div className="meters">
        <Meter label="Desempenho da pasta" value={ms.performance} color={ms.performance < 35 ? 'red' : ''} />
        <Meter label="Relação com o(a) presidente" value={ms.relationPresident} color={ms.relationPresident < 30 ? 'red' : 'blue'} note={ms.relationPresident < 25 ? 'risco de exoneração' : undefined} />
        <div className="meter"><div className="meter-label"><span>Orçamento discricionário</span><span>renova em janeiro</span></div><div className="meter-value" style={{ fontSize: 20 }}>R$ {ms.budgetLeft.toFixed(1)} bi</div><div className="bar gold"><i style={{ width: `${(ms.budgetLeft / def.budget) * 100}%` }} /></div><div className="small muted">de R$ {def.budget} bi/ano (valor de jogo)</div></div>
        {ms.licensed && <div className="meter"><div className="meter-label"><span>Mandato licenciado</span></div><div className="small" style={{ marginTop: 6 }}>{ms.licensed.office === 'senador' ? 'Senador(a)' : 'Deputado(a) federal'} até {ms.licensed.until.slice(0, 4)} — o suplente está no seu lugar (CF art. 56, I).</div></div>}
      </div>
      <div className="card" style={{ margin: '12px 0 16px' }}>
        <h3>O que esta pasta faz</h3>
        <ul className="small" style={{ margin: '6px 0 0 18px' }}>{def.actions.map((a) => <li key={a.id}><b>{a.label}</b> — {a.description}{a.budget ? ` (R$ ${a.budget} bi)` : ''}{a.delay ? ` · resultado em ~${a.delay} meses` : ''}</li>)}</ul>
      </div>
      {!!s.federal!.pending.length && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Em andamento</h3>
          {s.federal!.pending.slice(0, 8).map((p, i) => <p key={i} className="small">{p.label} — resultado em {Math.max(0, p.due - (s.month.year * 12 + s.month.month - 1))} mês(es)</p>)}
        </div>
      )}
    </>
  );
}

export function GovernoFederal({ s, act, decide }: { s: GameState; act: Act; decide: (id: string, d: 'sancionar' | 'vetar' | null) => void }) {
  const f = s.federal;
  const p = s.stateWorld.president;
  if (!f) return <div className="card"><p>Dados do governo federal indisponíveis.</p></div>;
  const pres = playerIsPresident(s);
  const vice = playerIsVice(s);
  const ms = playerMinistry(s);
  const cats = pres ? ['Presidência'] : vice ? ['Vice-Presidência', 'Ministério'] : ms ? ['Ministério'] : [];
  const acts = availableActions(s).filter((a) => cats.includes(a.def.category));
  const title = pres ? 'Presidência da República' : vice ? 'Vice-Presidência da República' : ms ? ministryById(ms.ministry)!.name : 'Governo federal';
  return (
    <>
      <div className="page-head">
        <div>
          <h2>{title}</h2>
          <p>
            {pres || vice || ms ? `Agenda do cargo: ${s.officePoints ?? 0} de ${officePointsFor(s)} compromissos · ` : ''}
            Presidente: {p.isPlayer ? 'você' : p.name} ({acr(p.partyId)}){p.real ? ' — pessoa real; o governo dela não é simulado por dentro' : p.isPlayer ? '' : ' — personagem do jogo'}
            {f.vice ? ` · Vice: ${f.vice.isPlayer ? 'você' : f.vice.name}` : ''}
          </p>
        </div>
      </div>
      {pres && (
        <div className="meters" style={{ marginBottom: 16 }}>
          <Meter label="Aprovação do governo" value={s.stateWorld.presidentApproval} color={s.stateWorld.presidentApproval < 30 ? 'red' : ''} />
          {f.impeachment.stage && <div className="meter" style={{ borderColor: 'var(--red)' }}><div className="meter-label"><span>Impeachment</span></div><div className="meter-value" style={{ fontSize: 18, color: 'var(--red)' }}>{f.impeachment.stage === 'denuncia' ? 'Denúncia na Câmara' : 'Afastado(a) — julgamento no Senado'}</div></div>}
        </div>
      )}
      {pres && <Sanctions s={s} decide={decide} />}
      {ms && <MinistryPanel s={s} />}
      {acts.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Ações do cargo</h3>
          <div className="actions">{acts.map((a) => <ActionCard key={a.def.id} def={a.def} status={a.status as string | null} s={s} act={act} />)}</div>
        </div>
      )}
      {federalModeled(s) ? (
        <>
          <Congress s={s} />
          <Proposals s={s} />
          <Economy s={s} />
          <Indices s={s} />
          <Cabinet s={s} />
        </>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <p>O governo do(a) presidente em exercício, uma pessoa real, não é simulado por dentro: o jogo não decide ministérios, convites nem demissões por pessoas reais. A partir da posse de um(a) presidente personagem do jogo (ou da sua), o ministério, a coalizão e as votações passam a ser simulados.</p>
          </div>
          <Economy s={s} />
        </>
      )}
      <div className="card">
        <h3>Regras</h3>
        {FEDERAL_RULES.map((r) => <p key={r} className="small">{r}</p>)}
      </div>
    </>
  );
}
