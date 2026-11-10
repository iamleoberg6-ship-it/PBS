import { useState } from 'react';
import {
  ORIGIN_LABEL, REGIONS, adultRelatives, relationLabel, SKILL_LABEL, TASK_LABEL, TASK_SKILL, TEAM_RULES, honestyLabel, teamSummary, themeOptionsForTeam,
  type GameState, type TeamMember, type TeamSkill, type TeamTask,
} from '../engine';
import { brl } from './format';

type Act = (id: string, param?: string) => void;
const SKILLS: TeamSkill[] = ['communication', 'politicalKnowledge', 'articulation', 'management'];
const TASKS: TeamTask[] = ['redes', 'imprensa', 'base', 'atendimento', 'articulacao', 'legislativo'];

function Skills({ m, highlight }: { m: TeamMember; highlight?: TeamSkill }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 12px', margin: '6px 0' }}>
      {SKILLS.map((k) => (
        <div key={k} className="small">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: highlight === k ? 700 : 400 }}>{SKILL_LABEL[k]}</span><span className="mono">{m.skills[k]}</span></div>
          <div className="bar blue"><i style={{ width: `${m.skills[k]}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function Honesty({ v }: { v: number }) {
  const cls = v >= 55 ? '' : v >= 35 ? 'gold' : 'red';
  return (
    <div className="small" style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Honestidade (avaliação de referências)</span><span className="mono">{v} · {honestyLabel(v)}</span></div>
      <div className={`bar ${cls}`}><i style={{ width: `${v}%` }} /></div>
    </div>
  );
}

function Member({ s, m, act }: { s: GameState; m: TeamMember; act: Act }) {
  const [share, setShare] = useState('0.3');
  const isChief = m.role === 'chefe';
  const current = m.task === 'base' ? `${m.id}|base|${m.taskParam ?? s.player.homeRegion}` : m.task === 'legislativo' ? `${m.id}|legislativo|${m.taskParam ?? themeOptionsForTeam(s)[0].value}` : `${m.id}|${m.task}`;
  const opts: { value: string; label: string }[] = [
    ...(isChief ? [{ value: `${m.id}|gestao`, label: TASK_LABEL.gestao }] : []),
    ...TASKS.flatMap((t) => (t === 'base' ? REGIONS.map((r) => ({ value: `${m.id}|base|${r.id}`, label: `${TASK_LABEL.base} — ${r.name}` }))
      : t === 'legislativo' ? themeOptionsForTeam(s).map((o) => ({ value: `${m.id}|legislativo|${o.value}`, label: `${TASK_LABEL.legislativo} — ${o.label}` }))
      : [{ value: `${m.id}|${t}`, label: TASK_LABEL[t] }])),
  ];
  const status = m.status === 'fantasma' ? <span className="tag" style={{ background: 'var(--red)', color: '#fff' }}>FANTASMA</span>
    : m.status === 'relapso' ? <span className="tag" style={{ background: 'var(--gold)' }}>frequência irregular</span> : null;
  return (
    <div className="card" style={{ borderLeft: m.rachadinha > 0 ? '5px solid var(--red)' : undefined }}>
      <div className="card-title">
        <h3 style={{ fontSize: 16 }}>{m.name}</h3>
        <span className="small muted">{isChief ? 'Chefe de gabinete' : 'Assessor(a)'} · {brl(m.salary)}</span>
      </div>
      <div className="pill-row">
        <span className="tag" style={m.origin === 'parente' ? { background: 'var(--red)', color: '#fff' } : undefined}>{ORIGIN_LABEL[m.origin]}</span>{status}
        {m.rachadinha > 0 && <span className="tag" style={{ background: 'var(--red)', color: '#fff' }}>devolve {Math.round(m.rachadinha * 100)}% (ilegal)</span>}
      </div>
      <Skills m={m} highlight={TASK_SKILL[m.task]} />
      <Honesty v={m.honestyEstimate} />
      <div className="small" style={{ marginTop: 4 }}>Lealdade a você: <b className="mono">{Math.round(m.loyalty)}</b></div>
      <label className="small" style={{ display: 'block', marginTop: 8 }}>Tarefa mensal
        <select value={current} onChange={(e) => act('eq_tarefa', e.target.value)} style={{ width: '100%' }}>
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      {m.lastOutput && <p className="small" style={{ marginTop: 6 }}><span className="muted">Último mês:</span> {m.lastOutput}</p>}
      <div className="pill-row" style={{ marginTop: 8 }}>
        {m.status !== 'ativo' && <button className="btn btn-sm" onClick={() => act('eq_regularizar', m.id)}>Exigir expediente</button>}
        {m.rachadinha > 0
          ? <button className="btn btn-sm" onClick={() => act('eq_parar_rachadinha', m.id)}>Parar de cobrar devolução</button>
          : (
            <>
              <select value={share} onChange={(e) => setShare(e.target.value)} className="btn-sm">
                <option value="0.3">30%</option><option value="0.5">50%</option><option value="0.8">80%</option>
              </select>
              <button className="btn btn-sm" style={{ color: 'var(--red)' }} title="Ilegal: peculato. Custa 1 compromisso." onClick={() => act('eq_rachadinha', `${m.id}|${share}`)}>Propor rachadinha ◆</button>
            </>
          )}
        <button className="btn btn-sm" onClick={() => act('eq_exonerar', m.id)}>Exonerar</button>
      </div>
    </div>
  );
}

function Candidate({ c, act, blocked }: { c: TeamMember; act: Act; blocked: string | null }) {
  return (
    <div className="card">
      <div className="card-title">
        <h3 style={{ fontSize: 16 }}>{c.name}</h3>
        <span className="small muted">{c.role === 'chefe' ? 'para chefe de gabinete' : 'assessor(a)'} · pede {brl(c.salary)}</span>
      </div>
      <span className="tag">{ORIGIN_LABEL[c.origin]}</span>
      <Skills m={c} />
      <Honesty v={c.honestyEstimate} />
      <p className="small muted" style={{ marginTop: 4 }}>Sugestão de tarefa: {TASK_LABEL[c.task]}{c.origin === 'partido' ? ' · nomear agrada a direção do partido' : c.origin === 'cabo' ? ' · traz votos do bairro' : c.origin === 'militante' ? ' · agrada a militância' : ''}</p>
      {blocked ? <p className="small muted">{blocked}</p> : (
        <div className="pill-row" style={{ marginTop: 6 }}>
          <button className="btn btn-sm btn-primary" onClick={() => act('eq_nomear', `${c.id}|ativo`)}>Nomear</button>
          <button className="btn btn-sm" style={{ color: 'var(--red)' }} title="Ilegal: recebe sem trabalhar. Você atesta a frequência." onClick={() => act('eq_nomear', `${c.id}|fantasma`)}>Nomear como fantasma</button>
        </div>
      )}
    </div>
  );
}

export function Equipe({ s, act }: { s: GameState; act: Act }) {
  const sum = teamSummary(s);
  const t = s.player.team;
  if (!sum || !t) return <div className="card"><p>Só quem exerce mandato de vereador(a), deputado(a) ou senador(a) nomeia assessores de gabinete.</p></div>;
  const hasChief = t.members.some((m) => m.role === 'chefe');
  const devol = t.members.reduce((x, m) => x + m.salary * m.rachadinha, 0);
  const relatives = adultRelatives(s).filter((m) => !m.employedByPlayer && !m.ex);
  const block = (c: TeamMember) => (sum.slotsLeft <= 0 ? 'Equipe-chave completa.' : c.role === 'chefe' && hasChief ? 'Você já tem chefe de gabinete.' : c.salary > sum.free ? 'Não cabe na verba restante.' : null);
  return (
    <>
      <div className="page-head"><div><h2>Minha equipe de gabinete</h2><p>Assessores comissionados trabalham todo mês na tarefa que você definir — sem gastar a sua agenda.</p></div></div>
      <div className="meters">
        <div className="meter"><div className="meter-label"><span>Equipe-chave</span></div><div className="meter-value">{t.members.length} / {sum.lim.slots}</div></div>
        <div className="meter"><div className="meter-label"><span>Folha da equipe-chave</span></div><div className="meter-value" style={{ fontSize: 18 }}>{brl(sum.payroll)}</div><div className={`bar ${sum.payroll > sum.lim.budget * 0.9 ? 'gold' : ''}`}><i style={{ width: `${Math.min(100, (sum.payroll / sum.lim.budget) * 100)}%` }} /></div><div className="small muted">verba de jogo: {brl(sum.lim.budget)}/mês</div></div>
        <div className="meter"><div className="meter-label"><span>Limite real do gabinete</span></div><div className="small" style={{ marginTop: 6 }}>{sum.lim.realLimit}</div><div className="small muted">{sum.lim.source}</div></div>
        {devol > 0 && <div className="meter" style={{ borderColor: 'var(--red)' }}><div className="meter-label"><span>Rachadinha (ilegal)</span></div><div className="meter-value" style={{ fontSize: 18, color: 'var(--red)' }}>{brl(devol)}/mês</div><div className="small muted">cada mês aumenta o risco de denúncia</div></div>}
      </div>
      {t.members.length > 0 && (
        <>
          <h3 style={{ margin: '8px 0' }}>Nomeados</h3>
          <div className="grid g-3">{t.members.map((m) => <Member key={m.id} s={s} m={m} act={act} />)}</div>
        </>
      )}
      <h3 style={{ margin: '16px 0 8px' }}>Currículos do mês</h3>
      <p className="small muted">A honestidade é uma avaliação feita por referências e pode errar. Ela indica a propensão a aceitar rachadinha, a virar funcionário fantasma por conta própria — ou a denunciar uma proposta ilegal. A lista muda todo mês.</p>
      <div className="grid g-3">{t.pool.map((c) => <Candidate key={c.id} c={c} act={act} blocked={block(c)} />)}</div>
      {!t.pool.length && <p className="small muted">Novos currículos chegam no próximo mês.</p>}
      {relatives.length > 0 && (
        <div className="card" style={{ marginTop: 16, borderLeft: '5px solid var(--red)' }}>
          <h3>Parentes pedindo vaga</h3>
          <p className="small"><span className="tag" style={{ background: 'var(--red)', color: '#fff', marginRight: 6 }}>ILEGAL</span>Nomear cônjuge, companheiro(a) ou parente até o 3º grau em cargo de confiança é nepotismo: viola a Constituição (Súmula Vinculante 13 do STF) e é ato de improbidade (Lei 8.429/92, art. 11, XI). O parente ocupa uma vaga, recebe salário e a família fica feliz — mas todo mês há chance de a imprensa descobrir: exoneração, credibilidade −12 e manchete.</p>
          <div className="pill-row">{relatives.map((m) => (
            <button key={m.id} className="btn btn-sm" disabled={sum.slotsLeft <= 0} title={sum.slotsLeft <= 0 ? 'Equipe-chave completa' : ''} onClick={() => act('eq_parente', m.id)}>Nomear {m.name} ({relationLabel(m).toLowerCase()})</button>
          ))}</div>
        </div>
      )}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Regras</h3>
        {TEAM_RULES.map((r) => <p key={r} className="small">{r}</p>)}
      </div>
    </>
  );
}
