# PBS — Relatório da Fase 4: campanhas, território, assessoria e balanceamento

Versão do save: **7** (saves v1–v6 migram automaticamente). Testes: **94 passando** (13 novos da Fase 4) + robôs de perfil em `npm run balance`.

## 1. Balanceamento das secretarias
- **Problema da Fase 3**: o secretário de Saúde terminava o mandato com aprovação ~90 jogando só na pasta.
- **Solução — pressão por pasta** [PARÂMETRO]: Saúde 1,7; Educação e Mobilidade 1,5; Zeladoria e Segurança 1,3; Assistência e Habitação 1,2; demais 1,0. A pressão:
  - acelera a piora natural dos indicadores (a demanda cresce mais);
  - aumenta a chance de crise;
  - eleva a cobrança do público (meta de aprovação mais alta);
  - reduz o ganho por entrega, ação da pasta e coletiva.
- **Resultado com robôs** (mandato inteiro):

| Secretário | Ativo | Passivo |
|---|---|---|
| Saúde (era ~90) | 67–75 | exonerado em todos |
| Educação | 51–58 | exonerado em todos |
| Mobilidade | 55–63 | exonerado em 3/4 |
| Cultura / Esportes | 54–70 | ~30, sem exoneração |

- **Conclusão**: pasta grande dá alto risco e alta recompensa; pasta pequena é mais segura.
- **A mesma regra vale para as secretarias da IA.**

## 2. Assessoria parlamentar jogável (`game/assessor.ts`, página Gabinete parlamentar)
- **Escolha do gabinete**: entre vereadores(as) do seu partido ou federação. Com vereador(a) real, o jogo deixa claro que a relação de trabalho é simulada e só gera tarefas institucionais comuns.
- **Demandas mensais (2, ou 3 na chefia), com prazo**:
  - parecer de comissão (ligado a um projeto real da pauta da comissão do gabinete);
  - minuta de projeto (vira projeto da bancada, com crédito para você);
  - agenda nos bairros (conhecimento do seu nome na região, que vale na campanha);
  - atendimento a lideranças;
  - articulação com outros gabinetes;
  - redes;
  - imprensa.
- **Chance de sucesso**: depende do atributo exigido, da especialidade temática e da rede de contatos.
- **Indicadores**: confiança do gabinete, rede de bastidores, entregas e falhas, especialidade.
  - Demanda vencida: −6 de confiança.
  - Confiança abaixo de 20 pode levar à exoneração (cargo de livre nomeação).
- **Carreira**: assessor(a) → assessor(a) especial → chefe de gabinete (salários de jogo R$ 9.500 / 14.000 / 19.000). A promoção exige confiança e entregas; a chefia pode representar o mandato.
- **Iniciativas próprias**: estudar a pauta, rede de bastidores, base própria (o gabinete pode estranhar o voo solo), trocar de gabinete, pedir exoneração.
- **Minutas que viram lei** rendem prestígio no gabinete e no partido.
- **Apoio do gabinete** à pré-candidatura (confiança ≥ 60): base, reconhecimento e lideranças das regiões onde você trabalhou.
- **Dilemas éticos, só com terceiros fictícios**:
  - fornecedor oferecendo vantagem (crime; risco de vazamento e afastamento);
  - jornalista pedindo informação de bastidor;
  - campanha no horário de expediente (conduta vedada real, Lei 9.504/97 art. 73, III, que vira irregularidade de campanha).

## 3. Campanha territorial (`data/regions.ts`, `game/campaign.ts`, página Campanha)
- **Território [REAL + DERIVADA]**: 32 subprefeituras com a população do Censo 2022 (total 11.451.999), agrupadas em 8 regiões (Centro, Oeste, Norte 1 e 2, Leste 1 e 2, Sul 1 e 2). Renda, prioridades, comparecimento e inclinação de cada região são parâmetros marcados.
- **Segmentos**: 8 segmentos (setor privado, servidores, empreendedores, informais, jovens, aposentados, estudantes, baixa renda) com receptividade por canal e temas, **sem associação a partidos**.
- **Modelo de voto por região** [SIMULAÇÃO documentada]: conhecimento × avaliação × proximidade de temas × (1 − rejeição) × influência local. O fator territorial (≈ 1,0 sem trabalho regional, até 1,45) multiplica a força da candidatura.
- **Plano**:
  - regiões prioritárias, temas e segmentos-alvo;
  - tom (propositivo, contraste, ataque);
  - equipe: coordenação, marketing, jurídico, contabilidade.
- **Ações**:
  - agenda de rua por região;
  - comunicação por canal (redes, impresso, rádio/TV), com alcance pelos segmentos;
  - lideranças locais;
  - contraste com adversários (tira votos, sobe a rejeição);
  - pesquisa interna (sem registro, pois não é divulgada);
  - repasse do Fundo Partidário.
- **Financiamento [REAL]**:
  - limites derivados dos valores reais de 2024 em SP (vereador R$ 2.071.008,63; prefeito R$ 67,3 mi e R$ 26,9 mi), corrigidos pela inflação do jogo;
  - despesas por categoria;
  - FEFC e Fundo Partidário separados do dinheiro pessoal.
- **Prestação de contas** (dezembro) e consequências:
  - contas aprovadas, aprovadas com ressalvas ou desaprovadas;
  - multa de 100% do excesso de gasto (Lei 9.504/97, art. 18-B);
  - risco de **cassação do diploma** em março de 2029 por captação ou gasto ilícito (art. 30-A). Se cassado, o vereador perde a vaga para a suplência e o prefeito, para o vice. Regra real: se a cassação é cedo no mandato, pode haver nova eleição (CE art. 224 §3º); o jogo simplifica.
- **Pesquisas completas**: conhecimento e rejeição por candidato, avaliação do governo municipal e cortes por região.
- **Apuração por região** para o vereador e para os dois primeiros colocados a prefeito.
- **Criação de personagem**: escolha da região onde você mora (sua base inicial).

## 4. Robôs de balanceamento (`tools/perfis.test.ts`)
Cinco partidas por perfil, candidatura a vereador em 2028:

| Perfil | Eleitos | Votos médios | Gasto médio |
|---|---|---|---|
| Rico (herdeiro, autofinancia) | 1/5 | 13,7 mil | R$ 165 mil |
| Pobre | 0/5 | 8,6 mil | R$ 64 mil |
| Popular (influenciador) | 4/5 | 38,8 mil | R$ 43 mil |
| Desconhecido (estudante, campanha completa) | 4/5 | 23,1 mil | R$ 60 mil |
| Ideológico (tom de ataque) | 0/5 | 11,5 mil | R$ 50 mil |
| Pragmático | 0/5 | 8,5 mil | R$ 50 mil |
| Independente (pouco partido) | 1/5 | 8,4 mil | R$ 20 mil |
| Partidário | 0/5 | 6,2 mil | R$ 46 mil |
| Assessor | 0/5 | 5,8 mil | R$ 29 mil |

**Critérios automáticos** (passam):
- pelo menos 3 perfis conseguem se eleger;
- o rico não ganha mais que todos os outros somados (dinheiro sozinho não decide).

**Leitura:**
- Reconhecimento e campanha territorial bem feita pesam mais que dinheiro.
- O ataque cobra rejeição.
- Militância e gabinete dão estrutura, mas não substituem visibilidade.
- O robô "diligente" antigo caiu de 6/6 para 2/6 eleitos, resolvendo a facilidade apontada na Fase 1.

**Pontos para acompanhar:**
- **Influenciador forte**: é forte por desenho, porque o usuário pediu bônus grandes em comunicação.
- **Pragmático e partidário fracos**: esses perfis rendem pouco nos robôs. Suas vantagens (convenção, FEFC, alianças) aparecem mais na disputa a prefeito.

## 5. Regra real × mecânica de jogo

| Tag | Item |
|---|---|
| REAL | População por subprefeitura (Censo 2022); limites de gastos 2024 (TSE); multa de 100% do excesso (art. 18-B); doações e autofinanciamento (art. 23); prestação de contas e cassação (arts. 28, 30, 30-A; LC 64/90 art. 22); conduta vedada do art. 73, III; registro de pesquisas (art. 33); cargo de assessor de livre nomeação |
| REAL (imprensa) | 2º turno de 2024: Boulos venceu só 3 de 57 zonas eleitorais; base eleitoral de Nunes no Grajaú |
| DERIVADA | 8 regiões por subprefeitura; eleitorado proporcional à população; limites de 2028 corrigidos pela inflação do jogo |
| SIMPLIFICAÇÃO | Cassação → suplente/vice (sem nova eleição); pesquisas regionais derivadas do modelo |
| PARÂMETRO | Pressão por pasta; renda, prioridades, comparecimento e inclinação regionais; receptividade dos segmentos; pesos do modelo de voto; salários e regras de promoção da assessoria |
| FICÇÃO | Lideranças comunitárias, fornecedores, jornalistas e demandas do gabinete |

## 6. Próximos passos (Fase 5 do plano)
- Ambições ativas de todos os atores (trocas de partido na janela, candidaturas próprias).
- Crises de imagem com informação verdadeira, falsa ou distorcida.
- Pacotes de regras 2030 e 2032, com eleições gerais e o jogo continuando depois de 2032.
