# PBS — Fase 9: indicadores sociais

**Pedido do usuário:** em qualquer cargo, ver indicadores sociais e sentir que o trabalho muda a cidade, a região, o estado ou o país, e não só a popularidade.

**Módulos novos:**
- `game/indicators.ts`: dados, simulação, efeitos do jogador e regras;
- `ui/indicadores.tsx`: página "Indicadores sociais".

Com mandato, a página aparece em "Meu cargo" como "Indicadores sociais do meu território"; sem mandato, em "Estado e União".

**Integração:**
- turno mensal, no passo 7d;
- ações "Enviar indicação ao Executivo" e "Indicar emendas ao orçamento", esta agora com escolha de área;
- leis do jogador, emendas pagas e projetos aprovados na Alesp e no Congresso;
- save: partidas antigas recebem o módulo ao carregar.

**Testes:** 176 passando, 7 deles em `indicators.test.ts`.

---

## 1. Indicadores e dados de partida (REGRA REAL / dado real)

| Esfera | Indicador | Partida | Fonte |
|---|---|---|---|
| Cidade de SP | Mortalidade infantil | 10,0 por mil nascidos vivos (2025) | SMS-SP, Boletim CEInfo por Subprefeitura (2026) |
| Cidade de SP | Ideb anos iniciais, rede municipal | 5,6 (2023) | Inep |
| Cidade de SP | Homicídios | 5,1 por 100 mil, padronizado por idade (2024) | SMS-SP, Boletim CEInfo (SIM) |
| Cidade de SP | Tempo diário em deslocamentos | 145 min, ida e volta (2024) | Rede Nossa SP / Ipec, Viver em SP: Mobilidade (pesquisa de opinião) |
| Cidade de SP | Mortes no trânsito | 4,3 por 100 mil (2024) | SIM/DataSUS, via Observatório Umane |
| Cidade de SP | Moradores sem atividade cultural no ano | 24% (dez/2017) | Rede Nossa SP / Ibope, Viver em SP: Cultura (edição mais recente com esse recorte) |
| Cidade de SP | Domicílios urbanos com coleta de esgoto | 89,1% (2024) | Cetesb / SMDU-Deinfo |
| Cidade de SP | Pessoas em situação de rua | 93.355 (jan/2025) | CadÚnico, via OBPopRua/UFMG (o censo municipal de 2021, com outro método, contou 31.884) |
| Estado de SP | Mortalidade infantil | 11,45 (2024) | Fundação Seade |
| Estado de SP | Ideb anos iniciais, todas as redes | 6,5 (2023) | Inep |
| Estado de SP | Homicídios | 6,6 por 100 mil (2024) | Atlas da Violência 2026 |
| Estado de SP | Desocupação | 5,0% (2025) | IBGE, PNAD Contínua |
| Estado de SP | Domicílios ligados à rede de esgoto | 94,1% (2024) | IBGE, PNAD Contínua |
| Estado de SP | Mortes no trânsito | 11,7 por 100 mil (2024) | Atlas da Violência 2026 |
| Estado de SP | Sem atividade cultural no ano | 26% (2025) | Fundação Seade |
| Brasil | Mortalidade infantil | 12,5 por mil (2023) | IBGE, Tábua de Mortalidade |
| Brasil | Ideb anos iniciais | 6,0 (2023) | Inep |
| Brasil | Mortes violentas intencionais | 19,1 por 100 mil (2025) | Anuário FBSP 2026 |
| Brasil | Desocupação | 5,6% (2025) | IBGE, PNAD Contínua |
| Brasil | Pobreza (US$ 6,85 PPC/dia) | 23,1% (2024) | IBGE, SIS 2025 |
| Brasil | Extrema pobreza (US$ 2,15 PPC/dia) | 3,5% (2024) | IBGE, SIS 2025 |
| Brasil | Domicílios ligados à rede de esgoto | 70,4% (2024) | IBGE, PNAD Contínua |
| Brasil | Mortes no trânsito | 17,5 por 100 mil (2024) | Atlas da Violência 2026 |
| Brasil | Sem atividade cultural presencial em 12 meses | 12% (2026) | Observatório Fundação Itaú / Datafolha |

Cada indicador mostra também:
- quem tem a **competência real**, por exemplo polícias com o estado e Ideb municipal com a rede da prefeitura;
- **como o jogador influencia** aquele indicador.

## 2. Como os indicadores evoluem (SIMULAÇÃO)

A fórmula é: `valor = tendência de fundo × (1 ∓ melhora estrutural ∓ contribuição do jogador)`.

- **Tendência de fundo (PARÂMETRO):** variação anual pequena, como mortalidade −1%/ano, homicídios −2%/ano, população de rua +2%/ano e esgoto +0,3 a 0,5 p.p./ano.
- **Melhora estrutural:** vem dos modelos de governo que o jogo já tinha.
  - **Cidade:** desempenho das secretarias da prefeitura em relação ao início, valendo para prefeito da IA ou do jogador, e para a pasta do jogador secretário. Elasticidade de até ±10% na mortalidade infantil, por exemplo.
  - **Estado:** índices do governo estadual quando o jogador é governador ou secretário estadual. A segurança do estado também afeta os homicídios na capital.
  - **Brasil:** índices do governo federal (ações dos ministérios) e a economia simulada. A desocupação segue a economia do governo federal; a do estado acompanha a nacional, na proporção de 2025.
- **Contribuição do jogador (PROPOSTA):** cada efeito entra aos poucos ao longo de meses e perde cerca de 0,6% ao mês sem renovação.

| Origem | Efeito |
|---|---|
| Indicação atendida (vereador) | 0,8% de melhora no tema, na sua região, em 6 meses |
| Emendas ao orçamento executadas (vereador) | 1,6% no tema escolhido, na sua região, em 9 meses |
| Lei municipal sancionada do jogador | 2,2% (cria programa) ou 0,9% (regulação), cidade inteira, em 12 meses |
| Emenda ou verba paga a uma região da capital (deputado/senador) | até 4% na região (R$ mi ÷ 4); para deputado estadual, também até 1% no estado |
| Emenda paga a uma região do Brasil (federal) | até 1,5% no Brasil |
| Projeto aprovado na Alesp / no Congresso | 1,2% no estado / 0,6% no Brasil, em 12 meses |

**Temas e indicadores que movem:**

| Tema | Indicador |
|---|---|
| saúde | mortalidade infantil |
| educação | Ideb |
| GCM / segurança | homicídios ou mortes violentas |
| habitação / assistência | população de rua, pobreza e extrema pobreza |
| zeladoria / meio ambiente / infraestrutura | esgoto |
| economia | desocupação |

Mobilidade e cultura ainda não mexem em nenhum indicador social.

## 3. Regiões da capital

- A página mostra mortalidade infantil, Ideb, homicídios e esgoto nas 8 regiões do jogo, com destaque para a sua região de base.
- **Diferença entre regiões (PARÂMETRO):** depende da renda da região, inspirada nos dados de desigualdade intraurbana.
  - Renda baixa: indicadores "quanto menor melhor" ×1,3, Ideb −0,35 e esgoto −6 p.p.
  - Renda alta: indicadores "quanto menor melhor" ×0,7, Ideb +0,4 e esgoto +7 p.p.
  - O valor da cidade é o dado oficial.
- Efeitos com região, como indicações e emendas, melhoram essa região e entram na média da cidade pelo peso da população.

## 4. Retorno político

Quando o efeito de uma ação chega ao território (PROPOSTA):
- aprovação do mandato: até +1,5 por mês;
- reconhecimento: até +0,5 por mês;
- simpatia na região beneficiada.

O log avisa quando o efeito de uma ação termina de entrar.

**Prefeito, governador e presidente:** a aprovação já vinha das secretarias e dos índices de governo. Os indicadores mostram esse resultado em números reais, sem contar o efeito duas vezes.

## 5. Página

- Abas Cidade, Estado e Brasil; a aba do mandato atual é a primeira.
- Cartão por indicador com:
  - valor e variação desde o dado de partida;
  - "seu efeito" nas unidades do indicador;
  - competência, alavancas e fonte.
- Tabela por região da capital.
- Lista "Seus efeitos em andamento".
- Evolução anual, com fechamento em dezembro.
- Regras.

## 6. Fase 9b: mobilidade, cultura, subprefeituras e ideologia dos governos da IA

**Mobilidade e cultura**
- Os indicadores novos estão na tabela da seção 1.
- Os temas mobilidade e cultura das ações agora movem esses indicadores. As secretarias municipais de Mobilidade e Cultura também contam, assim como o transporte metropolitano do governo do estado (deslocamento na capital e trânsito no estado) e a infraestrutura federal (trânsito no Brasil).

**Dados por região vindos das subprefeituras (dado real)**
- **Mortalidade infantil (2025) e homicídios (2024):** vêm das 32 subprefeituras, segundo o Boletim CEInfo da Secretaria Municipal da Saúde. A média de cada região do jogo é ponderada pela população do Censo 2022.
  - Exemplos: Pinheiros 1,4 e Freguesia-Brasilândia 15,8 de mortalidade infantil; M'Boi Mirim 8,6 e Vila Prudente 1,3 de homicídios.
- **Tempo de deslocamento:** vem da pesquisa Viver em SP 2024 por zona: Norte 131 min, Leste 135, Oeste 141, Centro 143, Sul 166.
- **Página:** a tabela por região marca cada coluna como DADO REAL ou PARÂMETRO. Há também uma tabela das 32 subprefeituras.
- **Evolução:** cada subprefeitura acompanha a evolução da cidade e o efeito do jogador na região.
- **Ainda por parâmetro de renda:** Ideb, esgoto e cultura por região.

**Perfil ideológico dos governos da IA (PROPOSTA)**

Quando quem governa é **personagem do jogo**, as decisões automáticas seguem o vetor ideológico do partido (escala de especialistas, Bolognesi et al. 2025, eixos derivados):

| Eixo | Efeito |
|---|---|
| Fiscal (expansão ↔ disciplina) | Postura fiscal: ajuste / neutra / expansão. Na prefeitura, muda a regra de contingenciamento e o tamanho do reforço ou corte no orçamento; na União, a política fiscal do ano |
| Econômico (intervenção ↔ mercado) | Carga tributária: reduzir / manter / aumentar |
| Econômico, social, segurança e ambiente | Peso de cada área (0,75 a 1,3): à esquerda, mais assistência, habitação, saúde, educação e cultura; à direita, mais infraestrutura, mobilidade e segurança |

**Carga tributária, por esfera:**
- **Prefeito:** no 3º mês do mandato, envia à Câmara uma redução do ISS (−4%) ou uma atualização do IPTU (+5%). O projeto precisa ser aprovado e respeita a anterioridade (CF art. 150).
- **Presidente:** pequenos efeitos mensais em crescimento, resultado primário e índice social.

**Como o perfil age em cada esfera:**
- **Prefeitura:** as secretarias da área prioritária lançam programas e ações com mais frequência, e a proposta de orçamento reforça a área prioritária.
- **Governo do estado:** quando o governador é personagem do jogo, há um modelo novo de índices estaduais (segurança, saúde, educação, mobilidade e habitação) que tende às prioridades do perfil e alimenta os indicadores do estado.
- **União:** a política fiscal do ano e os índices dos ministérios tendem às prioridades do perfil.
- **Página:** o cartão "Quem governa" mostra o nome, o partido, se é você, pessoa real ou personagem do jogo, e o resumo do perfil.

**Pessoas reais:** o prefeito, o governador e o presidente reais em exercício **não** são simulados por dentro. O jogo não decide por eles, e nessas esferas os indicadores seguem a tendência de fundo e a economia. Partidos sem classificação na fonte geram um perfil neutro.

## 7. Pendências

1. Ideb, esgoto e cultura com dado oficial por subprefeitura ou distrito.
2. Calibrar os eixos ideológicos com votações nominais por tema, como já previsto na metodologia de ideologia.
3. Notícias quando um indicador bate recorde ou piora muito.
