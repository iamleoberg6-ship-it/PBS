import { BR_REGIONS, NATIONAL_SOURCES, brRegionPop, isFederal, nationalIndex, type BrRegion, type GameState } from '../engine';

const num = (n: number) => n.toLocaleString('pt-BR');
const mi = (n: number) => `${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
const tone = (v: number) => (v >= 58 ? 'var(--accent)' : v <= 42 ? 'var(--red)' : 'var(--gold)');

const AREA: Record<BrRegion, string> = { norte: 'n', nordeste: 'ne', centro_oeste: 'co', sudeste: 'se', sul: 's' };

export function Brasil({ s }: { s: GameState }) {
  const n = s.national;
  if (!n) return <div className="card"><p>Dados nacionais indisponíveis nesta partida.</p></div>;
  const fed = isFederal(s);
  const totalFunds = BR_REGIONS.reduce((a, r) => a + n.funds[r], 0);
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Brasil por grandes regiões</h2>
          <p>{fed
            ? 'Em Brasília você vota e destina recursos para o país inteiro. Seu mandato segue sendo de São Paulo — quem reelege é o eleitorado paulista —, mas sua projeção nacional muda região por região.'
            : 'Panorama do país. Sua projeção por região passa a ser acompanhada quando você exerce mandato federal (deputado federal ou senador).'}</p>
        </div>
      </div>
      {fed && (
        <div className="meters">
          <div className="meter"><div className="meter-label"><span>Projeção nacional</span><span>média ponderada</span></div><div className="meter-value">{Math.round(nationalIndex(s, 'recognition'))}</div><div className="bar blue"><i style={{ width: `${nationalIndex(s, 'recognition')}%` }} /></div></div>
          <div className="meter"><div className="meter-label"><span>Aprovação nacional</span><span>de quem conhece você</span></div><div className="meter-value">{Math.round(nationalIndex(s, 'approval'))}</div><div className="bar"><i style={{ width: `${nationalIndex(s, 'approval')}%` }} /></div></div>
          <div className="meter"><div className="meter-label"><span>Emendas pagas fora de SP</span></div><div className="meter-value" style={{ fontSize: 20 }}>R$ {num(totalFunds)} mi</div></div>
        </div>
      )}
      <div className="br-map" aria-label="Regiões do Brasil">
        {BR_REGIONS.map((r) => {
          const reg = n.regions[r];
          const p = n.player[r];
          return (
            <div key={r} className="br-cell" style={{ gridArea: AREA[r], borderTopColor: fed ? tone(p.approval) : 'var(--line)' }}>
              <div className="br-name">{reg.name}</div>
              <div className="small muted">{reg.states}</div>
              <div className="small" style={{ marginTop: 6 }}>Desocupação <b className="mono">{reg.unemployment.toFixed(1)}%</b> · renda <b className="mono">R$ {num(reg.income)}</b></div>
              {fed && (
                <div className="small" style={{ marginTop: 6 }}>
                  Projeção <b className="mono">{Math.round(p.recognition)}</b> · aprovação <b className="mono" style={{ color: tone(p.approval) }}>{Math.round(p.approval)}</b>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Indicadores por região</h3>
        <div className="table-wrap" style={{ maxHeight: 'none' }}>
          <table>
            <thead><tr><th>Região</th><th>População</th><th>Eleitorado 2026</th><th>Desocupação</th><th>Rendimento médio</th>{fed && <><th>Sua projeção</th><th>Sua aprovação</th><th>Emendas pagas</th></>}</tr></thead>
            <tbody>
              {BR_REGIONS.map((r) => {
                const reg = n.regions[r];
                const p = n.player[r];
                return (
                  <tr key={r}>
                    <td><b>{reg.name}</b></td>
                    <td className="mono" title="Censo 2022 projetado com a taxa 2010–2022">{mi(brRegionPop(s, r))}</td>
                    <td className="mono">{mi(reg.electorate)}</td>
                    <td className="mono">{reg.unemployment.toFixed(1)}%</td>
                    <td className="mono">R$ {num(reg.income)}</td>
                    {fed && <>
                      <td><div className="bar blue" style={{ width: 90 }}><i style={{ width: `${p.recognition}%` }} /></div><span className="mono small">{Math.round(p.recognition)}</span></td>
                      <td><div className="bar" style={{ width: 90 }}><i style={{ width: `${p.approval}%`, background: tone(p.approval) }} /></div><span className="mono small">{Math.round(p.approval)}</span></td>
                      <td className="mono">R$ {num(n.funds[r])} mi</td>
                    </>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {fed && (
          <p className="small" style={{ marginTop: 10 }}>
            <b>Como sua projeção muda:</b> votos na pauta federal repercutem nas regiões afetadas por cada matéria; emendas pagas a municípios de outras regiões rendem reconhecimento e aprovação ali; e a ação "Agenda nacional" leva você a uma região. Nada disso vira voto em SP — e o tempo fora afasta você da sua base.
          </p>
        )}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Fontes e regras</h3>
        <p className="small"><span className="tag real">regra real</span> {NATIONAL_SOURCES.rules}</p>
        <p className="small"><span className="tag real">dado real</span> {NATIONAL_SOURCES.population} A população é projetada para o ano do jogo com a taxa de cada UF entre os Censos 2010 e 2022.</p>
        <p className="small"><span className="tag real">dado real</span> {NATIONAL_SOURCES.electorate}</p>
        <p className="small"><span className="tag real">dado real</span> {NATIONAL_SOURCES.unemployment}</p>
        <p className="small"><span className="tag real">dado real</span> {NATIONAL_SOURCES.income}</p>
        <p className="small"><span className="tag proposta">mecânica de jogo</span> Indicadores partem dos dados reais e variam com a simulação. Projeção e aprovação do jogador por região, o impacto regional das matérias (fictícias) e os efeitos de emendas e viagens são mecânicas de jogo. O jogo não atribui ideologia às regiões: a reação a cada voto vem de quem é afetado pela matéria.</p>
      </div>
    </>
  );
}
