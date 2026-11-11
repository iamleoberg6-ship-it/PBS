// Dados reais por subprefeitura da capital (Fase 9b).
// Fonte: Secretaria Municipal da Saúde, Boletim CEInfo "Saúde em Dados" por Subprefeitura, ano XXV, nº 25 (jul/2026).
//   · mortalidade infantil: coeficiente por mil nascidos vivos, 2025;
//   · homicídio: coeficiente por 100 mil habitantes, padronizado por idade, 2024.
// Tempo de deslocamento por zona: Rede Nossa São Paulo / Ipec, "Viver em São Paulo: Mobilidade Urbana" (2024),
//   tempo médio diário de todos os deslocamentos (ida e volta), por região da cidade.

export const SUBPREF_SOURCE = 'SMS-SP, Boletim CEInfo Saúde em Dados por Subprefeitura (jul/2026): mortalidade infantil 2025; homicídio 2024 (padronizado por idade)';
export const SUBPREF_CITY = { mortinf: 10.0, homic: 5.1 };

export const SUBPREF_DATA: Record<string, { mortinf: number; homic: number }> = {
  'Aricanduva-Formosa-Carrão': { mortinf: 7.8, homic: 4.2 },
  'Butantã': { mortinf: 8.6, homic: 3.5 },
  'Campo Limpo': { mortinf: 8.8, homic: 4.4 },
  'Capela do Socorro': { mortinf: 10.7, homic: 8.0 },
  'Casa Verde-Cachoeirinha': { mortinf: 10.8, homic: 5.7 },
  'Cidade Ademar': { mortinf: 11.8, homic: 3.7 },
  'Cidade Tiradentes': { mortinf: 11.5, homic: 6.8 },
  'Ermelino Matarazzo': { mortinf: 6.6, homic: 3.5 },
  'Freguesia-Brasilândia': { mortinf: 15.8, homic: 4.4 },
  'Guaianases': { mortinf: 10.6, homic: 5.8 },
  'Ipiranga': { mortinf: 7.1, homic: 4.9 },
  'Itaim Paulista': { mortinf: 10.8, homic: 7.5 },
  'Itaquera': { mortinf: 10.5, homic: 4.8 },
  'Jabaquara': { mortinf: 8.0, homic: 6.1 },
  'Jaçanã-Tremembé': { mortinf: 14.3, homic: 4.6 },
  'Lapa': { mortinf: 7.8, homic: 2.7 },
  "M'Boi Mirim": { mortinf: 9.7, homic: 8.6 },
  'Mooca': { mortinf: 9.7, homic: 2.6 },
  'Parelheiros': { mortinf: 10.6, homic: 6.1 },
  'Penha': { mortinf: 11.4, homic: 2.3 },
  'Perus': { mortinf: 14.1, homic: 2.5 },
  'Pinheiros': { mortinf: 1.4, homic: 1.6 },
  'Pirituba-Jaraguá': { mortinf: 11.6, homic: 5.6 },
  'Santana-Tucuruvi': { mortinf: 8.3, homic: 1.8 },
  'Santo Amaro': { mortinf: 5.8, homic: 1.9 },
  'São Mateus': { mortinf: 11.1, homic: 5.5 },
  'São Miguel': { mortinf: 11.5, homic: 4.7 },
  'Sapopemba': { mortinf: 11.7, homic: 6.4 },
  'Sé': { mortinf: 7.6, homic: 5.5 },
  'Vila Maria-Vila Guilherme': { mortinf: 10.5, homic: 6.0 },
  'Vila Mariana': { mortinf: 2.9, homic: 1.5 },
  'Vila Prudente': { mortinf: 7.6, homic: 1.3 },
};

export const MOBILITY_SOURCE = 'Rede Nossa São Paulo / Ipec, Viver em São Paulo: Mobilidade Urbana (2024)';
/** Tempo médio diário em todos os deslocamentos (minutos), por zona da cidade, 2024. */
export const ZONE_COMMUTE: Record<string, number> = { centro: 143, oeste: 141, norte: 131, leste: 135, sul: 166 };
export const REGION_ZONE: Record<string, string> = { centro: 'centro', oeste: 'oeste', norte1: 'norte', norte2: 'norte', leste1: 'leste', leste2: 'leste', sul1: 'sul', sul2: 'sul' };
