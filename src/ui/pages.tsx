import { useState } from 'react';
import {
  ATTRIBUTE_LABELS, FEDERATIONS, GAMEPLAY, PARTIES, PROFESSIONS, REAL_FIGURES, RULEPACK_BR_2028_MUN as RP, SAO_PAULO,
  availableActions, formatIsoPt, listName, monthIndex, monthLabel, partyById, partyChangeBlock, previewEligibility,
  estimateVereadorVotes, playerElectoralScore, councillorFacts, fatigueMultiplier, EXPERT_SCALE, IDEOLOGY_SOURCE, AXES, categoryLabel, generalPosition,
  REGIONS, type ActionDef, type AttributeKey, type ElectionRecord, type GameState, type Sourced,
} from '../engine';
import { brl, listColor, num, partyColor, pct } from './format';
import { Headlines, compact } from './media';
import { CausesModal } from './causes';

type Props = { s: GameState; act: (id: string, param?: string) => void };

const Meter = ({ label, value, color = '', note, onWhy }: { label: string; value: number; color?: string; note?: string; onWhy?: () => void }) => (
  <div className="meter" onClick={onWhy} style={onWhy ? { cursor: 'pointer' } : undefined} title={onWhy ? 'Clique para ver por que mudou' : undefined}>
    <div className="meter-label"><span>{label}</span>{note && <span>{note}</span>}</div>
    <div className="meter-value">{Math.round(value)}</div>
    <div className={`bar ${color}`}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    {onWhy && <div className="small muted" style={{ marginTop: 4 }}>por que mudou? ›</div>}
  </div>
);

export function LogList({ s, limit, kinds }: { s: GameState; limit?: number; kinds?: string[] }) {
  const items = [...s.log].reverse().filter((l) => !kinds || kinds.includes(l.kind)).slice(0, limit);
  return (
    <div className="log">
      {items.map((l, i) => (
        <div key={i} className={`log-item k-${l.kind}`}>
          <div className="when">{monthLabel(l.month)}</div>
          {l.text}
        </div>
      ))}
    </div>
  );
}

function ActionCard({ def, status, s, act }: { def: ActionDef; status: string | null; s: GameState; act: Props['act'] }) {
  const opts = def.params?.(s) ?? [];
  const [param, setParam] = useState<string>('');
  const value = param || opts[0]?.value || '';
  const disabled = status !== null || s.actionPoints < def.cost || s.pendingEvents.length > 0 || (def.params && opts.length === 0);
  return (
    <div className={`action ${status ? 'blocked' : ''}`}>
      <div className="action-head"><b>{def.label}</b><span className="cost">{def.cost === 0 ? 'livre' : '●'.repeat(def.cost)}</span></div>
      <p>{def.description}</p>
      {status && <span className="why">{status}</span>}
      {!status && def.fatigue !== false && (() => { const f = fatigueMultiplier(s, def.id); return f.mult < 1 ? <span className="small" style={{ color: '#8a6516' }}>Rendimento {Math.round(f.mult * 100)}%: {f.reason}</span> : null; })()}
      <div className="action-row">
        {def.params && opts.length > 0 && (
          <select value={value} onChange={(e) => setParam(e.target.value)} disabled={status !== null} aria-label={def.paramLabel}>
            {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        <button className="btn btn-sm btn-primary" disabled={!!disabled} onClick={() => act(def.id, value || undefined)}>Fazer</button>
      </div>
    </div>
  );
}

export function Gabinete({ s, act }: Props) {
  const [why, setWhy] = useState<string | null>(null);
  const p = s.player;
  const m = p.mandate;
  const acts = availableActions(s);
  const ORDER = ['Prefeitura', 'Secretaria', 'Mandato de vereador', 'Assessoria', 'Campanha', 'Pré-candidatura', 'Partido', 'Vida e carreira'];
  const groups = [...new Set(acts.map((a) => a.def.category))].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const party = p.partyId ? partyById(p.partyId) : null;
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Gabinete</h2>
          <p>{m ? `${m.office === 'vereador' ? 'Vereador(a)' : m.office === 'prefeito' ? 'Prefeito(a)' : `Secretário(a) de ${m.portfolio}`} de São Paulo` : p.job === 'assessor' ? 'Assessor(a) parlamentar' : PROFESSIONS[s.character.profession].label}
            {party ? ` · ${party.acronym}` : ' · sem partido'}
            {p.candidacy ? ` · candidatura a ${p.candidacy.office === 'prefeito' ? 'prefeito(a)' : 'vereador(a)'}: ${p.candidacy.status.replace('_', ' ')}` : ''}</p>
        </div>
      </div>
      <div className="meters">
        <Meter label="Reconhecimento" value={p.recognition} note="cidade" onWhy={() => setWhy('recognition')} />
        <Meter label="Base social" value={p.base} color="gold" onWhy={() => setWhy('base')} />
        <Meter label="Popularidade" value={s.character.attributes.popularity} color="blue" onWhy={() => setWhy('popularity')} />
        {party && <Meter label={`Confiança da direção (${party.acronym})`} value={p.partyRel.leadershipTrust} color="blue" onWhy={() => setWhy('leadershipTrust')} />}
        {party && <Meter label="Influência no partido" value={p.partyRel.influence} color="gold" onWhy={() => setWhy('partyInfluence')} />}
        {m && <Meter label={m.office === 'prefeito' ? 'Aprovação do governo' : 'Aprovação do mandato'} value={m.approval} onWhy={() => setWhy('approval')} />}
        {m && m.office !== 'prefeito' && <Meter label="Relação com a prefeitura" value={m.relationExecutive} color="blue" />}
        {m?.secretariat && <Meter label="Relação com a Câmara" value={m.secretariat.relationCouncil} color="gold" />}
        {m?.office === 'prefeito' && <Meter label="Base na Câmara" value={(m.councilBase / 55) * 100} note={`${m.councilBase}/55`} color={m.councilBase >= 28 ? '' : 'red'} />}
        {p.candidacy?.status === 'registrada' && <Meter label="Força de campanha" value={playerElectoralScore(s)} color="gold" note={p.candidacy.office === 'vereador' ? `~${num(estimateVereadorVotes(playerElectoralScore(s)))} votos` : ''} />}
      </div>
      <div className="grid g-main">
        <div className="card">
          <div className="card-title"><h3>Agenda do mês</h3><span className="small muted">{s.actionPoints} de {GAMEPLAY.actionPointsPerMonth.value} compromissos livres</span></div>
          {groups.map((g) => (
            <div className="action-group" key={g}>
              <h4>{g}</h4>
              <div className="actions">
                {acts.filter((a) => a.def.category === g).map((a) => <ActionCard key={a.def.id} def={a.def} status={a.status as string | null} s={s} act={act} />)}
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          {why && <CausesModal s={s} indicator={why} onClose={() => setWhy(null)} />}
          <h3>Manchetes</h3>
          <Headlines s={s} />
          <h3>Registro</h3>
          <LogList s={s} limit={12} />
        </div>
      </div>
    </>
  );
}

export function Personagem({ s }: { s: GameState }) {
  const c = s.character;
  return (
    <>
      <div className="page-head"><div><h2>{c.name}</h2><p>{PROFESSIONS[c.profession].label} · nascido(a) em {formatIsoPt(c.birthDate)} · {c.education} · domicílio eleitoral: São Paulo</p></div></div>
      <div className="grid g-2">
        <div className="card">
          <h3>Atributos</h3>
          {(Object.keys(ATTRIBUTE_LABELS) as AttributeKey[]).map((k) => (
            <div key={k} style={{ marginBottom: 10 }}>
              <div className="meter-label"><span>{ATTRIBUTE_LABELS[k]}</span><span className="mono">{Math.round(c.attributes[k])}</span></div>
              <div className={`bar ${k === 'popularity' ? 'blue' : ''}`}><i style={{ width: `${c.attributes[k]}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Finanças pessoais</h3>
          <dl className="kv">
            <dt>Caixa disponível</dt><dd>{brl(s.finances.cash)}</dd>
            <dt>Renda mensal</dt><dd>{brl(s.finances.monthlyIncome)}</dd>
            <dt>Despesas mensais</dt><dd>{brl(s.finances.monthlyExpenses)}</dd>
            <dt>Bens (imóveis, veículos, aplicações)</dt><dd>{brl(s.finances.assets)}</dd>
            <dt>Dívidas</dt><dd>{brl(s.finances.debts)}</dd>
            <dt><b>Patrimônio líquido</b></dt><dd><b>{brl(s.finances.netWorth)}</b></dd>
          </dl>
          {s.player.candidacy && (
            <>
              <h3 style={{ marginTop: 18 }}>Conta de campanha</h3>
              <dl className="kv">
                <dt>FEFC (do partido)</dt><dd>{brl(s.player.candidacy.account.fefc)}</dd>
                <dt>Doações</dt><dd>{brl(s.player.candidacy.account.donations)}</dd>
                <dt>Recursos próprios</dt><dd>{brl(s.player.candidacy.account.ownFunds)}</dd>
                <dt>Gasto</dt><dd>{brl(s.player.candidacy.account.spent)}</dd>
              </dl>
            </>
          )}
          <p className="small muted" style={{ marginTop: 12 }}>Dinheiro pessoal, caixa do partido e conta de campanha são contas separadas.</p>
        </div>
        <div className="card">
          <h3>Posições políticas</h3>
          <div className="small muted" style={{ marginBottom: 8 }}>Posição geral: {generalPosition(c.ideology)?.toLocaleString('pt-BR') ?? '—'} · {categoryLabel(generalPosition(c.ideology))}</div>
          {AXES.map((ax) => (
            <div key={ax.id} style={{ marginBottom: 8 }}>
              <div className="meter-label"><span>{ax.label}</span><span className="mono">{c.ideology[ax.id] > 0 ? '+' : ''}{c.ideology[ax.id]}</span></div>
              <div style={{ position: 'relative', height: 6, background: 'var(--paper-2)', borderRadius: 3 }}><i style={{ position: 'absolute', left: `calc(${(c.ideology[ax.id] + 100) / 2}% - 4px)`, top: -2, width: 8, height: 10, borderRadius: 2, background: 'var(--ink)' }} /></div>
              <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{ax.minus}</span><span>{ax.plus}</span></div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Trajetória</h3>
          {s.player.careerHistory.length === 0 && <p className="muted">Nenhum cargo público ainda.</p>}
          {s.player.careerHistory.map((h, i) => <div key={i} className="log-item k-mandato" style={{ marginBottom: 8 }}><b>{h.office}</b><div className="small muted">{h.from} → {h.to ?? 'atual'} · {h.note}</div></div>)}
          <h3 style={{ marginTop: 16 }}>Filiações</h3>
          {s.player.partyHistory.length === 0 && <p className="muted">Nunca foi filiado(a).</p>}
          {s.player.partyHistory.map((h, i) => <div key={i} className="small" style={{ marginBottom: 4 }}><b>{partyById(h.partyId)?.acronym}</b> · {formatIsoPt(h.from)} → {h.to ? formatIsoPt(h.to) : 'atual'}</div>)}
        </div>
      </div>
    </>
  );
}

export function Partidos({ s, changeParty }: { s: GameState; changeParty: (id: string | null) => void }) {
  const [confirm, setConfirm] = useState<string | null | undefined>(undefined);
  const rows = [...PARTIES].sort((a, b) => (s.government.councilSeatsByParty[b.id] ?? 0) - (s.government.councilSeatsByParty[a.id] ?? 0) || a.acronym.localeCompare(b.acronym));
  const block = confirm !== undefined ? partyChangeBlock(s, confirm) : null;
  return (
    <>
      <div className="page-head">
        <div><h2>Partidos</h2><p>30 partidos registrados no TSE e 5 federações (retrato de 30/10/2026). Filiar-se não gasta compromisso da agenda.</p></div>
        {s.player.partyId && <button className="btn" onClick={() => setConfirm(null)}>Desfiliar-se</button>}
      </div>
      <div className="grid g-main">
        <div className="card">
          <div className="table-wrap" style={{ maxHeight: 'none' }}>
            <table>
              <thead><tr><th>Sigla</th><th>Nome</th><th className="num">Nº</th><th>Federação</th><th>Posição (0–10)</th><th className="num">Vereadores SP</th><th /></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className={p.id === s.player.partyId ? 'mine' : ''}>
                    <td><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: partyColor(p.id), marginRight: 6 }} /><b>{p.acronym}</b></td>
                    <td>{p.name}</td>
                    <td className="num">{p.number}</td>
                    <td>{p.federationId ? <span className="tag fed">{FEDERATIONS.find((f) => f.id === p.federationId)!.name.replace('Federação ', '')}</span> : <span className="muted">—</span>}</td>
                    <td style={{ minWidth: 150 }} title={EXPERT_SCALE[p.id]?.basis}>
                      {EXPERT_SCALE[p.id]?.value != null ? (
                        <>
                          <div style={{ position: 'relative', height: 6, background: 'linear-gradient(90deg, #b4432f33, #e8e2d4, #2b5c8a33)', borderRadius: 3 }}>
                            <i style={{ position: 'absolute', left: `calc(${EXPERT_SCALE[p.id].value! * 10}% - 4px)`, top: -2, width: 8, height: 10, borderRadius: 2, background: 'var(--ink)' }} />
                          </div>
                          <div className="small muted">{EXPERT_SCALE[p.id].value!.toLocaleString('pt-BR')} · {categoryLabel(EXPERT_SCALE[p.id].value)}{EXPERT_SCALE[p.id].basis !== 'Valor da fonte (2022)' ? '*' : ''}</div>
                        </>
                      ) : <span className="small muted">não classificado</span>}
                    </td>
                    <td className="num">{s.government.councilSeatsByParty[p.id] ?? 0}</td>
                    <td>{p.id === s.player.partyId ? <span className="tag ok">seu partido</span> : <button className="btn btn-sm" onClick={() => setConfirm(p.id)}>Filiar-se</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <h3>Federações</h3>
            {FEDERATIONS.map((f) => (
              <div key={f.id} style={{ marginBottom: 10 }}>
                <b>{f.name}</b>
                <div className="small muted">{f.memberIds.map((id) => partyById(id)!.acronym).join(' + ')} · deferida em {formatIsoPt(f.approvedAt)}</div>
              </div>
            ))}
            <p className="small muted">Federação atua como um só partido na eleição proporcional e dura no mínimo 4 anos. Coligação só existe na eleição majoritária.</p>
          </div>
          <div className="callout">
            <b>Como a posição ideológica foi definida.</b> Escala esquerda–direita de 0 a 10 vinda de pesquisa com cientistas políticos: {IDEOLOGY_SOURCE}. O jogo não opina: usa a mesma fonte para todos. * Partido renomeado herda o valor da sigla anterior; fusão usa a média das siglas. O Missão (2025) não estava na pesquisa. As 10 dimensões detalhadas ainda são derivadas dessa escala (provisório) e serão calibradas por votações nominais.
          </div>
        </div>
      </div>
      {confirm !== undefined && (
        <div className="overlay" onClick={() => setConfirm(undefined)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{confirm ? `Filiar-se ao ${partyById(confirm)!.acronym}?` : 'Desfiliar-se?'}</h2>
            {block ? <p style={{ color: 'var(--red)' }}>{block}</p> : (
              <p>{confirm ? `A data de filiação passa a ser ${monthLabel(s.month)}. ` : ''}
                {monthIndex(s.month) >= 2028 * 12 + 3 && monthIndex(s.month) < 2029 * 12 ? 'Atenção: depois de 01/04/2028 uma nova filiação não vale para a eleição de 2028. ' : ''}
                {s.player.candidacy ? 'Sua pré-candidatura/candidatura atual será cancelada. ' : ''}
                {s.player.job === 'assessor' ? 'Você deixará o cargo de assessor. ' : ''}
                A relação com a nova direção começa baixa.</p>
            )}
            <div className="modal-options" style={{ flexDirection: 'row' }}>
              <button className="btn btn-primary" disabled={!!block} onClick={() => { changeParty(confirm ?? null); setConfirm(undefined); }}>Confirmar</button>
              <button className="btn" onClick={() => setConfirm(undefined)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const CAL: [string, string][] = [
  [RP.filiationDeadline.value, 'Prazo de filiação partidária e domicílio eleitoral'],
  [RP.conventionsStart.value, 'Início das convenções partidárias'],
  [RP.conventionsEnd.value, 'Fim das convenções'],
  [RP.registrationDeadline.value, 'Prazo para registro de candidaturas'],
  [RP.campaignStart.value, 'Início da propaganda eleitoral'],
  [RP.electionDate.value, '1º turno — prefeito(a) e vereadores'],
  [RP.runoffDate.value, '2º turno — prefeito(a), se necessário'],
  [RP.diplomaDeadline.value, 'Diplomação dos eleitos'],
  [RP.posseDate.value, 'Posse'],
];

export function Eleicoes({ s }: { s: GameState }) {
  const rec = s.elections.find((e) => e.year === 2028);
  const [tab, setTab] = useState<'camara' | 'prefeito' | 'auditoria' | 'pesquisas'>('camara');
  const nowIso = `${s.month.year}-${String(s.month.month).padStart(2, '0')}-15`;
  const c = s.player.candidacy;
  const checksV = previewEligibility(s, 'vereador');
  const checksP = previewEligibility(s, 'prefeito');
  return (
    <>
      <div className="page-head"><div><h2>Eleições municipais de 2028</h2><p>São Paulo · {num(SAO_PAULO.electorate)} eleitores · {SAO_PAULO.councilSeats} vagas na Câmara · segundo turno possível (mais de 200 mil eleitores)</p></div></div>
      {!rec && c?.status === 'registrada' && c.office === 'vereador' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="small mono muted">ESTIMATIVA INTERNA DA SUA CAMPANHA</div>
          <div className="big-number" style={{ margin: '6px 0' }}>{num(estimateVereadorVotes(playerElectoralScore(s)) * 0.7)} – {num(estimateVereadorVotes(playerElectoralScore(s)) * 1.3)} votos</div>
          <div className="small muted">Institutos não costumam medir vereador; esta é uma estimativa da sua equipe (mecânica de jogo). Referência: 20% do quociente eleitoral ≈ 21 mil votos.</div>
        </div>
      )}
      {!rec && s.polls.length > 0 && <div style={{ marginBottom: 16 }}><Polls s={s} /></div>}
      {!rec && (
        <div className="grid g-3">
          <div className="card">
            <h3>Calendário</h3>
            <div className="timeline">
              {CAL.map(([d, t]) => <div key={d + t} className={`tl ${d < nowIso ? 'past' : ''}`}><span className="d">{formatIsoPt(d)}</span><span className="dot" /><span className="t">{t}</span></div>)}
            </div>
            <p className="small muted">Datas derivadas da lei; confirmar quando o TSE publicar o calendário oficial de 2028.</p>
          </div>
          <div className="card">
            <h3>Elegibilidade: vereador(a)</h3>
            <Checks checks={c?.office === 'vereador' && c.checks.length ? c.checks : checksV} />
          </div>
          <div className="card">
            <h3>Elegibilidade: prefeito(a)</h3>
            <Checks checks={c?.office === 'prefeito' && c.checks.length ? c.checks : checksP} />
            <p className="small muted" style={{ marginTop: 10 }}>A escolha em convenção (20/07–05/08) é avaliada depois.</p>
          </div>
        </div>
      )}
      {rec && (
        <>
          {rec.playerOffice && (
            <div className="card" style={{ marginBottom: 16, borderLeft: `5px solid ${rec.playerElected ? 'var(--accent)' : 'var(--red)'}` }}>
              <div className="small mono muted">SEU RESULTADO</div>
              <div className="big-number" style={{ margin: '6px 0' }}>{num(rec.playerVotes ?? 0)} votos</div>
              <div>{rec.playerElected ? `Eleito(a) ${rec.playerOffice === 'prefeito' ? 'prefeito(a)' : 'vereador(a)'}!` : rec.runoffPending ? 'Disputando o 2º turno.' : 'Não eleito(a).'}</div>
            </div>
          )}
          <div className="tabs">
            <button className={`tab ${tab === 'camara' ? 'active' : ''}`} onClick={() => setTab('camara')}>Câmara Municipal</button>
            <button className={`tab ${tab === 'prefeito' ? 'active' : ''}`} onClick={() => setTab('prefeito')}>Prefeitura</button>
            <button className={`tab ${tab === 'auditoria' ? 'active' : ''}`} onClick={() => setTab('auditoria')}>Auditoria do cálculo</button>
            {s.polls.length > 0 && <button className={`tab ${tab === 'pesquisas' ? 'active' : ''}`} onClick={() => setTab('pesquisas')}>Pesquisas</button>}
          </div>
          {tab === 'pesquisas' && <Polls s={s} />}
          {tab === 'camara' && <CouncilResult rec={rec} />}
          {tab === 'prefeito' && <MayorResult rec={rec} />}
          <RegionalResult rec={rec} />
          {tab === 'auditoria' && rec.proportional && (
            <div className="card">
              <h3>Passo a passo da distribuição das {rec.proportional.seats} cadeiras</h3>
              <div className="pill-row" style={{ marginBottom: 10 }}><span className="tag ok">1ª fase: quociente partidário</span><span className="tag derivada">2ª fase: sobras 80/20</span><span className="tag real">3ª fase: maiores médias, todos</span></div>
              <div className="audit">{rec.proportional.audit.map((a, i) => <div key={i} className={`p-${a.phase}`}>{a.text}</div>)}</div>
            </div>
          )}
        </>
      )}
    </>
  );
}

function Polls({ s }: { s: GameState }) {
  const polls = s.polls;
  const last = polls[polls.length - 1];
  const ids = [...new Set(polls.flatMap((p) => p.results.map((r) => r.id)))];
  const nameOf = (id: string) => polls.flatMap((p) => p.results).find((r) => r.id === id)!;
  const firstRound = polls.filter((p) => p.scenario === '1º turno');
  const top = ids.filter((id) => firstRound.length && firstRound[firstRound.length - 1].results.slice(0, 4).some((r) => r.id === id) || id === 'character_player');
  return (
    <div className="grid g-main">
      <div className="card">
        <div className="card-title"><h3>Última pesquisa · prefeitura ({last.scenario})</h3><span className="small muted">{monthLabel(last.month)}</span></div>
        {last.results.map((r) => (
          <div key={r.id} style={{ marginBottom: 9 }}>
            <div className="meter-label"><span style={{ color: 'var(--ink)' }}><b>{r.id === 'character_player' ? `${r.name} (você)` : r.name}</b> · {r.label}{(() => { const f = r.id === 'character_player' ? Object.values(s.player.social.networks).reduce((a, b) => a + b, 0) : s.mayorRace?.find((m) => m.id === r.id)?.followers; return f ? ` · ${compact(f)} seguidores` : ''; })()}</span><span className="mono">{pct(r.share, 0)}</span></div>
            <div className={`bar ${r.id === 'character_player' ? 'gold' : 'blue'}`}><i style={{ width: `${r.share * 100}%` }} /></div>
          </div>
        ))}
        <div className="small muted">Brancos, nulos e indecisos: {pct(last.undecided, 0)}</div>
        {last.rejection && (
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table><thead><tr><th>Candidato(a)</th><th className="num">Conhece</th><th className="num">Rejeição</th></tr></thead>
              <tbody>{last.results.map((r) => <tr key={r.id}><td className="small">{r.id === 'character_player' ? `${r.name} (você)` : r.name}</td><td className="num">{pct(last.knowledge?.[r.id] ?? 0, 0)}</td><td className="num">{pct(last.rejection?.[r.id] ?? 0, 0)}</td></tr>)}</tbody></table>
          </div>
        )}
        {last.govEval && <div className="small" style={{ marginTop: 6 }}>Avaliação do governo municipal: ótimo/bom {pct(last.govEval.good, 0)} · regular {pct(last.govEval.regular, 0)} · ruim/péssimo {pct(last.govEval.bad, 0)}</div>}
        {last.byRegion && (
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table><thead><tr><th>Região</th><th>1º</th><th>2º</th></tr></thead>
              <tbody>{REGIONS.map((rg) => { const row = last.byRegion![rg.id] ?? []; const nm = (id: string) => last.results.find((x) => x.id === id)?.name.split(' ')[0] ?? id; return <tr key={rg.id}><td className="small">{rg.name}</td>{row.slice(0, 2).map((x) => <td key={x.id} className="small">{nm(x.id)} {pct(x.share, 0)}</td>)}</tr>; })}</tbody></table>
            <div className="small muted">Cortes regionais têm margem de erro maior que a do total.</div>
          </div>
        )}
        <p className="small" style={{ marginTop: 10 }}>{last.institute} · {num(last.sample)} entrevistas · margem de erro ±{last.marginOfError.toLocaleString('pt-BR')} p.p. (95%) · registro {last.registration}</p>
        <p className="small muted">Pesquisa é retrato do momento com margem de erro, não resultado. Registro obrigatório na Justiça Eleitoral (Lei 9.504/97 art. 33). Institutos fictícios.</p>
      </div>
      <div className="card">
        <h3>Evolução (1º turno)</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Mês</th>{top.map((id) => <th key={id} className="num">{nameOf(id).name.split(' ')[0]}</th>)}</tr></thead>
            <tbody>
              {[...firstRound].reverse().map((p, i) => (
                <tr key={i}><td className="small">{monthLabel(p.month).replace(' de ', '/').slice(0, 3)}/{String(p.month.year).slice(2)}</td>
                  {top.map((id) => { const r = p.results.find((x) => x.id === id); return <td key={id} className="num">{r ? pct(r.share, 0) : '—'}</td>; })}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Checks({ checks }: { checks: { id: string; ok: boolean; label: string; detail: string; source: string }[] }) {
  return (
    <div className="checks">
      {checks.map((c) => (
        <div key={c.id} className={`check ${c.ok ? '' : 'bad'}`}>
          <span className="ico">{c.ok ? '✓' : '✗'}</span>
          <div><b>{c.label}</b><div className="small">{c.detail}</div><div className="src">{c.source}</div></div>
        </div>
      ))}
    </div>
  );
}

function RegionalResult({ rec }: { rec: ElectionRecord }) {
  if (!rec.playerVotesByRegion && !rec.mayorByRegion) return null;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Apuração por região</h3>
      <div className="table-wrap"><table>
        <thead><tr><th>Região</th>{rec.playerVotesByRegion && <th className="num">Seus votos</th>}{rec.mayorByRegion && <th>Prefeito: 1º colocado</th>}{rec.mayorByRegion && <th>2º colocado</th>}</tr></thead>
        <tbody>{REGIONS.map((r) => (
          <tr key={r.id}><td>{r.name} <span className="small muted">({r.subprefeituras.map((x) => x.name).join(', ')})</span></td>
            {rec.playerVotesByRegion && <td className="num">{num(rec.playerVotesByRegion[r.id] ?? 0)}</td>}
            {rec.mayorByRegion && (rec.mayorByRegion[r.id] ?? []).slice(0, 2).map((x) => <td key={x.id} className="small">{x.name} {pct(x.share, 0)}</td>)}
          </tr>))}</tbody>
      </table></div>
      <p className="small muted">Distribuição regional simulada a partir do trabalho de campanha e de parâmetros do jogo; a população das regiões vem do Censo 2022.</p>
    </div>
  );
}

function CouncilResult({ rec }: { rec: ElectionRecord }) {
  const r = rec.proportional!;
  const playerSeat = r.elected.find((e) => e.candidateId === 'character_player');
  return (
    <div className="grid g-main">
      <div className="card">
        <div className="card-title"><h3>Resultado por partido/federação</h3><span className="small mono">QE = {num(r.electoralQuotient)}</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Agremiação</th><th className="num">Votos</th><th className="num">× QE</th><th className="num">QP</th><th className="num">1ª</th><th className="num">2ª</th><th className="num">3ª</th><th className="num">Cadeiras</th></tr></thead>
            <tbody>
              {r.lists.filter((l) => l.totalVotes > 0).map((l) => (
                <tr key={l.listId}>
                  <td><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: listColor(l.listId), marginRight: 6 }} />{l.label}</td>
                  <td className="num">{num(l.totalVotes)}</td>
                  <td className="num">{(l.totalVotes / r.electoralQuotient).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                  <td className="num">{l.partyQuotient}</td>
                  <td className="num">{l.seatsQP}</td>
                  <td className="num">{l.seatsPhase2}</td>
                  <td className="num">{l.seatsPhase3 + l.seatsArt111}</td>
                  <td className="num"><b>{l.totalSeats}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>Votação nominal mínima: {num(r.nominalMinPhase1Votes)} (10% do QE) na 1ª fase; {num(r.candidateMinPhase2Votes)} (20%) nas sobras, para partidos com pelo menos {num(r.partyMinPhase2Votes)} votos (80% do QE).</p>
      </div>
      <div className="card">
        <h3>Os 55 eleitos</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Candidato(a)</th><th className="num">Votos</th></tr></thead>
            <tbody>
              {[...r.elected].sort((a, b) => b.candidateVotes - a.candidateVotes).map((e) => (
                <tr key={e.candidateId} className={e.candidateId === 'character_player' ? 'mine' : ''}>
                  <td className="mono small">{e.seatNumber}</td>
                  <td>{e.candidateName} {e.candidateId.startsWith('real_ver_') && <span className="tag real">real</span>}<div className="small muted">{partyById(rec.candidatePartyById[e.candidateId])?.acronym ?? listName(e.listId)} · {e.phase === 'QP' ? 'quociente' : e.phase === 'SOBRAS_80_20' ? 'sobras 80/20' : 'última fase'}</div></td>
                  <td className="num">{num(e.candidateVotes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rec.playerOffice === 'vereador' && !playerSeat && <p className="small" style={{ marginTop: 8 }}>Você não está entre os eleitos. Compare seus votos com o último eleito do seu partido/federação.</p>}
      </div>
    </div>
  );
}

function MayorResult({ rec }: { rec: ElectionRecord }) {
  const rounds = [rec.mayorFirst, rec.mayorRunoff].filter(Boolean);
  return (
    <div className="grid g-2">
      {rounds.map((r, i) => (
        <div className="card" key={i}>
          <h3>{i === 0 ? '1º turno' : '2º turno'}</h3>
          {r!.ranking.map((c) => (
            <div key={c.id} style={{ marginBottom: 10 }}>
              <div className="meter-label"><span style={{ color: 'var(--ink)' }}><b>{c.id === 'character_player' ? `${c.name} (você)` : c.name}</b> · {c.label}</span><span className="mono">{pct(c.share)}</span></div>
              <div className={`bar ${c.id === 'character_player' ? 'gold' : 'blue'}`}><i style={{ width: `${c.share * 100}%` }} /></div>
              <div className="small muted">{num(c.votes)} votos</div>
            </div>
          ))}
          <p className="small">{r!.explanation}</p>
        </div>
      ))}
      {rec.runoffPending && <div className="callout">2º turno em 29/10/2028. Faça campanha em outubro e avance o mês para ver o resultado.</div>}
    </div>
  );
}

export function Cidade({ s }: { s: GameState }) {
  const g = s.government;
  const seats = Object.entries(g.councilSeatsByParty).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const dots = seats.flatMap(([id, n]) => Array.from({ length: n }, () => id));
  const realOf = (id: string) => REAL_FIGURES.find((f) => f.id === id);
  return (
    <>
      <div className="page-head"><div><h2>São Paulo</h2><p>Prefeitura e Câmara Municipal · mandato atual até {formatIsoPt(g.mandateUntil)}</p></div></div>
      <div className="grid g-2">
        <div className="card">
          <h3>Executivo municipal</h3>
          {[{ role: 'Prefeito(a)', h: g.mayor }, { role: 'Vice-prefeito(a)', h: g.viceMayor }].map(({ role, h }) => (
            <div key={role} style={{ marginBottom: 14 }}>
              <div className="small muted">{role}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 16 }}>{h.name}</b><span className="small">{partyById(h.partyId)?.acronym}</span>
                {h.real ? <span className="tag real">figura pública real</span> : <span className="tag">personagem do jogo</span>}
              </div>
              {h.real && realOf(h.personId)?.publicRecord.map((t, i) => <div key={i} className="small muted">• {t}</div>)}
            </div>
          ))}
          {g.councilPresident && (
            <div>
              <div className="small muted">Presidente da Câmara em {g.councilPresident.year}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 16 }}>{g.councilPresident.name}</b><span className="small">{partyById(g.councilPresident.partyId)?.acronym}</span>
                {g.councilPresident.simulated ? <span className="tag proposta">eleição simulada</span> : <span className="tag ok">você</span>}
              </div>
              <div className="small muted">Mesa com mandato de 1 ano. Na vida real, Ricardo Teixeira (UNIÃO) presidiu a Câmara em 2025 e 2026. Comissões, projetos e votações estão na página Câmara Municipal.</div>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-title"><h3>Câmara Municipal</h3><span className="small muted">{dots.length} vereadores</span></div>
          <div className="hemicycle">{dots.map((id, i) => <span key={i} className="seat" style={{ background: partyColor(id), outline: s.player.mandate?.office === 'vereador' && id === s.player.partyId && i === dots.indexOf(id) ? '2px solid var(--gold)' : 'none' }} />)}</div>
          <div className="legend">{seats.map(([id, n]) => <span key={id}><i style={{ background: partyColor(id) }} />{partyById(id)?.acronym} {n}</span>)}</div>
          <p className="small muted" style={{ marginTop: 10 }}>{monthIndex(s.month) < 2029 * 12 ? 'Bancadas eleitas em 2024.' : 'Bancadas eleitas em 2028 (simulação).'}</p>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title"><h3>Vereadores</h3><span className="small muted">{g.councillors.filter((c) => c.real).length} figuras públicas reais · {g.councillors.filter((c) => !c.real).length} personagens do jogo</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Vereador(a)</th><th>Partido</th><th>Nascimento</th><th className="num">Votos na eleição</th><th /></tr></thead>
            <tbody>
              {[...g.councillors].sort((a, b) => b.votes - a.votes).map((c) => (
                <tr key={c.id} className={c.id === 'character_player' ? 'mine' : ''}>
                  <td><b>{c.name}</b>{c.real && councillorFacts(c.id).slice(1).map((f, i) => <div key={i} className="small muted">{f}</div>)}</td>
                  <td><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: partyColor(c.partyId), marginRight: 6 }} />{partyById(c.partyId)?.acronym}</td>
                  <td className="small">{c.birthDate ? (c.birthPrecision === 'exata' ? formatIsoPt(c.birthDate) : `${c.birthDate.slice(0, 4)}`) : '—'} {c.birthPrecision && c.birthPrecision !== 'exata' && <span className={`tag ${c.birthPrecision === 'estimada' ? 'proposta' : 'derivada'}`}>{c.birthPrecision === 'estimada' ? 'estimado' : 'só o ano'}</span>}</td>
                  <td className="num">{num(c.votes)} <span className="small muted">({c.electedIn})</span></td>
                  <td>{c.id === 'character_player' ? <span className="tag ok">você</span> : c.real ? <span className="tag real">real</span> : <span className="tag">do jogo</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>{monthIndex(s.month) < 2029 * 12
          ? 'Vereadores eleitos em 2024, com o partido pelo qual se elegeram. Trocas de partido, licenças e suplências posteriores não estão refletidas.'
          : 'Composição eleita na simulação de 2028. Figuras reais aparecem com o resultado simulado; nada aqui é previsão.'}</p>
      </div>
    </>
  );
}

export function Historico({ s }: { s: GameState }) {
  const [kind, setKind] = useState<string>('todos');
  const kinds = ['todos', 'eleicao', 'partido', 'mandato', 'evento', 'acao', 'financas', 'sistema'];
  const labels: Record<string, string> = { todos: 'Tudo', eleicao: 'Eleições', partido: 'Partido', mandato: 'Mandato', evento: 'Eventos', acao: 'Ações', financas: 'Finanças', sistema: 'Sistema' };
  return (
    <>
      <div className="page-head"><div><h2>Histórico</h2><p>Tudo o que aconteceu na partida.</p></div></div>
      <div className="tabs">{kinds.map((k) => <button key={k} className={`tab ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>{labels[k]}</button>)}</div>
      <div className="card"><LogList s={s} kinds={kind === 'todos' ? undefined : [kind]} /></div>
    </>
  );
}

export function Regras({ s }: { s: GameState }) {
  const statusTag = (x: Sourced<unknown>) => <span className={`tag ${x.status === 'REGRA_REAL' ? 'real' : x.status === 'DERIVADA' ? 'derivada' : 'proposta'}`}>{x.status === 'REGRA_REAL' ? 'regra real' : x.status === 'DERIVADA' ? 'derivada da lei' : 'mecânica de jogo'}</span>;
  const show = (v: unknown) => (typeof v === 'object' && v !== null ? Object.values(v as object).join(' · ') : typeof v === 'boolean' ? (v ? 'sim' : 'não') : typeof v === 'number' && v < 1 ? pct(v, 0) : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatIsoPt(v) : String(v));
  const rows: [string, Sourced<unknown>][] = [
    ['Data do 1º turno', RP.electionDate], ['Data do 2º turno', RP.runoffDate], ['Prazo de filiação', RP.filiationDeadline], ['Prazo de domicílio eleitoral', RP.domicileDeadline],
    ['Convenções (início)', RP.conventionsStart], ['Registro de candidatura', RP.registrationDeadline], ['Início da propaganda', RP.campaignStart], ['Posse', RP.posseDate],
    ['Idade mínima — vereador', RP.minAge.vereador], ['Idade mínima — prefeito', RP.minAge.prefeito],
    ['Votação nominal mínima (1ª fase)', RP.proportional.nominalMinPhase1], ['Partido nas sobras', RP.proportional.partyMinPhase2], ['Candidato nas sobras', RP.proportional.candidateMinPhase2],
    ['Última fase aberta a todos', RP.proportional.phase3OpenToAllParties], ['Candidatos por lista', RP.proportional.candidatesPerListFactor],
    ['Segundo turno acima de', RP.runoffElectorateThreshold], ['Registro de pesquisas', RP.pollRegistration], ['Mandato da Mesa da Câmara (anos)', RP.councilMesaTermYears], ['Mandatos consecutivos no Executivo', RP.maxConsecutiveTermsExecutive], ['Coligação em eleição proporcional', RP.coalitionsAllowedProportional],
    ['Compromissos por mês', GAMEPLAY.actionPointsPerMonth], ['Votos válidos / eleitorado (proporcional)', GAMEPLAY.validVoteRateProportional], ['Teto de autofinanciamento', GAMEPLAY.ownFundsCapShareOfLimit],
    ['Limite de gastos — vereador SP', GAMEPLAY.spendingLimitVereadorSP], ['Limite de gastos — prefeito SP', GAMEPLAY.spendingLimitPrefeitoSP],
  ];
  return (
    <>
      <div className="page-head"><div><h2>Regras desta partida</h2><p>Pacote <span className="mono">{s.rulepackId}</span> · dados reais de {formatIsoPt(s.dataSnapshot)} · seed <span className="mono">{String(s.flags.seed)}</span></p></div></div>
      <div className="card">
        <div className="table-wrap" style={{ maxHeight: 'none' }}>
          <table>
            <thead><tr><th>Parâmetro</th><th>Valor</th><th>Tipo</th><th>Fonte</th></tr></thead>
            <tbody>{rows.map(([l, x]) => <tr key={l}><td>{l}</td><td className="mono">{l.includes('Limite de gastos') || l.includes('acima') ? (l.includes('acima') ? `${num(x.value as number)} eleitores` : brl(x.value as number)) : show(x.value)}</td><td>{statusTag(x)}</td><td className="small">{x.source}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <div className="callout" style={{ marginTop: 16 }}>
        O jogo separa três coisas: <b>regra real</b> (legislação, com fonte), <b>derivada da lei</b> (datas calculadas que ainda precisam ser confirmadas no calendário oficial do TSE) e <b>mecânica de jogo</b> (simulação fictícia e balanceável, como o modelo de votos). Votos, candidatos adversários e eventos são gerados pela simulação e não representam pesquisas nem previsões reais.
      </div>
    </>
  );
}
