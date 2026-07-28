# Ambiente Docker

## Subir a aplicacao

Na pasta raiz do projeto:

```bash
docker compose up --build
```

O frontend fica disponivel em <http://localhost:5173>. As pastas `web` e
`engine` sao montadas dentro do container, portanto alteracoes no codigo sao
recarregadas sem reconstruir a imagem.

A API fica em <http://localhost:3000> e expoe:

- `GET /health`
- `POST /matches`
- `GET /matches/:id`
- `POST /matches/:id/pause`
- `POST /matches/:id/resume`
- `POST /matches/:id/speed` com `{ "speed": 1 | 2 | 4 | 8 }`
- `WS /matches/:id/stream`

O servidor sempre usa updates fixos de 0.05s. Velocidades maiores executam
mais updates por janela real de 50ms, mas o WebSocket continua limitado a
aproximadamente 20 snapshots por segundo.

Para parar:

```bash
docker compose down
```

O volume `workspace_node_modules` preserva as dependencias entre reinicios. Se
os manifests mudarem, reconstrua a imagem com `docker compose up --build`.

## Comandos da engine

O servico `engine` pertence ao profile `tools`, por isso nao sobe junto com a
interface. Ele serve para executar comandos isolados no mesmo ambiente Node 22:

```bash
docker compose run --rm engine npm test -- --runInBand
docker compose run --rm engine npm run calibrate -- --matches 20 --tick 0.05
```

Para abrir um shell:

```bash
docker compose run --rm engine /bin/sh
```

## Persistencia

As sessoes da API ainda ficam em memoria. Reiniciar o container encerra as
partidas existentes. PostgreSQL sera adicionado quando os modelos persistentes
de campeonato, equipes e partidas forem definidos.
