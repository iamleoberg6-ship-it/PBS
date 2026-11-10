# PBS — Governo federal jogável: Presidência, Vice-Presidência e ministérios

Pedido do usuário:
- jogar como presidente, vice-presidente e ministro;
- ser convidado para um ministério se o partido do jogador não for muito distante do partido do presidente;
- presidente que pode centralizar o governo ou montar um governo de coalizão;
- cada ministério com jogabilidade própria.

Módulos novos: `game/federal.ts` (motor) e `ui/federal.tsx` (página). Integração em:
- eleição geral: `general.ts`;
- calendário: `turn.ts`;
- ações: `actions.ts`;
- convites: `events.ts`;
- carreiras: `careers.ts`;
- save: `save.ts`.

Testes: 152 passando, 12 deles em `federal.test.ts`. Save: versão 8, e partidas antigas recebem o governo federal ao carregar.

---

## 1. Regras reais usadas

| Regra | Fonte |
|---|---|
| Presidente e vice eleitos juntos, maioria absoluta com 2º turno | CF art. 77 |
| Idade mínima de 35 anos (presidente e vice) | CF art. 14 §3º, VI, "a" |
| Posse em 5 de janeiro, mandato de 4 anos | CF art. 82 (EC 111/2021) |
| Uma reeleição consecutiva, sem deixar o cargo para disputá-la | CF art. 14 §5º (EC 16/1997) |
| Presidente que disputa outro cargo renuncia 6 meses antes | CF art. 14 §6º |
| Vice substitui o presidente nos impedimentos (ex.: viagens), sucede na vaga e auxilia em missões especiais | CF art. 79 |
| Ministros: maiores de 21 anos, livre nomeação e exoneração | CF arts. 84, I, e 87 |
| Ministro que vai disputar eleição deixa o cargo 6 meses antes | LC 64/90, art. 1º, II, "a", 1 |
| Deputado ou senador nomeado ministro não perde o mandato: licencia-se e o suplente assume | CF art. 56, I |
| Medida provisória: força de lei imediata, 60 + 60 dias; perde a eficácia se não for aprovada | CF art. 62 |
| Sanção ou veto em 15 dias úteis; veto derrubado por maioria absoluta (257 deputados e 41 senadores) | CF art. 66 |
| PEC: 3/5 em dois turnos nas duas Casas (308 deputados, 49 senadores) | CF art. 60 §2º |
| Impeachment por crime de responsabilidade: Câmara autoriza por 2/3 (342); Senado condena por 2/3 (54); afastamento por até 180 dias | Lei 1.079/50; CF arts. 51 I, 52 parágrafo único e 86 |
| Banco Central autônomo: o presidente não decide a Selic | LC 179/2021 |
| Subsídio de presidente, vice e ministros: R$ 46.366,19 | Decreto Legislativo 172/2022 |

**Economia de partida (dados reais)**
- IPCA de 2025: 4,26%.
- PIB de 2025: +2,3%.
- Desocupação média de 2025: 5,6%.
- Dívida bruta do governo geral: 78,7% do PIB em dezembro de 2025 (BCB).
- Selic: 13,75% (Copom, 4/11/2026).
- Meta de inflação: 3% ± 1,5 p.p.
- Déficit primário do governo central em 2025: R$ 58,7 bi.

Daí em diante a economia é simulação.

**Pessoas reais.** O governo do presidente real em exercício (2027–2030) **não é simulado por dentro**: o jogo não decide ministérios, convites, demissões nem coalizões por pessoas reais. A página mostra só a economia de fundo. Ministérios, convites e coalizões passam a existir com presidentes **personagens do jogo** (a partir da posse de 2031) ou com o próprio jogador na Presidência.

## 2. Ministérios: 13 pastas, cada uma com ações próprias

A lista usa os nomes da estrutura de 2026. Cada pasta tem três ações exclusivas, com custo no orçamento da pasta, prazo até o resultado e risco quando faz sentido:

| Pasta | Ações próprias |
|---|---|
| Fazenda | meta fiscal mais dura; arrecadação sobre altas rendas; crédito a pequenas empresas |
| Casa Civil | destravar obras (por região); coordenar a agenda prioritária; mediar conflitos internos |
| Relações Institucionais | liberar emendas para a base (risco de desgaste); negociar cargos; contar votos |
| Saúde | mutirão de cirurgias (por região); vacinação; remédios gratuitos |
| Educação | tempo integral; alfabetização (por região); organizar o Enem (risco de falha) |
| Justiça e Segurança Pública | operação contra o crime organizado (por região, risco); fronteiras; fundo para os estados |
| Desenvolvimento e Assistência Social | busca ativa no Cadastro Único; pente-fino em benefícios (risco); combate à fome |
| Cidades | moradias; mobilidade; saneamento (todas por região) |
| Agricultura e Pecuária | Plano Safra; abertura de mercados; defesa sanitária (risco) |
| Meio Ambiente e Mudança do Clima | operação contra desmatamento; recursos internacionais; adaptação a eventos extremos |
| Trabalho e Emprego | qualificação; mediação de greve (risco); fiscalização de trabalho escravo |
| Integração e Desenvolvimento Regional | obras hídricas no semiárido; Defesa Civil; fundos regionais |
| Transportes | concessões de rodovias; recuperação de estradas; ferrovia de carga |

**Efeitos.** As ações movem:
- seis **índices de área** de jogo: saúde, educação, segurança, infraestrutura, meio ambiente e proteção social;
- a **economia**: inflação, PIB, desemprego, resultado primário e confiança do mercado;
- a **aprovação** do governo e do ministro;
- o **humor do Congresso**;
- a **projeção regional** do jogador.

**SIMPLIFICAÇÃO**: o governo real tem cerca de 38 pastas. O jogo simula as 13 principais, e cada presidente pode reorganizá-las por lei ou MP.

## 3. Coalizão × centralização

O presidente (personagem do jogo ou jogador) escolhe o estilo de governo:

| Estilo | Partidos da coalizão | Ministério | Congresso |
|---|---|---|---|
| **Coalizão ampla** (presidencialismo de coalizão) | Afinidade ideológica **ou** posição perto do centro da escala: partidos de centro tendem a compor com governos de campos diferentes | Mais pastas para aliados, menos técnicos | Base perto de 3/5, humor mais alto |
| **Coalizão moderada** | Meio-termo | Meio-termo | Base média |
| **Centralizado** | Só o próprio campo | Quase todo do partido, mais coeso e competente | Base pequena: mais derrotas no Congresso |

- A base vem das bancadas, com a Câmara extrapolada a partir da bancada de SP e o Senado com distribuição aproximada.
- Um humor do Congresso de 0 a 100 decide os votos dos aliados e dos avulsos.
- Fazenda, Casa Civil e Relações Institucionais ficam com o núcleo do presidente.

## 4. Convite para ministro

O convite só acontece com presidente personagem do jogo: na posse e nas reformas ministeriais anuais de abril. Condições:
- **Partido:** estar na coalizão ou ser ideologicamente próximo do partido do presidente. O presidente centralizador exige mais proximidade.
- **Projeção e preparo:** reconhecimento, projeção nacional ou mandato federal, e atributos de gestão, conhecimento político ou negociação.
- **Situação:** sem mandato, ou deputado federal / senador. Este se licencia (CF art. 56, I), o suplente assume e o jogador volta ao Congresso ao sair do ministério.

O evento oferece 2 ou 3 pastas, priorizando as ligadas à profissão do jogador.

**Jogador ministro**
- Agenda própria do cargo: 5 compromissos.
- Ações da pasta, mais as ações comuns: defender a pasta no Congresso, entrevista coletiva, despacho com o presidente, pedir crédito à Fazenda e pedir demissão.
- Indicadores próprios: desempenho da pasta, relação com o presidente e orçamento discricionário anual (valor de jogo).
- O presidente **exonera** quem fica com relação muito baixa ou desempenho fraco.
- Para disputar eleição, o ministro deixa o cargo 6 meses antes. A elegibilidade mostra a pendência e a ação de saída aparece.

## 5. Jogador presidente

**Como chegar**
- "Pleitear candidatura" agora inclui **Presidente da República** (eleições gerais), passando pela convenção do partido.
- A força do jogador conta a **projeção nacional** por região, e não só o reconhecimento em SP.
- Há pesquisas presidenciais, 2º turno com o jogador e reeleição.

**Ações do cargo** (6 compromissos de agenda do cargo)
- reforma ministerial / estilo de governo (no máximo uma a cada 6 meses);
- trocar um ministro (nome técnico ou indicação de partido aliado);
- enviar PL ou PEC, ou editar **MP**, a partir de uma agenda de 14 medidas fictícias. A votação acontece meses depois, com o quórum real. A MP vale na hora e cai se não for aprovada;
- política fiscal do ano (ajuste, neutra ou expansionista). Há também a opção **"maquiar as contas"**, ILEGAL: crime de responsabilidade contra a lei orçamentária, que abre caminho para impeachment;
- liberar emendas e cargos;
- pronunciamento em rede nacional;
- viagem a uma região;
- cúpula internacional (o vice assume interinamente).

**Sanção ou veto** (sem custo de agenda): projetos aprovados pelo Congresso chegam para decisão. Um veto pode ser derrubado com 257 deputados e 41 senadores.

**Aprovação.** A aprovação do governo segue a economia (desemprego, inflação, PIB), os índices de área e a lua de mel dos primeiros seis meses. A aprovação por região segue a nacional, com os vieses das políticas regionais.

**Impeachment** só acontece com crime de responsabilidade comprovado no jogo (pedalada ou vantagem indevida), aprovação baixa e Congresso hostil:
1. denúncia;
2. votação na Câmara (342 votos);
3. afastamento;
4. julgamento no Senado (54 votos).

Se condenado, o jogador perde o cargo e tem o final "Impeachment".

## 6. Vice-presidente

- **Chapa:** em julho do ano eleitoral, um pré-candidato a presidente (personagem do jogo) de partido próximo pode convidar o jogador para vice. Exige 35 anos e projeção. As convenções homologam a chapa. A projeção do jogador soma à chapa, e o jogador é eleito se a chapa vencer.
- **Ações:** articular votos do governo, missão no exterior, agenda regional, marcar posição própria (ganha projeção e piora a relação com o Planalto) e **acumular um ministério**: a Constituição prevê que o vice auxilie o presidente em missões especiais (art. 79, parágrafo único), e na prática vices já chefiaram ministérios. Com o ministério, ganha as ações da pasta.
- **Sucessão:** raramente, se o presidente personagem do jogo cai num impeachment, o jogador assume a Presidência (CF art. 79). Quem sucede o titular pode disputar a reeleição uma única vez.

## 7. Outras integrações

- **Página nova** "Presidência — meu governo", "Vice-Presidência" ou "Ministério — minha pasta" (em "Meu cargo"); para os demais, "Governo federal" (em "Estado e União"). Ela reúne:
  - base no Congresso, humor e coalizão;
  - propostas em tramitação;
  - economia nacional, com fontes;
  - índices de área;
  - ministério completo;
  - regras.
- **Eleições gerais:** pré-candidaturas presidenciais, pesquisas com o jogador e resultado dos dois turnos.
- **Desincompatibilização:** regras de ministro e presidente na tabela de prazos e nas verificações de elegibilidade.
- **Conquistas novas:** "Esplanada dos Ministérios", "Segundo posto da República" e "Palácio do Planalto".
- **Finais novos:** "Presidente da República", "Presidência difícil", "Vice-presidente da República", "Ministro(a) de Estado" e "Impeachment".
- **Ajuste de balanceamento:** a simulação de 4 anos de governo com estratégias diferentes deu inflação entre 3% e 4,3%, dívida subindo de 79% para cerca de 86% a 87% do PIB, aprovação entre 38 e 55, e cerca de metade das propostas aprovadas com coalizão moderada.

## 8. Regra real × mecânica de jogo

| Elemento | Classificação |
|---|---|
| Regras constitucionais e legais da seção 1; dados econômicos de partida | REGRA REAL / dado real |
| 13 ministérios com os nomes de 2026 | SIMPLIFICAÇÃO (estrutura real maior e mutável) |
| Ações das pastas, orçamentos discricionários, índices de área, efeitos econômicos, humor do Congresso, adesão dos partidos de centro, probabilidades de convite, escândalo, exoneração e impeachment | PROPOSTA |
| Matérias, MPs, ministros, presidentes e vices a partir de 2031 | Ficção (personagens do jogo) |
| Câmara nacional extrapolada da bancada de SP; força das listas no país aproximada pela de SP | SIMPLIFICAÇÃO (o jogo não simula os 27 estados) |

## 9. Campanha presidencial com painel nacional

Quem disputa a Presidência (ou é vice de chapa) faz campanha num mapa do país, não no mapa da capital.

- **Mapa:** as 5 grandes regiões, com peso pelo eleitorado de 2026 (TSE): Sudeste 42,0%, Nordeste 27,6%, Sul 14,5%, Norte 8,3% e Centro-Oeste 7,6%. A página Campanha mostra estados, população (Censo 2022), eleitorado, presença, conhecimento, rejeição, apoios e intenção relativa por região.
- **Temas nacionais:** emprego e renda, custo de vida, saúde, educação, segurança, combate à pobreza, infraestrutura e saneamento, meio ambiente.
- **Prioridades por região** (PROPOSTA, inspiradas em PNAD e saneamento): Norte (infraestrutura, saúde, emprego); Nordeste (emprego, combate à pobreza, educação); Centro-Oeste (infraestrutura, segurança, custo de vida); Sudeste (segurança, saúde, custo de vida); Sul (custo de vida, infraestrutura, saúde). O jogo não atribui ideologia às regiões.
- **Ponto de partida:** o conhecimento em cada região vem do reconhecimento nacional do jogador; no Sudeste soma-se o reconhecimento em SP. A rejeição sobe com posições extremas e baixa aprovação regional.
- **Ações:** "Agenda de rua" vira caravana por uma região; "lideranças" vira palanque com governadores e prefeitos (personagens do jogo). Pesquisa interna, comunicação e contraste usam as 5 regiões. O contraste mira o adversário mais forte da corrida presidencial. Debate fica disponível para o cabeça de chapa, não para o vice.
- **Custos (PROPOSTA):** 5× os de prefeito da capital, nas ações e na equipe de campanha.
- **Efeito:** o que o eleitor aprende sobre você numa região passa aos poucos para o reconhecimento nacional, que pesa na força da chapa. O fator territorial entra na força do candidato.
- **Pesquisas e apuração:** as pesquisas presidenciais trazem cortes por região. O resultado mostra seus votos de 1º turno por região do país.
- **Troca de cargo:** se a candidatura mudar de cargo (por exemplo, de presidente para deputado na convenção), o plano é refeito na geografia certa.

## 10. Pendências

1. Os 27 estados e as bancadas reais da Câmara inteira.
2. Indicação de ministros do STF, PGR e diretoria do Banco Central (dependem do Senado).
3. Orçamento federal detalhado (LOA e emendas de bancada no ciclo do governo).
