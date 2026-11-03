// Partidos e federações reais — retrato de 30/10/2026.
// Fonte: TSE, "Partidos políticos registrados no TSE" e "Federações partidárias registradas no TSE".
// Ideologia dos partidos reais fica em branco nesta versão: os valores serão calibrados por
// metodologia única e documentada (ex.: votações nominais), igual para todos.

export interface PartyData {
  id: string;
  acronym: string;
  name: string;
  number: number;
  type: 'real' | 'fictional';
  federationId: string | null;
}

export interface FederationData {
  id: string;
  name: string;
  memberIds: string[];
  approvedAt: string;
}

const p = (acronym: string, name: string, number: number, federationId: string | null = null): PartyData => ({
  id: `party_real_${acronym.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')}`,
  acronym, name, number, type: 'real', federationId,
});

export const FEDERATIONS: FederationData[] = [
  { id: 'fed_febrasil', name: 'Federação Brasil da Esperança (Fe Brasil)', memberIds: ['party_real_pt', 'party_real_pcdob', 'party_real_pv'], approvedAt: '2022-05-24' },
  { id: 'fed_psdbcidadania', name: 'Federação PSDB Cidadania', memberIds: ['party_real_psdb', 'party_real_cidadania'], approvedAt: '2022-05-26' },
  { id: 'fed_psolrede', name: 'Federação PSOL REDE', memberIds: ['party_real_psol', 'party_real_rede'], approvedAt: '2022-05-26' },
  { id: 'fed_renovacaosolidaria', name: 'Federação Renovação Solidária', memberIds: ['party_real_prd', 'party_real_solidariedade'], approvedAt: '2025-12-04' },
  { id: 'fed_uniaoprogressista', name: 'Federação União Progressista', memberIds: ['party_real_uniao', 'party_real_pp'], approvedAt: '2026-03-26' },
];

export const PARTIES: PartyData[] = [
  p('MDB', 'Movimento Democrático Brasileiro', 15),
  p('PDT', 'Partido Democrático Trabalhista', 12),
  p('PT', 'Partido dos Trabalhadores', 13, 'fed_febrasil'),
  p('PCdoB', 'Partido Comunista do Brasil', 65, 'fed_febrasil'),
  p('PSB', 'Partido Socialista Brasileiro', 40),
  p('PSDB', 'Partido da Social Democracia Brasileira', 45, 'fed_psdbcidadania'),
  p('AGIR', 'Agir', 36),
  p('MOBILIZA', 'Mobilização Nacional', 33),
  p('CIDADANIA', 'Cidadania', 23, 'fed_psdbcidadania'),
  p('PV', 'Partido Verde', 43, 'fed_febrasil'),
  p('AVANTE', 'Avante', 70),
  p('PP', 'Progressistas', 11, 'fed_uniaoprogressista'),
  p('PSTU', 'Partido Socialista dos Trabalhadores Unificado', 16),
  p('PCB', 'Partido Comunista Brasileiro', 21),
  p('PRTB', 'Partido Renovador Trabalhista Brasileiro', 28),
  p('DC', 'Democracia Cristã', 27),
  p('PCO', 'Partido da Causa Operária', 29),
  p('PODE', 'Podemos', 20),
  p('REPUBLICANOS', 'Republicanos', 10),
  p('PSOL', 'Partido Socialismo e Liberdade', 50, 'fed_psolrede'),
  p('PL', 'Partido Liberal', 22),
  p('PSD', 'Partido Social Democrático', 55),
  p('SOLIDARIEDADE', 'Solidariedade', 77, 'fed_renovacaosolidaria'),
  p('NOVO', 'Partido Novo', 30),
  p('REDE', 'Rede Sustentabilidade', 18, 'fed_psolrede'),
  p('DEMOCRATA', 'Democrata', 35),
  p('UP', 'Unidade Popular', 80),
  p('UNIÃO', 'União Brasil', 44, 'fed_uniaoprogressista'),
  p('PRD', 'Partido Renovação Democrática', 25, 'fed_renovacaosolidaria'),
  p('MISSÃO', 'Partido Missão', 14),
];

export function partyById(id: string): PartyData | undefined {
  return PARTIES.find((x) => x.id === id);
}

/** "Lista" eleitoral proporcional: federação conta como uma única agremiação (Lei 9.504/97 art. 6º-A). */
export function listIdForParty(partyId: string): string {
  const party = partyById(partyId);
  return party?.federationId ?? partyId;
}

export function listName(listId: string): string {
  const fed = FEDERATIONS.find((f) => f.id === listId);
  if (fed) return fed.name;
  return partyById(listId)?.acronym ?? listId;
}

export function listMembers(listId: string): string[] {
  const fed = FEDERATIONS.find((f) => f.id === listId);
  return fed ? fed.memberIds : [listId];
}

export function allListIds(): string[] {
  const ids = new Set<string>();
  for (const party of PARTIES) ids.add(listIdForParty(party.id));
  return [...ids];
}
