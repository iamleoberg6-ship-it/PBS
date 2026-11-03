import { useState } from 'react';
import {
  ACHIEVEMENTS, LAST_YEAR, REGIONS, RESPONSE_LABEL, STATE_AREAS, STATE_SOURCES, UPPER_LABEL, careerScore, cityAlignment, formatIsoPt, genCycle, genRulepack,
  monthIndex, monthLabel, outletById, partyById, previewEligibility, promiseCapacity, upperSummary,
  type CrisisResponse, type GameState, type GeneralElectionRecord, type MajRoundResult, type ProportionalResult,
} from '../engine';
import { num, partyColor, pct } from './format';
import { Checks, Polls } from './pages';

type Act = (id: string, param?: string) => void;
const acr = (id: string) => partyById(id)?.acronym ?? id;

function Seats({ title, seats, total, source }: { title: string; seats: Record<string, number>; total: number; source: string }) {
  const rows = Object.entries(seats).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const dots = rows.flatMap(([id, n]) => Array.from({ length: n }, () => id));
  return (
    <div className="card">
      <div className="card-title"><h3>{title}</h3><span className="small muted">{total} cadeiras</span></div>
      <div className="hemicycle">{dots.map((id, i) => <span key={i} className="seat" style={{ background: partyColor(id) }} />)}</div>
      <div className="pill-row" style={{ marginTop: 8 }}>{rows.map(([id, n]) => <span key={id} className="tag" style={{ borderLeft: `4px solid ${partyColor(id)}` }}>{acr(id)} {n}</span>)}</div>
      <p className="small muted" style={{ marginTop: 8 }}>{source}</p>
    </div>
  );
}

function Round({ r, title, seats }: { r: MajRoundResult; title: string; seats?: number }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {r.ranking.slice(0, 6).map((c, i) => (
        <div key={c.id} style={{ marginBottom: 9 }}>
          <div className="meter-label"><span style={{ color: 'var(--ink)' }}><b>{c.id === 'character_player' ? `${c.name} (você)` : c.name}</b> · {c.label}{seats && i < seats ? ' · eleito(a)' : ''}</span><span className="mono">{pct(c.share)}</span></div>
          <div className={`bar ${c.id === 'character_player' ? 'gold' : 'blue'}`}><i style={{ width: `${c.share * 100}%` }} /></div>
          <div className="small muted">{num(c.votes)} votos</div>
        </div>
      ))}
      <p className="small">{r.explanation}</p>
    </div>
  );
}

function House({ r, title }: { r: ProportionalResult; title: string }) {
  const [audit, setAudit] = useState(false);
  return (
    <div className="card">
      <div className="card-title"><h3>{title}</h3><span className="small muted">QE {num(r.electoralQuotient)} · {num(r.validVotes)} votos válidos</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Lista</th><th className="num">Votos</th><th className="num">Cadeiras</th></tr></thead>
        <tbody>{r.lists.filter((l) => l.totalSeats > 0).sort((a, b) => b.totalSeats - a.totalSeats).map((l) => <tr key={l.listId}><td className="small">{l.label}</td><td className="num">{num(l.totalVotes)}</td><td className="num">{l.totalSeats}</td></tr>)}</tbody>
      </table></div>
      <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setAudit(!audit)}>{audit ? 'Ocultar' : 'Ver'} auditoria do cálculo</button>
      {audit && <div className="audit" style={{ marginTop: 8 }}>{r.audit.map((a, i) => <div key={i} className={`p-${a.phase}`}>{a.text}</div>)}</div>}
    </div>
  );
}

function GeneralResult({ rec }: { rec: GeneralElectionRecord }) {
  const [tab, setTab] = useState<'maj' | 'alesp' | 'camara' | 'ver'>('maj');
  return (
    <>
      {rec.playerOffice && (
        <div className="card" style={{ marginBottom: 16, borderLeft: `5px solid ${rec.playerElected ? 'var(--accent)' : 'var(--red)'}` }}>
          <div className="small mono muted">SEU RESULTADO · {(UPPER_LABEL[rec.playerOffice] ?? rec.playerOffice).toUpperCase()}</div>
          <div className="big-number" style={{ margin: '6px 0' }}>{num(rec.playerVotes ?? 0)} votos</div>
          <div>{rec.playerElected ? 'Eleito(a)!' : rec.runoffPending ? 'Disputando o 2º turno.' : 'Não eleito(a).'}</div>
        </div>
      )}
      <div className="tabs">
        <button className={`tab ${tab === 'maj' ? 'active' : ''}`} onClick={() => setTab('maj')}>Governo, Senado e Presidência</button>
        <button className={`tab ${tab === 'alesp' ? 'active' : ''}`} onClick={() => setTab('alesp')}>Alesp</button>
        <button className={`tab ${tab === 'camara' ? 'active' : ''}`} onClick={() => setTab('camara')}>Câmara dos Deputados (SP)</button>
        <button className={`tab ${tab === 'ver' ? 'active' : ''}`} onClick={() => setTab('ver')}>Vereadores candidatos</button>
      </div>
      {tab === 'maj' && (
        <div className="grid g-2">
          <Round r={rec.governorFirst} title="Governador(a) — 1º turno" />
          {rec.governorRunoff && <Round r={rec.governorRunoff} title="Governador(a) — 2º turno" />}
          <Round r={rec.senate} title={`Senado (${rec.senateSeats} vaga${rec.senateSeats > 1 ? 's' : ''})`} seats={rec.senateSeats} />
          <Round r={rec.presidentRunoff ?? rec.presidentFirst} title={`Presidência — ${rec.presidentRunoff ? '2º turno' : '1º turno'} (simulação de fundo)`} />
        </div>
      )}
      {tab === 'alesp' && <House r={rec.alesp} title="Assembleia Legislativa (94 vagas)" />}
      {tab === 'camara' && <House r={rec.camara} title="Bancada de SP na Câmara dos Deputados (70 vagas)" />}
      {tab === 'ver' && (
        <div className="card">
          <h3>Vereadores de SP que disputaram</h3>
          {rec.councillorRuns.length === 0 ? <p className="small muted">Nenhum vereador (fictício) disputou neste ciclo.</p> : (
            <div className="table-wrap"><table><thead><tr><th>Vereador(a)</th><th>Partido</th><th>Cargo</th><th className="num">Votos</th><th>Resultado</th></tr></thead>
              <tbody>{rec.councillorRuns.map((r) => <tr key={r.id}><td>{r.name}</td><td>{acr(r.partyId)}</td><td className="small">{r.office === 'deputado_estadual' ? 'Alesp' : 'Câmara'}</td><td className="num">{num(r.votes)}</td><td>{r.elected ? <span className="tag ok">eleito(a) — suplente assume</span> : <span className="tag">não eleito(a)</span>}</td></tr>)}</tbody></table></div>
          )}
          <p className="small muted">Só personagens fictícios tomam decisões de carreira por iniciativa do jogo.</p>
        </div>
      )}
    </>
  );
}

function UpperPanel({ s }: { s: GameState }) {
  const m = s.player.mandate;
  const u = m?.upper;
  if (!m || !u) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title"><h3>Seu mandato</h3><span className="tag proposta">mandato abstrato</span></div>
      <p className="small">{upperSummary(s, m)}</p>
      <div className="meters">
        <div className="meter"><div className="meter-label"><span>Aprovação</span></div><div className="meter-value">{Math.round(m.approval)}</div><div className="bar"><i style={{ width: `${m.approval}%` }} /></div></div>
        <div className="meter"><div className="meter-label"><span>Relação com o Executivo</span></div><div className="meter-value">{Math.round(u.relationGov)}</div><div className="bar"><i style={{ width: `${u.relationGov}%` }} /></div></div>
        {m.office === 'governador' && <div className="meter"><div className="meter-label"><span>Base na Alesp</span></div><div className="meter-value">{u.assemblyBase ?? 0}/94</div><div className={`bar ${(u.assemblyBase ?? 0) < 48 ? 'red' : ''}`}><i style={{ width: `${((u.assemblyBase ?? 0) / 94) * 100}%` }} /></div></div>}
        {u.amendmentBudget > 0 && <div className="meter"><div className="meter-label"><span>Saldo de emendas</span></div><div className="meter-value">R$ {u.amendmentBudget} mi</div></div>}
      </div>
      {u.committeeRole && <p className="small">Cargo: <b>{u.committeeRole}</b></p>}
      {u.stateIndicators && (
        <div className="table-wrap"><table><thead><tr><th>Área estadual</th><th className="num">Indicador (simulado)</th><th>Programa</th></tr></thead>
          <tbody>{STATE_AREAS.map((a) => { const p = u.programs?.find((x) => x.area === a.id); return <tr key={a.id}><td className="small">{a.label}</td><td className="num">{Math.round(u.stateIndicators![a.id])}</td><td className="small">{p ? `${p.monthsLeft} meses p/ entrega` : '—'}</td></tr>; })}</tbody></table></div>
      )}
      {u.bills.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 8 }}><table><thead><tr><th>Projeto</th><th>Situação</th></tr></thead>
          <tbody>{[...u.bills].reverse().slice(0, 8).map((b) => <tr key={b.id}><td className="small">{b.title}</td><td>{b.status === 'tramitando' ? `tramitando (${b.monthsLeft} meses)` : b.status}</td></tr>)}</tbody></table></div>
      )}
      {u.amendments.length > 0 && <p className="small">Emendas: {u.amendments.filter((a) => a.paid).length} pagas de {u.amendments.length} indicadas.</p>}
      <p className="small muted">Simplificação declarada: Alesp, Câmara dos Deputados e Senado não têm votação nominal simulada como a Câmara Municipal; projetos e emendas têm prazos e chances de jogo.</p>
    </div>
  );
}

export function EstadoUniao({ s }: { s: GameState }) {
  const w = s.stateWorld;
  const G = genCycle(monthIndex(s.month));
  const years = [...new Set([...s.generalElections.map((e) => e.year), ...(G <= LAST_YEAR ? [G] : [])])].sort();
  const [year, setYear] = useState(G);
  const rec = s.generalElections.find((e) => e.year === year);
  const rp = genRulepack(year);
  const al = cityAlignment(s);
  const c = s.player.candidacy;
  const nowIso = `${s.month.year}-${String(s.month.month).padStart(2, '0')}-15`;
  const cal: [string, string][] = [
    [rp.desincompatibilizacao.value, 'Desincompatibilização (6 meses antes) e prazo de filiação/domicílio'],
    [rp.conventionsStart.value, 'Início das convenções'],
    [rp.registrationDeadline.value, 'Registro de candidaturas'],
    [rp.campaignStart.value, 'Início da propaganda'],
    [rp.electionDate.value, '1º turno — todos os cargos'],
    [rp.runoffDate.value, '2º turno — governador e presidente'],
    [rp.posse.presidente.value, 'Posse do(a) presidente'],
    [rp.posse.governador.value, 'Posse do(a) governador(a)'],
    [rp.posse.deputado_federal.value, 'Posse de deputados federais e senadores'],
    [rp.posse.deputado_estadual.value, 'Posse da Alesp'],
  ];
  const polls = s.polls.filter((p) => p.race === 'governador' && p.month.year === year);
  const senPolls = s.polls.filter((p) => p.race === 'senador' && p.month.year === year);
  return (
    <>
      <div className="page-head"><div><h2>Estado e União</h2><p>Governo de SP, bancadas e eleições gerais · {num(rp.stateElectorate.value)} eleitores no estado (TSE 2026)</p></div></div>
      <UpperPanel s={s} />
      <div className="grid g-3" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Governo do Estado</h3>
          <div className="big-number">{w.governor.isPlayer ? `${w.governor.name} (você)` : w.governor.name}</div>
          <p className="small">{acr(w.governor.partyId)} · {w.governor.since}–{w.governor.until} · {w.governor.consecutiveTerms}º mandato consecutivo {w.governor.real ? <span className="tag real">pessoa real · fato público</span> : <span className="tag proposta">personagem do jogo</span>}</p>
          <p className="small">Avaliação (simulada): {Math.round(w.governorApproval)} · alinhamento com a prefeitura: {pct(al.governor, 0)}</p>
        </div>
        <div className="card">
          <h3>Presidência</h3>
          <div className="big-number">{w.president.name}</div>
          <p className="small">{acr(w.president.partyId)} · {w.president.since}–{w.president.until} {w.president.real ? <span className="tag real">pessoa real · fato público</span> : <span className="tag proposta">personagem do jogo</span>}</p>
          <p className="small">Avaliação (simulada): {Math.round(w.presidentApproval)} · alinhamento com a prefeitura: {pct(al.president, 0)}</p>
        </div>
        <div className="card">
          <h3>Senadores por SP</h3>
          {w.senators.map((x) => <p key={x.id} className="small"><b>{x.isPlayer ? `${x.name} (você)` : x.name}</b> · {acr(x.partyId)} · até {x.until + 1} {x.real ? <span className="tag real">real</span> : <span className="tag proposta">fictício</span>}</p>)}
        </div>
      </div>
      <p className="small muted" style={{ marginBottom: 12 }}>{STATE_SOURCES.executivos} {STATE_SOURCES.vereadores2026} A avaliação dos governos é um número do jogo, não pesquisa real. Alinhamento político pesa nos convênios da prefeitura (mecânica de jogo).</p>
      <div className="grid g-2" style={{ marginBottom: 16 }}>
        <Seats title="Alesp" seats={w.alespSeats} total={94} source={s.generalElections.length ? 'Composição resultante da simulação.' : STATE_SOURCES.alesp} />
        <Seats title="Bancada paulista na Câmara" seats={w.camaraSeats} total={70} source={s.generalElections.length ? 'Composição resultante da simulação.' : STATE_SOURCES.camara} />
      </div>
      <h2 style={{ marginTop: 8 }}>Eleições gerais de {year}</h2>
      {years.length > 1 && <div className="tabs">{years.map((y) => <button key={y} className={`tab ${y === year ? 'active' : ''}`} onClick={() => setYear(y)}>{y}</button>)}</div>}
      {rec ? <GeneralResult rec={rec} /> : (
        <>
          {polls.length > 0 && <div style={{ marginBottom: 16 }}><Polls s={s} polls={polls} title="governo de SP" /></div>}
          {senPolls.length > 0 && <div style={{ marginBottom: 16 }}><Polls s={s} polls={senPolls} title="Senado" /></div>}
          <div className="grid g-3">
            <div className="card">
              <h3>Calendário</h3>
              <div className="timeline">{cal.map(([d, t]) => <div key={d + t} className={`tl ${d < nowIso ? 'past' : ''}`}><span className="d">{formatIsoPt(d)}</span><span className="dot" /><span className="t">{t}</span></div>)}</div>
              <p className="small muted">{rp.label}. Reformas eleitorais posteriores a 2026 não são modeladas.</p>
            </div>
            <div className="card">
              <h3>Elegibilidade {c && c.year === year ? `(${UPPER_LABEL[c.office] ?? c.office})` : ''}</h3>
              <Checks checks={c && c.year === year && c.checks.length ? c.checks : previewEligibility(s, c && c.year === year ? c.office : 'deputado_estadual')} />
            </div>
            <div className="card">
              <h3>Desincompatibilização</h3>
              {rp.desincompatibilizacaoRules.map((r) => <div key={r.cargo} className="small" style={{ marginBottom: 8 }}><b>{r.cargo}</b>: {r.prazo}. <span className={`tag ${r.status === 'REGRA_REAL' ? 'real' : 'derivada'}`}>{r.status === 'REGRA_REAL' ? 'regra real' : 'derivada'}</span><div className="src">{r.source}</div></div>)}
              <p className="small">Vagas: Alesp {rp.seats.alesp.value} · Câmara {rp.seats.camaraSP.value} · Senado {rp.seats.senadoSP.value} ({rp.seats.senadoSP.source})</p>
            </div>
          </div>
        </>
      )}
    </>
  );
}

const TRUTH_LABEL = { verdadeira: 'VERDADEIRA', falsa: 'FALSA', distorcida: 'DISTORCIDA' } as const;

export function Imagem({ s, act }: { s: GameState; act: Act }) {
  const active = s.crises.filter((c) => c.status === 'ativa' && c.targetId === 'character_player');
  const mine = s.crises.filter((c) => c.targetId === 'character_player' && c.status !== 'ativa').reverse();
  const world = s.crises.filter((c) => c.targetId !== 'character_player').reverse().slice(0, 8);
  const open = s.communityPromises.filter((p) => p.status === 'aberta' || p.status === 'em_andamento');
  const closed = s.communityPromises.filter((p) => !(p.status === 'aberta' || p.status === 'em_andamento'));
  const gw = s.player.regionalGoodwill ?? {};
  return (
    <>
      <div className="page-head"><div><h2>Imagem e promessas</h2><p>Credibilidade pessoal {Math.round(s.player.credibility ?? 60)}/100 · {mine.length} crise(s) enfrentada(s) · {s.communityPromises.filter((p) => p.status === 'cumprida').length} promessa(s) cumprida(s), {s.communityPromises.filter((p) => p.status === 'quebrada').length} quebrada(s)</p></div></div>
      {active.map((c) => (
        <div key={c.id} className="card" style={{ marginBottom: 14, borderLeft: '5px solid var(--red)' }}>
          <div className="small mono muted">CRISE ATIVA · {outletById(c.outletId).name.toUpperCase()} (credibilidade {Math.round(s.outlets.find((o) => o.id === c.outletId)?.credibility ?? outletById(c.outletId).credibility)}) · PRAZO: {monthLabel({ year: Math.floor(c.deadline / 12), month: (c.deadline % 12) + 1 })}</div>
          <h3 style={{ margin: '6px 0' }}>{c.headline}</h3>
          <p className="small">Você sabe: a história é <b>{TRUTH_LABEL[c.truth]}</b> ({c.origin}). O público não sabe. Gravidade {c.severity}/100.</p>
          <div className="pill-row">{(Object.keys(RESPONSE_LABEL) as CrisisResponse[]).filter((r) => r !== 'ignorar').map((r) => <button key={r} className="btn btn-sm" disabled={s.actionPoints < 1} onClick={() => act('responder_crise', `${c.id}|${r}`)}>{RESPONSE_LABEL[r]}</button>)}</div>
          <p className="small muted" style={{ marginTop: 6 }}>Sem resposta até o prazo, conta como "não responder". Custa 1 compromisso de agenda.</p>
        </div>
      ))}
      <div className="grid g-2">
        <div className="card">
          <h3>Promessas em aberto</h3>
          {open.length === 0 ? <p className="small muted">Nenhuma. Use "Fazer promessa pública a uma comunidade" na agenda (em campanha ou com mandato).</p> : (
            <div className="table-wrap"><table><thead><tr><th>Promessa</th><th className="num">Feito</th><th>Prazo</th><th></th></tr></thead>
              <tbody>{open.map((p) => { const cap = promiseCapacity(s, p); return (
                <tr key={p.id}><td className="small">{p.text}<div className="muted">{p.context}</div></td><td className="num">{p.progress}%</td><td className="small">{monthLabel({ year: Math.floor(p.dueMonth / 12), month: (p.dueMonth % 12) + 1 })}</td>
                  <td>{cap.block ? <span className="small muted">{cap.block}</span> : <button className="btn btn-sm" disabled={s.actionPoints < 1} onClick={() => act('cumprir_promessa', p.id)}>Trabalhar (+~{cap.gain}%)</button>}</td></tr>); })}</tbody></table></div>
          )}
          {closed.length > 0 && <div className="small" style={{ marginTop: 8 }}>{closed.slice(-8).map((p) => <div key={p.id}>{p.status === 'cumprida' ? '✓' : p.status === 'quebrada' ? '✗' : '·'} {p.text} — {p.status}</div>)}</div>}
        </div>
        <div className="card">
          <h3>Boa vontade por região</h3>
          {REGIONS.map((r) => { const v = gw[r.id] ?? 0; return (
            <div key={r.id} style={{ marginBottom: 6 }}><div className="meter-label"><span>{r.name}</span><span className="mono">{v > 0 ? '+' : ''}{Math.round(v)}</span></div>
              <div className={`bar ${v < 0 ? 'red' : ''}`}><i style={{ width: `${Math.min(100, Math.abs(v))}%` }} /></div></div>); })}
          <p className="small muted">Promessas cumpridas, emendas pagas e presença em crises somam; promessas quebradas e ausência subtraem. Afeta presença, conhecimento e rejeição na próxima campanha (mecânica de jogo).</p>
        </div>
      </div>
      <div className="grid g-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Seu histórico de crises</h3>
          {mine.length === 0 ? <p className="small muted">Nenhuma até agora.</p> : mine.slice(0, 10).map((c) => <div key={c.id} className="small" style={{ marginBottom: 8 }}><b>{c.headline}</b> ({TRUTH_LABEL[c.truth].toLowerCase()}) — {c.response ? RESPONSE_LABEL[c.response] : ''}: {c.outcome}</div>)}
        </div>
        <div className="card">
          <h3>Veículos (fictícios)</h3>
          <div className="table-wrap"><table><thead><tr><th>Veículo</th><th className="num">Credibilidade</th><th className="num">Erros</th></tr></thead>
            <tbody>{s.outlets.map((o) => <tr key={o.id}><td className="small">{outletById(o.id).name}<div className="muted">{outletById(o.id).kind}</div></td><td className="num">{Math.round(o.credibility)}</td><td className="num">{o.falseStories}</td></tr>)}</tbody></table></div>
          {world.length > 0 && <><h3 style={{ marginTop: 12 }}>No mundo</h3>{world.map((c) => <div key={c.id} className="small" style={{ marginBottom: 6 }}>{c.headline} — {c.outcome}</div>)}</>}
          <p className="small muted">Crises atingem só o jogador e personagens fictícios. Direito de resposta: Lei 13.188/2015 (regra real); efeitos são mecânica de jogo.</p>
        </div>
      </div>
    </>
  );
}

export function Conquistas({ s }: { s: GameState }) {
  const have = new Map(s.achievements.map((a) => [a.id, a.month]));
  return (
    <>
      <div className="page-head"><div><h2>Conquistas e desfecho</h2><p>{s.achievements.length} de {ACHIEVEMENTS.length} conquistas · nota da trajetória {careerScore(s)}/100 (mecânica de jogo)</p></div></div>
      {s.ending && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '5px solid var(--gold)' }}>
          <div className="small mono muted">DESFECHO · {monthLabel(s.ending.month).toUpperCase()}</div>
          <h2 style={{ margin: '6px 0' }}>{s.ending.title}</h2>
          <p>{s.ending.text}</p>
          <p className="small">Nota final: {s.ending.score}/100</p>
        </div>
      )}
      <div className="grid g-3">
        {ACHIEVEMENTS.map((a) => (
          <div key={a.id} className="card" style={{ opacity: have.has(a.id) ? 1 : 0.5 }}>
            <h3>{have.has(a.id) ? '★ ' : ''}{a.title}</h3>
            <p className="small">{a.description}</p>
            {have.has(a.id) && <p className="small muted">{monthLabel(have.get(a.id)!)}</p>}
          </div>
        ))}
      </div>
      <h3 style={{ marginTop: 16 }}>Carreira</h3>
      <div className="table-wrap"><table><thead><tr><th>Cargo</th><th>De</th><th>Até</th><th>Nota</th></tr></thead>
        <tbody>{s.player.careerHistory.map((h, i) => <tr key={i}><td>{h.office}</td><td>{h.from}</td><td>{h.to ?? 'atual'}</td><td className="small">{h.note}</td></tr>)}</tbody></table></div>
    </>
  );
}
