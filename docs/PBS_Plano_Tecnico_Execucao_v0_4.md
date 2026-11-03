# PBS — Plano técnico de execução (completo)

Versão do plano: 1.1 · Data: 02/11/2026 · Código atual: **v0.5-fase1** (formato de save v4)
Responde às Etapas A–D da seção 18 do *Plano de Evolução do Jogo* e detalha todas as fases.

**Convenções do documento**
- Situação de cada item: ✅ feito · 🟡 parcial · ⬜ a fazer.
- Tipos de regra, sempre marcados no código e na aba **Regras** do jogo:
  - **[REAL]**: regra institucional com fonte.
  - **[DERIVADA]**: data ou valor calculado a partir da lei, a confirmar.
  - **[SIMPLIFICAÇÃO]**: regra real modelada de forma reduzida, com o motivo documentado.
  - **[PARÂMETRO]**: balanceamento de jogo.
  - **[FICÇÃO]**: evento ou personagem inventado.
- **Testes de cada entrega**: unidade (regras) + invariantes (estado sempre válido) + reprodutibilidade (mesma seed e decisões dão o mesmo resultado, inclusive passando por salvar e carregar) + robôs de balanceamento quando a entrega mexe em estratégia.

---

## Parte 1 — Diagnóstico (Etapa A)

### 1.1 Inventário por sistema (após a Fase 1)

| Sistema | Situação | Conteúdo real hoje | Lacuna principal |
|---|---|---|---|
| Regras proporcionais | ✅ | QE, QP, 10%, sobras 80/20, última fase aberta (STF 2024), art. 111, desempate por idade com precisão da data, auditoria | Pacotes para 2030/2032 |
| Regras majoritárias e elegibilidade | ✅ | 2º turno, idade, filiação, domicílio, reeleição, convenção | Desincompatibilização, inelegibilidades (LC 64/90), cotas de gênero da lista |
| Simulação de votos | ✅ (agregada) | Total conservado, efeito puxador parametrizado, incumbentes reais concorrendo | Regiões e segmentos (Fase 4) |
| Personagem | 🟡 | Atributos, origens com prós e contras, ideologia em 4 eixos, finanças, redes | Reputação, histórico de promessas públicas, saúde e vida pessoal |
| Patrimônio | ✅ | Caixa + bens − dívidas, juros, amortização | Investimentos escolhidos, declaração de bens ao TSE |
| Partidos (dados) | ✅ | 30 partidos, 5 federações, ideologia de fonte acadêmica | Cláusula de desempenho e Fundo Partidário por partido |
| Partidos (organização) | ✅ Fase 1 | Diretório municipal, executiva, facções simuladas, disputa da presidência por delegados, promessas, processo disciplinar, convenção por delegados | Diretórios estadual e nacional, fundação de partido, fusão/incorporação, finanças partidárias |
| Atores, relações e memória | ✅ Fase 1 (núcleo) | Registro único (55 vereadores reais + ~120 dirigentes fictícios), relações dirigidas com memória e decaimento | Ambições ativas (o ator age por conta própria), relações entre atores, reputação pública dos atores |
| Livro de causas ("por que mudou?") | ✅ Fase 1 | Toda variação de indicador relevante tem causa registrada; consulta na interface | Cobrir indicadores de governo e economia (Fase 3) |
| Desgaste por repetição | ✅ Fase 1 | Rendimento cai na repetição no mês e em meses seguidos; custos inteiros | Ajuste fino por tipo de ação |
| Câmara | 🟡 | Composição nominal, Mesa anual simulada, projetos com contador, CPI por evento | Comissões, tramitação, votação nominal, oposição/base (Fase 2) |
| Governo municipal | 🟡 (mínimo) | Aprovação, base, prioridade, secretariado genérico | Orçamento, secretarias, indicadores, obras (Fase 3) |
| Pesquisas | 🟡 | Intenção de voto, margem, indecisos, 2º turno | Rejeição, conhecimento, avaliação de governo, cortes regionais |
| Imprensa | 🟡 | 7 veículos fictícios, notícias do estado do jogo, viés simples | Credibilidade, agenda temática, relação veículo–personagem, crises |
| Redes sociais | 🟡 | Seguidores, níveis, foco mensal, força digital | Engajamento, reputação digital, publicações e reações, crises |
| Eventos | 🟡 | 9 eventos condicionados ao estado | Formato completo (contexto, personagens, custos, consequências futuras) |
| Saves | ✅ | Migração v1→v4, validação, reparo, relatório | Backup automático de múltiplos slots |
| Eleições futuras | ⬜ | Jogo termina em dez/2032 | Pacotes 2030/2032 e continuidade |
| Desktop | 🟡 | Tauri configurado; workflow de build Windows no GitHub | Gerar e testar o .exe; fontes embutidas |

### 1.2 Débitos técnicos conhecidos
1. `actions.ts` concentra ações de todos os sistemas (≈ 800 linhas). **Fase 2**: dividir em `actions/` por domínio, mantendo o catálogo único.
2. A tramitação de projetos é só um sorteio (`turn.ts`). Será substituída na Fase 2 (justificativa: não existe votação nominal para preservar).
3. Mesa da Câmara usa sorteio ponderado e não considera relações. **Fase 2**.
4. Cópia completa do estado por ação (cerca de 1 s por partida inteira num computador comum, e o save chega a ~440 KB no fim). Aceitável hoje. **Fase 6**: revisar se o estado crescer além de ~2 MB.

---

## Parte 2 — Dependências (Etapa B)

```
[Pacote de regras por eleição] ──┬──► [Eleitoral] ──► [Eleições 2030/2032]
                                 └──► [Orçamento: limites legais]
[Atores] ─► [Relações + memória] ─┬─► [Partido: facções, disputas, convenção] ✅
                                  ├─► [Câmara: Mesa, comissões, votações]
                                  └─► [Imprensa: relação veículo–personagem]
[Partido] ─► [Convenção] ─► [Candidaturas]
[Câmara] + [Governo] ─► [Governabilidade]
[Orçamento] ─► [Secretarias] ─► [Programas e obras] ─► [Indicadores] ─► [Opinião por região/segmento]
[Regiões + segmentos] ─► [Pesquisas regionais] ─► [Votos]
[Livro de causas] ◄── todos os sistemas registram nele
```

| Sistema | Precisa existir antes |
|---|---|
| Votação nominal na Câmara | Atores, relações, partidos com orientação de bancada, projetos com tema, posição frente ao Executivo |
| Administração municipal | Calendário, orçamento, secretarias, indicadores, Câmara (para aprovar a lei orçamentária) |
| Campanha territorial | Regiões, segmentos, pesquisas regionais, financiamento |
| Eleições gerais | Pacotes de regras 2030/2032, Assembleia, Câmara dos Deputados, Senado (1/3 e 2/3), governador, presidente |
| Crises de imagem | Imprensa com credibilidade, redes com reputação, memória |

---

## Parte 3 — Arquitetura (Etapa C)

### 3.1 Módulos
| Módulo | Arquivos | Responsabilidade | Situação |
|---|---|---|---|
| Regras reais | `rules/*`, `data/rulepack.ts` | Cálculos com fonte; pacote por eleição | ✅ (2028) |
| Dados reais | `data/parties.ts`, `world.ts`, `ideology.ts` | Partidos, federações, vereadores, nascimentos com precisão | ✅ |
| Atores | `game/actors.ts` | Registro único; traços sempre simulados | ✅ |
| Relações | `game/relations.ts` | Relações dirigidas, memória, decaimento, “standing” | ✅ |
| Partido | `game/partyorg.ts`, `game/party.ts` | Diretório, executiva, facções, disputas, promessas, disciplina, convenção | ✅ |
| Livro de causas | `game/ledger.ts` | Fotografia antes/depois e causa | ✅ |
| Desgaste | `game/fatigue.ts` | Multiplicador por repetição | ✅ |
| Câmara | `game/legislature/*` | Mesa, comissões, tramitação, votações | ⬜ Fase 2 |
| Governo | `game/government/*` | Orçamento, secretarias, programas, indicadores | ⬜ Fase 3 |
| Eleitorado | `game/electorate/*` | Regiões, segmentos, modelo de voto | ⬜ Fase 4 |
| Mídia | `game/news.ts`, `social.ts`, futuro `media/*` | Veículos, notícias, redes, crises | 🟡 |
| Pipeline mensal | `game/turn.ts` | Ordem documentada (3.3) | ✅ |
| Persistência | `game/save.ts` | Migração encadeada + validação por módulo | ✅ |

### 3.2 Estado principal (atual)
`character`, `finances` (com bens), `player` (partido, `partyRel` com 5 indicadores, candidatura, mandato, redes, uso de ações), `parties`, `government` (vereadores com nascimento e precisão), `actors`, `relations`, `partyOrgs`, `contests`, `promises`, `elections`, `mayorRace`, `polls`, `news`, `ledger`, `pendingEvents`, `log`, `flags`, `rng`.
A acrescentar: `legislature` (Fase 2), `municipality` com orçamento e indicadores (Fase 3), `electorate` (Fase 4), `crises` (Fase 5).

### 3.3 Ordem do processamento mensal (documentada)
1. Fechamento das finanças pessoais.
2. Mandato (hoje: tramitação simplificada; Fase 2: Câmara).
3. Decaimentos naturais.
4. Redes sociais.
5. Momento dos partidos.
6. Avanço do calendário.
7. Vida partidária: decisões de disputas, abertura de novas disputas, facções, disciplina, decaimento das relações.
8. Gatilhos do calendário eleitoral (convenção, eleição, posse, Mesa).
9. Salários de mandato.
10. Imprensa: notícias do mês, notícias de contexto, disputas de outros partidos.
11. Patrimônio.
12. Evento do mês.

Cada fase grava no livro de causas. Entram nas próximas fases: economia e orçamento (antes do passo 2) e pesquisas regionais (passo 8 ou 10).

### 3.4 Persistência
- Cada versão de formato tem um passo de migração determinístico, que recria por seed o que faltava, e um teste com save real da versão anterior.
- Validação por domínio: limites, referências entre entidades, somas (cadeiras, participação das facções), eventos conhecidos.
- Erro fatal recusa o save com mensagem clara. Inconsistência reparável é corrigida e listada para o jogador.

### 3.5 Testes (estratégia)
- **Unidade:** regras reais com casos feitos à mão.
- **Invariantes:**
  - soma de votos;
  - 55 cadeiras sem duplicidade;
  - patrimônio = caixa + bens − dívidas;
  - participação das facções somando 1;
  - relações só entre atores existentes;
  - (Fase 3) orçamento fechado.
- **Aceitação:** um teste por critério de conclusão de fase.
- **Reprodutibilidade:** partidas inteiras e salvar/carregar no meio.
- **Balanceamento (Fase 4 em diante):** robôs por perfil (rico, pobre, popular, desconhecido, ideológico, pragmático, independente, partidário), medindo taxa de vitória e diversidade de estratégias.
- **Rejogabilidade:** variância entre seeds e detecção de estados sem saída.

---

## Parte 4 — Plano de entregas (Etapa D)

### FASE 0 — Estabilização ✅ (concluída; ver *PBS_Fase0_Relatorio_Auditoria*)
0.1 Conservação de votos e somas exatas · 0.2 Patrimônio · 0.3 Validação e migração de saves · 0.4 Datas de nascimento sem valor genérico · 0.5 Configuração Tauri · 0.6 Relatório.

### FASE 1 — Profundidade política ✅ (núcleo entregue nesta versão)

**1.1 Registro de atores ✅**
- **Objetivo:** todo personagem relevante é uma entidade com traços e objetivos.
- **Arquivos:** `game/actors.ts`, `types.ts` (`Actor`).
- **Regras:** pessoas reais só com fatos públicos [REAL]. Traços sempre simulados com metodologia única [PARÂMETRO]. A ideologia de um vereador real = posição do partido, sem atribuir opinião individual.
- **Aceite:** 55 atores reais e nenhum duplicado (teste).

**1.2 Relações, memória e livro de causas ✅**
- **Arquivos:** `relations.ts`, `ledger.ts`, `turn.ts`, `actions.ts`, `events.ts`.
- **Regras:** relação dirigida com confiança, afinidade, favores e até 8 memórias. Traição e promessa quebrada decaem mais devagar [PARÂMETRO].
- **Aceite:** traição registrada e lembrada (teste); cada variação de indicador tem causa (teste); "por que mudou?" na interface.

**1.3 Diretório e executiva ✅**
- **Arquivos:** `partyorg.ts`.
- **Regras:**
  - Mandato da direção de 2 anos [SIMPLIFICAÇÃO: o prazo varia por estatuto].
  - Delegados = 40 + 12 × bancada [PARÂMETRO].
  - Filiados em SP simulados [FICÇÃO marcada].
- **Aceite:** 30 diretórios válidos (teste).

**1.4 Facções simuladas ✅**
- **Regras:** os tipos são direção, governista ou oposicionista, programática, pragmática e regional, com preferências próprias. Participação, influência e mobilização mudam todo mês. Vereadores reais recebem alinhamento interno simulado.
- **Aceite:** facções votam em bloco segundo relação e preferências (teste).

**1.5 Cinco indicadores do jogador no partido ✅**
- **Arquivos:** `types.ts` (`PlayerPartyRel`), migração v3→v4.
- **Aceite:** os indicadores mudam de forma independente (testes 6–7).

**1.6 Disputas internas ✅**
- **Funcionalidades:** presidência do diretório (abre 3 meses antes do fim do mandato), candidatura do jogador, acordo com facção (promessa de vaga), declaração de apoio (promessa), crítica à direção, processo disciplinar (advertência, suspensão, expulsão) e disputas em todos os partidos sem o jogador.
- **Regras:**
  - Exige 6 meses de filiação e influência ≥ 25 [SIMPLIFICAÇÃO de estatuto].
  - Disciplina segue o estatuto (Lei 9.096/95 arts. 23 e 25) [REAL, rito simplificado].
  - Na expulsão, o jogo mantém o mandato proporcional [A CONFIRMAR na jurisprudência do TSE].
- **Aceite:** critérios 1 a 9 da seção 4.6 do plano (testes).

**1.7 Convenção por delegados ✅**
- **Regras:**
  - Vereador: a direção monta a lista de até vagas + 1 nomes [REAL: limite]; a escolha considera confiança e apoio de facção [SIMULAÇÃO].
  - Prefeito: votação de delegados contra o nome da direção, com peso das pesquisas.
- **Aceite:** jogador forte aprovado em >75% das tentativas e jogador isolado em <25% (teste).

**1.8 Desgaste por repetição ✅**
- **Regras:** no mesmo mês, 100% / 60% / 35%. Em meses seguidos, o rendimento cai 12% por mês a partir do 3º, com piso de 55%. Pular um mês zera a sequência. Custos não se reduzem [PARÂMETRO].
- **Aceite:** testes de queda, recuperação e custo inteiro.

**Fase 1 — pendências para a 1.9**
- Ambições ativas: atores com objetivo agem por conta própria (lançam candidaturas a prefeito, disputam a Mesa, trocam de partido na janela).
- Diretórios estadual e nacional, como camada abstrata de poder que intervém no municipal (por exemplo, intervenção no diretório, veto a alianças).
- Expansão das convenções: aprovação de programa e de alianças por delegados.
- Atos internos com custo de capital político explícito, com um recurso "capital político" separado do dinheiro.

### FASE 2 — Câmara Municipal funcional ⬜

**Pesquisa de regras antes de codificar**
- Lei Orgânica do Município de SP: iniciativa, quóruns, veto e sua apreciação, CPI.
- Regimento Interno da CMSP: Mesa, comissões permanentes, prazos, urgência.
- CF art. 29-A (limites de gasto da Câmara) e art. 31 (fiscalização com o TCM).

| # | Entrega | Funcionalidades | Arquivos / estado | Regras-chave | Testes / aceite |
|---|---|---|---|---|---|
| 2.1 | Vereadores-agentes | Traços, base regional, ambição, histórico de votos para os 55 | `legislature/members.ts`; `Actor` ganha `voteHistory`, `region` | Base regional [FICÇÃO marcada para reais] | Comportamento estável com a mesma seed |
| 2.2 | Mesa com chapas | Cargos (presidência, vices, secretarias), formação de chapas, negociação de votos, presidência com poder de pauta | `legislature/mesa.ts`; `state.legislature.mesa` | Mandato anual [DERIVADA da prática 2025/2026]; eleição por maioria [confirmar no Regimento] | O jogador vence só com apoio construído; o presidente controla a pauta |
| 2.3 | Comissões permanentes | 9 comissões, presidência, membros, relatoria | `legislature/committees.ts` | Composição proporcional às bancadas [confirmar no Regimento] | Composição proporcional (invariante) |
| 2.4 | Tramitação | Protocolo → CCJ → mérito → plenário → sanção/veto → apreciação do veto; emendas; requerimentos; indicações; audiências | `legislature/bills.ts`; `Bill` | Iniciativa privativa do prefeito em certas matérias [REAL, a listar]; prazos de sanção e veto [REAL] | Fluxo completo de um projeto e casos de vício de iniciativa |
| 2.5 | Votação nominal | Cada vereador decide por orientação partidária, ideologia, Executivo, opinião pública, compromissos e relação com o autor | `legislature/vote.ts` | Quóruns de maioria simples, absoluta e qualificada [REAL] | O jogador não controla votos de aliados; negociação muda o resultado |
| 2.6 | Governo e oposição | Base, independentes, oposição moderada ou radical, apoio pontual, coalizões temáticas que mudam ao longo do mandato | `legislature/alignments.ts` | [SIMULAÇÃO] | Mudar de bloco tem custo e memória |
| 2.7 | CPI | Requisitos, prazo, relatório, consequências | `legislature/cpi.ts` | 1/3 de assinaturas, fato determinado, prazo certo (CF art. 58 §3º por simetria; confirmar na LOM) | Requisitos verificados |
| 2.8 | Interface da Câmara | Pauta, comissões, projetos, placar de votação, mapa de apoios | `ui/camara.tsx` | — | Uso de ponta a ponta |

**Critério de conclusão:** um mandato de vereador completo com decisões que custam algo, derrotas possíveis, histórico coerente e votações explicáveis.

### FASE 3 — Governo e economia ⬜

**Pesquisa de dados e regras antes de codificar**
- LOA vigente de SP (receita, despesa por função, pessoal, dívida) com fonte e ano.
- Lei de Responsabilidade Fiscal (LC 101/2000): limite de pessoal do Executivo municipal e da Câmara; Receita Corrente Líquida.
- Mínimos constitucionais: saúde (LC 141/2012) e educação (CF art. 212).
- Limites de dívida consolidada e de operações de crédito (resoluções do Senado).
- Ciclo PPA/LDO/LOA (CF art. 165).

| # | Entrega | Funcionalidades | Estado | Regras | Aceite |
|---|---|---|---|---|---|
| 3.1 | Orçamento anual | Receitas (tributos, transferências constitucionais e voluntárias, patrimoniais), despesas (pessoal, custeio, investimento, dívida), execução mensal | `municipality.budget` | Valores reais de base com fonte [REAL], projeções [PARÂMETRO] | Orçamento fecha (invariante) |
| 3.2 | Limites legais | Pessoal/RCL, mínimos de saúde e educação, dívida | `rules/fiscal.ts` | [REAL] parametrizado por ano | Alertas e consequências ao descumprir |
| 3.3 | Secretarias | Orçamento, secretário (ator), equipe, capacidade, metas, problemas | `municipality.secretariats` | [SIMULAÇÃO] | O jogador nomeia e cobra; o desempenho varia |
| 3.4 | Programas e obras | Planejamento → licitação → execução → entrega, com atrasos e custos | `municipality.projects` | Lei 14.133/2021 em nível simplificado [SIMPLIFICAÇÃO] | Obra leva meses e pode atrasar |
| 3.5 | Indicadores municipais | Emprego, renda, educação, saúde, mobilidade, segurança, habitação, saneamento, desigualdade, qualidade de vida, com inércia | `municipality.indicators` | Pontos de partida reais quando houver fonte | Indicadores reagem devagar e não instantaneamente |
| 3.6 | Decisões fiscais | Tributos municipais (IPTU, ISS), cortes, programas, crédito, renegociação | `government/decisions.ts` | Competência municipal [REAL]; anterioridade tributária [REAL] | Cada decisão tem efeito financeiro, político e social |
| 3.7 | Ciclo orçamentário | PPA (1º ano do mandato), LDO, LOA votada na Câmara, créditos adicionais, prestação de contas ao TCM | integra a Fase 2 | [REAL] calendário | A LOA precisa passar na Câmara |
| 3.8 | Interface de governo | Painel de orçamento, secretarias, obras, indicadores | `ui/governo.tsx` | — | Um mandato de prefeito jogável |

**Critério de conclusão:** administrar a prefeitura e ver os efeitos das decisões ao longo dos meses, sem resultado garantido.

### FASE 4 — Campanhas e eleições avançadas ⬜

| # | Entrega | Detalhe | Regras |
|---|---|---|---|
| 4.1 | Regiões | 5 zonas → 32 subprefeituras como unidade; eleitorado por zona eleitoral do TSE | Dados reais com fonte [REAL] |
| 4.2 | Segmentos | Setor privado, servidores, empreendedores, jovens, aposentados, estudantes, informais, faixas de renda; **sem** associar automaticamente grupo a partido | [SIMULAÇÃO] |
| 4.3 | Modelo de voto | Intenção = conhecimento × avaliação × proximidade de temas × rejeição × influência local | [SIMULAÇÃO] documentada |
| 4.4 | Etapas da campanha | Pré-campanha, alianças, convenção, registro, equipe, plano territorial, comunicação, debates, pesquisas, reta final, apuração | Lei 9.504/97 [REAL] |
| 4.5 | Financiamento completo | Recursos próprios, FEFC, Fundo Partidário, doações, limites, prestação de contas, punições | [REAL] por eleição |
| 4.6 | Pesquisas completas | Rejeição, conhecimento, avaliação de governo, cortes regionais | Lei 9.504/97 art. 33 [REAL] |
| 4.7 | Robôs de balanceamento | 8 perfis, taxa de vitória e diversidade de estratégias | — |

**Critério de conclusão:** campanhas com planejamento, riscos e resultados coerentes, sem que dinheiro sozinho decida o resultado.

### FASE 5 — Mundo vivo e expansão ⬜
- **5.1 Ambições ativas** de todos os atores, incluindo trocas de partido na janela, candidaturas próprias e alianças entre atores.
- **5.2 Crises de imagem**: informação verdadeira, falsa ou distorcida; respostas possíveis; credibilidade do veículo; histórico do personagem.
- **5.3 Eventos no formato completo** (contexto, personagens, custos, consequências futuras) e **memória de promessas públicas** a comunidades.
- **5.4 Pacotes de regras 2030 e 2032** (pesquisa de calendário e legislação), e o jogo continua depois de 2032.
- **5.5 Eleições gerais:** Assembleia Legislativa (94 vagas em SP), Câmara dos Deputados (70 vagas por SP), Senado (renovação de 1/3 em 2030 — confirmar), governador, presidente.
- **5.6 Novos níveis:** cargos estaduais e federais jogáveis, como deputado e secretário estadual.
- **5.7 Conquistas e finais múltiplos** (seção 11.4 do plano).

**Critério de conclusão:** o mundo político continua evoluindo sem o jogador, e a carreira pode passar de 2032.

### FASE 6 — Polimento e distribuição ⬜
Tutorial guiado; acessibilidade (contraste, teclado, tamanho de fonte); fontes embutidas; instalador Windows assinado; backup automático de saves (vários slots e exportar arquivo); otimização de desempenho; balanceamento final; documentação para o jogador.

---

## Parte 5 — Integração entre sistemas (regra 2.2 do plano)

| Ação ou acontecimento | Partido | Câmara | Opinião pública | Imprensa | Próxima eleição |
|---|---|---|---|---|---|
| Criticar a direção (✅) | −confiança, −fidelidade, +popularidade interna, memória do presidente | — | +reconhecimento | Notícia | Convenção mais difícil |
| Vencer disputa interna (✅) | Presidência, cumprimento de promessas | — | — | Notícia | Candidatura garantida |
| Trocar de lado numa disputa (✅) | Traição na memória, −fidelidade | (Fase 2) aliado vira rival em votações | — | — | Facção nega apoio |
| Apoiar o prefeito numa votação (Fase 2) | Agrada a ala governista e desagrada a de oposição | Relação com o Executivo e emendas | Varia por segmento | Notícia conforme a linha editorial | Efeito na avaliação do eleitor |
| Investir em saúde como prefeito (Fase 3) | — | Disputa por emendas | Melhora gradual nas regiões atendidas | Cobertura de entrega | Avaliação de governo |

---

## Parte 6 — Riscos
- **Regras que mudam:** cada eleição terá pacote próprio e nada será assumido igual entre ciclos.
- **Pessoas reais:** traços e alinhamentos sempre marcados como simulados; nenhum escândalo inventado.
- **Escopo:** profundidade em SP antes de novas cidades.
- **Desempenho:** monitorar o tamanho do estado a cada fase.
- **Balanceamento:** robôs de perfil desde a Fase 4.
