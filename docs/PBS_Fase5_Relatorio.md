# PBS — Relatório da Fase 5: mundo vivo, eleições gerais e carreira até 2036

Critério de conclusão do plano v0.4: **o mundo evolui sem o jogador e a carreira pode ir além de 2032**. A partida agora começa em janeiro de 2027 e termina em dezembro de 2036. Nesse período há três eleições municipais (2028, 2032 e 2036) e duas gerais (2030 e 2034). O jogo também termina quando o jogador encerra a carreira, e em ambos os casos mostra um desfecho.

Save: versão 8, com migração automática a partir da v7. Testes: 112 passando, 18 deles em `phase5.test.ts`.

---

## 1. Ciclos eleitorais e pacotes de regras (5.4) — `game/cycle.ts`, `data/rulepack.ts`

O calendário passou a ser calculado por ciclo:
- **Municipais** em Y = 2028, 2032, 2036…; **gerais** em G = 2030, 2034…
- Funções principais: `munCycle`, `genCycle`, `nextElection` e `munTerm`.
- Todos os gatilhos que antes eram fixos em 2028, 2029 e 2032 agora dependem do ciclo. Isso inclui:
  - pré-candidatura e convenções;
  - pesquisas;
  - posse;
  - Mesa da Câmara, que agora tem eleição em janeiro de 2029 e de 2033 e em dezembro dos anos intermediários;
  - arquivamento de projetos no fim da legislatura;
  - PPA no 1º ano de cada mandato;
  - prazo do Programa de Metas;
  - LRF arts. 21 e 42 no fim de cada mandato;
  - janela partidária, em março de 2028 e 2032 para vereadores e de 2030 e 2034 para deputados.

**Pacotes de regras**

| Pacote | Status | Conteúdo |
|---|---|---|
| `BR-2028-MUN-v0.1` | inalterado | — |
| `BR-2032-MUN-proj`, `BR-2036-MUN-proj` | DERIVADA | Mesmas regras de 2028, com as datas recalculadas (1º domingo e último domingo de outubro, 6 meses antes, posse em 1º/01). |
| `BR-2030-GER-proj`, `BR-2034-GER-proj` | ver itens abaixo | Pacote novo das eleições gerais. |

Itens do pacote das eleições gerais:
- **Datas** (CF arts. 28 e 77): 1º turno no primeiro domingo de outubro; 2º turno no último domingo de outubro.
- **Posses**:
  - presidente em 5/1 e governador em 6/1 — **EC 111/2021, REGRA REAL**;
  - deputados federais e senadores em 1º/02 — CF art. 57 §4º;
  - Alesp em 15/03 — REGRA REAL (prática confirmada nas legislaturas de 2019 e 2023).
- **Idade mínima** (CF art. 14 §3º VI): senador 35 anos, governador 30, deputado 21.
- **Cadeiras**:
  - Alesp com 94 (CF art. 27: 36 + 58);
  - 70 deputados federais por SP (LC 78/93);
  - no Senado, 1 vaga em 2030 e 2 em 2034 (CF art. 46 §2º).
- **Eleitorado do estado**: 34,1 milhões (TSE 2026).
- **Limites de gastos** de deputados: DERIVADA, valor de 2022 corrigido. Os de senador e governador são valores de jogo (PROPOSTA), porque o limite real é fixado pelo TSE por estado.

> **Projeção, não previsão:** os ciclos a partir de 2030 aplicam a lei vigente em 30/10/2026. Reformas posteriores não são modeladas. A página Regras diz isso explicitamente.

## 2. Mundo estadual e federal e eleições gerais (5.5) — `game/general.ts`, página **Estado e União**

**Estado inicial**: somente fatos públicos de 2026.
- Presidente: Lula (PT), reeleito em 2026, com mandato de 2027 a 2030. Não pode concorrer em 2030.
- Governador: Tarcísio de Freitas (Republicanos), reeleito no 1º turno de 2026. Também não pode concorrer em 2030 (CF art. 14 §5º).
- Senadores por SP: Guilherme Derrite (PP) e André do Prado (PL), eleitos em 2026, e Marcos Pontes (PL), com mandato até jan/2031.
- Alesp eleita em 2026: PL 27, PT 16, PSOL 9, PSD 9, Podemos 6, Republicanos 6, MDB 5, PP 5, União 4, PSB 3, Missão 1, PSDB 1, Novo 1, PRD 1.
- Bancada federal de SP: PL 19, Fed. PT-PCdoB-PV 11, Podemos 6, PSD 6, Republicanos 6, PSOL 6, MDB 4, PP 3, União 2, Novo 2, PSB 2, PRD 1, PSDB 1, Missão 1.
  - As 11 vagas da federação Fé Brasil ficaram com o PT (Metrópoles, 05/10/2026). Orlando Silva, do PCdoB, não se reelegeu.
- Vereadores de SP eleitos deputados em 2026 (Câmara Municipal de SP, 05/10/2026):
  - federais: Lucas Pavanato, Sargento Nantes, Ana Carolina Oliveira, Luna Zarattini, Sidney Cruz e Dra. Sandra Tadeu;
  - estaduais: Thammy Miranda, Marina Bragante e Keit Lima.
  - No jogo, eles saem na posse (fevereiro ou março de 2027). Quem assume é um suplente **fictício do mesmo partido**; os suplentes reais não são modelados.
  - Carlos Bezerra Jr. também foi eleito, mas estava como suplente em exercício e não faz parte da composição de 2024 usada pelo jogo.

**Eleição geral simulada** (outubro de G):
- **Alesp (94) e Câmara (70)**: mesmo motor proporcional real da Câmara Municipal (CE arts. 106–111, sobras 80/20 e decisão do STF de 2024), com auditoria passo a passo.
  - A força das listas parte da bancada anterior e do momento do partido.
  - Os candidatos são fictícios, exceto o jogador e os vereadores fictícios que decidiram concorrer.
- **Governador**: 1º e 2º turnos. Se o jogador vai ao 2º turno, ganha um mês de campanha, como na disputa pela prefeitura.
  - Governador fictício em 1º mandato disputa a reeleição, com peso pela avaliação.
- **Senado**: maioria simples, com uma ou duas vagas.
- **Presidência**: simulação de fundo com candidatos fictícios.
  - **SIMPLIFICAÇÃO justificada**: o jogador não disputa a Presidência, porque o escopo do jogo é São Paulo.
  - O resultado muda o alinhamento federal.
- **Pessoas reais**: a partir de 2030, todos os candidatos majoritários são personagens fictícios. O jogo não decide se Tarcísio, Pontes ou qualquer pessoa real vai concorrer, nem quem venceria.

**Posses**: em janeiro, dos executivos; em fevereiro, dos deputados federais e senadores; em março, da Alesp. As bancadas e os executivos do estado são atualizados a partir do resultado.

**Desincompatibilização**
- Para concorrer, prefeito e governador renunciam até seis meses antes (CF art. 14 §6º).
- Secretário municipal se afasta no mesmo prazo (LC 64/90 art. 1º, III, "b", 3). Está marcado como DERIVADA, a confirmar na jurisprudência do TSE.
- Assessor se afasta três meses antes (LC 64/90 art. 1º, II, "l").
- Como funciona no jogo:
  - existe a ação "Renunciar/afastar-se para concorrer";
  - quem ainda ocupa o cargo em abril tem o registro **indeferido**, com o motivo explicado na lista de elegibilidade.

**Interconexão**: o alinhamento entre o partido do prefeito e o do governador e do presidente aumenta a chance de sucesso dos convênios ("Negociar convênios com Estado e União"). O governador jogador pode mandar convênios para a capital.

## 3. Novos níveis jogáveis (5.6) — `game/upper.ts`, `game/careers.ts`

| Cargo | Ações | Observações |
|---|---|---|
| Deputado(a) estadual e federal, senador(a) | apresentar projeto; indicar emenda individual por região; articular com o governo; disputar cargo em comissão; fiscalizar; agenda na base | Emendas são impositivas (CF art. 166 §§9º–11), mas o pagamento depende do Executivo. Emenda paga gera boa vontade na região. A agenda em Brasília afasta da base. |
| Governador(a) | programas estaduais por área (segurança, saúde, educação, metrô e trens, habitação); negociar base na Alesp (maioria: 48); convênio com a capital | Sem maioria, os programas atrasam. Há crises estaduais e a aprovação depende dos indicadores. |
| Secretário(a) estadual | programas da pasta; articular com o governador | Convite do governador eleito por afinidade política, com a mesma lógica do convite municipal. Pode haver exoneração. |

- **SIMPLIFICAÇÃO declarada**: Alesp, Câmara dos Deputados e Senado não têm votação nominal simulada. O mandato é abstrato: prazos, chances de jogo e relação com o Executivo. O aviso aparece na própria página.
- **Subsídios**:
  - deputado federal e senador: R$ 46.366,19 (2025, REAL);
  - deputado estadual: 75% do federal (CF art. 27 §2º, DERIVADA);
  - governador e secretário estadual: valor de jogo.
- **Transições**:
  - vereador eleito deputado deixa a Câmara na posse e o suplente assume;
  - mandatos vencem na data certa;
  - reeleição consecutiva é contada para prefeito e governador;
  - a cassação vale para qualquer cargo: suplente, vice-prefeito ou vice-governador assume.

## 4. Ambições da IA (5.1) — `game/livingworld.ts`, `game/elections.ts`, `game/general.ts`

- **Janela partidária**: em março do ano municipal, vereadores **fictícios** de partidos fracos podem migrar para partidos maiores e ideologicamente próximos. As bancadas e os blocos são recalculados e a troca vira notícia.
- **Candidaturas próprias**:
  - em março do ano de eleição geral, vereadores fictícios bem votados anunciam candidatura a deputado (Alesp ou Câmara);
  - os eleitos saem na posse e os suplentes assumem;
  - em 2032, o prefeito fictício em 1º mandato disputa a reeleição, com peso pela gestão e pelos escândalos;
  - vereadores fictícios fortes podem ser o nome do partido para a prefeitura.
- **Alianças**: uma agremiação pequena pode desistir e apoiar o nome ideologicamente mais próximo, somando força. Isso aparece no rótulo da chapa.
- **Política para pessoas reais**: vereadores reais em exercício **não** trocam de partido nem se candidatam por decisão do jogo. Essa regra é coberta por teste.

## 5. Crises de imagem (5.2) — página **Imagem e promessas**

- Cada crise tem **veracidade**: verdadeira, falsa ou distorcida.
  - O jogador sabe qual é; o público não.
  - As verdadeiras nascem de atos registrados do jogador: irregularidade de campanha, vantagem indevida aceita, promessa quebrada, caixa negativo da prefeitura.
- **Veículos** fictícios com **credibilidade dinâmica**. Entraram dois de baixa credibilidade: um perfil anônimo e um blog. Quem publica algo falso e é desmentido perde credibilidade.
- **Respostas**: desmentir, explicar com documentos, admitir e pedir desculpas, direito de resposta (Lei 13.188/2015, REAL) ou não responder.
  - A matriz de efeitos veracidade × resposta é PROPOSTA.
  - **Negar algo verdadeiro pode virar "mentira exposta"**: grande perda de popularidade e −15 de credibilidade.
  - Contra perfil anônimo, o direito de resposta tem efeito limitado.
- **Histórico do personagem**: a nova *credibilidade pessoal* (0–100) modula a eficácia dos desmentidos futuros e entra no desfecho.
- Crises de personagens fictícios (prefeito, pré-candidatos, vereadores) movem o mundo: reduzem a força nas pesquisas e a chance de reeleição. **Nunca atingem pessoas reais** (coberto por teste).

## 6. Promessas a comunidades e eventos (5.3)

- **Promessa pública** (região × tema): dá boa vontade imediata.
  - Vence no fim do mandato disputado, ou do atual.
  - Na aba Imagem, cada promessa mostra o progresso e a capacidade de entrega do cargo atual.
- **Como cumprir** depende do cargo:
  - prefeito: caixa;
  - secretário: orçamento livre da pasta;
  - vereador: indicações e emendas;
  - deputado ou senador: emendas;
  - governador: convênio.
- **Resultado**:
  - promessa cumprida: boa vontade +14 e credibilidade +3;
  - promessa quebrada: boa vontade −18, popularidade −2,5, credibilidade −4 e vira pauta verdadeira de crise;
  - candidatura derrotada, rejeitada ou retirada: as promessas caducam sem punição.
- **Boa vontade regional** persiste entre campanhas: ao abrir um novo plano, entra em presença, conhecimento e rejeição da região.
- **Eventos novos**:
  - enchente numa região, com memória da promessa feita àquela região;
  - convite para secretaria estadual.
  - Os eventos que eram presos a 2028 foram generalizados.

## 7. Conquistas e finais (5.7) — `game/endings.ts`, página **Conquistas**

- **21 conquistas**: de "Entrei para o jogo" a "Palácio dos Bandeirantes", incluindo "Mea-culpa", "Sangue frio" e "Quem promete, entrega".
- **Desfechos** possíveis:
  - Estadista paulista;
  - Voz de SP no Senado;
  - Prefeito(a) que entregou / de promessas;
  - Parlamentar de carreira;
  - Vereador(a) de bairro;
  - Servidor(a) da cidade;
  - Eminência parda;
  - Militância;
  - Cidadão(ã) engajado(a);
  - Diploma cassado;
  - Escândalo.
- A nota da trajetória (0–100) é mecânica de jogo.
- A ação "Encerrar a carreira política" termina a partida a qualquer momento, desde que não haja candidatura registrada.

## 8. Desempenho e tamanho do save

- Dez anos de partida aumentaram o save. Para conter isso:
  - a auditoria passo a passo fica guardada só na eleição mais recente de cada tipo;
  - o mapa de partidos dos candidatos guarda só os eleitos;
  - projetos de legislaturas passadas saem do save, exceto os do jogador;
  - as pesquisas ficam limitadas às 70 mais recentes.
- Resultado: o save final ficou em cerca de 0,9 MB, e uma partida completa simula em cerca de 1,3 s.

## 9. Calibração

- **Votos de deputado**: multiplicador de alcance fora da capital (PROPOSTA) de 0,75 para estadual e 0,70 para federal. Resultado:
  - vereador médio (reconhecimento 45): 18 mil a 28 mil votos, não se elege;
  - vereador forte (reconhecimento 60): 34 mil a 54 mil votos, às vezes se elege;
  - liderança consolidada (reconhecimento 75): 63 mil a 100 mil votos, elege-se.
- **Robô de carreira longa** (`tools/carreira.test.ts`): roda com `npm run balance`.
  - Jogando de forma ingênua, raramente passa de secretário municipal ou de uma eleição de vereador.
  - Esse robô é um diagnóstico de que o jogo não é trivial. A régua de balanceamento continua sendo os perfis da Fase 4.
  - Em execução anterior, um perfil fez vereador → deputado estadual → vereador.
- **Frequência de crises**: reduzida depois do primeiro teste. Ficou em aproximadamente uma crise a cada 1–2 anos para quem é conhecido, com mais crises em campanha.

## 10. Regra real × mecânica de jogo

| Elemento | Classificação |
|---|---|
| Datas, posses, idades, cadeiras, renovação do Senado, maioria absoluta e 2º turno, sistema proporcional, janela partidária, CF art. 14 §§5º–6º, direito de resposta, emendas impositivas e cotas federais de 2026, subsídio federal | REGRA REAL (com fonte na página Regras) |
| Datas de 2030–2036, desincompatibilização de secretário municipal, limites de gastos de deputado | DERIVADA |
| Votos, candidatos fictícios, chances de projetos e emendas, crises e veículos, promessas e boa vontade, conquistas e nota | PROPOSTA |

## 11. Arrecadação de campanha (ajuste pós-fase)

| Regra | Classificação |
|---|---|
| Empresa (pessoa jurídica) não pode doar (STF, ADI 4.650/2015; Lei 13.165/2015) | REGRA REAL |
| Pessoa física doa até 10% dos rendimentos brutos do ano anterior (Lei 9.504/97 art. 23 §1º) | REGRA REAL |
| Financiamento coletivo em plataforma cadastrada (art. 23 §4º, IV), a partir de 15 de maio do ano eleitoral; o dinheiro só é liberado com a candidatura registrada e, sem registro, é devolvido (art. 22-A §3º) | REGRA REAL |
| Valores arrecadados e chances | PROPOSTA |

Ações novas:
- **Vaquinha virtual**: rende mais para quem tem redes sociais grandes e base. O valor fica retido até o registro da candidatura.
- **Jantar de arrecadação com empresários**:
  - opção legal: só doações de pessoa física (CPF), dentro do limite;
  - opção "por fora": dinheiro de empresa ou sem registro, ou seja, caixa dois. Rende mais, mas conta como irregularidade (contas desaprovadas, ação de cassação) e vira pauta verdadeira de crise de imagem.

A arrecadação também foi escalada por cargo: a de governador e a de senador são próximas à de prefeito, e a de deputado é duas vezes a de vereador.

## 12. Trabalho de cargo sem desgaste (ajuste pós-fase)

- Ações das categorias Assessoria, Mandato de vereador, Prefeitura, Secretaria, Mandato estadual/federal e Governo do Estado **não perdem mais rendimento quando repetidas**: é o trabalho do cargo.
  - O desgaste por repetição continua nas ações de vida, partido, redes e campanha.
- Para a aprovação não disparar, o que satura agora é a **atenção do público no mês** (PROPOSTA):
  - até +1,5 de aprovação vinda de ações num mesmo mês conta inteiro;
  - o que passar disso conta a 25%.
  - Indicadores, programas, demandas e projetos rendem sempre 100%.
- Balanço com jogo ativo, verificado depois do ajuste:
  - secretário(a) da Saúde termina com aprovação entre 71 e 74;
  - prefeito(a), entre 72 e 77.
  - As duas faixas ficam dentro do que foi calibrado na Fase 4.

## 13. Navegação por esfera e agenda do cargo (ajuste pós-fase)

**Menu lateral em grupos**, que mudam conforme o cargo do jogador:
- *Você*: agenda, personagem, imagem.
- *Meu cargo*: página do mandato atual. Exemplos: "Alesp — meu mandato", "Câmara Municipal — meu mandato", "Prefeitura — meu governo", gabinete de assessor.
- *Eleições*: a próxima eleição aparece primeiro (municipal ou geral), junto com a campanha.
- *Estado e União* e *Cidade de São Paulo*: a esfera em que o jogador atua vem antes da outra.
- *Partido e mídia*.
- *Trajetória*.

Outras mudanças de navegação:
- A eleição geral ganhou página própria, separada da composição do governo e das bancadas.
- Mandatos estaduais e federais ganharam a página **Meu mandato**, com:
  - painel do mandato;
  - ações do cargo;
  - composição da casa legislativa;
  - registro do mandato.
- O topo da tela mostra o mandato do jogador quando ele não é municipal.

**Agenda do cargo** (PROPOSTA):
- Quem exerce cargo recebe compromissos extras só para o trabalho do cargo:
  - assessor: 3;
  - vereador, secretário, deputado, senador e secretário estadual: 4;
  - prefeito e governador: 5.
- Os 5 compromissos pessoais ficam livres para partido, redes e campanha.
- As ações do cargo (◆) gastam primeiro a agenda do cargo e, quando ela acaba, a pessoal.
- Balanço conferido: com 9 ações de pasta por mês, o secretário da Saúde termina com aprovação entre 70 e 76.

## 14. Emendas com valores reais (ajuste pós-fase)

| Cargo | Cota anual por parlamentar (valores de 2026) | Fonte | Status |
|---|---|---|---|
| Deputado estadual | ~R$ 13 milhões | os 94 deputados dividem 0,45% da receita corrente líquida (RCL) do estado (InfoMoney/O Globo) | DERIVADA |
| Deputado federal | R$ 39,9 milhões | LOA 2026 | REGRA REAL |
| Senador | R$ 72,8 milhões | LOA 2026 | REGRA REAL |

- **Quem paga**: o Executivo (governo do estado ou União). As emendas individuais são impositivas, mas o ritmo de pagamento varia.
- **Quando renova**: a cota é anual e renova em janeiro. O que não for indicado no ano se perde (SIMPLIFICAÇÃO).
- **Saúde**: no Congresso, metade da cota vai para a saúde (CF art. 166 §9º), e o jogo aplica essa regra.
- **Valor de cada emenda**: o jogador escolhe (R$ 1, 2, 5, 10 ou 20 mi, ou o saldo restante), além da região e da área.
- **Saves em andamento** recebem a nova cota, descontado o que já foi indicado no ano.

## 15. Outras fontes de recursos e esquemas ilegais (ajuste pós-fase)

**Caminhos legais** (ações na página do mandato):

- **Pedir verba ao governo (indicação)**
  - O que é: pedido de transferência voluntária ao governador (deputado estadual) ou à União (deputado federal e senador).
  - REGRA REAL: não é obrigatória, depende de decisão do Executivo. Exemplo: no ABC paulista, R$ 68,3 mi em indicações dependiam do governo, contra R$ 56,7 mi em emendas impositivas.
  - PROPOSTA:
    - a chance de ser atendido depende do alinhamento com o governo, da relação e do valor pedido;
    - o pagamento dessas verbas sai mais rápido;
    - teto anual de R$ 30 mi para deputado estadual, R$ 60 mi para federal e R$ 90 mi para senador.
- **Votar com o governo em matéria importante**
  - Melhora a relação com o Executivo, o que abre as indicações e acelera os pagamentos.
  - Às vezes a matéria é impopular na base do jogador.
- **Emenda de bancada** (deputado federal e senador)
  - REGRA REAL: impositiva; a LOA 2026 destina R$ 11,2 bi, cerca de R$ 500 mi por estado.
  - PROPOSTA: a fatia de cada parlamentar depende do tamanho do partido, da articulação e de ter cargo em comissão. A divisão acontece de janeiro a março, uma vez por ano.
- **Emenda de comissão** (deputado federal e senador)
  - REGRA REAL: não é impositiva; a LOA 2026 destina R$ 12,1 bi.
  - PROPOSTA: quem preside comissão tem muito mais acesso. Uma vez por ano.

**Caminho ilegal**: cobrar "retorno" de quem recebe as emendas.
- **O que acontece no jogo**:
  - entra de 5% a 10% do valor das emendas do ano;
  - o dinheiro vai para o bolso ou para a próxima campanha, onde vira caixa dois e irregularidade ao entrar.
- **Risco de investigação** (PROPOSTA): cresce mensalmente a cada esquema. A operação policial causa:
  - crise de imagem verdadeira;
  - popularidade −10, credibilidade −15 e aprovação −12;
  - chance de perda do mandato por quebra de decoro (CF art. 55) e inelegibilidade (LC 64/90).
- **No desfecho da carreira**: o esquema conta como corrupção e pode levar ao final "Escândalo".
- **Tipificação real**: corrupção passiva e peculato.

## 16. Votações do mês (ajuste pós-fase)

Todo mês, quem tem mandato legislativo recebe matérias para votar. Votar é de graça: **não gasta agenda**. O card "Votações do mês" aparece no topo da Agenda e na página do mandato.

**Vereador(a)**
- Toda votação do mês usa o motor real da Câmara Municipal (Fase 2).
- Se nenhuma matéria chegou ao plenário, a Presidência pauta uma em regime de urgência. Isso é SIMPLIFICAÇÃO.
- O card mostra, para cada matéria:
  - o autor;
  - a posição da prefeitura;
  - a opinião pública;
  - a orientação da bancada;
  - a previsão de placar (28 votos para aprovar).

**Deputado(a) estadual, deputado(a) federal e senador(a)**
- Recebem de 1 a 2 matérias fictícias por mês, no formato `game/pauta.ts`. São temas típicos de cada casa, como concessões, piso do magistério, ICMS, isenção de IR, regulação de plataformas, PECs e sabatinas.
- Cada matéria tem autoria (Executivo ou parlamentares), posição do governo, apoio do público, repercussão e orientação do partido. A orientação é calculada pela relação governo × oposição e pela ideologia.
- O placar é simulado bancada por bancada, com dissidências. Para aprovar:
  - lei comum: maioria simples (CF art. 47, REGRA REAL);
  - PEC: 3/5 (CF art. 60 §2º, REGRA REAL).
- **Consequências do voto** (PROPOSTA):
  - votar contra o partido: lealdade percebida e confiança da direção caem;
  - votar contra o governo: a relação com o Executivo cai;
  - votar contra a opinião pública: aprovação e popularidade caem;
  - votar contra a própria linha ideológica: a base cai;
  - abster-se em tema importante: crítica pública.
- Quem não vota segue a orientação da bancada automaticamente.
- Votações de grande repercussão viram notícia.

## 17. Equipe do gabinete: assessores do jogador (ajuste pós-fase)

Quem exerce mandato de vereador(a), deputado(a) estadual, deputado(a) federal ou senador(a) ganha a página **"Minha equipe de gabinete"** (grupo "Meu cargo"). Lá o jogador nomeia, exonera e dá tarefas aos próprios assessores. Módulo: `game/team.ts`.

**Regras reais (REGRA REAL)**
- Cargos de gabinete são em comissão, de livre nomeação e exoneração.
- Limites de lotação por gabinete:
  - Câmara Municipal de SP: até 18 cargos (1 chefe + 17 assessores), Lei 16.972/2018;
  - Alesp: de 16 a 32 cargos em comissão, LC estadual 1.136/2011, art. 7º;
  - Câmara dos Deputados: 5 a 25 secretários parlamentares, verba de R$ 165.806,07/mês em 2026 (Ato da Mesa 243/2026), salários-base de R$ 1.710,83 a R$ 12.979,45;
  - Senado: até 50 cargos comissionados.
- Rachadinha e funcionário fantasma são tratados como peculato (CP art. 312) e improbidade. Podem levar à perda do mandato (CF art. 55) e à inelegibilidade (LC 64/90).

**SIMPLIFICAÇÃO**: o jogador nomeia só a **equipe-chave** (5 vagas para vereador, 6 para deputado, 7 para senador). O resto da lotação real fica abstrato. Assim o jogo evita dezenas de fichas sem perder o essencial: quem faz o quê, com que qualidade e com que caráter.

**Como funciona (PROPOSTA)**
- **Currículos do mês**: 5 ou 6 candidatos fictícios, renovados todo mês. Enquanto não houver chefe de gabinete, dois deles são para chefia. Cada ficha mostra:
  - quatro atributos: comunicação, técnica legislativa, articulação e organização;
  - salário pedido;
  - origem: profissional de mercado, indicação do partido, cabo eleitoral ou militante;
  - **avaliação de honestidade**, uma estimativa por referências que pode errar em ±10.
- **Origem pesa**: indicação do partido agrada a direção; cabo eleitoral traz base; militante agrada a militância e tende a ser mais honesto.
- **Verba da equipe-chave**: R$ 45 mil (vereador), 55 mil (estadual), 60 mil (federal) e 75 mil (senador). O salário é pago pela Casa, não pelo jogador.
- **Tarefas mensais**: rodam sozinhas, sem gastar agenda. São as mesmas frentes do trabalho de assessor:
  - redes sociais: seguidores na rede em foco;
  - imprensa e crises: reconhecimento, credibilidade e redução da gravidade de crises ativas;
  - agenda na base: boa vontade na região escolhida, base e menos distância da base;
  - atendimento ao público: aprovação, até +0,6 por mês somando a equipe;
  - articulação política: confiança da direção e relação com o Executivo;
  - minutas e pareceres: a minuta avança e, ao completar, vira projeto protocolado.
- **Chefe de gabinete** coordena a equipe: produção +10% a +24%, conforme a organização dele(a), e menos chance de alguém virar relapso.
- O rendimento de cada tarefa depende do atributo correspondente.

**Rachadinha (ILEGAL)**
- Ação "Propor rachadinha" com devolução de 30%, 50% ou 80%. Custa 1 compromisso.
- A chance de aceitar depende da honestidade real (oculta), da lealdade e do tamanho da devolução. Fantasmas aceitam mais.
- Quem recusa perde lealdade. Uma pessoa honesta pode pedir exoneração ou **denunciar ao MP**.
- Quem aceita devolve parte do salário todo mês para o caixa do jogador.
- Cada mês há risco de investigação (Coaf/MP). O risco cresce com o número de participantes, a deslealdade e a fama do jogador.
- Ex-participantes exonerados ficam ressentidos e podem denunciar por até 3 anos, mesmo depois do mandato.
- Se for descoberta:
  - crise de imagem verdadeira;
  - queda de popularidade, aprovação e credibilidade;
  - registro de vantagem indevida;
  - chance de perda do mandato;
  - pesa no final ("Escândalo" ou "Cassado").

**Funcionário fantasma**
- O jogador pode nomear alguém "como fantasma" (ILEGAL). A pessoa não trabalha, mas o cabo eleitoral rende base e a indicação do partido rende confiança.
- Assessores com honestidade baixa podem **virar relapsos por conta própria**: param de produzir ("frequência irregular").
- Nos dois casos a imprensa pode descobrir. Como é o parlamentar quem atesta a frequência (REGRA REAL na Câmara dos Deputados), a cobrança cai sobre o mandato. O efeito é mais leve quando o jogador não sabia.
- "Exigir expediente" põe a pessoa para trabalhar.

**Fim do mandato**: a equipe é exonerada. Quem participou de rachadinha continua sendo um risco.

## 18. Pendências conhecidas

1. **Tramitação completa na Alesp e no Congresso**: já há votação mensal em plenário, mas sem comissões nem autoria de projetos pelo motor da Fase 2. Seria uma extensão futura.
2. **Secretário estadual**: o mandato é abstrato. O orçamento estadual detalhado não está modelado.
3. **Desincompatibilização de secretário municipal**: continua marcada como DERIVADA.
