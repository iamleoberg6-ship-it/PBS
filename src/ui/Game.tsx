import { Component, useEffect, useState, type ReactNode } from 'react';
import {
  GAMEPLAY, TEAM_LIMITS, setFloorVote, officePointsFor, nextElection, munCycle, genCycle, monthIndex, advanceMonth, setPlayerVote, openDraft, adjustDraft, changeParty, setSocialFocus, currentPhaseLabel, eventById, monthLabel, performAction, resolveEvent, saveLocal, serialize,
  type GameState,
} from '../engine';
import { brl } from './format';
import { Cidade, Eleicoes, Gabinete, Historico, Partidos, Personagem, Regras } from './pages';
import { Noticias, Redes } from './media';
import { MeuPartido } from './party';
import { Camara } from './camara';
import { Secretaria } from './secretaria';
import { Governo } from './governo';
import { Campanha, GabineteParlamentar } from './campanha';
import { Equipe } from './equipe';
import { Brasil } from './brasil';
import { GuideCard } from './guide';
import { CausesModal } from './causes';
import { exportSave, isDesktop, mirrorToFile } from './desktop';
import { Conquistas, EleicoesGerais, EstadoUniao, Imagem, MeuMandato } from './estado';

const PAGE_IDS = ['gabinete', 'mandato', 'personagem', 'meupartido', 'partidos', 'redes', 'noticias', 'campanha', 'eleicoes', 'gerais', 'estado', 'imagem', 'gabparl', 'governo', 'camara', 'secretaria', 'cidade', 'conquistas', 'historico', 'regras', 'equipe', 'brasil'] as const;
type PageId = (typeof PAGE_IDS)[number];
type NavGroup = { title: string; items: [PageId, string][] };

const MANDATE_PAGE: Record<string, [PageId, string]> = {
  vereador: ['camara', 'Câmara Municipal — meu mandato'],
  prefeito: ['governo', 'Prefeitura — meu governo'],
  secretario: ['secretaria', 'Minha secretaria'],
  deputado_estadual: ['mandato', 'Alesp — meu mandato'],
  deputado_federal: ['mandato', 'Câmara dos Deputados — meu mandato'],
  senador: ['mandato', 'Senado — meu mandato'],
  governador: ['mandato', 'Governo do Estado — meu governo'],
  secretario_estadual: ['mandato', 'Secretaria estadual'],
};

/** Navegação por esferas: o cargo atual vem primeiro, depois a eleição mais próxima e a esfera onde você atua. */
function navGroups(s: GameState): NavGroup[] {
  const m = s.player.mandate;
  const groups: NavGroup[] = [{ title: 'Você', items: [['gabinete', 'Agenda e ações'], ['personagem', 'Personagem'], ['imagem', 'Imagem e promessas']] }];
  const cargo: [PageId, string][] = [];
  if (m && MANDATE_PAGE[m.office]) cargo.push(MANDATE_PAGE[m.office]);
  if (s.player.staff) cargo.push(['gabparl', 'Gabinete parlamentar (assessoria)']);
  if (m && TEAM_LIMITS[m.office]) cargo.push(['equipe', `Minha equipe de gabinete (${s.player.team?.members.length ?? 0})`]);
  const federal = m?.office === 'deputado_federal' || m?.office === 'senador';
  if (federal) cargo.push(['brasil', 'Brasil — minha projeção']);
  if (cargo.length) groups.push({ title: 'Meu cargo', items: cargo });
  const ne = nextElection(monthIndex(s.month));
  const munY = munCycle(monthIndex(s.month));
  const genY = genCycle(monthIndex(s.month));
  const el: [PageId, string][] = [];
  if (s.player.candidacy) el.push(['campanha', `Minha campanha ${s.player.candidacy.year ?? 2028}`]);
  const mun: [PageId, string] = ['eleicoes', `Eleições municipais ${munY}`];
  const gen: [PageId, string] = ['gerais', `Eleições gerais ${genY}`];
  el.push(...(ne.kind === 'geral' ? [gen, mun] : [mun, gen]));
  groups.push({ title: 'Eleições', items: el });
  const upper = !!m && ['deputado_estadual', 'deputado_federal', 'senador', 'governador', 'secretario_estadual'].includes(m.office);
  const state: NavGroup = { title: 'Estado e União', items: federal ? [['estado', 'Governo de SP e Congresso']] : [['estado', 'Governo de SP e Congresso'], ['brasil', 'Brasil por regiões']] };
  const city: NavGroup = { title: 'Cidade de São Paulo', items: ([['governo', 'Prefeitura'], ['camara', 'Câmara Municipal'], ['cidade', 'Vereadores e cidade']] as [PageId, string][]).filter(([id]) => !cargo.some(([c]) => c === id)) };
  groups.push(...(upper ? [state, city] : [city, state]));
  groups.push({ title: 'Partido e mídia', items: [['meupartido', 'Meu partido'], ['partidos', 'Partidos'], ['redes', 'Redes sociais'], ['noticias', 'Notícias']] });
  groups.push({ title: 'Trajetória', items: [['conquistas', 'Conquistas'], ['historico', 'Histórico'], ['regras', 'Regras']] });
  return groups;
}

/** Se uma página quebrar, só ela mostra o erro: a barra do topo e o botão de avançar continuam funcionando. */
class PageBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  componentDidUpdate(prev: { resetKey: string }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (this.state.error) return <div className="card"><h3>Esta página encontrou um erro</h3><p className="small">A partida continua: troque de página ou avance o mês. Se o erro se repetir, exporte o save e mande para correção.</p><p className="small mono muted">{this.state.error}</p></div>;
    return this.props.children;
  }
}

export function Game({ initial, onExit }: { initial: GameState; onExit: () => void }) {
  const [s, setS] = useState<GameState>(initial);
  const [page, setPage] = useState<PageId>('gabinete');
  const [toast, setToast] = useState('');
  const [whyCash, setWhyCash] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { saveLocal(s); void mirrorToFile(s); }, [s]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t); }, [toast]);

  const act = (id: string, param?: string) => {
    const next = performAction(s, id, param);
    if (next !== s) {
      setS(next);
      setToast(next.log[next.log.length - 1]?.text ?? '');
    }
  };
  const advance = () => {
    const before = s.log.length;
    const next = advanceMonth(s);
    setS(next);
    const fresh = next.log.slice(before).filter((l) => l.kind === 'eleicao' || l.kind === 'mandato');
    if (fresh.some((l) => l.kind === 'eleicao') && next.elections.length > s.elections.length) setPage('eleicoes');
    if (next.generalElections.length > s.generalElections.length) setPage('gerais');
    const om = s.player.mandate?.office, nm = next.player.mandate?.office;
    if (nm && nm !== om && MANDATE_PAGE[nm]) setPage(MANDATE_PAGE[nm][0]);
    if (next.gameOver) setPage('conquistas');
    setToast(fresh[fresh.length - 1]?.text ?? `Avançou para ${monthLabel(next.month)}.`);
    if (next.crises.some((c) => c.status === 'ativa' && c.targetId === 'character_player') && !s.crises.some((c) => c.status === 'ativa' && c.targetId === 'character_player')) setToast('Crise de imagem: veja a aba Imagem e promessas.');

  };

  const ev = s.pendingEvents[0];
  const tpl = ev ? eventById(ev.templateId) : undefined;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">PBS<span>.</span></div>
        <div>
          <div className="top-date">{monthLabel(s.month)}</div>
          <div className="top-phase">{currentPhaseLabel(s)}</div>
        </div>
        <div className="top-spacer" />
        <div className="ap" title="Agenda pessoal: compromissos livres deste mês">
          {Array.from({ length: GAMEPLAY.actionPointsPerMonth.value }, (_, i) => <span key={i} className={`ap-dot ${i < s.actionPoints ? 'on' : ''}`} />)}
        </div>
        {officePointsFor(s) > 0 && (
          <div className="ap" title="Agenda do cargo: compromissos só para o trabalho do cargo" style={{ marginLeft: 8 }}>
            <span className="small" style={{ color: 'var(--paper-2, #ddd)', marginRight: 4 }}>cargo</span>
            {Array.from({ length: officePointsFor(s) }, (_, i) => <span key={i} className={`ap-dot ${i < (s.officePoints ?? 0) ? 'on' : ''}`} style={{ borderRadius: 2, transform: 'rotate(45deg)' }} />)}
          </div>
        )}
        <button className="top-stat top-stat-btn" onClick={() => setWhyCash(true)} title="Por que o caixa mudou?" aria-label={`Caixa pessoal: ${brl(s.finances.cash)}. Ver por que mudou`}><b>{brl(s.finances.cash)}</b><small>caixa pessoal</small></button>
        <button className="btn btn-gold" onClick={advance} disabled={s.gameOver || !!ev}>
          {s.gameOver ? 'Fim da partida' : ev ? 'Responda o evento' : 'Avançar mês →'}
        </button>
      </header>
      <nav className="sidebar">
        {navGroups(s).map((g) => (
          <div key={g.title}>
            <div className="nav-group">{g.title}</div>
            {g.items.map(([id, label]) => (
              <button key={id + label} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>{label}</button>
            ))}
          </div>
        ))}
        <div className="nav-sep" />
        <button className="nav-item" onClick={() => setExporting(true)}>Salvar / exportar partida</button>
        <button className="nav-item" onClick={onExit}>Menu inicial</button>
        <div className="side-foot">{isDesktop ? "Salvo automaticamente em Documentos › Political Brazilian Simulator." : "Salvo automaticamente neste navegador. Use \"Salvar / exportar\" para guardar um arquivo."}</div>
      </nav>
      <main className="main"><PageBoundary resetKey={`${page}-${s.month.year}-${s.month.month}`}>
        <GuideCard s={s} setS={setS} go={(p) => { if ((PAGE_IDS as readonly string[]).includes(p)) setPage(p as PageId); }} />
        {page === 'gabinete' && <Gabinete s={s} act={act} voteBill={(id, c) => setS(setPlayerVote(s, id, c))} voteFloor={(id, c) => setS(setFloorVote(s, id, c))} />}
        {page === 'personagem' && <Personagem s={s} />}
        {page === 'meupartido' && <MeuPartido s={s} />}
        {page === 'partidos' && <Partidos s={s} changeParty={(id) => { const n = changeParty(s, id); setS(n); setToast(n.log[n.log.length - 1]?.text ?? ''); }} />}
        {page === 'redes' && <Redes s={s} setFocus={(n) => setS(setSocialFocus(s, n))} />}
        {page === 'noticias' && <Noticias s={s} />}
        {page === 'eleicoes' && <Eleicoes s={s} />}
        {page === 'estado' && <EstadoUniao s={s} />}
        {page === 'gerais' && <EleicoesGerais s={s} />}
        {page === 'mandato' && <MeuMandato s={s} act={act} voteFloor={(id, c) => setS(setFloorVote(s, id, c))} />}
        {page === 'imagem' && <Imagem s={s} act={act} />}
        {page === 'conquistas' && <Conquistas s={s} />}
        {page === 'campanha' && <Campanha s={s} act={act} />}
        {page === 'gabparl' && <GabineteParlamentar s={s} act={act} />}
        {page === 'equipe' && <Equipe s={s} act={act} />}
        {page === 'brasil' && <Brasil s={s} />}
        {page === 'governo' && <Governo s={s} openDraft={() => setS(openDraft(s))} adjust={(k, p) => setS(adjustDraft(s, k, p))} />}
        {page === 'camara' && <Camara s={s} vote={(id, c) => setS(setPlayerVote(s, id, c))} />}
        {page === 'secretaria' && <Secretaria s={s} />}
        {page === 'cidade' && <Cidade s={s} />}
        {page === 'historico' && <Historico s={s} />}
        {page === 'regras' && <Regras s={s} setS={setS} />}
      </PageBoundary></main>

      {ev && tpl && (
        <div className="overlay">
          <div className="modal" role="dialog" aria-modal="true">
            <div className="small mono muted">ACONTECIMENTO · {monthLabel(s.month).toUpperCase()}</div>
            <h2>{tpl.title(s, ev.vars)}</h2>
            <p>{tpl.body(s, ev.vars)}</p>
            <div className="modal-options">
              {tpl.options(s, ev.vars).map((o, i) => (
                <button key={i} className="btn" onClick={() => { const n = resolveEvent(s, i); setS(n); setToast(n.log[n.log.length - 1]?.text ?? ''); }}>
                  <span>{o.label}</span>{o.hint && <small>{o.hint}</small>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {exporting && (
        <div className="overlay" onClick={() => setExporting(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Exportar save</h2>
            <p>{isDesktop ? 'A partida já é salva sozinha em arquivo (pasta Documentos › Political Brazilian Simulator), com uma cópia por ano de jogo. Você também pode gravar uma cópia agora ou copiar o texto.' : 'Baixe um arquivo .json da partida (recomendado) ou copie o texto para continuar em outro navegador ou computador.'}</p>
            <textarea readOnly value={serialize(s)} onFocus={(e) => e.currentTarget.select()} />
            <div className="modal-options" style={{ flexDirection: 'row' }}>
              <button className="btn btn-gold" onClick={() => { exportSave(s).then(setToast); }}>{isDesktop ? 'Salvar cópia em arquivo' : 'Baixar arquivo .json'}</button>
              <button className="btn btn-primary" onClick={() => { navigator.clipboard?.writeText(serialize(s)).then(() => setToast('Save copiado.'), () => setToast('Não deu para copiar automaticamente: selecione o texto e copie.')); }}>Copiar</button>
              <button className="btn" onClick={() => setExporting(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
      {whyCash && <CausesModal s={s} indicator="cash" onClose={() => setWhyCash(false)} />}
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  );
}
