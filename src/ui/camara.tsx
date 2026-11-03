import { Votacoes } from './votacoes';
import { useState } from 'react';
import {
  ABSOLUTE_MAJORITY, BLOC_LABEL, THEME_LABEL, CPI_SIGNATURES, KIND_LABEL, LEG_RULES, STAGE_LABEL, authorLabel, blocCounts, forecast, isActive,
  monthLabel, nameOf, partyById, partyOrientation, playerCommittee, PLAYER,
  type Bill, type GameState, type Stance, type VoteChoice,
} from '../engine';
import { partyColor } from './format';

const VOTE_LABEL: Record<VoteChoice, string> = { S: 'Sim', N: 'Não', A: 'Abstenção' };
const BLOC_COLOR: Record<Stance, string> = { base: '#2d6a9f', independente: '#9aa5ae', oposicao: '#c0763a', oposicao_radical: '#a33a3a' };
const TAG_CLASS: Record<string, string> = { REAL: 'real', DERIVADA: 'derivada', 'SIMPLIFICAÇÃO': 'fed', 'PARÂMETRO': 'proposta', 'A CONFIRMAR': 'no' };

type Tab = 'meus' | 'votacao' | 'comissoes' | 'sancao' | 'concluidos';

export function Camara({ s, vote }: { s: GameState; vote: (billId: string, c: VoteChoice | null) => void }) {
  const L = s.legislature;
  const isVer = s.player.mandate?.office === 'vereador';
  const [tab, setTab] = useState<Tab>(isVer ? 'meus' : 'votacao');
  const [open, setOpen] = useState<string | null>(null);
  const counts = blocCounts(s);
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const myComm = playerCommittee(s);
  const mine = (b: Bill) => b.author === PLAYER || (b.author === 'executivo' && s.player.mandate?.office === 'prefeito') || b.rapporteurId === PLAYER;
  const lists: Record<Tab, Bill[]> = {
    meus: L.bills.filter(mine),
    votacao: L.bills.filter((b) => b.stage === 'plenario' || b.stage === 'veto'),
    comissoes: L.bills.filter((b) => ['ccj', 'merito', 'financas'].includes(b.stage)),
    sancao: L.bills.filter((b) => b.stage === 'sancao'),
    concluidos: L.bills.filter((b) => !isActive(b)).slice(-40),
  };
  const shown = [...lists[tab]].reverse();
  const TABS: [Tab, string][] = [['meus', isVer ? 'Meus projetos e relatorias' : 'Projetos do meu interesse'], ['votacao', 'Plenário e vetos'], ['comissoes', 'Nas comissões'], ['sancao', 'Aguardando sanção'], ['concluidos', 'Concluídos']];
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Câmara Municipal</h2>
          <p>{s.government.councillors.length} vereadores · maioria absoluta: {ABSOLUTE_MAJORITY} · {L.presidentId ? `presidência de ${nameOf(s, L.presidentId)}${L.mesaYear ? ` (${L.mesaYear})` : ''}` : 'Mesa não eleita'}
            {isVer && ` · você: ${BLOC_LABEL[s.player.mandate!.stance]}${myComm ? `, Comissão de ${myComm.name}` : ''}`}</p>
        </div>
      </div>
      {isVer && <Votacoes s={s} voteBill={vote} voteFloor={() => undefined} />}

      <div className="grid g-2">
        <div className="card">
          <div className="card-title"><h3>Blocos frente ao prefeito</h3><span className="small muted">simulação</span></div>
          <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 10 }}>
            {(Object.keys(counts) as Stance[]).map((k) => <i key={k} title={BLOC_LABEL[k]} style={{ width: `${(counts[k] / total) * 100}%`, background: BLOC_COLOR[k] }} />)}
          </div>
          <div className="legend">{(Object.keys(counts) as Stance[]).map((k) => <span key={k}><i style={{ background: BLOC_COLOR[k] }} />{BLOC_LABEL[k]} {counts[k]}</span>)}</div>
          <p className="small muted" style={{ marginTop: 8 }}>Base = partidos da coligação do prefeito. Demais blocos saem da distância ideológica do partido ao prefeito (escala de especialistas) e do pragmatismo simulado de cada vereador. Não é afirmação sobre como um vereador real se posiciona.</p>
        </div>
        <div className="card">
          <div className="card-title"><h3>Mesa Diretora {L.mesaYear ?? ''}</h3><span className="tag proposta">composição simulada</span></div>
          <table>
            <tbody>{L.mesa.map((m) => {
              const c = s.government.councillors.find((x) => x.id === m.actorId);
              return <tr key={m.role} className={m.actorId === PLAYER ? 'mine' : ''}><td className="small muted">{m.role}</td><td><b>{nameOf(s, m.actorId)}</b></td><td>{partyById(m.actorId === PLAYER ? s.player.partyId ?? '' : c?.partyId ?? '')?.acronym}</td></tr>;
            })}</tbody>
          </table>
          <p className="small muted" style={{ marginTop: 8 }}>Mandato de 1 ano. Na vida real, Ricardo Teixeira (UNIÃO) presidiu a Câmara em 2025 e 2026; os demais anos são simulados.</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title"><h3>Comissões permanentes</h3><span className="small muted">proporcionais às bancadas (D'Hondt)</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Comissão</th><th className="num">Vagas</th><th>Presidente</th><th>Composição</th><th className="num">Projetos</th></tr></thead>
            <tbody>{L.committees.map((c) => {
              const byP: Record<string, number> = {};
              for (const id of c.members) { const pid = id === PLAYER ? s.player.partyId ?? '' : s.government.councillors.find((x) => x.id === id)?.partyId ?? ''; byP[pid] = (byP[pid] ?? 0) + 1; }
              return (
                <tr key={c.id} className={c.members.includes(PLAYER) ? 'mine' : ''}>
                  <td><b>{c.name}</b>{c.members.includes(PLAYER) && <span className="tag ok" style={{ marginLeft: 6 }}>sua comissão</span>}</td>
                  <td className="num">{c.seats}</td>
                  <td className="small">{c.presidentId ? nameOf(s, c.presidentId) : '—'}</td>
                  <td className="small">{Object.entries(byP).sort((a, b) => b[1] - a[1]).map(([p, n]) => <span key={p} style={{ marginRight: 8, whiteSpace: 'nowrap' }}><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: partyColor(p), marginRight: 3 }} />{partyById(p)?.acronym} {n}</span>)}</td>
                  <td className="num">{L.bills.filter((b) => isActive(b) && b.committeeId === c.id && ['ccj', 'merito', 'financas'].includes(b.stage)).length}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="tabs">{TABS.map(([id, label]) => <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label} ({lists[id].length})</button>)}</div>
        {shown.length === 0 && <p className="muted">Nada aqui por enquanto.</p>}
        {shown.map((b) => <BillRow key={b.id} s={s} b={b} open={open === b.id} toggle={() => setOpen(open === b.id ? null : b.id)} vote={vote} canVote={isVer} />)}
      </div>

      <div className="grid g-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>CPIs</h3>
          {L.cpis.length === 0 && <p className="small muted">Nenhuma CPI. Requer fato determinado (fiscalização) e {CPI_SIGNATURES} assinaturas.</p>}
          {L.cpis.map((c) => (
            <div key={c.id} style={{ marginBottom: 10 }}>
              <b>{c.topic}</b> <span className={`tag ${c.status === 'instalada' ? 'ok' : c.status === 'arquivada' ? 'no' : ''}`}>{c.status}</span>
              <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${Math.min(100, (c.signatures.length / CPI_SIGNATURES) * 100)}%` }} /></div>
              <div className="small muted">{c.signatures.length}/{CPI_SIGNATURES} assinaturas · desde {monthLabel(c.startedAt)}{c.endsAt ? ` · prazo até ${monthLabel(c.endsAt)}` : ''}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Seus votos</h3>
          {L.voteHistory.length === 0 && <p className="small muted">Você ainda não votou em plenário.</p>}
          <div className="table-wrap" style={{ maxHeight: 260 }}>
            <table><tbody>{[...L.voteHistory].reverse().slice(0, 30).map((v, i) => <tr key={i}><td className="small muted">{monthLabel(v.month)}</td><td className="small">{v.title}</td><td>{v.player ? <span className={`tag ${v.player === 'S' ? 'ok' : v.player === 'N' ? 'no' : ''}`}>{VOTE_LABEL[v.player]}</span> : '—'}</td><td className="small">{v.outcome}</td></tr>)}</tbody></table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Regras da Câmara no jogo</h3>
        {LEG_RULES.map((r, i) => <div key={i} className="small" style={{ marginBottom: 6 }}><span className={`tag ${TAG_CLASS[r.tag]}`} style={{ marginRight: 6 }}>{r.tag}</span>{r.text}</div>)}
      </div>
    </>
  );
}

function BillRow({ s, b, open, toggle, vote, canVote }: { s: GameState; b: Bill; open: boolean; toggle: () => void; vote: (id: string, c: VoteChoice | null) => void; canVote: boolean }) {
  const active = isActive(b);
  const ctx = b.stage === 'veto' ? 'veto' : b.stage === 'plenario' ? 'plenario' : 'comissao';
  const f = active && b.stage !== 'sancao' ? forecast(s, b, ctx) : null;
  const myVote = s.legislature.playerVotes[b.id];
  const orient = s.player.partyId ? partyOrientation(s, s.player.partyId, b, ctx) : null;
  const inMyCommittee = s.legislature.committees.find((c) => c.id === b.committeeId)?.members.includes(PLAYER);
  const votable = canVote && active && b.stage !== 'sancao' && (b.stage === 'plenario' || b.stage === 'veto' || inMyCommittee);
  const rc = b.vetoVote ?? b.vote;
  const knowsFlaw = b.executiveInitiativeOnly && (s.character.attributes.politicalKnowledge >= 45 || b.stage !== 'ccj');
  return (
    <div style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', cursor: 'pointer', flexWrap: 'wrap' }} onClick={toggle}>
        <span className="mono small">{b.number}</span>
        <b style={{ flex: 1, minWidth: 220 }}>{b.title}</b>
        <span className="small muted">{authorLabel(s, b)}</span>
        <span className={`tag ${b.stage === 'lei' ? 'ok' : ['arquivado', 'rejeitado', 'veto_mantido'].includes(b.stage) ? 'no' : ''}`}>{STAGE_LABEL[b.stage]}</span>
        {b.urgent && active && <span className="tag derivada">urgência</span>}
        {myVote && active && <span className="tag fed">seu voto: {VOTE_LABEL[myVote]}</span>}
      </div>
      {open && (
        <div className="grid g-2" style={{ marginTop: 10 }}>
          <div>
            <div className="small">{KIND_LABEL[b.kind]} · tema: {THEME_LABEL[b.theme] ?? b.theme} · comissão atual: {s.legislature.committees.find((c) => c.id === b.committeeId)?.name ?? '—'}</div>
            <div className="small">Relator(a): {b.rapporteurId ? nameOf(s, b.rapporteurId) : '—'}{b.parecer ? ` · parecer ${b.parecer === 'favoravel' ? 'favorável' : 'contrário'}` : ''}</div>
            <div className="small">Prefeitura: <b>{b.executivePosition === 'favor' ? 'a favor' : b.executivePosition === 'contra' ? 'contra' : 'neutra'}</b> · pressão pública {Math.round(b.salience)}/100 · opinião {b.publicSupport > 0.1 ? 'favorável' : b.publicSupport < -0.1 ? 'contrária' : 'dividida'}</div>
            {knowsFlaw && <div className="small" style={{ color: 'var(--red)' }}>Risco de vício de iniciativa: o texto trata de matéria privativa do prefeito.</div>}
            {b.commitments.length > 0 && <div className="small">Compromissos de voto fechados por você: {b.commitments.map((id) => nameOf(s, id)).join(', ')}</div>}
            <div style={{ marginTop: 8 }}>{b.history.map((h, i) => <div key={i} className="small muted">{monthLabel(h.month)} — {h.text}</div>)}</div>
          </div>
          <div>
            {f && (
              <>
                <div className="small muted">Placar provável {ctx === 'comissao' ? 'na comissão' : ctx === 'veto' ? 'pela derrubada do veto' : 'no plenário'} (sem ruído)</div>
                <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', margin: '4px 0' }}>
                  <i style={{ width: `${(f.yes / Math.max(1, f.yes + f.no + f.undecided)) * 100}%`, background: 'var(--accent)' }} />
                  <i style={{ width: `${(f.undecided / Math.max(1, f.yes + f.no + f.undecided)) * 100}%`, background: '#c9c2b4' }} />
                  <i style={{ width: `${(f.no / Math.max(1, f.yes + f.no + f.undecided)) * 100}%`, background: 'var(--red)' }} />
                </div>
                <div className="small">{f.yes} tendem a favor · {f.undecided} indecisos · {f.no} tendem contra{ctx === 'veto' ? ` (derrubada exige ${ABSOLUTE_MAJORITY})` : ''}</div>
              </>
            )}
            {rc && <div className="small" style={{ marginTop: 6 }}>Última votação: {rc.yes} sim · {rc.no} não · {rc.abst} abstenções — {rc.quorum}</div>}
            {votable && (
              <div style={{ marginTop: 10 }}>
                <div className="small muted">Seu voto na próxima votação {orient && orient !== 'A' ? `(orientação da sua bancada: ${VOTE_LABEL[orient]})` : '(bancada liberada)'}. Votar não gasta compromisso; sem registro, você segue a bancada.</div>
                <div className="pill-row" style={{ marginTop: 6 }}>
                  {(['S', 'N', 'A'] as VoteChoice[]).map((c) => <button key={c} className="btn btn-sm" style={myVote === c ? { background: c === 'N' ? 'var(--red)' : c === 'S' ? 'var(--accent)' : 'var(--ink-3)', borderColor: 'transparent', color: '#fff' } : undefined} onClick={() => vote(b.id, c)}>{VOTE_LABEL[c]}</button>)}
                  {myVote && <button className="btn btn-sm" onClick={() => vote(b.id, null)}>Seguir a bancada</button>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
