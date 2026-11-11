# PBS — Fase 10: Ideologia dos partidos calibrada por votações nominais

**Status:** implementado · 180 testes passando · build OK

## Objetivo
Até a Fase 9b, as 10 dimensões ideológicas de cada partido eram derivadas de uma única escala esquerda–direita de especialistas (provisório). Agora, sete dimensões usam o **comportamento real dos deputados de cada partido** em votações nominais da Câmara, misturado à escala. Essas posições alimentam o perfil de governo da IA (Fase 9b), as afinidades entre partidos e as coligações.

## Fonte e método
- **DADO REAL:** voto individual de cada deputado (`/votacoes/{id}/votos`, API Dados Abertos da Câmara dos Deputados), agregado pela sigla do deputado na data da votação. Não usamos a orientação de bancada, porque nas legislaturas recentes ela vem por bloco e não por partido.
- **MÉTODO DO JOGO** (decisões nossas, não regra real):
  - Coesão por partido em cada votação: (Sim − Não) / (Sim + Não). Obstrução conta como Não; abstenção e ausência ficam fora.
  - O resultado é multiplicado pelo sentido da votação (+1 se votar "Sim" puxa para o polo +, −1 caso contrário).
  - Média das votações do eixo, ×100, o que dá uma posição de −100 a +100.
  - Um partido só conta numa votação se tiver ao menos 3 deputados votando.
  - Mistura com a escala de especialistas (valor (v − 5) × 20):
    - 75% votações e 25% escala com 2 ou mais votações;
    - 50/50 com 1 votação;
    - só a escala sem votação (marcado ○ na interface);
    - só as votações quando o eixo não é derivável da escala.

## Votações usadas
| Eixo | Votação | Data | Sim × Não | "Sim" puxa para |
|---|---|---|---|---|
| Segurança | PL 583/2011, fim da saída temporária (id 596844-116) | 03/08/2022 | 311 × 98 | + (punitivo) |
| Segurança | PL 5.582/2025, "PL Antifacção" (2579832-62) | 18/11/2025 | 370 × 110 | + |
| Ambiente | PL 490/2007, marco temporal (345311-270) | 30/05/2023 | 283 × 155 | + (desenvolvimentista) |
| Ambiente | PL 3.729/2004, Lei Geral do Licenciamento (257161-337) | 12/05/2021 | 300 × 122 | + |
| Ambiente | PL 2.159/2021, licenciamento, emendas do Senado (257161-454) | 16/07/2025 | 267 × 116 | + |
| Economia | PL 4.173/2023, fundos exclusivos e offshores (2383287-43) | 25/10/2023 | 323 × 119 | − (mais tributação) |
| Economia | PL 591/2021, privatização dos Correios (2270894-103) | 05/08/2021 | 285 × 173 | + (mercado) |
| Desenvolvimento | PL 591/2021, Correios (2270894-103) | 05/08/2021 | 285 × 173 | + |
| Fiscal | PEC 32/2022, PEC da Transição, 1º turno (2194899-103) | 20/12/2022 | 331 × 168 | − (expansão) |
| Fiscal | PEC 241/2016, teto de gastos, 1º turno (2088351-235) | 10/10/2016 | 366 × 111 | + (austeridade) |
| Social | PL 3.179/2012, educação domiciliar (534328-167) | 18/05/2022 | 264 × 144 | + (conservador) |
| Social | PDL 3/2025, susta resolução do Conanda sobre aborto legal (2482078-57) | 05/11/2025 | 317 × 111 | + |
| Trabalho | PL 6.787/2016, reforma trabalhista (2122076-348) | 26/04/2017 | 296 × 177 | + (flexibilização) |
| Trabalho | PL 4.302/1998, terceirização irrestrita (20794-133) | 22/03/2017 | 232 × 188 | + |

Os placares completos de todas as votações estão em `src/engine/data/rollcall.ts` (`ROLLCALL_VOTES`) e na tabela "Votações usadas" da página Partidos.

### Votações descartadas por confusão de motivos
- **Privatização da Eletrobras:** o Novo votou contra por causa dos "jabutis" (emendas estranhas ao tema), e não por discordar de privatizar.
- **Arcabouço fiscal (2023):** PSOL e Novo votaram contra, por razões opostas, então a votação não separa os polos.
- **Igualdade salarial:** quase unânime, sem poder discriminante. Foi trocada pela terceirização.

## Mapeamento de siglas antigas (fusões e renomeações)
- DEM e PSL → União
- PTB e Patriota → PRD
- PROS → Solidariedade
- PSC, PHS e PTN → Podemos
- PRB → Republicanos
- PR → PL
- PPS → Cidadania
- PMDB → MDB
- PTdoB → Avante
- PMN → Mobiliza
- PTC → Agir

O PMB ainda não foi mapeado para o Democrata (bancada mínima, efeito desprezível; pendência).

## Resultado (−100 a +100; ° = só a escala de especialistas)
| Partido | economia | fiscal | social | seguranca | ambiente | trabalho | desenvolvimento |
|---|---|---|---|---|---|---|---|
| MDB | 3 | 24 | 51 | 80 | 62 | 56 | 44 |
| PDT | -65 | -54 | -38 | -6 | -45 | -72 | -40 |
| PT | -86 | -86 | -83 | -85 | -86 | -86 | -73 |
| PCdoB | -91 | -91 | -91 | -70 | -91 | -91 | -82 |
| PSB | -74 | -30 | -59 | -33 | -42 | -4 | -54 |
| PSDB | 12 | 25 | 52 | 64 | 71 | 64 | 46 |
| CIDADANIA | 20 | -14 | 37 | 81 | 40 | 9 | 47 |
| PV | -42 | -4 | -61 | -23 | -71 | -4 | -9 |
| AVANTE | -25 | -17 | 36 | 43 | 30 | -11 | 22 |
| PP | 32 | 34 | 78 | 89 | 82 | 62 | 79 |
| PODE | -3 | 29 | 78 | 81 | 50 | 34 | 40 |
| REPUBLICANOS | 25 | 88 | 90 | 88 | 87 | 61 | 84 |
| PSOL | -93 | -93 | -93 | -93 | -93 | -93 | -86 |
| PL | 69 | 80 | 91 | 91 | 91 | 54 | 69 |
| PSD | -15 | 19 | 68 | 85 | 61 | 59 | 31 |
| SOLIDARIEDADE | -7 | -4 | 46 | 65 | 21 | -5 | 44 |
| NOVO | 93 | 87 | 93 | 93 | 93 | 73° | 87 |
| REDE | -26° | -63 | -26° | -26° | -26° | -81 | -26° |
| UNIÃO | 33 | 33 | 72 | 91 | 85 | 65 | 74 |
| PRD | 24 | 64 | 91 | 91 | 40 | 53 | 67 |

Os partidos sem bancada suficiente (Agir, Mobiliza, PSTU, PCB, PRTB, DC, PCO, Democrata, UP) ficam só com a escala.

**Leituras que o dado trouxe e a escala não mostrava:**
- PSD e MDB ficam no centro em economia (−15 e +3), mas à direita em segurança (+85 e +80).
- O PSB fica perto do centro em trabalho (−4).
- O PL é mais moderado em trabalho (+54) do que nos demais eixos.
- O Republicanos é muito austero no fiscal (+88).

## Limitações (declaradas)
- **Efeito governo/oposição:** voto nominal mede também disciplina e posição em relação ao governo da época, não só convicção. Por exemplo, a PEC da Transição foi votada antes da posse de Lula, e o teto de gastos no governo Temer.
- **Só a Câmara;** o Senado ainda não entra.
- **Poucas votações por eixo** (1 a 3). Cada eixo deve ganhar mais votações nas próximas calibrações.
- **Três eixos sem dado:** organização do Estado, relações internacionais e direitos individuais ficam nulos, à espera de votações que os separem bem.
- **Partido atual ≠ partido da época:** fusões são mapeadas, mas a migração individual de deputados entre partidos não é considerada.

## Arquivos
- `src/engine/data/rollcall.ts`: votações e posições geradas (`ROLLCALL_VOTES`, `ROLLCALL_POSITIONS`).
- `src/engine/data/ideology.ts`: `expertDerived`, `axisPosition` (valor, base, nº de votações) e `partyIdeology`, que agora vem da mistura.
- `src/ui/ideologia.tsx`: painel "Ideologia por tema" na página Partidos, com mapa de cores, marcação ●/○ e a lista das votações.
- `src/engine/game/ideology.test.ts`: sinais esquerda/direita, regra de mistura, limites e placares.
