# PBS — Fase 12: navegação em 7 seções e fonte única

**Status:** implementado · 183 testes passando · build OK · conferido no navegador (desktop e celular 390 px)

## Problema
- O menu lateral tinha de 20 a 23 itens, conforme o cargo.
- Havia páginas repetidas:
  - "Vereadores e cidade" repetia o resumo da Prefeitura e da Câmara Municipal;
  - "Brasil por regiões" repetia o que "Indicadores sociais" já mostrava.
- Assuntos ligados ficavam em grupos diferentes: imagem num, redes e notícias em outro.
- Itens trocavam de nome e de lugar conforme o cargo.

## Nova estrutura
O menu tem sete seções fixas. Os nomes não mudam com o cargo, e cada seção tem abas no topo da página.

| Seção | Abas |
|---|---|
| Agenda | Agenda e ações |
| Meu cargo (só com mandato ou emprego) | mandato/governo do cargo atual · gabinete parlamentar (assessoria) · minha equipe |
| Eleições | minha campanha (se houver) · municipais · gerais (a próxima eleição vem primeiro) |
| Partidos | meu partido · todos os partidos (com a ideologia por tema) |
| Imagem e mídia | imagem e promessas · redes sociais · notícias |
| Política e país | São Paulo · Governo de SP e Congresso · Governo federal (oculto para quem é presidente, vice ou ministro, porque já está em "Meu cargo") · Indicadores |
| Eu | personagem · vida pessoal e família · conquistas · histórico |

**Rodapé do menu:** Regras · Salvar/exportar · Menu inicial.

**Detalhes:**
- **São Paulo:** uma aba só, com três vistas internas (visão geral e vereadores, Prefeitura e Câmara Municipal). A antiga página "Vereadores e cidade" virou a visão geral.
- **Indicadores:** cidade, estado e Brasil na mesma tela. A antiga página "Brasil por regiões" ficou logo abaixo.
- **Desvio da proposta inicial:** "Indicadores do meu território" e "Projeção no Brasil" não ficaram em "Meu cargo". As duas mostravam o mesmo conteúdo da aba Indicadores, então ficam só em "Política e país", sempre no mesmo lugar.
- **Memória de aba:** cada seção lembra a última aba aberta.
- **Atalhos antigos continuam valendo:**
  - Os links do guia que apontam para páginas antigas (`governo`, `camara`, `brasil`, `secretaria`) são redirecionados ao novo lugar.
  - Quando o jogador é vereador ou prefeito, `camara` ou `governo` continuam abrindo o mandato dele em "Meu cargo".
- **Guia:** os textos do guia foram atualizados (menu em seções, campanha, imagem).
- **Celular:** o menu vira uma faixa fixa no topo, de 50 px, e as abas ficam presas logo abaixo ao rolar.

## Fonte
- A Rubik passa a ser a fonte única do jogo, embutida no build via `@fontsource/rubik`, licença SIL OFL.
- As fontes pixeladas (Press Start 2P, Pixelify Sans e VT323) foram removidas. Misturar fonte pixelada com texto legível ficou incoerente.
- O estilo 8-bit continua nas formas:
  - cantos retos, bordas grossas e sombra dura;
  - barras em blocos;
  - cursor ▶ no menu;
  - urna em pixel art;
  - céu estrelado e skyline na tela inicial;
  - janelas no estilo de RPG.

## Arquivos
- `src/ui/Game.tsx`: `sections()`, `resolvePage()`, memória de aba, barra de abas e as vistas de São Paulo.
- `src/index.css`: fonte única e estilos de seção, abas e rodapé do menu.
- `src/engine/game/tutorial.ts`: textos do guia atualizados.
