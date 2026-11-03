// Mundo do protótipo: município de São Paulo + figuras públicas reais (só dados de registro público).

export type MunicipalityTier = 'metropole' | 'grande' | 'media' | 'pequena';

export interface MunicipalityData {
  id: string;
  ibgeCode: number;
  name: string;
  stateId: string;
  tier: MunicipalityTier;
  electorate: number;
  electorateSource: string;
  councilSeats: number;
  /** Bancadas eleitas no último pleito (base para a força inicial dos partidos no município). */
  councilSeatsByParty: Record<string, number>;
  councilSource: string;
}

export const SAO_PAULO: MunicipalityData = {
  id: 'BR-SP-3550308',
  ibgeCode: 3550308,
  name: 'São Paulo',
  stateId: 'BR-SP',
  tier: 'metropole',
  electorate: 9_322_444,
  electorateSource: 'TSE — eleitorado apto, Eleições 2024',
  councilSeats: 55,
  councilSeatsByParty: {
    party_real_pt: 8,
    party_real_mdb: 7,
    party_real_pl: 7,
    party_real_uniao: 7,
    party_real_pode: 6,
    party_real_psol: 6,
    party_real_pp: 4,
    party_real_psd: 3,
    party_real_republicanos: 2,
    party_real_psb: 2,
    party_real_pv: 1,
    party_real_novo: 1,
    party_real_rede: 1,
  },
  councilSource: 'Resultado da eleição para vereador de 2024 (bancadas eleitas; não reflete trocas de partido posteriores)',
};

// Tiers planejados (PROPOSTA de abstração por camadas, ver especificação técnica).
export const TIER_PROFILES: Record<MunicipalityTier, { label: string; detail: string }> = {
  metropole: { label: 'Metrópole', detail: 'Simulação detalhada: bairros/zonas, mídia própria, segundo turno.' },
  grande: { label: 'Cidade grande', detail: 'Simulação detalhada por zonas; segundo turno se > 200 mil eleitores.' },
  media: { label: 'Cidade média', detail: 'Simulação agregada; turno único.' },
  pequena: { label: 'Cidade pequena', detail: 'Simulação agregada, política de relações pessoais; turno único.' },
};

export interface RealFigure {
  id: string;
  name: string;
  partyId: string;
  type: 'real';
  /** Cargo atual (registro público). */
  office: { officeId: string; jurisdictionId: string; since: string; until: string } | null;
  /** Mandatos consecutivos no cargo executivo atual (para regra de reeleição). */
  consecutiveExecutiveTerms: number;
  publicRecord: string[];
}

export const REAL_FIGURES: RealFigure[] = [
  {
    id: 'real_ricardo_nunes',
    name: 'Ricardo Nunes',
    partyId: 'party_real_mdb',
    type: 'real',
    office: { officeId: 'prefeito', jurisdictionId: 'BR-SP-3550308', since: '2021-05-16', until: '2028-12-31' },
    consecutiveExecutiveTerms: 2,
    publicRecord: [
      'Eleito vice-prefeito de São Paulo em 2020.',
      'Assumiu a prefeitura em maio de 2021, após a morte do prefeito Bruno Covas.',
      'Reeleito prefeito em 2024 (segundo turno).',
    ],
  },
  {
    id: 'real_mello_araujo',
    name: 'Ricardo Mello Araújo',
    partyId: 'party_real_pl',
    type: 'real',
    office: { officeId: 'vice_prefeito', jurisdictionId: 'BR-SP-3550308', since: '2025-01-01', until: '2028-12-31' },
    consecutiveExecutiveTerms: 0,
    publicRecord: ['Eleito vice-prefeito de São Paulo em 2024, na chapa de Ricardo Nunes.'],
  },
];

// Os 55 vereadores eleitos em 2024 (nome de urna, partido pelo qual foram eleitos e votos).
// Fonte: resultado oficial TSE, reproduzido por CartaCapital e Brasil de Fato (06/10/2024).
// Não reflete trocas de partido, licenças ou suplências posteriores.
export interface RealCouncillor {
  id: string;
  name: string;
  partyId: string;
  votes2024: number;
}

export const SP_COUNCILLORS_2024: RealCouncillor[] = [
  { id: 'real_ver_lucas_pavanato', name: 'Lucas Pavanato', partyId: 'party_real_pl', votes2024: 161386 },
  { id: 'real_ver_ana_carolina_oliveira', name: 'Ana Carolina Oliveira', partyId: 'party_real_pode', votes2024: 129563 },
  { id: 'real_ver_dr_murillo_lima', name: 'Dr. Murillo Lima', partyId: 'party_real_pp', votes2024: 113820 },
  { id: 'real_ver_sargento_nantes', name: 'Sargento Nantes', partyId: 'party_real_pp', votes2024: 112484 },
  { id: 'real_ver_amanda_paschoal', name: 'Amanda Paschoal', partyId: 'party_real_psol', votes2024: 108654 },
  { id: 'real_ver_rubinho_nunes', name: 'Rubinho Nunes', partyId: 'party_real_uniao', votes2024: 101549 },
  { id: 'real_ver_luna_zarattini', name: 'Luna Zarattini', partyId: 'party_real_pt', votes2024: 100921 },
  { id: 'real_ver_luana_alves', name: 'Luana Alves', partyId: 'party_real_psol', votes2024: 83262 },
  { id: 'real_ver_dra_sandra_tadeu', name: 'Dra. Sandra Tadeu', partyId: 'party_real_pl', votes2024: 74511 },
  { id: 'real_ver_pastora_sandra_alves', name: 'Pastora Sandra Alves', partyId: 'party_real_uniao', votes2024: 74192 },
  { id: 'real_ver_silvao_leite', name: 'Silvão Leite', partyId: 'party_real_uniao', votes2024: 63988 },
  { id: 'real_ver_isac_felix', name: 'Isac Félix', partyId: 'party_real_pl', votes2024: 62275 },
  { id: 'real_ver_zoe_martinez', name: 'Zoe Martinez', partyId: 'party_real_pl', votes2024: 60272 },
  { id: 'real_ver_rodrigo_goulart', name: 'Rodrigo Goulart', partyId: 'party_real_psd', votes2024: 58715 },
  { id: 'real_ver_danilo_do_posto_de_saude', name: 'Danilo do Posto de Saúde', partyId: 'party_real_pode', votes2024: 58676 },
  { id: 'real_ver_gabriel_abreu', name: 'Gabriel Abreu', partyId: 'party_real_pode', votes2024: 58581 },
  { id: 'real_ver_edir_sales', name: 'Edir Sales', partyId: 'party_real_psd', votes2024: 58190 },
  { id: 'real_ver_alessandro_guedes', name: 'Alessandro Guedes', partyId: 'party_real_pt', votes2024: 58183 },
  { id: 'real_ver_celso_giannazi', name: 'Celso Giannazi', partyId: 'party_real_psol', votes2024: 57789 },
  { id: 'real_ver_cris_monteiro', name: 'Cris Monteiro', partyId: 'party_real_novo', votes2024: 56904 },
  { id: 'real_ver_silvinho', name: 'Silvinho', partyId: 'party_real_uniao', votes2024: 53453 },
  { id: 'real_ver_thammy_miranda', name: 'Thammy Miranda', partyId: 'party_real_psd', votes2024: 50234 },
  { id: 'real_ver_nabil_bonduki', name: 'Nabil Bonduki', partyId: 'party_real_pt', votes2024: 49540 },
  { id: 'real_ver_janaina_paschoal', name: 'Janaina Paschoal', partyId: 'party_real_pp', votes2024: 48893 },
  { id: 'real_ver_fabio_riva', name: 'Fabio Riva', partyId: 'party_real_mdb', votes2024: 44627 },
  { id: 'real_ver_major_palumbo', name: 'Major Palumbo', partyId: 'party_real_pp', votes2024: 43455 },
  { id: 'real_ver_rute_costa', name: 'Rute Costa', partyId: 'party_real_pl', votes2024: 43090 },
  { id: 'real_ver_sidney_cruz', name: 'Sidney Cruz', partyId: 'party_real_mdb', votes2024: 42988 },
  { id: 'real_ver_george_hato', name: 'George Hato', partyId: 'party_real_mdb', votes2024: 42837 },
  { id: 'real_ver_sansao_pereira', name: 'Sansão Pereira', partyId: 'party_real_republicanos', votes2024: 42229 },
  { id: 'real_ver_andre_santos', name: 'André Santos', partyId: 'party_real_republicanos', votes2024: 41379 },
  { id: 'real_ver_helio_rodrigues', name: 'Hélio Rodrigues', partyId: 'party_real_pt', votes2024: 40753 },
  { id: 'real_ver_amanda_vettorazzo', name: 'Amanda Vettorazzo', partyId: 'party_real_uniao', votes2024: 40144 },
  { id: 'real_ver_marcelo_messias', name: 'Marcelo Messias', partyId: 'party_real_mdb', votes2024: 40079 },
  { id: 'real_ver_marina_bragante', name: 'Marina Bragante', partyId: 'party_real_rede', votes2024: 39147 },
  { id: 'real_ver_tripoli', name: 'Tripoli', partyId: 'party_real_pv', votes2024: 39039 },
  { id: 'real_ver_simone_ganem', name: 'Simone Ganem', partyId: 'party_real_pode', votes2024: 38540 },
  { id: 'real_ver_sandra_santana', name: 'Sandra Santana', partyId: 'party_real_mdb', votes2024: 38326 },
  { id: 'real_ver_joao_jorge', name: 'João Jorge', partyId: 'party_real_mdb', votes2024: 36296 },
  { id: 'real_ver_ely_teruel', name: 'Ely Teruel', partyId: 'party_real_mdb', votes2024: 35622 },
  { id: 'real_ver_professor_toninho_vespoli', name: 'Professor Toninho Vespoli', partyId: 'party_real_psol', votes2024: 34735 },
  { id: 'real_ver_silvia_da_bancada_feminista', name: 'Silvia da Bancada Feminista', partyId: 'party_real_psol', votes2024: 34537 },
  { id: 'real_ver_sonaira_fernandes', name: 'Sonaira Fernandes', partyId: 'party_real_pl', votes2024: 33957 },
  { id: 'real_ver_dr_milton_ferreira', name: 'Dr. Milton Ferreira', partyId: 'party_real_pode', votes2024: 33493 },
  { id: 'real_ver_joao_ananias', name: 'João Ananias', partyId: 'party_real_pt', votes2024: 33225 },
  { id: 'real_ver_kenji_palumbo', name: 'Kenji Palumbo', partyId: 'party_real_pode', votes2024: 32495 },
  { id: 'real_ver_ricardo_teixeira', name: 'Ricardo Teixeira', partyId: 'party_real_uniao', votes2024: 31566 },
  { id: 'real_ver_jair_tatto', name: 'Jair Tatto', partyId: 'party_real_pt', votes2024: 30905 },
  { id: 'real_ver_eliseu_gabriel', name: 'Eliseu Gabriel', partyId: 'party_real_psb', votes2024: 30706 },
  { id: 'real_ver_dheison', name: 'Dheison', partyId: 'party_real_pt', votes2024: 30575 },
  { id: 'real_ver_senival_moura', name: 'Senival Moura', partyId: 'party_real_pt', votes2024: 30480 },
  { id: 'real_ver_renata_falzoni', name: 'Renata Falzoni', partyId: 'party_real_psb', votes2024: 30206 },
  { id: 'real_ver_keit_lima', name: 'Keit Lima', partyId: 'party_real_psol', votes2024: 27769 },
  { id: 'real_ver_adrilles_jorge', name: 'Adrilles Jorge', partyId: 'party_real_uniao', votes2024: 25038 },
  { id: 'real_ver_gilberto_nascimento', name: 'Gilberto Nascimento', partyId: 'party_real_pl', votes2024: 22306 },
];

export const COUNCIL_FACTS: Record<string, string[]> = {
  real_ver_ricardo_teixeira: ['Presidente da Câmara Municipal de São Paulo em 2025 e 2026 (eleições da Mesa de 01/01/2025 e 15/12/2025).'],
};


// Nascimento dos vereadores reais. Precisão: 'exata' (data com fonte), 'ano' (idade publicada),
// 'estimada' (estimativa do jogo). As estimativas reproduzem a distribuição oficial por faixa etária
// da legislatura 2025–2028 (Câmara Municipal de SP: 2 de 20–29, 10 de 30–39, 13 de 40–49, 16 de 50–59, 10 de 60–69, 4 de 70–79).
export type BirthPrecision = 'exata' | 'ano' | 'estimada';
export interface BirthInfo { date: string; precision: BirthPrecision; source: string }
export const COUNCILLOR_BIRTHS: Record<string, BirthInfo> = {
  'Lucas Pavanato': { date: '1998-05-12', precision: 'exata', source: 'Wikipédia (Lucas Pavanato)' },
  'Zoe Martinez': { date: '1999-06-30', precision: 'ano', source: 'Câmara Municipal de SP: 25 anos na eleição de 2024' },
  'Amanda Vettorazzo': { date: '1989-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Luna Zarattini': { date: '1989-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Amanda Paschoal': { date: '1989-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Keit Lima': { date: '1989-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Rubinho Nunes': { date: '1989-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Gabriel Abreu': { date: '1989-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Kenji Palumbo': { date: '1989-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Dheison': { date: '1989-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Danilo do Posto de Saúde': { date: '1989-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Luana Alves': { date: '1989-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Ana Carolina Oliveira': { date: '1979-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Thammy Miranda': { date: '1979-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Sargento Nantes': { date: '1979-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Dr. Murillo Lima': { date: '1979-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Sonaira Fernandes': { date: '1979-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Marina Bragante': { date: '1979-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Celso Giannazi': { date: '1979-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Alessandro Guedes': { date: '1979-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Hélio Rodrigues': { date: '1979-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Rodrigo Goulart': { date: '1979-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Simone Ganem': { date: '1979-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'André Santos': { date: '1979-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Sansão Pereira': { date: '1979-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Janaina Paschoal': { date: '1969-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Adrilles Jorge': { date: '1969-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Isac Félix': { date: '1969-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Rute Costa': { date: '1969-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Silvão Leite': { date: '1969-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Silvinho': { date: '1969-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Fabio Riva': { date: '1969-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Major Palumbo': { date: '1969-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Sidney Cruz': { date: '1969-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'George Hato': { date: '1969-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Marcelo Messias': { date: '1969-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Sandra Santana': { date: '1969-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Ely Teruel': { date: '1969-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Professor Toninho Vespoli': { date: '1969-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'João Ananias': { date: '1969-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Silvia da Bancada Feminista': { date: '1969-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Nabil Bonduki': { date: '1959-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Ricardo Teixeira': { date: '1959-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Dr. Milton Ferreira': { date: '1959-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Edir Sales': { date: '1959-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Senival Moura': { date: '1959-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Jair Tatto': { date: '1959-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Dra. Sandra Tadeu': { date: '1959-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Cris Monteiro': { date: '1959-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'João Jorge': { date: '1959-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Pastora Sandra Alves': { date: '1959-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Renata Falzoni': { date: '1950-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Eliseu Gabriel': { date: '1950-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Tripoli': { date: '1950-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
  'Gilberto Nascimento': { date: '1950-07-01', precision: 'estimada', source: 'Estimativa do jogo (faixa etária coerente com o perfil oficial da legislatura)' },
};
