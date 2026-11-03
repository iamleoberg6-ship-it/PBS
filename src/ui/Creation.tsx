import { useMemo, useState } from 'react';
import {
  ATTRIBUTE_LABELS, BASE_ATTRIBUTES, FREE_POINTS, PARTIES, PROFESSIONS, START_STATUS, SAO_PAULO, TIER_PROFILES,
  createGame, previewEligibility, AXES, PARTIES as ALL_PARTIES, EXPERT_SCALE, categoryLabel, generalPosition, ideologicalDistance, partyIdeology, type AttributeKey, type GameState, type ProfessionId, type StartStatus,
} from '../engine';
import { brl } from './format';

const EDITABLE: AttributeKey[] = ['communication', 'charisma', 'negotiation', 'leadership', 'management', 'politicalKnowledge', 'articulation'];
const EDUCATION = ['Ensino fundamental', 'Ensino médio', 'Ensino técnico', 'Ensino superior', 'Pós-graduação'];

export function Creation({ onStart, onBack }: { onStart: (s: GameState) => void; onBack: () => void }) {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('1996-05-20');
  const [gender, setGender] = useState('Prefiro não informar');
  const [education, setEducation] = useState('Ensino superior');
  const [profession, setProfession] = useState<ProfessionId>('professor');
  const [startStatus, setStartStatus] = useState<StartStatus>('independente');
  const [partyId, setPartyId] = useState<string>('party_real_mdb');
  const [bio, setBio] = useState('');
  const [bonus, setBonus] = useState<Partial<Record<AttributeKey, number>>>({});
  const [seed, setSeed] = useState('');
  const [ideo, setIdeo] = useState<Record<string, number>>({ economia: 0, social: 0, seguranca: 0, ambiente: 0 });
  const ideology = { ...ideo, fiscal: ideo.economia, trabalho: ideo.economia, desenvolvimento: ideo.economia };

  const used = Object.values(bonus).reduce((s, v) => s + (v ?? 0), 0);
  const left = FREE_POINTS - used;
  const prof = PROFESSIONS[profession];

  const preview = useMemo(() => createGame({
    name: name || 'Prévia', birthDate, gender, education, profession, startStatus,
    startPartyId: startStatus === 'independente' ? null : partyId, bio, attributeBonus: bonus, seed: 1, ideology,
  }), [name, birthDate, gender, education, profession, startStatus, partyId, bio, bonus, ideo]);

  const eligV = previewEligibility(preview, 'vereador').find((c) => c.id === 'idade')!;
  const eligP = previewEligibility(preview, 'prefeito').find((c) => c.id === 'idade')!;

  const step = (k: AttributeKey, d: number) => {
    const cur = bonus[k] ?? 0;
    const nextV = cur + d;
    if (nextV < 0 || nextV > 25 || (d > 0 && left <= 0)) return;
    setBonus({ ...bonus, [k]: nextV });
  };

  const start = () => {
    const s = createGame({
      name, birthDate, gender, education, profession, startStatus,
      startPartyId: startStatus === 'independente' ? null : partyId, bio, attributeBonus: bonus, ideology,
      seed: seed.trim() ? Number(seed) || undefined : undefined,
    });
    onStart(s);
  };

  return (
    <div style={{ background: 'var(--paper)', minHeight: '100%' }}>
      <div className="creation">
        <div className="page-head">
          <div>
            <div className="small mono muted">NOVA CARREIRA · JANEIRO DE 2027</div>
            <h2 style={{ fontSize: 30 }}>Quem é você?</h2>
            <p>Origem e atributos dão vantagens, mas não fecham caminhos.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onBack}>Voltar</button>
            <button className="btn btn-primary" onClick={start} disabled={!name.trim() || left < 0}>Começar carreira</button>
          </div>
        </div>

        <div className="grid g-main">
          <div className="grid">
            <div className="card form">
              <h3>Identidade</h3>
              <div className="grid g-2">
                <div className="field"><label>Nome</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome e sobrenome" /></div>
                <div className="field"><label>Data de nascimento</label><input type="date" value={birthDate} min="1950-01-01" max="2012-12-31" onChange={(e) => setBirthDate(e.target.value)} />
                  <span className="hint">{eligV.ok ? '✓' : '✗'} vereador em 2028 · {eligP.ok ? '✓' : '✗'} prefeito em 2028</span></div>
                <div className="field"><label>Gênero</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)}>{['Feminino', 'Masculino', 'Não binário', 'Prefiro não informar'].map((g) => <option key={g}>{g}</option>)}</select>
                  <span className="hint">Não altera direitos políticos.</span></div>
                <div className="field"><label>Escolaridade</label>
                  <select value={education} onChange={(e) => setEducation(e.target.value)}>{EDUCATION.map((g) => <option key={g}>{g}</option>)}</select></div>
                <div className="field"><label>Município (domicílio eleitoral)</label>
                  <select value={SAO_PAULO.id} disabled><option value={SAO_PAULO.id}>São Paulo (SP) — {TIER_PROFILES.metropole.label}</option></select>
                  <span className="hint">Cidades médias e pequenas entram nas próximas versões.</span></div>
                <div className="field"><label>Seed da partida (opcional)</label><input value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} placeholder="Aleatória" />
                  <span className="hint">Mesma seed + mesmas escolhas = mesmos resultados.</span></div>
              </div>
              <div className="field"><label>Biografia</label><textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Opcional" /></div>
            </div>

            <div className="card form">
              <h3>Origem</h3>
              <div className="grid g-2">
                <div className="field"><label>Profissão</label>
                  <select value={profession} onChange={(e) => setProfession(e.target.value as ProfessionId)}>
                    {(Object.keys(PROFESSIONS) as ProfessionId[]).map((p) => <option key={p} value={p}>{PROFESSIONS[p].label}</option>)}
                  </select>
                  <span className="hint">Renda {brl(prof.income)}/mês · caixa inicial {brl(prof.cash)} · reconhecimento inicial {prof.recognition}</span>
                  <div className="pill-row" style={{ marginTop: 4 }}>
                    {Object.entries(prof.mods).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([k, v]) => (
                      <span key={k} className={`tag ${(v ?? 0) > 0 ? 'ok' : 'no'}`}>{ATTRIBUTE_LABELS[k as AttributeKey]} {(v ?? 0) > 0 ? '+' : '−'}{Math.abs(v ?? 0)}</span>
                    ))}
                  </div>
                  {prof.note && <span className="hint">{prof.note}</span>}
                </div>
                <div className="field"><label>Situação política inicial</label>
                  <select value={startStatus} onChange={(e) => setStartStatus(e.target.value as StartStatus)}>
                    {(Object.keys(START_STATUS) as StartStatus[]).map((p) => <option key={p} value={p}>{START_STATUS[p].label}</option>)}
                  </select>
                  <span className="hint">{START_STATUS[startStatus].detail}</span>
                </div>
              </div>
              {startStatus !== 'independente' && (
                <div className="field"><label>Partido de filiação (desde 2025)</label>
                  <select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                    {[...PARTIES].sort((a, b) => a.acronym.localeCompare(b.acronym)).map((p) => <option key={p.id} value={p.id}>{p.acronym} — {p.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-title"><h3>Atributos</h3><span className={`tag ${left === 0 ? 'ok' : ''}`}>{left} pontos livres</span></div>
            {EDITABLE.map((k) => (
              <div className="stepper" key={k}>
                <span>{ATTRIBUTE_LABELS[k]}</span>
                <button onClick={() => step(k, -5)} aria-label="menos">−</button>
                <span className="v">{preview.character.attributes[k]}</span>
                <button onClick={() => step(k, 5)} aria-label="mais">+</button>
              </div>
            ))}
            <div className="stepper"><span>Popularidade</span><span /><span className="v">{preview.character.attributes.popularity}</span><span /></div>
            <h3 style={{ marginTop: 22 }}>Posições políticas</h3>
            {AXES.filter((a) => ['economia', 'social', 'seguranca', 'ambiente'].includes(a.id)).map((a) => (
              <div key={a.id} className="field" style={{ marginBottom: 6 }}>
                <label>{a.label} <span className="muted mono">{ideo[a.id] > 0 ? '+' : ''}{ideo[a.id]}</span></label>
                <input type="range" min={-100} max={100} step={10} value={ideo[a.id]} onChange={(e) => setIdeo({ ...ideo, [a.id]: Number(e.target.value) })} />
                <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{a.minus}</span><span>{a.plus}</span></div>
              </div>
            ))}
            <div className="small" style={{ marginTop: 6 }}>Sua posição geral: <b>{categoryLabel(generalPosition(preview.character.ideology))}</b>. Partidos mais próximos: {
              [...ALL_PARTIES].filter((p) => EXPERT_SCALE[p.id]?.value != null)
                .map((p) => ({ p, d: ideologicalDistance(preview.character.ideology, partyIdeology(p.id)) ?? 1 }))
                .sort((x, y) => x.d - y.d).slice(0, 4).map((x) => x.p.acronym).join(', ')
            }.</div>
            <p className="small muted">Afinidade ideológica muda a relação inicial com o partido e as chances de coligação. Política fiscal, relações trabalhistas e desenvolvimento acompanham Economia; as demais começam neutras.</p>
            <p className="small muted" style={{ marginTop: 10 }}>Escala 0–100. Base {BASE_ATTRIBUTES.communication} + origem + seus pontos (até +25 por atributo). Popularidade não se compra: vem da trajetória.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
