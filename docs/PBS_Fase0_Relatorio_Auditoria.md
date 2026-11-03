# PBS — Fase 0: relatório de auditoria e estabilização

Data: 02/11/2026 · Versão: v0.3 → **v0.4-fase0** (save v3) · Responde à seção 3 do *Plano de Evolução*.

## Resumo
Foram encontrados 6 problemas: 2 de gravidade alta e 3 de gravidade média já estão corrigidos e testados, e 1 (empacotamento) está parcialmente resolvido.
- **Testes:** os automatizados passaram de 27 para 41, todos passando.
- **Verificações extras:** checagem de tipos sem erros, build web gerado e duas partidas completas jogadas pela interface num navegador automatizado, sem erros.
- **Pendências:** o instalador de Windows não foi gerado aqui, porque o ambiente é Linux sem as bibliotecas do Tauri. A configuração está pronta e validada pelo `tauri info`.

## Problemas encontrados e correções

| # | Problema | Gravidade | Arquivos | Correção | Testes |
|---|---|---|---|---|---|
| A1 | **Votos do jogador eram somados por cima do total da lista.** O jogador ganhava votos sem que ninguém perdesse, o que inflava os votos válidos e o quociente eleitoral. Medido antes da correção: válidos ~176 mil acima do alvo, quase exatamente os 182 mil votos do jogador naquele cenário. | **Alta** | `game/elections.ts` | O total de válidos virou restrição fixa. Os votos do jogador saem do bolo nominal da própria lista. Um **efeito puxador** parametrizado (50% dos votos do jogador são voto novo para a lista, retirados das outras listas) fica marcado como mecânica de jogo em `rulepack.ts`. Teto: o jogador não passa de 90% dos nominais da lista. | `elections.test.ts`: 4 cenários × 8 seeds |
| A2 | **Arredondamento** (`Math.round` por candidato) fazia a soma dos candidatos diferir do total da lista. O mesmo acontecia no majoritário. | Média | `game/elections.ts`, novo `util/apportion.ts` | Divisão pelo método dos maiores restos, com soma exata garantida. | Soma de nominais + legenda = válidos; soma no majoritário = válidos |
| A3 | Verificação das regras: QE, QP, 10%, 80/20, última fase, art. 111, federação como lista única. | — | `rules/proportional.ts` | Sem erro de regra encontrado. Foram acrescentados invariantes: eleito na 1ª fase com ≥ 10% do QE, eleito nas sobras 80/20 com ≥ 20%, cadeiras da 1ª fase ≤ QP, 55 eleitos sem duplicidade. | idem |
| B1 | **Patrimônio estático**: `netWorth` nunca mudava, e dívida não tinha juros nem amortização. | Média | `game/finance.ts` (novo), `turn.ts`, `actions.ts`, `events.ts`, `create.ts`, `types.ts` | Patrimônio líquido = caixa + bens − dívidas, recalculado a cada mês e a cada ação. Bens rendem 0,3% ao mês e dívida custa 2% ao mês. A dívida é amortizada automaticamente quando o caixa passa de 2 meses de despesas. Tudo parametrizado como mecânica de jogo. Conta de campanha continua separada. | Invariante em 40 meses; desempregado acumula dívida; médico forma patrimônio |
| C1 | **Saves sem validação nem migração.** A mudança de formato da v0.3 recusava saves antigos, e um save corrompido podia quebrar a partida. | **Alta** | `game/save.ts` (reescrito), `ui/Start.tsx` | Fluxo novo: parse → migração por formato (v1 → v2 → v3, determinística) → validação estrutural com reparos seguros (limites, caixa negativo, patrimônio, partido inexistente, filiação duplicada, vereadores duplicados, bancadas, eventos desconhecidos, seguidores inválidos) → recusa com mensagem clara nos casos fatais. A interface mostra os ajustes feitos antes de continuar. | Ida e volta idêntica; reprodutibilidade salvando no meio; migração de save v1; reparos; recusas |
| D1 | **Data de nascimento genérica (01/01/1970) para os 55 vereadores reais**, usada no desempate legal pelo mais idoso. | Média | `game/elections.ts`, `rules/proportional.ts` | Data desconhecida passa a ser `null`. Num empate em que falta a data, o jogo usa a ordem de registro como fallback e registra isso na auditoria da apuração, sem fingir que aplicou o art. 110. | Teste de empate com data ausente |
| D2 | Dirigente fictício aparecia como presidente do diretório de um partido real sem identificação. | Baixa | `game/events.ts` | Rotulado como "dirigente fictício do jogo". | — |
| E1 | Faltava configuração de empacotamento desktop. | — | `src-tauri/` (novo), `package.json`, `README.md` | Tauri 2: configuração, Cargo, ponto de entrada, permissões mínimas, ícones e scripts `desktop:dev`/`desktop:build`. A execução web não foi afetada (o build web continua igual). | `tauri info` reconhece a configuração |

## Testes executados (41)
- **Regras reais (17):** quociente eleitoral; três fases de distribuição com caso calculado à mão; art. 111; desempate por idade; calendário de 2028; elegibilidade (idade, filiação, reeleição); segundo turno.
- **Conservação de votos (7):** maiores restos; 4 cenários de lista × 8 seeds; majoritário; desempate sem data.
- **Saves e patrimônio (7):** ida e volta; reprodutibilidade salvando no meio; migração v1; reparos; recusas; invariante de patrimônio; dívida e formação de patrimônio.
- **Simulação (10):** partidas inteiras determinísticas com várias seeds, de vereador e de prefeito; vereadores reais; Mesa anual; pesquisas; ideologia; redes; notícias.
- **Também:** checagem de tipos sem erros, build web e duas partidas de ponta a ponta pela interface (criação → filiação → campanha → apuração → mandato) sem erros.

## Pendências
1. **Instalador Windows**: gerar numa máquina Windows com `npm run desktop:build` (passos no README). Não foi possível aqui (Linux sem WebKitGTK).
2. **Fontes offline no desktop**: hoje vêm do Google Fonts; sem internet o jogo usa fontes do sistema. Fica para a Fase 6.
3. **Ações repetitivas** (seção 12.2 do plano): ainda dá para repetir a mesma ação todo mês com retorno quase cheio. Já há retornos decrescentes nos indicadores, mas não fadiga por repetição. Proposto para a Fase 1, junto com o livro de causas.
4. **Relação jogador–partido** ainda é um indicador só (vira cinco na Fase 1, com migração).
5. **Datas de nascimento reais**: se quisermos o desempate legal exato com figuras reais, é preciso carregar datas com fonte. Por enquanto o fallback está identificado.

## Riscos de regressão
- **Balanceamento eleitoral:** com a conservação de votos, o jogador num partido pequeno tem teto mais baixo (90% dos nominais da lista). Nos testes, um influenciador fez 38–73 mil votos e um professor bem articulado 36 mil, ambos plausíveis. Ajustes ficam no parâmetro `candidatePullShare`.
- **Saves antigos** são migrados com estimativas (bens = patrimônio antigo − caixa) e a interface avisa o que foi ajustado.
- **Mudança de formato:** a próxima (save v4, Fase 1) exige migrar `partyStanding` para os novos indicadores. O padrão de migração encadeada já está pronto para isso.
