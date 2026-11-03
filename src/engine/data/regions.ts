// Território e segmentos eleitorais da cidade de São Paulo (Fase 4).
//
// [REAL] População de cada subprefeitura: IBGE, Censo 2022 (tabela da Prefeitura/SMUL, "População recenseada,
//        subprefeituras e distritos, 1950–2022"). Total: 11.451.999.
// [DERIVADA] Agrupamento das 32 subprefeituras em 8 regiões, inspirado nas 8 regiões de análise da Prefeitura
//        (Centro, Norte 1, Norte 2, Sul 1, Sul 2, Leste 1, Leste 2, Oeste), que na fonte oficial são definidas por
//        distritos — aqui por subprefeitura inteira. Eleitorado da região proporcional à população.
// [PARÂMETRO/FICÇÃO] Perfil de renda, prioridades, comparecimento e inclinação política de cada região são
//        parâmetros do jogo, não estatísticas. Segmentos não são associados a partidos.

export interface Region {
  id: string;
  name: string;
  subprefeituras: { name: string; pop2022: number }[];
  income: 'alta' | 'média' | 'média-baixa' | 'baixa';
  priorities: string[]; // temas (THEMES) mais cobrados — PARÂMETRO
  turnout: number; // comparecimento relativo (1 = média da cidade) — PARÂMETRO
  lean: number; // −1 (mais progressista) … +1 (mais conservadora) — PARÂMETRO pequeno, ver nota
  note: string;
}

export const REGIONS: Region[] = [
  { id: 'centro', name: 'Centro', income: 'média', priorities: ['zeladoria', 'habitacao'], turnout: 0.95, lean: -0.25,
    subprefeituras: [{ name: 'Sé', pop2022: 423536 }], note: 'Bela Vista foi uma das 3 zonas eleitorais vencidas por Boulos no 2º turno de 2024 (imprensa).' },
  { id: 'oeste', name: 'Oeste', income: 'alta', priorities: ['mobilidade', 'meioambiente'], turnout: 1.06, lean: -0.05,
    subprefeituras: [{ name: 'Butantã', pop2022: 468522 }, { name: 'Lapa', pop2022: 338347 }, { name: 'Pinheiros', pop2022: 285815 }], note: '' },
  { id: 'norte1', name: 'Norte 1', income: 'média', priorities: ['saude', 'mobilidade'], turnout: 1.02, lean: 0.15,
    subprefeituras: [{ name: 'Santana-Tucuruvi', pop2022: 318913 }, { name: 'Vila Maria-Vila Guilherme', pop2022: 276069 }, { name: 'Jaçanã-Tremembé', pop2022: 283892 }, { name: 'Casa Verde-Cachoeirinha', pop2022: 306275 }], note: '' },
  { id: 'norte2', name: 'Norte 2', income: 'baixa', priorities: ['saude', 'gcm'], turnout: 0.97, lean: 0.05,
    subprefeituras: [{ name: 'Freguesia-Brasilândia', pop2022: 380513 }, { name: 'Pirituba-Jaraguá', pop2022: 480218 }, { name: 'Perus', pop2022: 163083 }], note: '' },
  { id: 'leste1', name: 'Leste 1', income: 'média', priorities: ['gcm', 'saude'], turnout: 1.01, lean: 0.15,
    subprefeituras: [{ name: 'Mooca', pop2022: 377163 }, { name: 'Penha', pop2022: 472757 }, { name: 'Aricanduva-Formosa-Carrão', pop2022: 266157 }, { name: 'Vila Prudente', pop2022: 243728 }, { name: 'Sapopemba', pop2022: 266715 }], note: '' },
  { id: 'leste2', name: 'Leste 2', income: 'baixa', priorities: ['mobilidade', 'saude'], turnout: 0.96, lean: 0.05,
    subprefeituras: [{ name: 'Itaquera', pop2022: 550540 }, { name: 'Guaianases', pop2022: 273707 }, { name: 'Cidade Tiradentes', pop2022: 194177 }, { name: 'São Mateus', pop2022: 453527 }, { name: 'São Miguel', pop2022: 344609 }, { name: 'Itaim Paulista', pop2022: 345968 }, { name: 'Ermelino Matarazzo', pop2022: 202214 }],
    note: 'Imprensa: Boulos perdeu no extremo leste em 2024, região que tradicionalmente votava na esquerda.' },
  { id: 'sul1', name: 'Sul 1', income: 'alta', priorities: ['mobilidade', 'gcm'], turnout: 1.05, lean: 0.0,
    subprefeituras: [{ name: 'Vila Mariana', pop2022: 337654 }, { name: 'Ipiranga', pop2022: 480878 }, { name: 'Jabaquara', pop2022: 214958 }, { name: 'Santo Amaro', pop2022: 272332 }], note: '' },
  { id: 'sul2', name: 'Sul 2', income: 'baixa', priorities: ['saude', 'educacao'], turnout: 0.95, lean: 0.0,
    subprefeituras: [{ name: 'Campo Limpo', pop2022: 675598 }, { name: 'Capela do Socorro', pop2022: 605383 }, { name: 'Cidade Ademar', pop2022: 412804 }, { name: "M'Boi Mirim", pop2022: 570809 }, { name: 'Parelheiros', pop2022: 165138 }],
    note: 'Piraporinha e Valo Velho estiveram entre as 3 zonas vencidas por Boulos no 2º turno de 2024; a base eleitoral de Ricardo Nunes é a região do Grajaú (imprensa).' },
];

export const REGION_SOURCE = 'IBGE, Censo 2022 — população por subprefeitura (Prefeitura de SP/SMUL). Agrupamento em 8 regiões: do jogo.';
export const SP_POP_2022 = 11451999;

export const regionPop = (r: Region) => r.subprefeituras.reduce((a, x) => a + x.pop2022, 0);
export const regionById = (id: string) => REGIONS.find((r) => r.id === id);
/** Peso eleitoral: população × comparecimento relativo, normalizado (DERIVADA + PARÂMETRO). */
export function regionWeights(): Record<string, number> {
  const raw = REGIONS.map((r) => regionPop(r) * r.turnout);
  const tot = raw.reduce((a, b) => a + b, 0);
  return Object.fromEntries(REGIONS.map((r, i) => [r.id, raw[i] / tot]));
}

export interface Segment {
  id: string;
  name: string;
  share: number; // fração do eleitorado (PARÂMETRO; segmentos se sobrepõem na vida real)
  channels: { rua: number; digital: number; tv: number; liderancas: number }; // receptividade 0–1
  themes: string[];
}

export const SEGMENTS: Segment[] = [
  { id: 'privado', name: 'Trabalhadores do setor privado', share: 0.3, channels: { rua: 0.5, digital: 0.7, tv: 0.6, liderancas: 0.3 }, themes: ['mobilidade', 'gcm'] },
  { id: 'servidores', name: 'Servidores públicos', share: 0.06, channels: { rua: 0.4, digital: 0.5, tv: 0.5, liderancas: 0.6 }, themes: ['saude', 'educacao'] },
  { id: 'empreendedores', name: 'Empreendedores', share: 0.1, channels: { rua: 0.5, digital: 0.8, tv: 0.4, liderancas: 0.4 }, themes: ['zeladoria', 'mobilidade'] },
  { id: 'informais', name: 'Trabalhadores informais', share: 0.15, channels: { rua: 0.8, digital: 0.5, tv: 0.6, liderancas: 0.7 }, themes: ['habitacao', 'saude'] },
  { id: 'jovens', name: 'Jovens (16–24)', share: 0.12, channels: { rua: 0.4, digital: 0.95, tv: 0.2, liderancas: 0.3 }, themes: ['cultura', 'educacao'] },
  { id: 'aposentados', name: 'Aposentados', share: 0.15, channels: { rua: 0.6, digital: 0.3, tv: 0.9, liderancas: 0.6 }, themes: ['saude', 'gcm'] },
  { id: 'estudantes', name: 'Estudantes', share: 0.06, channels: { rua: 0.4, digital: 0.9, tv: 0.2, liderancas: 0.4 }, themes: ['educacao', 'cultura'] },
  { id: 'baixa_renda', name: 'Famílias de baixa renda', share: 0.06, channels: { rua: 0.8, digital: 0.4, tv: 0.7, liderancas: 0.9 }, themes: ['habitacao', 'saude'] },
];
export const segmentById = (id: string) => SEGMENTS.find((x) => x.id === id);
