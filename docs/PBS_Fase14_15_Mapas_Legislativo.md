# PBS — Fases 14 e 15: salvar sem medo, mapas e mandatos acima da Prefeitura

**Status:** implementado · 192 testes passando · balanceamento OK · build OK · conferido no navegador (desktop e celular)

## 0. Salvar sem medo e correções
- **Voltar no tempo:** a cada mês avançado o jogo guarda uma cópia da partida no IndexedDB do navegador.
  - Mantém os últimos 6 meses e o janeiro de cada ano, até 12 anos por partida e até 5 partidas.
  - As cópias aparecem na tela inicial, em "Voltar no tempo", com o botão "Restaurar".
- **Lembrete de exportar:** com 12 meses de jogo sem exportar, aparece uma bolinha em "Salvar / exportar" e um aviso a cada 6 meses.
- **Correções:**
  - a idade dos filhos agora conta o mês de nascimento (campo `birthMonth`);
  - quem é exonerado e recontratado como assessor mantém 70% da rede de contatos (PROPOSTA);
  - o texto da convenção usa o ano da próxima eleição;
  - no celular as páginas não estouram mais para o lado (colunas do grid com `min-width: 0`).

## 1. Mapas clicáveis (Fase 14)
Ficam em Política e país › Indicadores. A vista inicial segue o cargo:
- presidente, vice e ministro: Brasil;
- governador, secretário estadual, deputados e senador: estado;
- os demais: capital.

| Vista | Áreas | Camadas | Fonte |
|---|---|---|---|
| Capital | 32 subprefeituras (GeoSampa) | mortalidade infantil e homicídios (DADO REAL, CEInfo, atualizados pela simulação), deslocamento (DADO REAL por zona), densidade (Censo 2022 ÷ área GeoSampa), Ideb/esgoto/cultura (PARÂMETRO), seus votos por região | Prefeitura de SP, GeoSampa (WFS `geoportal:subprefeitura`) |
| Estado | 11 Regiões Geográficas Intermediárias (IBGE, 2017) | IDHM e componentes 2010 (DERIVADA: municípios ponderados pela população de 2022), população 2022 (DADO REAL); governador: investimento e aprovação por região | malha municipal do IBGE (via tbrugz/geodata-br), composição regional do IBGE, SIDRA 4714, Atlas Brasil |
| Brasil | 27 UFs | IDHM por UF (DERIVADA), população 2022 (DADO REAL), desocupação e renda por região (PNAD Contínua, atualizadas pela simulação), sua projeção por região | malha do IBGE (via click_that_hood), SIDRA 4714, Atlas Brasil |

- **Ficha da área:** tocar numa área abre os números, cada um com a sua etiqueta (● dado real, ○ parâmetro ou dado do jogo).
- **Processamento das malhas:** simplificadas com mapshaper e projetadas em SVG. O arquivo gerado é `src/engine/data/maps.ts` (86 KB), sem dependência de rede.
- **Conferências:**
  - capital: 11.451.999 habitantes, IDHM 0,805;
  - estado: 44.411.238 habitantes;
  - os números batem com o Censo 2022 e com o Atlas.
- **Limitações:**
  - o IDHM é de 2010, último disponível por município;
  - os indicadores estaduais do jogo (e_*) existem só como média do estado; a ficha da região mostra essa média e avisa.

## 2. Mandatos acima da Prefeitura (Fase 15)
### Deputado(a) estadual, deputado(a) federal e senador(a)
- **Comissão permanente:**
  - o parlamentar pede uma vaga e a bancada indica;
  - a chance depende do tamanho da bancada, da confiança da direção e da articulação;
  - CCJ e Finanças/Economia são mais disputadas;
  - nomes reais, numa seleção das listas oficiais:
    - Alesp: 12 de 21 comissões (dados abertos da Alesp);
    - Câmara: 11 de 30 comissões;
    - Senado: 10 de 16 comissões.
- **Presidência da comissão:**
  - uma tentativa por ano, decidida por acordo de líderes (PROPOSTA de chance);
  - mandato de 1 ano na Câmara e de 2 anos no Senado e na Alesp (REGRA REAL, segundo fontes oficiais de 2023 a 2025);
  - dá mais relatorias e força aos projetos do tema (+18 pontos de chance; +8 só por ser titular).
- **Relatoria:**
  - de fevereiro a dezembro chegam matérias do tema da comissão;
  - o relator tem 2 meses para apresentar o parecer, senão a relatoria é redistribuída e a confiança da direção cai;
  - os três pareceres e seus efeitos:

| Parecer | O que acontece |
|---|---|
| Favorável | a matéria vai ao plenário; agrada ao governo se é dele |
| Substitutivo negociado | custa 1 compromisso; desloca cerca de 5% da casa para o Sim (mais com negociação alta); dá credibilidade e reconhecimento |
| Contrário | a comissão vota o parecer: aprovado, a matéria é arquivada; derrubado, segue ao plenário |

  - depois da votação em plenário, o relator ganha reconhecimento se o resultado acompanhou o parecer.
- **Liderança da bancada:**
  - uma tentativa por ano, mais fácil em bancada pequena;
  - o líder define a orientação da própria bancada no plenário, então não há infidelidade, e ganha reconhecimento todo mês.
- **CPI:**
  - assinaturas de 1/3 da casa (REGRA REAL, CF art. 58 §3º): 171 na Câmara, 27 no Senado e 32 na Alesp (por simetria; conferir);
  - na oposição as assinaturas vêm mais rápido;
  - instalada, dura 4 meses (PROPOSTA), com exposição para o parlamentar e desgaste do governo;
  - se o jogador é o relator, escolhe o relatório final: **duro** (pede indiciamentos ao Ministério Público) ou **brando** (acordo com o governo).

### Governador(a)
- **Investimento regional:** a ação "Investir numa região do estado" (PARÂMETRO de R$ 500 mi):
  - foca no componente mais fraco do IDHM da região e dá impulso no indicador estadual correspondente;
  - aumenta a aprovação na região, mais onde a população é menor, com retorno decrescente onde já se investiu.
- **Aprovação:** a aprovação estadual puxa para a média das regiões, ponderada pela população.
- **Onde ver:** o painel "Regiões do estado" fica em Meu cargo; o mapa do estado ganha as camadas de investimento e de aprovação.

### Presidente
Já tinha a parte mais completa (ministérios, medidas, MPs, sanção e veto, economia). Agora ganha o mapa do Brasil com projeção, desocupação e renda por região.

## Arquivos
- `src/ui/snapshots.ts`: cópias automáticas e lembrete de exportar.
- `src/engine/data/maps.ts`: malhas e dados gerados.
- `src/ui/mapas.tsx`: os três mapas.
- `src/engine/game/legislativo.ts`: comissões, relatoria, liderança, CPI e regiões do governador.
- `src/ui/legislativo.tsx`: painéis da página do mandato.
- Ganchos em:
  - `pauta.ts`: reforço do substitutivo, orientação do líder e crédito ao relator;
  - `upper.ts`: bônus de tema da comissão;
  - `actions.ts`: 4 ações;
  - `turn.ts`: passos mensais.
- **Testes:** `legislativo.test.ts`.

## Próximos passos possíveis
- Comissões e liderança para vereador na Câmara Municipal (já existe uma estrutura parecida da Fase 2).
- Orçamento estadual jogável (LOA do estado), como o da Prefeitura.
- Indicadores estaduais com dado real por região (DataSUS e SSP-SP por município).
