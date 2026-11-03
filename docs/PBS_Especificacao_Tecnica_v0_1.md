# PBS — Especificação técnica e roadmap (v0.3)

Data: 30/10/2026 · Complementa o *Documento Mestre v0.1* · Status: protótipo v0.3 (São Paulo 2027–2032, vereadores reais, pesquisas, ideologia, redes sociais, imprensa)

## 1. Decisões tomadas nesta sessão

| Tema (seção 13 do doc mestre) | Decisão | Origem |
|---|---|---|
| Plataforma | Jogo de PC. Interface em TypeScript + React, empacotada como app desktop (Tauri) para Windows/Steam. Durante o desenvolvimento roda no navegador. | DECIDIDO pelo criador ("primeiro caminho") |
| Tempo | Turnos mensais. 5 compromissos de agenda por mês (parâmetro de gameplay; eram 3 até a v0.5, ampliado com a chegada das atividades partidárias). | DECIDIDO |
| Partidos reais | Desde o protótipo: 30 partidos e 5 federações do TSE (retrato de 30/10/2026). | DECIDIDO |
| Personagens reais | Sim, vários. Política: só dados de registro público; nada de escândalos, crimes ou falas inventadas sobre pessoas reais; atributos de jogo por metodologia única para todos; sem fotos reais. | DECIDIDO (criador) + PROPOSTA (salvaguardas) |
| Primeira cidade | São Paulo. Depois: cidades grandes, médias, pequenas e do interior. | DECIDIDO |
| Cargos jogáveis | Todos, inclusive não eletivos (assessor, secretário etc.), com profundidades diferentes. | DECIDIDO |
| Imprensa | Veículos FICTÍCIOS com perfis (TV aberta, canal 24h, rádio all news, jornal local, revista progressista, site conservador, videocast). Motivo: evitar manchetes inventadas sob marcas reais e risco de marca registrada. | DECIDIDO pelo criador |
| Redes sociais | Instagram, X, YouTube e TikTok com seguidores, níveis e foco mensal; influenciador começa com milhões. Plataformas reais, números simulados; figuras reais sem contagem de seguidores. | DECIDIDO (criador) + valores PROPOSTA |
| Ideologia dos partidos reais | Escala esquerda–direita 0–10 de pesquisa com especialistas (Bolognesi, Ribeiro, Codato e Silva, Opinião Pública 2025, dados de 2022). Renomeados herdam a sigla anterior; fusão = média; Missão não classificado. 7 das 10 dimensões derivadas da escala geral (provisório); 3 sem valor até calibração por votações nominais. | Metodologia PROPOSTA, dados de fonte acadêmica |
| Origens profissionais | Cada origem tem bônus **e** penalidades. Ex.: influenciador/YouTuber: Comunicação +20, Carisma +14, Conhecimento político −22, Articulação −14, Gestão −12, Negociação −8, Liderança −4; reconhecimento inicial alto e bônus em conteúdo nas redes. | DECIDIDO (criador) + valores PROPOSTA |

## 2. Correções e lacunas encontradas no documento mestre

Regras reais que faltavam ou estavam imprecisas:
1. **Senado**: renovação alternada de 1/3 e 2/3. Nos anos de 2/3, o eleitor vota em dois candidatos. Cada senador tem 2 suplentes (CF art. 46).
2. **Reeleição**: o limite de uma reeleição consecutiva vale para prefeito, governador e presidente (CF art. 14 §5º), não só para presidente. O vice que sucede o titular e depois se elege já usou a reeleição. Exemplo real usado no jogo: Ricardo Nunes não pode concorrer em 2028.
3. **Idade mínima**: é aferida na posse, exceto os 18 anos de vereador, aferidos na data-limite do registro (Lei 9.504/97 art. 11 §2º). Isso substitui "data juridicamente relevante".
4. **Sobras eleitorais**: o STF (28/02/2024) abriu a última fase de distribuição a todos os partidos, sem a regra 80/20. O doc mestre não trata as 3 fases.
5. **Cláusula de desempenho** (EC 97/2017): está só no glossário, mas condiciona Fundo Partidário e propaganda gratuita. Precisa entrar no Módulo 02.
6. **Limite de candidatos**: 100% das vagas + 1 por partido/federação (Lei 9.504/97 art. 10).
7. **Fidelidade partidária**: vale só para mandatos proporcionais (janela partidária, Lei 9.096/95 art. 22-A). Mandatos majoritários não perdem o cargo por troca de partido.
8. **Mesa da Câmara de SP**: o mandato é anual (eleições em 01/01/2025 e 15/12/2025; Ricardo Teixeira presidiu em 2025 e 2026). O v0.1 usava biênio por engano. Corrigido; falta confirmar no Regimento Interno.
9. **Doações**: só de pessoas físicas, até 10% da renda do doador. Autofinanciamento limitado a 10% do limite de gastos do cargo.

Lacunas de design (pendentes):
- Modelo de eleitor: segmentos agregados por zona/município ainda não definidos (o protótipo usa força partidária + desempenho do candidato).
- Calibração das 10 dimensões ideológicas por votações nominais (a escala geral já tem fonte acadêmica).
- Política de atualização de dados reais entre versões (o save já registra o pacote de regras).
- Escala municipal: 5.570 municípios exigem camadas de abstração (ver §4).

## 3. Arquitetura

```
src/engine/            ← motor puro, sem interface (testável, determinístico)
  calendar.ts          datas, turnos mensais, prazos
  rng.ts               aleatoriedade com seed (registrada no save)
  data/                dados reais versionados
    rulepack.ts        pacote de regras por ciclo; cada parâmetro marcado REGRA_REAL / DERIVADA / PROPOSTA com fonte
    parties.ts         partidos e federações (TSE)
    world.ts           municípios, figuras reais (registro público)
  rules/               regras institucionais reais (funções puras + testes)
    proportional.ts    QE, QP, 10%, sobras 80/20, última fase, art. 111, desempates, trilha de auditoria
    majoritarian.ts    maioria absoluta, 2º turno (> 200 mil eleitores), maioria simples
    eligibility.ts     condições de elegibilidade com fonte por item
  game/                mecânicas de gameplay (fictícias, balanceáveis)
    types.ts, create.ts, actions.ts, events.ts, elections.ts, party.ts, turn.ts, save.ts,
    council.ts (Câmara/Mesa), polls.ts (pesquisas), social.ts (redes), news.ts (imprensa fictícia)
  data/ideology.ts     escala de especialistas + dimensões
src/ui/                interface React (consome só o motor)
```

Princípios aplicados: separação regra real × mecânica de jogo; números legais em tabela de parâmetros (nada hardcoded na lógica); IDs estáveis; save com versão, pacote de regras e estado do RNG; mesma seed + mesmas escolhas = mesmo resultado.

## 4. Escala territorial (proposta)

| Camada | Exemplos | Simulação |
|---|---|---|
| Metrópole | São Paulo, Rio | Detalhada: zonas/bairros, mídia própria, 2º turno |
| Cidade grande | > 200 mil eleitores | Detalhada por zonas; 2º turno |
| Cidade média | 50–200 mil | Agregada; turno único |
| Cidade pequena | < 50 mil | Agregada; peso maior de relações pessoais |

Municípios fora do foco do jogador rodam em modo "fundo" (resultado agregado anual), para caber em desempenho.

## 5. Módulos e dependências

| Módulo | Depende de | Situação |
|---|---|---|
| 15 Salvamento | — | Protótipo (localStorage + exportar/importar) |
| 01 Personagem | 15 | Protótipo |
| 02 Partidos | 01, 15 | Parcial: filiação, troca, fidelidade, federações; faltam diretórios, finanças, facções, fundação |
| 03 Eleitoral | 01, 02 | Municipal completo nas regras; campanha simplificada |
| 04 Mandatos | 03 | Vereador, prefeito, secretário, assessor (simples) |
| 05 Legislativo | 04, 02 | Parcial: projetos, Mesa, CPI (evento) |
| 06 Executivo | 04, 08 | Parcial: prioridade, secretariado, projetos |
| 07 Governabilidade | 05, 06, 02 | Parcial: base na Câmara |
| 08 Economia/orçamento | 06 | Não iniciado |
| 09 Opinião pública e mídia | 01, 03 | Parcial: reconhecimento, base, aprovação, pesquisas, redes sociais, imprensa fictícia |
| 10 Eventos | todos | 9 eventos com condições |
| 11 Justiça | 03, 10 | Não iniciado (irregularidade só registrada) |
| 12 Federativo | 06, 08 | Não iniciado |
| 13 IA de mundo | 02, 03 | Básica: momento partidário, candidatos adversários |
| 14 UX | todos | Protótipo |

Ordem crítica: Personagem → Partidos → Eleitoral → Mandatos → (Legislativo, Executivo) → Governabilidade → Orçamento.

## 6. Roadmap

1. **v0.1 (feito)**: fatia vertical São Paulo 2027–2032, regras municipais reais, cálculo proporcional auditável.
2. **v0.2 (feito)**: os 55 vereadores eleitos em 2024 pelo nome (partido e votos de registro público), concorrendo à reeleição na simulação com peso pela votação anterior; Mesa anual; disputa de prefeito persistente com pré-candidatos; pesquisas mensais (institutos fictícios, amostra, margem de erro de 95%, registro); estimativa interna de votos para vereador; profissões com trade-offs. 24 testes.
3. **v0.3 (feito)**: ideologia dos partidos reais com fonte acadêmica (afeta relação inicial com o partido e coligações); posições do personagem em 4 eixos; redes sociais com foco mensal e força digital na eleição; central de notícias com 7 veículos fictícios, linha editorial e efeito no reconhecimento/popularidade; evento de videocast; reportagem de caixa dois. 27 testes.
4. **v0.3.1**: calibração das dimensões por votações nominais (dados abertos da Câmara); empacotamento Tauri (.exe); mais eventos.
5. **v0.4**: 2ª cidade de cada camada (grande, média, pequena); modelo de eleitor por zona; diretórios municipais.
6. **v0.5**: eleições gerais 2030 (deputado estadual/federal, governador, senado com 1/3–2/3, presidente); Assembleia e Câmara dos Deputados.
7. **v0.6**: orçamento público e indicadores; governabilidade completa; fundação de partido com apoiamento real.
8. **v0.7+**: facções, finanças partidárias, fusões; Justiça Eleitoral e órgãos de controle; relações federativas; mundo vivo.

## 7. O que o protótipo NÃO faz ainda

- Valores provisórios: limites de gastos de campanha em SP (aguardam o TSE 2028), salários de prefeito, secretário e assessor, FEFC por candidato.
- Dimensões ideológicas detalhadas com fonte própria (hoje derivadas da escala geral).
- Eleitorado por segmento ideológico (a ideologia ainda não mexe direto no voto).
- Trocas de partido, licenças e suplências de vereadores após 2024; resultado das eleições de 2026 (vereadores eleitos deputados).
- Premissa da simulação: todos os vereadores atuais tentam a reeleição em 2028.
- Eleições de 2030 em diante, outras cidades, orçamento.

## 8. Fontes

TSE: partidos registrados; federações registradas (Fe Brasil, PSDB Cidadania, PSOL REDE, Renovação Solidária, União Progressista). Código Eleitoral arts. 106–111 (Lei 14.211/2021). Res. TSE 23.677/2021. STF, sobras eleitorais (28/02/2024). Lei 9.504/97 arts. 1º, 3º, 8º, 9º, 10, 11, 23, 36, 36-A. Lei 9.096/95 art. 22-A. CF arts. 14, 17, 29, 30, 46. Câmara Municipal de SP: bancadas eleitas em 2024. Eleitorado de SP em 2024: 9.322.444. Vereadores eleitos em 2024 (resultado TSE, via CartaCapital e Brasil de Fato). Mesa da CMSP 2025–2026 (portal da Câmara Municipal de SP). Lei 9.504/97 art. 33 (pesquisas). Bolognesi, Ribeiro, Codato e Silva, "O desaparecimento do centro ideológico no sistema partidário brasileiro", Opinião Pública (2025); Bolognesi, Ribeiro e Codato, Dados (2023).
