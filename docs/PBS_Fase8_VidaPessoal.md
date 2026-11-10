# PBS — Fase 8: vida pessoal do político

Pedido do usuário: trazer para o jogo a vida pessoal do político. Isso inclui família criada pelo jogador, chances de relacionamento ao longo da partida, ameaças que crescem com a projeção, saúde e herdeiro político. As ameaças **pressionam, mas não tiram ninguém da política à força**: afastar-se do cargo é sempre uma decisão do jogador.

Módulos novos:
- `game/personal.ts`: estado, passo mensal, exposição, ameaças, licença, herdeiro e regras;
- `game/personalActions.ts`: ações e a troca de personagem pelo herdeiro;
- `game/personalEvents.ts`: acontecimentos;
- `ui/pessoal.tsx`: página "Vida pessoal e família".

Integração em:
- criação do personagem;
- turno mensal (passo 7c);
- ações (bloqueio do trabalho do cargo durante a licença);
- finais e conquistas;
- save: partidas antigas recebem o módulo ao carregar.

A vida pessoal tem **sorteio próprio** (`personal.rng`), para não mudar o resto da simulação.

Testes: 164 passando, 9 deles em `personal.test.ts`.

---

## 1. Família (criada pelo jogador)

Na criação do personagem, o jogador escolhe:
- estado civil: solteiro, namorando, casado, união estável ou divorciado;
- nome do parceiro ou parceira;
- até 5 filhos, com nome e idade;
- se os pais estão vivos.

Quem começa como herdeiro tem um pai ex-político (personagem do jogo).

Cada familiar tem:
- **humor** de 0 a 100;
- **perfil**: apoia a carreira, prefere privacidade, tem ambição política ou vive se metendo em confusão;
- **interesse por política**.

Mais de três meses sem "Tempo com a família" e o humor do cônjuge e dos filhos menores cai todo mês.

**Acontecimentos da família:**
- crise no casamento: terapia de casal, promessa de mais tempo (cobrada depois) ou separação;
- família na campanha;
- filho com problema na escola;
- filho adulto que vira notícia;
- pai ou mãe idosos que precisam de cuidados;
- filho que quer entrar na política;
- parente pedindo emprego no gabinete.

**Divórcio**
- SIMPLIFICAÇÃO: −30% dos bens e −15% do caixa.
- Pensão para filhos menores, descontada todo mês (parâmetro).

## 2. Relacionamentos

- **Para quem está solteiro:**
  - "Sair para conhecer pessoas" (o carisma ajuda);
  - o evento "Alguém interessante";
  - "Encontro" para cultivar a relação;
  - o namoro pode virar público e depois casamento ou união estável;
  - sem atenção, a relação esfria e acaba.
- **Amigos e mentor:**
  - um amigo de infância;
  - um mentor, para quem é filiado;
  - um ex-sócio, para empresários.
  - O amigo pode pedir ajuda num contrato público: orientar dentro da lei, **interferir (ILEGAL)** ou recusar.
- **Adversário pessoal:**
  - surge com a exposição alta e ataca com insinuações.
  - Respostas: rebater, ignorar, processar por difamação ou tentar fazer as pazes.

## 3. Exposição, ameaças e segurança

**Exposição pública (0–100)** soma:
- o peso do cargo (vereador 15 … presidente 70);
- o reconhecimento;
- a polarização: distância do centro na escala ideológica;
- campanha registrada;
- crises de imagem;
- a tensão recente.

Com licença, a exposição cai para menos da metade.

**Ameaças**
- A chance mensal cresce com a exposição. A segurança reduz essa chance: privada 0,6×, policial 0,45×, oficial 0,25×.
- Escala, do nível 1 ao 5:
  1. ataques nas redes;
  2. mensagens;
  3. ameaça à família;
  4. protesto na porta de casa;
  5. intimidação séria.
- Nada é descrito de forma gráfica, e ameaças nunca envolvem pessoas reais.
- Para personagem mulher com mandato ou candidatura, parte dos ataques é violência política de gênero.

**Respostas à ameaça:**
- registrar ocorrência;
- denunciar em público: solidariedade e reconhecimento, mas mais exposição e desgaste na família;
- pedir proteção policial (nível 3 ou mais; depende de avaliação);
- contratar segurança privada;
- afastar-se do cargo por 2 meses;
- ignorar: arriscado sem segurança nos níveis 4 e 5.

**Segurança oficial** vem automaticamente para presidente, vice, governador e candidato a presidente.

## 4. Licença do cargo (decisão do jogador)

"Pedir licença do cargo" fica na página Vida pessoal. O motivo pode ser segurança pessoal, interesse particular ou família, ou saúde.

**Parlamentar**
- Até 120 dias por ano por interesse particular, **sem salário**.
- Por saúde, com salário.
- O suplente assume.

**Prefeito, governador e presidente:** o vice assume interinamente.

**Durante a licença**
- Não há agenda do cargo, e as ações do mandato ficam bloqueadas.
- O suplente vota no seu lugar.
- Você segue na política fora do cargo, como militante: partido, base e redes.
- A aprovação do mandato cai devagar.

A licença termina sozinha no prazo, ou antes, com "Reassumir o cargo". Outro caminho de menos exposição, que já existia, é aceitar uma secretaria.

## 5. Estresse e saúde

- **Estresse:** sobe com o peso do cargo (vereador +3 … presidente +10 por mês), com a campanha, com crises e com ameaças.
- **O que reduz o estresse:**
  - recuperação natural;
  - acompanhamento psicológico (R$ 1.200/mês, parâmetro);
  - cônjuge de bem com você;
  - licença;
  - folga;
  - tempo com a família.
- **Saúde:** cai com estresse alto por meses seguidos e se recupera com estresse baixo. O jogo **não simula doenças específicas**, só o desgaste.
- **Efeito na agenda pessoal:** estresse ≥80, saúde <45 e saúde <25 tiram compromissos, até 3 por mês.
- **Evento "O corpo cobrou a conta":** reduzir a agenda, licença médica, ou seguir em frente com risco de internação.

## 6. Herdeiro político

**Lançar um parente na política**
- Vale para parente adulto com interesse em política, por **vereador** (anos municipais) ou **deputado estadual** (anos gerais).
- Resultado em outubro: a chance cresce com o seu reconhecimento, a sua base e a sua credibilidade.

**Passar o bastão**
- Sem mandato e sem candidatura, você se aposenta e a partida continua com um filho ou filha adulto com interesse em política.
- O herdeiro fica com:
  - cerca de 35% do seu reconhecimento e 40% da sua base;
  - metade do desvio da sua credibilidade;
  - o mesmo partido;
  - atributos com parte dos seus.
- O personagem antigo vira pai ou mãe e mentor.
- O final registra a geração.

**Deixar a vida pública pela família:** um final próprio, "Pela família".

**Conquistas novas:** "Casa em ordem", "Não me calo" e "Dinastia política".

## 7. Regra real × mecânica de jogo

| Elemento | Classificação |
|---|---|
| Ameaça é crime; a ação depende de representação (Código Penal, art. 147) | REGRA REAL |
| Violência política contra a mulher (Código Eleitoral, art. 326-B; Lei 14.192/2021) | REGRA REAL |
| Difamação (Código Penal, art. 139) | REGRA REAL |
| Nepotismo, inclusive cruzado, vedado (Súmula Vinculante 13); improbidade (Lei 8.429/92, art. 11, XI) | REGRA REAL |
| Inelegibilidade reflexa de cônjuge e parentes até o 2º grau do chefe do Executivo no território dele, salvo reeleição (CF art. 14 §7º); o divórcio no mandato não a afasta (Súmula Vinculante 18) | REGRA REAL |
| Licença de parlamentar por doença ou interesse particular, sem remuneração, até 120 dias por sessão legislativa; suplente convocado (CF art. 56, II e §1º) | REGRA REAL (federal) |
| Mesma regra para vereador e deputado estadual; licença do chefe do Executivo sempre autorizada | SIMPLIFICAÇÃO |
| Segurança institucional de presidente, vice e família (GSI) e do governador de SP (Casa Militar); Polícia Federal na segurança de candidatos a presidente (prática) | Contexto real |
| Exposição, chance de ameaça, estresse, saúde, humor, valores de segurança, terapia, partilha e pensão; chances de eleição do herdeiro | PROPOSTA / PARÂMETRO |
| Familiares, pretendentes, amigos, adversários e autores de ameaças | Ficção (personagens do jogo) |

## 8. Pendências

1. Herdeiro com mandato próprio (vereador eleito) jogável depois de passar o bastão: hoje, só filhos sem mandato podem herdar a partida.
2. Nepotismo também na equipe do gabinete (o painel de equipe ainda não lista parentes).
3. Filhos nascendo durante a partida.
