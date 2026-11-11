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

**Testes:** 173 passando, 4 deles em `indicators.test.ts`.

---

## 1. Indicadores e dados de partida (REGRA REAL / dado real)

| Esfera | Indicador | Partida | Fonte |
|---|---|---|---|
| Cidade de SP | Mortalidade infantil | 11,4 por mil nascidos vivos (2024) | Seade / SMDU-Deinfo |
| Cidade de SP | Ideb anos iniciais, rede municipal | 5,6 (2023) | Inep |
| Cidade de SP | Homicídios dolosos | 4,36 vítimas por 100 mil (2024) | SSP-SP |
| Cidade de SP | Domicílios urbanos com coleta de esgoto | 89,1% (2024) | Cetesb / SMDU-Deinfo |
| Cidade de SP | Pessoas em situação de rua | 93.355 (jan/2025) | CadÚnico, via OBPopRua/UFMG (o censo municipal de 2021, com outro método, contou 31.884) |
| Estado de SP | Mortalidade infantil | 11,45 (2024) | Fundação Seade |
| Estado de SP | Ideb anos iniciais, todas as redes | 6,5 (2023) | Inep |
| Estado de SP | Homicídios | 6,6 por 100 mil (2024) | Atlas da Violência 2026 |
| Estado de SP | Desocupação | 5,0% (2025) | IBGE, PNAD Contínua |
| Estado de SP | Domicílios ligados à rede de esgoto | 94,1% (2024) | IBGE, PNAD Contínua |
| Brasil | Mortalidade infantil | 12,5 por mil (2023) | IBGE, Tábua de Mortalidade |
| Brasil | Ideb anos iniciais | 6,0 (2023) | Inep |
| Brasil | Mortes violentas intencionais | 19,1 por 100 mil (2025) | Anuário FBSP 2026 |
| Brasil | Desocupação | 5,6% (2025) | IBGE, PNAD Contínua |
| Brasil | Pobreza (US$ 6,85 PPC/dia) | 23,1% (2024) | IBGE, SIS 2025 |
| Brasil | Extrema pobreza (US$ 2,15 PPC/dia) | 3,5% (2024) | IBGE, SIS 2025 |
| Brasil | Domicílios ligados à rede de esgoto | 70,4% (2024) | IBGE, PNAD Contínua |

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

## 6. Pendências

1. Indicadores para mobilidade e cultura, como tempo de viagem e acesso a equipamentos, com dado real.
2. Dados oficiais por subprefeitura ou distrito, no lugar do parâmetro de renda.
3. Indicadores estaduais para quando o governador é personagem do jogo, com um modelo de governo estadual da IA.
4. Notícias quando um indicador bate recorde ou piora muito.
