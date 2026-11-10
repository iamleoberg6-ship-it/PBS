import {
  MARITAL_LABEL, PERSONAL_RULES, SECURITY_LABEL, TRAIT_LABEL, availableActions, memberAge, monthLabel, privateLeaveLeft, relationLabel,
  type GameState,
} from '../engine';
import { ActionCard } from './pages';

type Act = (id: string, param?: string) => void;

function Meter({ label, value, note, color }: { label: string; value: number; note?: string; color?: string }) {
  return (
    <div className="meter">
      <div className="meter-label"><span>{label}</span>{note && <span>{note}</span>}</div>
      <div className="meter-value">{Math.round(value)}</div>
      <div className={`bar ${color ?? ''}`}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  );
}

const fromIndex = (t: number) => ({ year: Math.floor(t / 12), month: (t % 12) + 1 });
const TAG: Record<string, string> = { REAL: 'real', PARÂMETRO: 'proposta', SIMPLIFICAÇÃO: 'proposta' };

export function VidaPessoal({ s, act }: { s: GameState; act: Act }) {
  const p = s.personal;
  if (!p) return <div className="card"><h3>Vida pessoal</h3><p className="small">Indisponível nesta partida.</p></div>;
  const acts = availableActions(s).filter((a) => a.def.category === 'Vida pessoal');
  const fam = p.family.filter((m) => !m.ex);
  const exes = p.family.filter((m) => m.ex);
  const lastThreat = p.threats[p.threats.length - 1];
  const threatLevel = lastThreat && monthIndexOf(s) - lastThreat.month <= 6 ? lastThreat.level : 0;
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Vida pessoal</h2>
          <p>{MARITAL_LABEL[p.marital]} · {fam.length} familiar(es) próximos{p.generation > 1 ? ` · ${p.generation}ª geração da família na política` : ''}</p>
        </div>
      </div>

      {p.leave && (
        <div className="card" style={{ borderLeft: '5px solid var(--gold)', marginBottom: 16 }}>
          <h3>Licenciado(a) do cargo</h3>
          <p className="small">Desde {monthLabel(fromIndex(p.leave.since))}, até {monthLabel(fromIndex(p.leave.until))}. Motivo: {p.leave.reason === 'saude' ? 'saúde' : p.leave.reason === 'ameaca' ? 'segurança pessoal' : 'interesse particular'}{p.leave.paid ? '' : ' (sem remuneração)'}. O trabalho do mandato fica com o substituto; você segue atuando no partido, na base e nas redes.</p>
        </div>
      )}

      <div className="meters">
        <Meter label="Estresse" value={p.stress} color={p.stress >= 75 ? 'red' : p.stress >= 50 ? 'gold' : ''} note={p.stress >= 80 ? 'tira agenda' : ''} />
        <Meter label="Saúde" value={p.health} color={p.health < 45 ? 'red' : 'blue'} note={p.health < 45 ? 'tira agenda' : ''} />
        <Meter label="Exposição pública" value={p.exposure} color={p.exposure >= 50 ? 'red' : 'gold'} note="cargo, fama, polarização" />
        <Meter label="Ameaças recentes" value={threatLevel * 20} color="red" note={threatLevel ? `nível ${threatLevel}/5` : 'nenhuma em 6 meses'} />
      </div>
      <p className="small muted">Segurança: <b>{SECURITY_LABEL[p.security]}</b>{p.therapy ? ' · em acompanhamento psicológico' : ''}{s.player.mandate && ['vereador', 'deputado_estadual', 'deputado_federal', 'senador'].includes(s.player.mandate.office) ? ` · licença por interesse particular disponível este ano: ${privateLeaveLeft(s)} mês(es)` : ''}</p>

      <div className="grid g-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Família</h3>
          {fam.length ? (
            <div className="table-wrap"><table>
              <thead><tr><th>Nome</th><th>Relação</th><th className="num">Idade</th><th className="num">Humor</th><th>Perfil</th></tr></thead>
              <tbody>{fam.map((m) => (
                <tr key={m.id}>
                  <td><b>{m.name}</b>{p.heirId === m.id && <span className="tag ok" style={{ marginLeft: 4 }}>herdeiro(a)</span>}
                    {m.politics && <div className="small">{m.politics.status === 'pre' ? 'pré-candidato(a)' : m.politics.status === 'eleito' ? (m.politics.until !== undefined && monthIndexOf(s) > m.politics.until ? 'ex-' : m.politics.since !== undefined && monthIndexOf(s) < m.politics.since ? 'eleito(a), posse em breve —' : 'em mandato —') : 'não eleito(a)'} — {m.politics.office === 'vereador' ? 'vereador(a)' : 'deputado(a) estadual'} {m.politics.year}</div>}
                    {m.formerOffice && <div className="small muted">{m.formerOffice}</div>}
                    {m.employedByPlayer && <div className="small" style={{ color: 'var(--red)' }}>nomeado(a) irregularmente ({m.employedByPlayer === 'cruzado' ? 'nepotismo cruzado' : 'no seu gabinete'})</div>}</td>
                  <td>{relationLabel(m)}</td>
                  <td className="num">{memberAge(s, m)}</td>
                  <td className="num" style={{ color: m.mood < 30 ? 'var(--red)' : undefined }}>{Math.round(m.mood)}</td>
                  <td className="small">{TRAIT_LABEL[m.trait]}</td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <p className="small muted">Ninguém próximo por enquanto.</p>}
          {exes.length > 0 && <p className="small muted">{exes.map((m) => `${relationLabel(m)}: ${m.name}`).join(' · ')}</p>}
          {p.babyDue ? <p className="small"><b>{p.babyBy === 'adocao' ? 'Adoção em andamento' : 'Bebê a caminho'}:</b> previsão para {monthLabel(fromIndex(p.babyDue))}.</p> : null}
          <p className="small muted">Mais de três meses sem "Tempo com a família" e o humor de cônjuge e filhos pequenos cai todo mês.</p>
        </div>
        <div className="card">
          <h3>Relacionamentos</h3>
          {p.romance && <p className="small"><b>{p.romance.stage === 'namoro' ? 'Namorando' : 'Conhecendo'}:</b> {p.romance.name} · afinidade {Math.round(p.romance.affinity)}{p.romance.public ? ' · público' : ' · discreto'}</p>}
          {p.friends.map((f) => <p key={f.id} className="small"><b>{f.kind === 'mentor' ? 'Mentor(a)' : f.kind === 'ex_socio' ? 'Ex-sócio(a)' : 'Amigo(a)'}:</b> {f.name} · confiança {Math.round(f.trust)}</p>)}
          {p.rival ? <p className="small" style={{ color: 'var(--red)' }}><b>Adversário pessoal:</b> {p.rival.name} · intensidade {Math.round(p.rival.intensity)}</p> : <p className="small muted">Sem adversário pessoal.</p>}
          {p.ancestors.length > 0 && <p className="small"><b>Família na política:</b> {p.ancestors.map((a) => `${a.name} (${a.peak})`).join(' → ')} → você</p>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Ações da vida pessoal</h3>
        <div className="actions">{acts.map((a) => <ActionCard key={a.def.id} def={a.def} status={a.status as string | null} s={s} act={act} />)}</div>
      </div>

      {p.threats.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Histórico de ameaças</h3>
          <div className="table-wrap"><table>
            <thead><tr><th>Mês</th><th className="num">Nível</th><th>O que houve</th><th>Resposta</th></tr></thead>
            <tbody>{[...p.threats].reverse().slice(0, 10).map((t, i) => <tr key={i}><td className="small">{monthLabel(fromIndex(t.month))}</td><td className="num">{t.level}</td><td className="small">{t.text}</td><td className="small">{t.response ?? '—'}</td></tr>)}</tbody>
          </table></div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Regras</h3>
        {PERSONAL_RULES.map((r, i) => <p key={i} className="small"><span className={`tag ${TAG[r.tag]}`} style={{ marginRight: 6 }}>{r.tag}</span>{r.text}</p>)}
      </div>
    </>
  );
}

const monthIndexOf = (s: GameState) => s.month.year * 12 + s.month.month - 1;
