import { AXES, PARTIES, ROLLCALL_VOTES, axisPosition, type AxisId } from '../engine';

const SHOWN: AxisId[] = ['economia', 'fiscal', 'social', 'seguranca', 'ambiente', 'trabalho', 'desenvolvimento', 'estado', 'direitos'];
const cell = (v: number) => `rgba(${v < 0 ? '228,59,68' : '42,120,220'}, ${Math.min(0.6, Math.abs(v) / 160)})`;

/** Posição de cada partido por tema (−100 a +100), calibrada por votações nominais da Câmara. */
export function IdeologiaPorTema({ highlight }: { highlight?: string | null }) {
  const parties = PARTIES.filter((p) => SHOWN.some((a) => axisPosition(p.id, a).value !== null));
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Ideologia por tema</h3>
      <p className="small muted">−100 = primeiro polo, +100 = segundo polo. Vermelho: rumo ao primeiro polo; azul: rumo ao segundo. ● = calibrado por votações nominais (Câmara e Senado); ○ = só a escala de especialistas; — = sem dado. Relações internacionais ainda não têm votação que separe os partidos.</p>
      <div className="table-wrap"><table>
        <thead><tr><th>Partido</th>{SHOWN.map((a) => { const ax = AXES.find((x) => x.id === a)!; return <th key={a} className="num small" title={`${ax.minus} ↔ ${ax.plus}`}>{ax.label}<div className="muted" style={{ fontWeight: 400 }}>{ax.minus.split(' ').slice(-1)} ↔ {ax.plus.split(' ').slice(-1)}</div></th>; })}</tr></thead>
        <tbody>{parties.map((p) => (
          <tr key={p.id} className={p.id === highlight ? 'mine' : ''}>
            <td><b>{p.acronym}</b></td>
            {SHOWN.map((a) => { const r = axisPosition(p.id, a); return <td key={a} className="num small" style={{ background: r.value === null ? undefined : cell(r.value) }} title={r.basis === 'escala' ? 'Só escala de especialistas' : r.basis === 'votacoes' ? `${r.votes} votação(ões), sem escala` : `${r.votes} votação(ões) + escala`}>{r.value === null ? '—' : r.value}{r.value !== null && <span className="muted"> {r.basis === 'escala' ? '○' : '●'}</span>}</td>; })}
          </tr>
        ))}</tbody>
      </table></div>
      <details style={{ marginTop: 8 }}>
        <summary className="small"><b>Votações usadas ({ROLLCALL_VOTES.length})</b></summary>
        <div className="table-wrap"><table>
          <thead><tr><th>Tema</th><th>Casa</th><th>Votação</th><th>Data</th><th className="num">Sim × Não</th><th>Votar "Sim" puxa para</th></tr></thead>
          <tbody>{ROLLCALL_VOTES.map((v) => { const ax = AXES.find((x) => x.id === v.axis)!; return (
            <tr key={v.axis + v.id}><td className="small">{ax.label}</td><td className="small">{v.house === 'SF' ? 'Senado' : 'Câmara'}</td><td className="small">{v.label}</td><td className="small">{v.date.split('-').reverse().join('/')}</td><td className="num small">{v.sim} × {v.nao}</td><td className="small">{v.dir > 0 ? ax.plus : ax.minus}</td></tr>
          ); })}</tbody>
        </table></div>
      </details>
      <p className="small muted" style={{ marginTop: 6 }}><span className="tag real" style={{ marginRight: 4 }}>DADO REAL</span>Votos individuais de cada deputado e senador (Dados Abertos da Câmara e do Senado), agregados pelo partido na data da votação, com siglas antigas mapeadas ao partido atual. <span className="tag proposta" style={{ marginLeft: 4, marginRight: 4 }}>MÉTODO DO JOGO</span>A escolha das votações, o sentido de cada uma e a mistura com a escala de especialistas (75/25 com 2+ votações; 50/50 com 1; organização do Estado e direitos usam só votações) são decisões do jogo, documentadas. Votos de governo e oposição também carregam disciplina partidária, não só convicção.</p>
    </div>
  );
}
