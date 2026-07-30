# Protocolo TypeScript–Python v1

O processo TypeScript é persistente e usa JSON Lines: uma mensagem JSON por linha em `stdin`, uma resposta por linha em `stdout`. Logs e falhas fatais usam exclusivamente `stderr` para não corromper o protocolo.

## Iniciar

```bash
cd engine
npm run --silent protocol:stdio
```

Mensagens possuem envelope obrigatório:

```json
{"protocolVersion":1,"requestId":"python-1","type":"HELLO","payload":{}}
```

Toda resposta repete `protocolVersion` e `requestId`. Sucesso contém `ok: true` e `payload`. Falha contém:

```json
{
  "protocolVersion": 1,
  "requestId": "python-1",
  "ok": false,
  "type": "ERROR",
  "error": {
    "code": "ENVIRONMENT_ERROR",
    "message": "...",
    "recoverable": true
  }
}
```

## Mensagens v1

- `HELLO`: negocia versões e capacidades.
- `CREATE`: cria e mantém um cenário por `environmentId`.
- `RESET`: reinicia esse ambiente com uma seed inteira.
- `STEP`: executa um `PlayerActionCommand` válido.
- `CLOSE_ENV`: remove somente um ambiente.
- `SHUTDOWN`: fecha todos e encerra o processo.

Um processo pode hospedar vários ambientes. Requisições v1 são síncronas e respondidas na ordem de entrada. A identidade ainda é mantida por `requestId`, portanto uma versão futura poderá multiplexar com segurança.

`CREATE` também aceita `wireFormat: "FULL" | "COMPACT"`. O formato compacto mantém vetor, máscara, reward e término, omitindo entidades estruturadas e histórico de eventos que o PPO não consome.

## Gymnasium

O pacote está em `engine/python`:

```bash
python -m pip install -e engine/python
```

```python
from football_env import AttackerVsGoalkeeperEnv

with AttackerVsGoalkeeperEnv(seed=41) as env:
    observation, info = env.reset(seed=41)
    while True:
        valid = info["action_mask"].nonzero()[0]
        observation, reward, terminated, truncated, info = env.step(int(valid[0]))
        if terminated or truncated:
            break
```

O espaço de observação é `Box(-1, 1, (189,), float32)`. O action space é `Discrete(24)` e `info["action_mask"]` contém a máscara para o boundary atual. A ação discreta é convertida pelo wrapper ao ID estável correspondente; alvos válidos usam escolha determinística quando há mais de um.

## Falhas

- Versões são negociadas antes da criação do ambiente.
- Erros de máscara, ambiente finalizado ou ID desconhecido retornam erros estruturados e recuperáveis.
- Timeout encerra o subprocesso para impedir respostas atrasadas de contaminarem a próxima requisição.
- Morte do processo inclui as últimas linhas de `stderr` na exceção Python.
- `step()` não recria estado perdido silenciosamente. O chamador deve executar `reset()`, que inicia outro processo e recria o cenário.
- `close()` é idempotente e tenta `CLOSE_ENV` e `SHUTDOWN` antes de terminar o processo.

O protocolo não transporta objetos JavaScript, `NaN` ou referências internas. Observação, máscara, eventos, resultado e `rewardBreakdown` são dados JSON versionados.
