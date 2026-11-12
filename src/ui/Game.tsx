import { Component, useEffect, useState, type ReactNode } from 'react';
import {
  GAMEPLAY, TEAM_LIMITS, decideSanction, setFloorVote, officePointsFor, nextElection, munCycle, genCycle, monthIndex, advanceMonth, setPlayerVote, openDraft, adjustDraft, changeParty, setSocialFocus, currentPhaseLabel, eventById, monthLabel, performAction, resolveEvent, saveLocal, serialize,
  type GameState,
  detectScenes, pastApuracoes, type Scene, type ApuracaoRef,
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
import { VidaPessoal } from './pessoal';
import { Indicadores } from './indicadores';
import { Brasil } from './brasil';
import { GovernoFederal } from './federal';
import { GuideCard } from './guide';
import { CausesModal } from './causes';
import { exportSave, isDesktop, mirrorToFile } from './desktop';
import { Conquistas, EleicoesGerais, EstadoUniao, Imagem, MeuMandato } from './estado';
import { SceneQueue, Apuracao, soundOn, setSoundOn } from './cenas';

const PAGE_IDS = ['gabinete', 'mandato', 'personagem', 'meupartido', 'partidos', 'redes', 'noticias', 'campanha', 'eleicoes', 'gerais', 'estado', 'imagem', 'gabparl', 'governo', 'camara', 'secretaria', 'cidade', 'conquistas', 'historico', 'regras', 'equipe', 'brasil', 'federal', 'pessoal', 'indicadores'] as const;
type PageId = (typeof PAGE_IDS)[number];
type Tab = [PageId, string];
type SectionId = 'agenda' | 'cargo' | 'eleicoes' | 'partidos' | 'midia' | 'politica' | 'eu';
type Section = { id: SectionId; label: string; tabs: Tab[] };
type SpView = 'visao' | 'governo' | 'camara';

const MANDATE_PAGE: Record<string, Tab> = {
  vereador: ['camara', 'Meu mandato na Câmara'],
  prefeito: ['governo', 'Meu governo na Prefeitura'],
  secretario: ['secretaria', 'Minha secretaria'],
  deputado_estadual: ['mandato', 'Meu mandato na Alesp'],
  deputado_federal: ['mandato', 'Meu mandato na Câmara dos Deputados'],
  senador: ['mandato', 'Meu mandato no Senado'],
  governador: ['mandato', 'Meu governo do Estado'],
  secretario_estadual: ['mandato', 'Minha secretaria estadual'],
  presidente: ['federal', 'Minha Presidência'],
  vice_presidente: ['federal', 'Vice-Presidência'],
  ministro: ['federal', 'Meu ministério'],
};

/** Sete seções fixas no menu; cada uma com abas internas. Os nomes das seções não mudam com o cargo. */
function sections(s: GameState): Section[] {
  const m = s.player.mandate;
  const cargo: Tab[] = [];
  if (m && MANDATE_PAGE[m.office]) cargo.push(MANDATE_PAGE[m.office]);
  if (s.player.staff) cargo.push(['gabparl', 'Gabinete parlamentar (assessoria)']);
  if (m && TEAM_LIMITS[m.office]) cargo.push(['equipe', `Minha equipe (${s.player.team?.members.length ?? 0})`]);
  const ne = nextElection(monthIndex(s.month));
  const mun: Tab = ['eleicoes', `Municipais ${munCycle(monthIndex(s.month))}`];
  const gen: Tab = ['gerais', `Gerais ${genCycle(monthIndex(s.month))}`];
  const el: Tab[] = [...(s.player.candidacy ? [['campanha', `Minha campanha ${s.player.candidacy.year ?? 2028}`] as Tab] : []), ...(ne.kind === 'geral' ? [gen, mun] : [mun, gen])];
  const fedOwn = ['presidente', 'vice_presidente', 'ministro'].includes(m?.office ?? '');
  const all: Section[] = [
    { id: 'agenda', label: 'Agenda', tabs: [['gabinete', 'Agenda e ações']] },
    { id: 'cargo', label: 'Meu cargo', tabs: cargo },
    { id: 'eleicoes', label: 'Eleições', tabs: el },
    { id: 'partidos', label: 'Partidos', tabs: [['meupartido', 'Meu partido'], ['partidos', 'Todos os partidos']] },
    { id: 'midia', label: 'Imagem e mídia', tabs: [['imagem', 'Imagem e promessas'], ['redes', 'Redes sociais'], ['noticias', 'Notícias']] },
    { id: 'politica', label: 'Política e país', tabs: [['cidade', 'São Paulo'], ['estado', 'Governo de SP e Congresso'], ...(fedOwn ? [] : [['federal', 'Governo federal'] as Tab]), ['indicadores', 'Indicadores']] },
    { id: 'eu', label: 'Eu', tabs: [['personagem', 'Personagem'], ['pessoal', s.personal?.leave ? 'Vida pessoal (licenciado)' : 'Vida pessoal e família'], ['conquistas', 'Conquistas'], ['historico', 'Histórico']] },
  ];
  return all.filter((x) => x.tabs.length > 0);
}

/** Leva qualquer id de página antigo (guia, eventos) para onde ele mora agora. */
function resolvePage(s: GameState, p: PageId): { page: PageId; sp?: SpView } {
  const own = s.player.mandate && MANDATE_PAGE[s.player.mandate.office]?.[0];
  if ((p === 'governo' || p === 'camara') && own !== p) return { page: 'cidade', sp: p };
  if (p === 'brasil') return { page: 'indicadores' };
  if (p === 'secretaria' && own !== 'secretaria') return { page: 'cidade', sp: 'governo' };
  return { page: p };
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
  const [page, setPageRaw] = useState<PageId>('gabinete');
  const [sp, setSp] = useState<SpView>('visao');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [replay, setReplay] = useState<ApuracaoRef | null>(null);
  const [som, setSom] = useState(soundOn());
  const [lastTab, setLastTab] = useState<Partial<Record<SectionId, PageId>>>({});
  const setPage = (p: PageId) => { const r = resolvePage(s, p); setPageRaw(r.page); if (r.sp) setSp(r.sp); };
  const secs = sections(s);
  const current = secs.find((x) => x.tabs.some(([id]) => id === page));
  useEffect(() => { if (current) setLastTab((l) => (l[current.id] === page ? l : { ...l, [current.id]: page })); }, [page, current?.id]);
  const openSection = (x: Section) => { const last = lastTab[x.id]; setPageRaw(last && x.tabs.some(([id]) => id === last) ? last : x.tabs[0][0]); };
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
    const sc = detectScenes(s, next);
    if (sc.length) setScenes(sc);
    const fresh = next.log.slice(before).filter((l) => l.kind === 'eleicao' || l.kind === 'mandato');
    if (fresh.some((l) => l.kind === 'eleicao') && next.elections.length > s.elections.length) setPage('eleicoes');
    if (next.generalElections.length > s.generalElections.length) setPage('gerais');
    const om = s.player.mandate?.office, nm = next.player.mandate?.office;
    if (nm && nm !== om && MANDATE_PAGE[nm]) setPageRaw(MANDATE_PAGE[nm][0]);
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
            {Array.from({ length: officePointsFor(s) }, (_, i) => <span key={i} className={`ap-dot ${i < (s.officePoints ?? 0) ? 'on' : ''}`} style={{ borderRadius: 0, transform: 'rotate(45deg)' }} />)}
          </div>
        )}
        <button className="top-stat top-stat-btn" onClick={() => setWhyCash(true)} title="Por que o caixa mudou?" aria-label={`Caixa pessoal: ${brl(s.finances.cash)}. Ver por que mudou`}><b>{brl(s.finances.cash)}</b><small>caixa pessoal</small></button>
        <button className="btn btn-gold" onClick={advance} disabled={s.gameOver || !!ev}>
          {s.gameOver ? 'Fim da partida' : ev ? 'Responda o evento' : 'Avançar mês →'}
        </button>
      </header>
      <nav className="sidebar">
        <div>
          {secs.map((x) => (
            <button key={x.id} className={`nav-item ${current?.id === x.id ? 'active' : ''}`} onClick={() => openSection(x)}>{x.label}</button>
          ))}
        </div>
        <div className="nav-sep" />
        <div className="nav-foot">
          <button className={`nav-link ${page === 'regras' ? 'on' : ''}`} onClick={() => setPageRaw('regras')}>Regras</button>
          <button className="nav-link" onClick={() => setExporting(true)}>Salvar / exportar</button>
          <button className="nav-link" onClick={() => { setSoundOn(!som); setSom(!som); }}>Som: {som ? 'ligado' : 'desligado'}</button>
          <button className="nav-link" onClick={onExit}>Menu inicial</button>
        </div>
        <div className="side-foot">{isDesktop ? "Salvo automaticamente em Documentos › Political Brazilian Simulator." : "Salvo automaticamente neste navegador. Use \"Salvar / exportar\" para guardar um arquivo."}</div>
      </nav>
      <main className="main">
        {current && current.tabs.length > 1 && (
          <div className="tabs section-tabs" role="tablist" aria-label={current.label}>
            {current.tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={page === id} className={`tab ${page === id ? 'active' : ''}`} onClick={() => setPageRaw(id)}>{label}</button>)}
          </div>
        )}
        {(page === 'eleicoes' || page === 'gerais' || page === 'campanha') && (() => { const past = pastApuracoes(s).filter((r) => page === 'campanha' || (page === 'eleicoes') === (r.level === 'municipal')); return past.length ? (
          <div className="replay-row"><span>Rever a noite da apuração:</span>{past.map((r) => <button key={`${r.level}${r.year}${r.round}`} className="btn btn-sm" onClick={() => setReplay(r)}>{r.year}{r.round === 2 ? ' · 2º turno' : ''} · {r.office.replace('_', ' ')}</button>)}</div>
        ) : null; })()}
        <PageBoundary resetKey={`${page}-${s.month.year}-${s.month.month}`}>
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
        {page === 'pessoal' && <VidaPessoal s={s} act={act} />}
        {page === 'indicadores' && <><Indicadores s={s} /><div style={{ marginTop: 28 }}><Brasil s={s} /></div></>}
        {page === 'federal' && <GovernoFederal s={s} act={act} decide={(id, d) => setS(decideSanction(s, id, d))} />}
        {page === 'cidade' && (
          <div className="pill-row subnav" role="group" aria-label="São Paulo">
            {([['visao', 'Visão geral e vereadores'], ['governo', 'Prefeitura'], ['camara', 'Câmara Municipal']] as [SpView, string][]).map(([v, l]) => <button key={v} className={`btn btn-sm ${sp === v ? 'btn-gold' : ''}`} aria-pressed={sp === v} onClick={() => setSp(v)}>{l}</button>)}
          </div>
        )}
        {page === 'cidade' && sp === 'governo' && <Governo s={s} openDraft={() => setS(openDraft(s))} adjust={(k, p) => setS(adjustDraft(s, k, p))} />}
        {page === 'cidade' && sp === 'camara' && <Camara s={s} vote={(id, c) => setS(setPlayerVote(s, id, c))} />}
        {page === 'governo' && <Governo s={s} openDraft={() => setS(openDraft(s))} adjust={(k, p) => setS(adjustDraft(s, k, p))} />}
        {page === 'camara' && <Camara s={s} vote={(id, c) => setS(setPlayerVote(s, id, c))} />}
        {page === 'secretaria' && <Secretaria s={s} />}
        {page === 'cidade' && sp === 'visao' && <Cidade s={s} />}
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

      {scenes.length > 0 && <SceneQueue s={s} scenes={scenes} onDone={() => setScenes([])} />}
      {replay && <div className="scene-overlay"><Apuracao s={s} refe={replay} onClose={() => setReplay(null)} /></div>}

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
