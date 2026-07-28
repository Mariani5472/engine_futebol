# Ambiente Docker

## Subir a aplicacao

Na pasta raiz do projeto:

```bash
docker compose up --build
```

O frontend fica disponivel em <http://localhost:5173>. As pastas `web` e
`engine` sao montadas dentro do container, portanto alteracoes no codigo sao
recarregadas sem reconstruir a imagem.

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

## API e banco

Ainda nao existem servicos `api` ou `postgres`. A primeira versao executa a
engine diretamente no browser. Esses servicos podem ser adicionados sem mudar
os containers atuais quando houver persistencia, autenticacao ou simulacao no
servidor.
