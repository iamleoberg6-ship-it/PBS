import {
  FACTION_TRAITS, PLAYER, monthLabel, partyById, projectContest, rel, standing,
  type GameState,
} from '../engine';

const Bar = ({ label, value, hint, color = '' }: { label: string; value: number; hint: string; color?: string }) => (
  <div style={{ marginBottom: 12 }}>
    <div className="meter-label"><span style={{ color: 'var(--ink)', fontWeight: 600 }}>{label}</span><span className="mono">{Math.round(value)}</span></div>
    <div className={`bar ${color}`}><i style={{ width: `${value}%` }} /></div>
    <div className="small muted">{hint}</div>
  </div>
);

const relTag = (v: number) => (v > 30 ? <span className="tag ok">aliado</span> : v > 8 ? <span className="tag">simpático</span> : v < -30 ? <span className="tag no">hostil</span> : v < -8 ? <span className="tag no">desconfiado</span> : <span className="tag">neutro</span>);

export function MeuPartido({ s }: { s: GameState }) {
  const pid = s.player.partyId;
  if (!pid) {
    return (
      <>
        <div className="page-head"><div><h2>Meu partido</h2><p>Você não é filiado(a). Escolha uma legenda na página Partidos.</p></div></div>
        <div className="callout">Sem partido você pode construir base, redes e reconhecimento, mas não pode se candidatar: a filiação é condição de elegibilidade (CF art. 14 §3º, V).</div>
      </>
    );
  }
  const party = partyById(pid)!;
  const org = s.partyOrgs[pid];
  const pr = s.player.partyRel;
  const contest = s.contests.find((c) => c.partyId === pid && c.status === 'aberta');
  const lastContest = [...s.contests].reverse().find((c) => c.partyId === pid && c.status === 'decidida');
  const proj = contest ? projectContest(s, contest) : null;
  const nameOf = (id: string) => (id === PLAYER ? `${s.character.name} (você)` : s.actors[id]?.name ?? id);
  const myPromises = s.promises.filter((p) => p.status === 'aberta' || p.madeAt.year >= s.month.year - 1);
  return (
    <>
      <div className="page-head">
        <div><h2>{party.acronym} — diretório municipal de São Paulo</h2><p>{party.name} · {org.directorate.delegates} delegados · ~{org.directorate.members.toLocaleString('pt-BR')} filiados na cidade (simulado) · mandato da direção até {monthLabel(org.directorate.termEnds)}</p></div>
        {pr.executiveRole && <span className="tag derivada" style={{ fontSize: 13 }}>Você: {pr.executiveRole}</span>}
      </div>
      <div className="grid g-main">
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <h3>Facções</h3>
            <div className="grid g-2">
              {org.factions.map((f) => {
                const st = standing(s, f.leaderId, PLAYER);
                const r = rel(s, f.leaderId, PLAYER);
                return (
                  <div key={f.id} className="action" style={{ background: '#fff' }}>
                    <div className="action-head"><b>{f.name}</b><span className="mono small">{Math.round(f.share * 100)}% dos delegados</span></div>
                    <p>{FACTION_TRAITS[f.type]}</p>
                    <div className="small">Liderança: <b>{s.actors[f.leaderId]?.name}</b> <span className="muted">(personagem do jogo)</span></div>
                    <div className="small">Influência {Math.round(f.influence)} · mobilização {Math.round(f.mobilization)}</div>
                    <div className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>Relação com você: {relTag(st)} <span className="muted mono">confiança {Math.round(r.trust)}</span></div>
                    {r.memory.slice(0, 2).map((m, i) => <div key={i} className="small muted">• {m.text} ({monthLabel(m.month)})</div>)}
                  </div>
                );
              })}
            </div>
          </div>
          {contest && proj && (
            <div className="card" style={{ borderLeft: '5px solid var(--gold)' }}>
              <h3>Disputa aberta: presidência do diretório</h3>
              <p className="small muted">Decisão em {monthLabel(contest.decidesAt)}. Projeção atual (sem o imprevisto do dia):</p>
              {contest.candidates.map((id) => {
                const v = proj.votes[id] ?? 0;
                return (
                  <div key={id} style={{ marginBottom: 8 }}>
                    <div className="meter-label"><span style={{ color: 'var(--ink)' }}><b>{nameOf(id)}</b></span><span className="mono">{v} delegados</span></div>
                    <div className={`bar ${id === PLAYER ? 'gold' : 'blue'}`}><i style={{ width: `${(v / org.directorate.delegates) * 100}%` }} /></div>
                  </div>
                );
              })}
              <div className="small muted">Facções votam em bloco; os demais delegados seguem popularidade interna e mobilização. Ações na aba Gabinete → Partido.</div>
            </div>
          )}
          {lastContest?.result && (
            <div className="card">
              <h3>Última disputa ({monthLabel(lastContest.decidesAt)})</h3>
              <p>Vencedor(a): <b>{nameOf(lastContest.result.winnerId)}</b></p>
              <table><thead><tr><th>Facção</th><th>Votou em</th><th className="num">Delegados</th></tr></thead>
                <tbody>{lastContest.result.byFaction.map((b) => <tr key={b.factionId}><td>{org.factions.find((f) => f.id === b.factionId)?.name}</td><td>{nameOf(b.candidateId)}</td><td className="num">{b.delegates}</td></tr>)}
                  {Object.entries(lastContest.result.unaligned).map(([id, v]) => <tr key={id}><td className="muted">Não alinhados</td><td>{nameOf(id)}</td><td className="num">{v}</td></tr>)}</tbody></table>
            </div>
          )}
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <h3>Sua posição no partido</h3>
            <Bar label="Confiança da direção" value={pr.leadershipTrust} hint="Pesa em candidaturas, recursos do FEFC e cargos." color="blue" />
            <Bar label="Popularidade interna" value={pr.internalPopularity} hint="Como filiados e militância te veem; move delegados não alinhados." />
            <Bar label="Influência" value={pr.influence} hint="Peso nas decisões; exigida para disputar cargos (≥ 25)." color="gold" />
            <Bar label="Fidelidade percebida" value={pr.perceivedLoyalty} hint="Cai com críticas e promessas quebradas; baixa demais abre processo disciplinar." />
            <Bar label="Mobilização" value={pr.mobilization} hint="Capacidade de levar filiados e delegados para votar." color="gold" />
            {pr.disciplinary > 0 && <div className="tag no">{pr.disciplinary === 1 ? 'Advertência formal' : 'Suspenso(a)'}</div>}
            <p className="small muted" style={{ marginTop: 8 }}>Os indicadores são independentes: dá para ter muita força eleitoral e pouca confiança da direção.</p>
          </div>
          <div className="card">
            <h3>Executiva municipal</h3>
            {org.directorate.executive.map((e, i) => <div key={i} className="small" style={{ marginBottom: 4 }}><b>{e.role}:</b> {nameOf(e.actorId)}</div>)}
            <p className="small muted">Dirigentes são personagens do jogo. A composição real depende do estatuto e das eleições internas de cada partido.</p>
          </div>
          {myPromises.length > 0 && (
            <div className="card">
              <h3>Seus compromissos</h3>
              {myPromises.map((p) => <div key={p.id} className="small" style={{ marginBottom: 4 }}>{p.text} — <span className={`tag ${p.status === 'cumprida' ? 'ok' : p.status === 'quebrada' ? 'no' : ''}`}>{p.status}</span></div>)}
            </div>
          )}
          <div className="card">
            <h3>Histórico do diretório</h3>
            {org.history.length === 0 && <p className="small muted">Nada relevante ainda.</p>}
            {[...org.history].reverse().slice(0, 6).map((h, i) => <div key={i} className="small" style={{ marginBottom: 4 }}><span className="muted">{monthLabel(h.month)}:</span> {h.text}</div>)}
          </div>
        </div>
      </div>
    </>
  );
}
