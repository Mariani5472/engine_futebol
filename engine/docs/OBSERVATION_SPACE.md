# Observation spaces

As observações são três contratos independentes. A separação é estrutural: `PlayerPolicyInput` contém somente `ActorObservation`. Crítico privilegiado e debug não são campos opcionais do mesmo objeto e não aparecem no snapshot normal.

## Ator — versão 1

O ator recebe:

- estado próprio exato;
- placar, direção de ataque e tempo atual;
- bola conforme `BallMemory`;
- companheiros e adversários conforme `PlayerAwareness`;
- certeza e idade da memória;
- action mask atual.

Ele não recebe estado físico exato de jogadores não percebidos, proprietário físico da bola, alvos internos, cooldowns, atributos ocultos ou previsões futuras autoritativas.

`vector` tem 189 valores em ordem fixa. Posições são divididas pelas dimensões do campo, velocidades por limites declarados, tempo por 5.400 segundos e escalares são limitados a `[0,1]` ou `[-1,1]`. Slots ausentes são preenchidos com zeros. A normalização não usa média, desvio ou qualquer estatística calculada com partidas futuras.

## Crítico privilegiado — versão 1

`MatchSession.privilegedCriticObservation(playerId)` expõe o estado completo e normalizado dos 22 jogadores e da bola para treinamento centralizado. Seu vetor atual possui 184 valores. Essa chamada não é utilizada pelo `PlayerPolicyController`, não integra `PlayerPolicyInput` e não é publicada pela API de jogo.

## Debug — versão 1

`MatchSession.debugObservation(playerId)` expõe posições brutas, alvos táticos, locks, recuperação e responsabilidades. É destinado apenas a diagnóstico humano. Não é normalizado e não entra no caminho de decisão.

## Versionamento

- `ACTOR_OBSERVATION_VERSION = 1`
- `PRIVILEGED_CRITIC_OBSERVATION_VERSION = 1`
- `DEBUG_OBSERVATION_VERSION = 1`
- `manifest.versions.observation = 2`, registrando a migração do contrato anterior implícito para os três schemas formais.

Alterar ordem, tamanho, significado, normalização ou visibilidade de um campo exige incrementar a versão correspondente e a versão de observação do manifesto.

## Invariantes contra vazamento

Os testes garantem que:

- mover um adversário não observado não altera a observação do ator;
- alterar posição, velocidade ou altura física da bola não altera o ator enquanto `BallMemory` permanece igual;
- a mesma alteração aparece no crítico e no debug;
- `PlayerPolicy` recebe somente o schema `ACTOR`;
- snapshots normais não contêm crítico ou debug;
- todos os valores model-ready são finitos e permanecem em `[-1,1]`.
