# Political Brazilian Simulator (PBS)

Simulador de carreira política brasileira. Comece como cidadão em São Paulo, filie-se a um partido real, dispute espaço interno, eleições e mandatos — com as regras eleitorais de verdade (quociente eleitoral, sobras, elegibilidade, federações) separadas das mecânicas de jogo.

## Rodar no navegador

```bash
npm install
npm run dev        # abre em http://localhost:5173
npx vitest run     # testes do motor
npm run build      # gera dist/index.html (arquivo único)
```

## Estrutura

- `src/engine/` — motor da simulação (sem interface, determinístico por seed)
  - `rules/` regras reais (proporcional, majoritário, elegibilidade) com testes
  - `data/` dados reais com fonte (partidos, federações, vereadores, ideologia)
  - `game/` mecânicas de jogo (turnos, ações, partidos, relações, eleições, imprensa, saves)
- `src/ui/` — interface React
- `src-tauri/` — empacotamento desktop (Tauri 2)
- `docs/` — especificação, plano técnico e relatórios de fase

## Versão desktop (Windows) — Tauri 2

O jogo roda no navegador (`npm run dev`) e também pode ser empacotado como aplicativo de Windows.
A configuração está em `src-tauri/`. A geração do instalador precisa ser feita numa máquina Windows:

1. Instale o Rust (https://rustup.rs) e o "Desktop development with C++" do Visual Studio Build Tools.
2. O WebView2 já vem no Windows 10/11.
3. Na pasta do projeto: `npm install` e depois `npm run desktop:build`.
4. O instalador sai em `src-tauri/target/release/bundle/nsis/` (.exe) e `.../msi/`.

Para testar sem gerar instalador: `npm run desktop:dev`.
Observação: as fontes vêm do Google Fonts; sem internet o jogo usa fontes do sistema (empacotar as fontes fica para a Fase 6).

### Gerar o instalador sem ter Windows (GitHub Actions)
1. Crie um repositório no GitHub e envie este código.
2. Em **Actions → Instalador Windows → Run workflow**.
3. Ao terminar (~10 min na primeira vez), baixe `PBS-instalador-windows` em *Artifacts*: dentro estão o `.exe` e o `.msi`.
O instalador não é assinado digitalmente; o Windows pode mostrar o aviso "SmartScreen" (clique em "Mais informações → Executar assim mesmo").
