# PBS — Fase 11: Senado na ideologia, novos temas e identidade visual 8-bit

**Status:** implementado · 183 testes passando · balanceamento OK · build OK

## 1. Votações do Senado
- **DADO REAL:** voto nominal de cada senador, com o partido dele na data da votação.
  - Fonte: Senado Federal, Dados Abertos, serviço `/plenario/lista/votacao/{início}/{fim}`.
  - Foram indexadas 718 votações abertas, de 2015 a nov/2026. Votações secretas, como as de autoridades, ficam de fora.
  - O serviço consta como descontinuado pelo próprio Senado, mas ainda respondia em 10/11/2026. Se parar, a coleta precisará migrar para `/dadosabertos/votacao`.
- **MÉTODO DO JOGO:**
  - Mesmo cálculo de coesão da Fase 10.
  - Mínimo de **2 senadores** votando por partido (na Câmara são 3).
  - As votações das duas casas entram na **mesma média simples** do eixo. Cada votação pesa igual, seja da Câmara ou do Senado.
  - As siglas antigas seguem o mesmo mapa da Fase 10. O **PMB agora é mapeado ao Democrata**, pendência que ficou da Fase 10.

| Eixo | Votação no Senado | Data | Sim × Não | "Sim" puxa para |
|---|---|---|---|---|
| Segurança | PL 2.253/2022, fim da saída temporária (sessão 6818) | 20/02/2024 | 61 × 2 | + |
| Ambiente | PL 2.903/2023, marco temporal (6756) | 27/09/2023 | 43 × 21 | + |
| Ambiente | PL 2.159/2021, licenciamento ambiental (6935) | 21/05/2025 | 54 × 13 | + |
| Fiscal | PEC 32/2022, PEC da Transição, 1º turno (6671) | 20/12/2022 | 63 × 10 | − |
| Trabalho | PLC 38/2017, reforma trabalhista (5726) | 11/07/2017 | 50 × 25 | + |
| Organização do Estado | PEC 45/2019, reforma tributária, 2º turno (6777) | 08/11/2023 | 53 × 24 | + (centralização) |
| Organização do Estado | PLP 18/2022, teto do ICMS sobre combustíveis, energia e telecom (6612) | 13/06/2022 | 65 × 12 | + |
| Direitos individuais | PEC 45/2023, criminalização do porte de drogas, 1º turno (6824) | 16/04/2024 | 53 × 9 | + (restrição) |

No Senado, os placares somam só os votos de senadores com partido. As votações de economia não entraram:
- A privatização da Eletrobras tem o mesmo problema dos "jabutis" visto na Câmara.
- A taxação de offshores não teve votação nominal útil.

## 2. Temas que estavam sem dado
### Organização do Estado (descentralização ↔ centralização)
- Duas medidas centralizadoras de **governos opostos**, votadas nas duas casas:
  - **Reforma tributária (2023, governo Lula):** o IBS substitui ICMS e ISS e passa a ter um comitê gestor nacional.
    - Câmara: 2196833-373, 375 × 113.
  - **Regras federais sobre o ICMS (2021–2022, governo Bolsonaro):**
    - Câmara: PLP 11/2020, votação 2237876-99 (392 × 71).
    - Senado: PLP 18/2022.
- Juntar as duas atenua o efeito governo/oposição. Fica a disposição de cada partido de aceitar que a União decida sobre tributos de estados e municípios.
- **Leitura:**
  - Quase todos os partidos aparecem centralizadores, porque o Congresso aprovou essas medidas com folga.
  - O Novo é o único claramente descentralizador (−67).
  - PL (+11) e Republicanos (+30) são os menos centralizadores entre os grandes.
- **Limite:** o eixo mede só centralização tributária. Ainda não há votações sobre segurança ou saúde que separem os partidos; a PEC da Segurança Pública (PEC 18/2025) passou quase por unanimidade nas duas casas.

### Direitos individuais (proteção liberal ↔ restrição em nome de valores coletivos)
- **PEC 45/2023 (Senado):** criminaliza o porte de qualquer quantidade de droga. É o caso clássico de restringir uma conduta individual em nome de um valor coletivo.
- **Descartado: PL 2.630/2020 ("PL das Fake News", urgência na Câmara).** Os dois lados invocam direitos (liberdade de expressão de um lado, proteção contra desinformação do outro), então o sentido do voto não é inequívoco. Incluído, ele zerava PT e PL e colocava o PSOL no extremo "restritivo" por uma única votação.
- **Limite:** o eixo usa uma votação, só do Senado. Partidos sem pelo menos 2 senadores votando (PSOL, Novo, PCdoB, PV, Cidadania etc.) ficam sem dado nele.

### Relações internacionais (multilateralismo ↔ nacionalismo): continua sem dado
- Acordos internacionais costumam ser aprovados em votação simbólica ou quase unânime. Exemplo: a Lei da Reciprocidade (2025) passou quase por unanimidade.
- A única votação disputada encontrada foi a da **Base de Alcântara (PDL 523/2019, 329 × 86)**. Ela mede alinhamento com os EUA e soberania tecnológica, e não adesão a instituições multilaterais.
- Usar essa votação inverteria o sentido do eixo. A decisão foi **deixar o tema sem dado** em vez de forçar uma leitura.

## 3. Resultado atualizado (−100 a +100; ° = só escala de especialistas; — = sem dado)
| Partido | economia | fiscal | social | seguranca | ambiente | trabalho | desenvolvimento | estado | direitos |
|---|---|---|---|---|---|---|---|---|---|
| MDB | 3 | -7 | 51 | 81 | 53 | 55 | 44 | 41 | 25 |
| PDT | -65 | -63 | -38 | -6 | -39 | -72 | -40 | 90 | — |
| PT | -86 | -86 | -83 | -48 | -86 | -86 | -73 | 46 | -100 |
| PCdoB | -91 | -91 | -91 | -70 | -91 | -91 | -82 | 100 | — |
| PSB | -74 | -30 | -59 | -11 | -23 | -10 | -54 | 94 | 100 |
| PSDB | 12 | -5 | 52 | 71 | 74 | 66 | 46 | 59 | — |
| CIDADANIA | 20 | -14 | 37 | 81 | 40 | 9 | 47 | 86 | — |
| PV | -42 | -4 | -61 | -23 | -71 | -4 | -9 | 75 | — |
| AVANTE | -25 | -17 | 36 | 43 | 30 | -11 | 22 | 86 | — |
| PP | 32 | 11 | 78 | 90 | 86 | 72 | 79 | 55 | 100 |
| PODE | -3 | 24 | 78 | 84 | 65 | 18 | 40 | 64 | 100 |
| REPUBLICANOS | 25 | 88 | 90 | 90 | 89 | 61 | 84 | 30 | 100 |
| PSOL | -93 | -93 | -93 | -93 | -93 | -93 | -86 | 38 | — |
| PL | 69 | 63 | 91 | 92 | 89 | 67 | 69 | 11 | 100 |
| PSD | -15 | -9 | 68 | 85 | 48 | 58 | 31 | 87 | 100 |
| SOLIDARIEDADE | -7 | -4 | 46 | 65 | 21 | -5 | 44 | 64 | — |
| NOVO | 93 | 87 | 93 | 93 | 93 | 73° | 87 | -67 | — |
| REDE | -26° | -63 | -26° | -26° | -26° | -81 | -26° | — | — |
| UNIÃO | 33 | 3 | 72 | 92 | 88 | 75 | 74 | 78 | 100 |
| PRD | 24 | 23 | 91 | 91 | 40 | 41 | 67 | 73 | — |

**Mudanças trazidas pelo Senado:**
- O PT ficou menos punitivo em segurança (de −85 para −48). Na saidinha, a bancada do PT no Senado votou majoritariamente a favor do fim do benefício.
- O PSB foi para perto do centro em segurança (−11) e votou a favor da PEC das Drogas (+100 em direitos).
- O MDB e o PSD ficaram levemente expansionistas no fiscal (−7 e −9), porque apoiaram a PEC da Transição no Senado.

## 4. Identidade visual 8-bit
Pedido do Leonardo: um visual "menos sem vida", no estilo 8-bit.

- **Fontes** (embutidas no build via `@fontsource`, sem depender de rede; licença SIL OFL):
  - Press Start 2P: títulos e marca;
  - Pixelify Sans: texto corrido, botões e tabelas;
  - VT323: números (medidores, tabelas, caixa).
  - A Press Start 2P encolhe as maiúsculas acentuadas para caber no bloco de 8 px, por isso os títulos nela não usam caixa-alta forçada.
- **Paleta:**
  - fundo noturno (#1b1f3b);
  - verde, amarelo e azul da bandeira em versão saturada (#10a04e, #ffc61a, #2a78dc);
  - vermelho, roxo e ciano de apoio;
  - papel creme com grade de pontos.
- **Linguagem visual:**
  - cantos retos;
  - bordas de 3 px;
  - sombra dura sem desfoque (4 px), e o botão "afunda" ao clicar;
  - barras de indicador segmentadas em blocos;
  - pontos de agenda quadrados e cadeiras do plenário em pixels;
  - abas com cara de pasta;
  - rolagem pixelada.
- **Elementos de jogo:**
  - cursor ▶ piscando no item ativo do menu;
  - ícone de urna em pixel art na marca (desenho próprio, em SVG);
  - tela inicial com céu estrelado, skyline pixelado e título com sombra dupla;
  - janelas no estilo caixa de diálogo de RPG, com moldura dupla e fundo em scanlines.
  - Animações respeitam `prefers-reduced-motion`.
- Celular conferido em 390 px.

## Arquivos
- `src/engine/data/rollcall.ts`: gerado; votações das duas casas com o campo `house: 'CD' | 'SF'`.
- `src/ui/ideologia.tsx`: inclui os temas organização do Estado e direitos, e a coluna "Casa" na lista de votações.
- `src/ui/pages.tsx`: texto explicativo atualizado.
- `src/index.css`: nova identidade visual.
- `src/engine/game/ideology.test.ts`: testes da Fase 11 (duas casas, novos eixos, internacional nulo).
- Dependências novas: `@fontsource/press-start-2p`, `@fontsource/pixelify-sans`, `@fontsource/vt323`.
