# Scraper ESPN — Brasileirão Série A 2026

Pacote TypeScript independente que obtém os elencos dos 20 clubes da Série A de 2026. Ele não importa nem altera a engine de simulação.

## Uso

Na raiz do monorepo:

```bash
pnpm scrape
```

O comando consulta os clubes sequencialmente, com intervalo entre requisições, timeout e uma repetição em caso de falha transitória. O resultado é salvo em `scraper/data/brasileirao-2026.json`. Falhas de um clube são registradas no campo `failures` sem interromper os demais.

## Fonte e escopo

Fonte: endpoint público de elenco da ESPN para a liga `BRA.1`, temporada `2026`, em português do Brasil. Os IDs dos clubes foram confirmados na tabela 2026 da própria ESPN. O arquivo normaliza identidade do clube, atletas, camisa, posição, nacionalidade, idade, data de nascimento, altura, peso e foto quando disponíveis.

Os dados são um retrato no momento da execução. A ESPN pode corrigir ou atualizar elencos sem aviso; rode novamente para atualizar o arquivo.
