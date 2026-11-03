# PBS — Fase 1 (Profundidade política): relatório de entrega

Data: 02/11/2026 · Versão: **v0.5-fase1** · Formato de save: v4 (saves v1–v3 são migrados automaticamente)

## Entregue
| Item | O que o jogador vê | Onde no código |
|---|---|---|
| Registro de atores | 55 vereadores reais e ~120 dirigentes fictícios com traços (simulados), influência e objetivos | `game/actors.ts` |
| Relações e memória | Facções e dirigentes lembram de apoio, acordo, ataque, traição e promessa quebrada; os sentimentos decaem com o tempo e as traições demoram mais | `game/relations.ts` |
| Diretório municipal | Página **Meu partido**: executiva, delegados, filiados (simulados) e histórico | `game/partyorg.ts`, `ui/party.tsx` |
| Facções | 1 a 4 grupos por partido (direção, governista ou oposição, programática, pragmática, regional), com participação nos delegados, influência e mobilização que mudam todo mês | `game/partyorg.ts` |
| 5 indicadores no partido | Confiança da direção, popularidade interna, influência, fidelidade percebida e mobilização, independentes entre si | `types.ts`, `ui/party.tsx` |
| Disputas internas | Presidência do diretório disputada por delegados; candidatura, acordo com facção (promessa de vaga), declaração de apoio, crítica à direção; disputas acontecem em todos os partidos | `partyorg.ts`, `actions.ts` |
| Disciplina | Processo no conselho de ética: defesa, retratação ou enfrentamento, com advertência, suspensão ou expulsão | `events.ts` |
| Convenção por delegados | Vereador: lista montada pela direção, com apoio de facção. Prefeito: votação de delegados, com peso das pesquisas | `partyorg.ts` |
| Desgaste por repetição | Aviso de rendimento no cartão da ação; ganhos reduzidos, custos inteiros | `game/fatigue.ts` |
| "Por que mudou?" | Clique em qualquer indicador do Gabinete para ver as causas dos últimos 3 meses | `game/ledger.ts`, `ui/causes.tsx` |
| Idades dos vereadores | 1 data exata (Pavanato), 1 só com ano (Zoe Martinez), 53 estimadas e marcadas, reproduzindo as faixas etárias oficiais da Câmara; o desempate por idade informa quando usou estimativa | `data/world.ts` |
| Instalador Windows | Workflow do GitHub Actions que gera `.exe` e `.msi` num computador Windows | `.github/workflows/desktop-windows.yml` |

## Testes (55 no total, todos passando)
- **14 novos de aceitação da Fase 1:** estrutura dos 30 diretórios; os 9 critérios da seção 4.6 do plano; traição lembrada; disputas em vários partidos sem o jogador; desgaste e recuperação; custo inteiro; causas registradas; migração de save v3 → v4; reprodutibilidade.
- **Os 41 anteriores** continuam passando.
- **Outras verificações:** checagem de tipos sem erros, build web e uma partida pela interface de 14 meses com disputa interna, desgaste e "por que mudou?" sem erros.

## Simplificações documentadas
- Mandato do diretório de 2 anos e exigência de 6 meses de filiação para disputar: o real varia por estatuto.
- Diretórios estadual e nacional ainda não existem como camada própria.
- Expulsão mantém o mandato proporcional (a confirmar na jurisprudência).
- Alinhamento interno de vereadores reais com facções é simulado e aparece marcado assim.

## Riscos de regressão
- **Balanceamento:** convenções ficaram mais exigentes; quem não trabalha o partido pode ser preterido.
- **Desempenho:** uma partida inteira roda em ~1 s no motor; o save cresce até ~440 KB.
