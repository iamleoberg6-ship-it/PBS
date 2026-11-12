# PBS — Fase 13: noite da apuração e cenas

**Status:** implementado · 185 testes passando · build OK · conferido no navegador numa partida real (eleição de 2028 → apuração → posse em janeiro de 2029)

## Objetivo
Os grandes momentos da carreira passavam como uma linha de texto. Agora viram telas próprias.

## 1. Noite da apuração
Quando o jogador é candidato, a apuração abre sozinha ao avançar o mês da eleição. Vale para:
- 1º turno municipal e gerais;
- 2º turno de prefeito, governador e presidente.

**Na tela:**
- relógio a partir das 17h, horário de Brasília;
- barra de "seções totalizadas" e aviso de quais regiões estão chegando;
- placar com barras e votos subindo em tempo real.
- **Majoritária:** os 5 primeiros mais o jogador, com o percentual dos válidos.
- **Proporcional:**
  - os eleitos da lista do jogador mais o próprio jogador, ordenados pela posição dentro da lista;
  - no fim aparece a linha de corte, com as cadeiras que a lista fez.
- O jogador fica numa faixa fixa no rodapé durante a contagem.
- **No fim**, um carimbo: ELEITO(A)!, 2º TURNO! ou NÃO ELEITO(A), com confete na vitória e um texto com o resultado (votos, cadeiras da lista, votos do último eleito).
- **Controles:** acelerar ×3, pular para o resultado e continuar. Enter ou Esc também funcionam.
- **Rever a noite da apuração:** botões nas abas Minha campanha, Municipais e Gerais.

**Regra real × apresentação:**

| Tag | Item |
|---|---|
| DADO DO JOGO | Números finais calculados pelo motor eleitoral já existente (quociente eleitoral, sobras 80/20, art. 111, maioria absoluta) |
| MECÂNICA DE APRESENTAÇÃO | Ordem em que as regiões aparecem, curva de totalização e oscilação dos candidatos durante a contagem. É ilustrativa e está avisada no rodapé da tela |

**Votos do jogador por região:** quando o registro tem `playerVotesByRegion`, a curva do jogador segue a ordem de chegada das regiões. Se as regiões fortes dele chegam cedo, ele aparece na frente no começo, como acontece de verdade.

## 2. Cenas em tela cheia
Cada cena tem cenário em pixel art desenhado em código (SVG) e texto curto.

| Cena | Quando aparece | Cenário |
|---|---|---|
| Posse | o jogador assume um cargo | prédio da Prefeitura ou Câmara, Palácio dos Bandeirantes ou Brasília (Congresso e Planalto), com família e fogos; faixa dourada para prefeito, governador e presidente |
| Fim de mandato / cassação | o mandato termina (cassação reconhecida pelo log) | caixa de papelão; chuva na cassação |
| Nomeação / promoção / exoneração | mudanças no emprego de assessor | escritório; fogos na promoção; chuva e caixa na exoneração |
| Nascimento | novo filho na família | hospital, os pais com o bebê, corações |
| Casamento / separação | entra ou sai o cônjuge | casal com coração / figura sozinha na chuva |
| Escândalo | nova crise de imagem ativa contra o jogador | jornal "URGENTE" e câmeras com flash; o texto muda se a história é verdadeira, falsa ou distorcida |
| Filiação / troca de partido | muda o partido | bandeira com a sigla, na cor da lista |
| Ameaça grave | nova ameaça de nível 4 ou mais | celular tremendo e balões "!!!" |
| Sucessão / fim da carreira | o herdeiro assume / fim de jogo | entardecer |

- **Personagem:** a figura principal segue o gênero do personagem.
- **Ordem:** várias cenas no mesmo mês aparecem em sequência, e a apuração vem antes da posse.

## 3. Som
- Efeitos curtos gerados no navegador (WebAudio), sem arquivos de áudio: vitória, derrota, suspense de 2º turno, momentos alegres e tique da contagem.
- Botão "Som: ligado/desligado" no rodapé do menu; a escolha fica guardada no navegador.
- As animações respeitam `prefers-reduced-motion`.

## Arquitetura
- `src/engine/game/scenes.ts`:
  - `detectScenes(prev, next)`: função pura que compara dois estados consecutivos. **Não muda o estado nem o formato do save**, então não há migração.
  - `apuracaoData(s, ref)`: monta os números da apuração a partir do registro da eleição.
  - `pastApuracoes(s)`: lista as eleições em que o jogador foi candidato.
- `src/ui/cenas.tsx`: `SceneQueue`, `Apuracao`, sprites em pixel art e efeitos sonoros.
- `src/ui/Game.tsx`: chama `detectScenes` depois de "Avançar mês"; tem os botões de rever a apuração e o de som.
- `src/engine/game/scenes.test.ts`:
  - uma partida real até 2028, conferindo que a apuração bate com o registro da eleição;
  - casos montados para posse, nascimento, filiação, nomeação e promoção, além de dois estados iguais não gerarem cena.

## Ideias para depois
- Ilustração própria para cada cargo nas posses estaduais e federais (Alesp e Senado separados).
- Discurso de vitória ou derrota escolhido pelo jogador, com efeito em imagem e base.
- Retratos em pixel art para personagens fictícios.
