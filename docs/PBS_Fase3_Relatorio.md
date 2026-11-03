# PBS — Relatório da Fase 3: governo e economia da Prefeitura

Versão do save: **6** (saves v1–v5 migram automaticamente). Testes: **81 passando** (12 novos da Fase 3).

## 1. O que entrou

### 1.1 Orçamento com base real (`data/spfinance.ts`, `game/municipality.ts`)
- **Ponto de partida real (2025)**: receita de R$ 123,5 bi (ISS R$ 37,5 bi; IPTU R$ 16,1 bi; ITBI R$ 4,5 bi; transferências R$ 25,5 bi), pessoal R$ 40,7 bi, investimentos ≈ R$ 11 bi, RCL R$ 100,7 bi, pessoal em 28,1% da RCL, dívida líquida em 19,6% da RCL.
- **LOA 2027 do jogo** fecha exatamente no total real da LDO 2027 (R$ 138,6 bi). Saúde, Educação e Assistência são ancoradas no PLOA 2026; as demais áreas são estimativas, marcadas como tal.
- **Execução mensal**: receitas (ISS e ITBI acompanham a atividade econômica), despesas por área, pessoal, serviço da dívida, caixa e dívida. O exercício fecha em dezembro com o resultado, a RCL e os índices legais.
- **A cidade funciona sem o jogador**: com prefeito da IA, LDO, LOA e contingenciamento são automáticos, e as 10 secretarias são chefiadas por personagens do jogo.

### 1.2 Limites legais (`rules/fiscal.ts`)
Painel de limites com as faixas reais:
- pessoal / RCL (alerta 54%, prudencial 57%, máximo 60%);
- Educação ≥ 31% (Lei Orgânica, art. 208) e Saúde ≥ 15%;
- dívida até 1,2 × RCL e crédito até 16% da RCL no ano.

Consequências reais aplicadas:
- acima do limite prudencial, reajustes ficam bloqueados (LRF art. 22);
- acima do limite, ficam bloqueados operações de crédito e convênios voluntários (art. 23);
- aumento de pessoal é nulo nos 180 dias finais do mandato (art. 21);
- não se contrai dívida nos dois últimos quadrimestres do mandato (art. 42).

### 1.3 Ciclo orçamentário na Câmara
- **LDO até 15/04** e **LOA até 30/09**, votadas pela Câmara como projetos de verdade (Comissão de Finanças → plenário).
- No 1º ano do mandato, o **PPA** vai junto com a LOA.
- A Câmara aprova a LOA **com emendas que reestimam a receita**, como aconteceu na LOA 2026.
- **LOA não votada até 31/12**: vale o orçamento anterior corrigido pela inflação (a confirmar na redação do art. 140 da LOM).
- **Prazo perdido** pelo prefeito-jogador: a Fazenda envia o texto padrão e ele perde aprovação.

### 1.4 Decisões do prefeito
- **Montar o orçamento** (julho a setembro) na página Prefeitura: botões por área, demais órgãos e operações de crédito; mostra o saldo e o cumprimento dos mínimos. Só envia se fechar e respeitar os mínimos.
- **Programa de Metas** em até 90 dias da posse (LOM art. 69-A): quatro pacotes de prioridades, cobrados pelo desempenho das pastas.
- **Nomear secretário(a)**: técnico (mais competência) ou indicação política (menos competência, mas traz o partido para a base e recalcula os blocos da Câmara). O jogador assume a prefeitura com interinos.
- **IPTU e ISS**: projetos de lei com anterioridade e noventena (CF art. 150). O ISS fica entre 2% e 5%. Aumentar imposto é impopular, e a base pode traí-lo.
- **Contingenciamento** (LRF art. 9º), **operação de crédito** com destino e verificação de limites, **reajuste dos servidores**, **convênios** com Estado e União (agora entram no caixa).
- **Orçamento → serviços**: o corte de uma área acelera a piora dos indicadores da pasta e aumenta crises; o reforço freia a piora e libera programas.

### 1.5 Prestação de contas
- **Junho**: parecer prévio do Tribunal de Contas do Município sobre as contas do ano anterior (contrário se os mínimos ou limites forem descumpridos; com ressalvas se houver déficit relevante ou pessoal acima do prudencial).
- **Agosto**: julgamento pela Câmara. O parecer só cai com **2/3 (37 votos)** (CF art. 31). Rejeição custa aprovação, vira notícia e o jogo informa o risco de inelegibilidade (LC 64/90, art. 1º, I, "g").

### 1.6 Secretário(a) jogador(a)
- A pasta do jogador é a mesma da cidade: herda indicadores e programas e recebe o orçamento da LOA.
- Se for exonerado, a pasta volta para a IA.

### 1.7 Interface
Página **Prefeitura** com cinco abas:
1. Finanças e limites;
2. Orçamento (editor do projeto de LOA);
3. Secretarias (secretário, orçamento frente à referência, indicadores, programas, crises);
4. Contas e calendário (LDO/LOA/PPA/Metas, histórico, TCM);
5. Regras e fontes.

## 2. Regra real × mecânica de jogo

| Tag | Item |
|---|---|
| REAL | LRF: pessoal 60% da RCL (alerta 54%, prudencial 57%), vedações dos arts. 21, 22, 23 e 42, contingenciamento (art. 9º), reserva de contingência (art. 5º) |
| REAL | Educação 31% (LOM art. 208); Saúde 15% (LC 141/2012) |
| REAL | Dívida 1,2 × RCL (Res. Senado 40/2001); crédito 16% da RCL (Res. 43/2001) |
| REAL | Câmara: teto de 3,5% para cidades com mais de 8 milhões de habitantes (CF art. 29-A) — exibido como regra |
| REAL | Prazos: LDO 15/04, LOA 30/09, votação até 31/12 (LOM arts. 138 e 140); Programa de Metas em 90 dias (LOM art. 69-A) |
| REAL | Anterioridade e noventena (CF art. 150); ISS entre 2% e 5% (LC 116/2003); parecer do TCM e 2/3 para derrubá-lo (CF art. 31) |
| REAL | Números de 2025 (RGF e Gestão Fiscal), LOA 2026, PLOA 2026 por área, LDO 2027 |
| DERIVADA | RCL = 96,1% das receitas correntes; pessoal LRF = 69% do pessoal total (razões de 2025); calibração contábil de Educação e Saúde |
| SIMPLIFICAÇÃO | LOA não votada → orçamento anterior corrigido; emendas da Câmara como reestimativa de receita; crédito liberado em 2 meses |
| PARÂMETRO | Inflação 4% a.a., crescimento real 1,5%, custo e prazo da dívida, divisão do pessoal por área, reserva mínima, efeito do orçamento sobre os indicadores |
| FICÇÃO | Secretários(as) e seus perfis; orçamento das áreas sem fonte; valores iniciais dos indicadores sociais |

## 3. Balanceamento (bots, mandato 2029–2032)
- **Prefeito ativo** (metas, nomeações, LDO/LOA no prazo, reforço em Saúde e Educação, crédito, zeladoria): aprovação final 66–76; contas aprovadas.
- **Prefeito passivo**: aprovação 25–29, prazos perdidos, LOA às vezes prorrogada.
- **Cidade da IA** (2027–2032): receita cresce de R$ 138 bi para ~R$ 180 bi nominais; pessoal entre 24% e 28% da RCL; dívida líquida entre 22% e 26% da RCL; mínimos cumpridos.

## 4. Pendências e próximos passos
- Conferir a redação do art. 140 da LOM (LOA não votada) e o rito da LDO na CMSP.
- Emendas individuais impositivas dos vereadores (verificar se a LOM de SP prevê) e créditos adicionais por decreto dentro do limite autorizado na LOA.
- Previdência municipal (RPPS/Sampaprev) e precatórios como pressões de caixa.
- Fase 4 (plano): balanceamento sistemático com bots, curvas de dificuldade, e a pasta grande fácil demais para o secretário.
