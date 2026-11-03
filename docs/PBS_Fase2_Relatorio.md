# PBS — Relatório da Fase 2: Câmara Municipal funcional e secretarias jogáveis

Versão do save: **5** (saves v1–v4 migram automaticamente). Testes: **69 passando** (14 novos da Fase 2).

## 1. O que entrou

### 1.1 Motor legislativo (`src/engine/game/legislature.ts`)
- **Comissões permanentes da CMSP (7)**: Constituição, Justiça e Legislação Participativa; Finanças e Orçamento; Política Urbana, Metropolitana e Meio Ambiente; Administração Pública; Trânsito, Transporte, Atividade Econômica, Turismo, Lazer e Gastronomia; Educação, Cultura e Esportes; Saúde, Promoção Social, Trabalho e Mulher. Composição proporcional às bancadas (D'Hondt, preenchimento intercalado), presidentes escolhidos com preferência à base do governo.
- **Blocos**: base (coligação do prefeito), independente, oposição moderada e oposição radical, pela distância ideológica do partido ao prefeito e pelo pragmatismo simulado de cada vereador.
- **Tramitação completa**: CCJ → comissão de mérito → Finanças (se cria despesa) → plenário → sanção/veto (15 dias; silêncio = sanção tácita) → apreciação do veto (derrubada só com 28 votos).
- **Vício de iniciativa**: projetos de vereador que criam programa podem invadir matéria privativa do prefeito; a chance cai com conhecimento político (o influenciador sofre mais). A CCJ tende a barrar e o prefeito tende a vetar.
- **Modelo de voto** por vereador: ideologia do partido, bloco frente ao governo, posição do Executivo, rivalidade entre blocos, mesma bancada do autor, relação com o jogador, compromissos, pressão pública e ruído. A interface mostra o **placar provável**.
- **Voto do jogador** em comissão e plenário, sem gastar compromisso de agenda. Sem registro, segue a orientação da bancada. Consequências: fidelidade percebida e confiança da direção (contrariar a bancada), relação com a prefeitura (contrariar o governo sendo base), popularidade (contrariar a opinião pública em tema de repercussão) e memória de traição (votar contra a bancada de quem votou no seu projeto a seu pedido).
- **IA legislativa**: bancadas apresentam 1–2 projetos por mês e o Executivo envia projetos (com urgência às vezes). Projetos da IA são atribuídos a **bancadas**, nunca a uma pessoa real.
- **Mesa Diretora**: cinco cargos, eleição na janela real (1º/01/2029; dezembro de 2029, 2030 e 2031), candidatura do jogador, negociação de bancadas em troca de cargo na Mesa (promessa rastreada), votação nominal e maioria absoluta no 1º escrutínio. Presidência dá o poder de pautar.
- **CPI**: fato determinado (achado da fiscalização), 19 assinaturas, prazo de 4 meses, relatório final com desfecho variável.

### 1.2 Novas ações de vereador
Apresentar projeto (tema × tipo), pedir relatoria, articular votos, audiência pública, indicação ao Executivo, fiscalizar, protocolar CPI, colher assinaturas, posição frente à prefeitura (4 blocos), emendas, lançar candidatura à Mesa, negociar bancada para a Mesa, pautar (se presidente).

Prefeito: enviar projeto do Executivo (agora tramita de verdade), ceder espaço no governo a um partido específico (amplia a base, recalcula blocos), **sancionar ou vetar**.

### 1.3 Secretarias (`src/engine/game/secretariat.ts`)
- **Convite só com relação política**: mesma chapa/federação do prefeito eleito, apoio declarado na campanha, ou proximidade ideológica forte (distância ≤ 0,15 na escala). Também exige reconhecimento, competência (gestão ou conhecimento político) e confiança mínima da direção. Sem afinidade, o registro explica por que não houve convite.
- **10 pastas**: Saúde, Educação, Mobilidade e Trânsito, Habitação, Assistência e Desenvolvimento Social, Cultura, Esportes e Lazer, Verde e Meio Ambiente, Subprefeituras (zeladoria), Segurança Urbana. As três oferecidas dependem da profissão e dos atributos.
- **Indicadores sociais por pasta** (3 cada, ponto de partida simulado), que pioram sozinhos com a demanda.
- **Indicadores políticos**: aprovação da pasta, relação com o prefeito, relação com a Câmara, capacidade da equipe, risco de exoneração.
- **Orçamento**: ordem de grandeza simulada, com fatia livre (4%) para novos programas e suplementação disputada com a Fazenda.
- **Programas**: planejamento → licitação (impugnação/TCM) → execução (atrasos e aditivos) → entrega com efeito nos indicadores.
- **Ação própria de cada pasta** (ex.: mutirão de consultas, busca ativa escolar, operação tapa-buraco, vistoria em áreas de risco), crises específicas, gabinete de crise, coletiva de imprensa e reforço da equipe.
- **Exoneração**: relação com o prefeito < 25 ou aprovação < 28 por 3 meses.

### 1.4 Interface
- Página **Câmara Municipal**: blocos, Mesa, comissões com composição, projetos por aba (meus, plenário/vetos, comissões, sanção, concluídos), detalhe com histórico, relator, parecer, posição da prefeitura, pressão pública, placar provável e botões de voto; CPIs; histórico dos seus votos; regras com etiquetas.
- Página **Minha secretaria** (só aparece para secretário): indicadores políticos e sociais, orçamento, programas com barra de fases, catálogo e regras.
- Gabinete mostra relação com a prefeitura e com a Câmara.

## 2. Regra real × mecânica de jogo

| Tag | Item |
|---|---|
| REAL | Sanção/veto em 15 dias e silêncio como sanção tácita (LOM-SP art. 42; CF art. 66 por simetria) |
| REAL | Veto apreciado em 30 dias; rejeição só por maioria absoluta — 28 de 55 (LOM-SP art. 42) |
| REAL | Comissões permanentes da CMSP; CCJ e Finanças como etapas obrigatórias conforme a matéria |
| REAL | CPI: 1/3 dos membros, fato determinado, prazo certo (CF art. 58 §3º por simetria — conferir no Regimento) |
| REAL | Iniciativa privativa do prefeito (LOM-SP art. 37 §2º — conferir incisos); STF Tema 917: criar despesa, por si só, não é vício |
| REAL | Coligação de Ricardo Nunes em 2024: 12 partidos (MDB, PL, PSD, União, Republicanos, PP, Podemos, Solidariedade, Avante, Mobiliza, Agir, PRD) — base inicial do governo no jogo |
| REAL | Secretário é cargo de livre nomeação e exoneração; contratações pela Lei 14.133/2021, sob controle do TCM |
| DERIVADA | Composição das comissões por D'Hondt sobre as vagas de cada comissão |
| SIMPLIFICAÇÃO | Cada vereador é titular de uma só comissão; parecer contrário arquiva (sem recurso ao plenário) |
| SIMPLIFICAÇÃO | Mesa com cinco cargos; 2º escrutínio por maioria simples (a confirmar no Regimento) |
| PARÂMETRO | Tamanho das comissões (9/9/7/7/7/7/9), ritmo (≥ 1 mês por etapa), chance de pauta, prazo da CPI (4 meses), pesos do modelo de voto |
| FICÇÃO | Orçamentos das pastas (ordem de grandeza), valores iniciais dos indicadores, custos e prazos dos programas, crises |

Pessoas reais: vereadores reais votam pelo modelo do jogo; isso é simulação, não previsão nem afirmação sobre como votariam. A Mesa de 2027 em diante é simulada (na vida real, Ricardo Teixeira presidiu a Câmara em 2025 e 2026).

## 3. Balanceamento observado (bots)
- Projetos do jogador em 12 meses (3 projetos, 8 sementes): base do governo ≈ 83% viram lei; oposição sem articular ≈ 8%; oposição articulando votos ≈ 45–70%. Articulação e posição política importam.
- Secretário ativo (5 ações/mês na pasta): aprovação 60–90 ao fim do mandato; passivo: aprovação ~30 e exoneração em parte das partidas. **Ponto para a Fase 4**: pasta grande (Saúde) ainda fica fácil para quem joga só nela.
- Desempenho: ~4 ms por mês simulado com a Câmara inteira.

## 4. Pendências e próximos passos
- Conferir no Regimento Interno da CMSP: tamanho exato das comissões, rito da eleição da Mesa, prazo de CPI, recurso contra parecer de comissão, arquivamento no fim da legislatura.
- Fase 3 (plano): prefeito jogável em profundidade (LOA/LDO/PPA, Lei de Responsabilidade Fiscal, secretariado de IA com as mesmas pastas, Tribunal de Contas).
- Acúmulo de comissões e suplências; lideranças de bancada e de governo; requerimentos de urgência pelo plenário.
