# PBS — Relatório da Fase 6: polimento e distribuição

Critério do plano v0.4: **jogo apresentável, estável e instalável**. Esta fase entregou o aplicativo de desktop com saves em arquivo, o guia do jogador, uma rodada de balanceamento de carreira longa e melhorias de interface, acessibilidade e transparência dos indicadores.

Versão: 0.6.0. Save: versão 8 (ajustes automáticos ao carregar). Testes: 133 passando, 7 deles em `phase6.test.ts`.

---

## 1. Aplicativo de desktop — `src-tauri/`, `src/ui/desktop.ts`, `.github/workflows/desktop.yml`

**Instaladores para três sistemas**, gerados a cada envio para a branch `main` pelo GitHub Actions (aba Actions → "Instaladores desktop" → Artifacts):

| Sistema | Arquivos | Observação |
|---|---|---|
| Windows | `.exe` (instalador) e `.msi` | — |
| macOS | `.dmg` | Sem assinatura da Apple: na 1ª abertura, clique com o botão direito → Abrir. |
| Linux | `.AppImage` e `.deb` | O `.deb` também foi compilado com sucesso neste ambiente. |

Se você criar uma tag `v*` no GitHub (por exemplo `v0.6.0`, em Releases → Draft a new release), os instaladores são anexados automaticamente a essa Release.

**Saves em arquivo** (só no desktop):
- Pasta visível: `Documentos/Political Brazilian Simulator`.
- `autosave.json` é regravado a cada mês de jogo.
- Uma cópia por ano de jogo (`pbs-<nome>-ano-AAAA.json`), para voltar no tempo se algo der errado.
- A gravação usa arquivo temporário e renomeação: um travamento no meio não corrompe o save anterior.
- A tela inicial lista os arquivos da pasta para carregar.
- Segurança: o backend nativo só lê e escreve dentro dessa pasta, só arquivos `.json` com nome simples. Não há acesso à rede.

**No navegador**:
- "Salvar / exportar partida" agora baixa um arquivo `.json` (no protótipo publicado no Claude, pela permissão de download do artefato, com confirmação); continua dando para copiar o texto.
- "Abrir arquivo de save" na tela inicial carrega esse arquivo.
- O localStorage continua como salvamento automático, com as 3 cópias de segurança da versão anterior.

## 2. Guia do jogador — `game/tutorial.ts`, `ui/guide.tsx`

- Opção "Guia para iniciantes" na criação do personagem (ligada por padrão).
- Um card no topo da página mostra **uma dica por vez**, com os botões "Entendi", "Ir para…" e "Desligar o guia".
- Introdução: agenda e "Avançar mês"; menu por esfera; "por que mudou".
- **14 dicas de contexto** (17 no total, com a introdução), cada uma aparece uma vez quando a situação acontece:
  - sem partido (prazo de filiação, Lei 9.504/97 art. 9º);
  - disputa interna no partido;
  - redes sociais;
  - ano de eleição (convenções de 20/7 a 5/8 e campanha a partir de 16/8);
  - campanha registrada;
  - primeiro evento;
  - assessor de gabinete;
  - primeiro cargo (agenda ◆);
  - votações do mês;
  - equipe de gabinete;
  - prefeitura (LRF art. 42);
  - secretaria;
  - crise de imagem;
  - caixa pessoal negativo.
- Página Regras: ligar/desligar o guia e "ver todas as dicas de novo".
- **Partidas em andamento** (com mais de 3 meses) não reveem a introdução; só aparecem as dicas de recursos novos.

## 3. Balanceamento de carreira longa

**Correção de bug (grave)**: a convenção partidária tratava qualquer candidatura que não fosse a prefeito como candidatura a **vereador**. Deputado usava a régua de vereador, e governador e senador não passavam pela disputa de delegados. Agora a convenção usa o cargo disputado (`elections.ts`, `resolveConvention`).

**Memória do eleitor** (PROPOSTA): quem já disputou eleição ou exerceu mandato não volta ao anonimato.
- Os votos recebidos criam um **piso de reconhecimento**. Por exemplo, 20 mil votos na cidade dão piso de cerca de 30. Na eleição estadual conta só a parcela estimada de votos da capital (45%).
- Ex-ocupantes de cargo também ficam com piso: vereador 28, deputado 32 a 36, senador 45, prefeito 50, governador 55.
- O esquecimento natural não leva o reconhecimento abaixo desse piso.

**Robô de carreira** (`tools/carreira.test.ts`):
- Corrigido: o robô gastava a agenda repetindo uma ação de custo zero ("Ajustar o plano de campanha") e quase nunca fazia campanha de verdade.
- Agora ele também nomeia a equipe de gabinete.
- Resultado típico depois dos ajustes: o candidato iniciante sobe de cerca de 6 mil para cerca de 20 mil votos entre 2028 e 2032 e se elege vereador. Como vereador, tenta a Alesp: 18 mil a 53 mil votos, ainda insuficiente numa lista grande como a do PL. Depois disputa a prefeitura.
- O jogo continua difícil para quem joga de forma ingênua. Os perfis da Fase 4 continuam sendo a régua (`npm run balance`).

## 4. Interface, acessibilidade e "por que mudou"

- **"O que mudou no último mês"**: novo quadro na Agenda. Mostra a soma das variações de cada indicador no mês que passou e as três principais causas. Clicar abre o histórico de causas.
- **Causas mais precisas**: o processamento mensal agora separa:
  - campanha territorial e assessoria;
  - mandato estadual/federal;
  - investigação de esquema;
  - equipe do gabinete;
  - mundo estadual.
- Credibilidade pessoal e relação com o Executivo passaram a ter histórico de causas.
- O **caixa no topo** é clicável e abre o histórico de causas do dinheiro.
- **Celular**: barra de navegação compacta e fixa ao rolar; indicadores em duas colunas; janelas que cabem na tela. Corrigido o rodapé do menu, que ocupava 150 px no celular.
- **Acessibilidade**:
  - foco visível em todos os controles (contorno dourado);
  - indicadores clicáveis acessíveis por teclado (Enter/Espaço), com descrição para leitores de tela;
  - avisos (toast) anunciados por leitores de tela;
  - respeito à preferência "reduzir animações" do sistema.

## 5. Regra real × mecânica de jogo

| Elemento | Classificação |
|---|---|
| Prazo de filiação, datas de convenção e de campanha, LRF art. 42 citados no guia | REGRA REAL (já referenciadas no pacote de regras) |
| Piso de reconhecimento por votos e cargos | PROPOSTA |
| Textos do guia | Explicação de mecânicas de jogo |

## 6. Pendências

1. **Tramitação completa na Alesp e no Congresso** (comissões e relatorias).
2. **Orçamento estadual detalhado** para o governador.
3. **Presidência da República** como disputa jogável.
4. **Assinatura dos instaladores** (Windows SmartScreen e Apple): exige certificados pagos. Sem eles, o sistema mostra aviso na primeira abertura.
