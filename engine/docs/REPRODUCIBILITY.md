# Manifesto de execução e instrumentação

Toda execução publica um `ExecutionManifest` no resultado, nos snapshots e no
arquivo final. O manifesto não contém horário de parede, UUID gerado durante a
execução ou qualquer outro valor não determinístico.

## Versões registradas

- engine;
- física;
- observação;
- espaço de ações;
- reward;
- regras;
- cenário;
- estatísticas;
- RNG;
- protocolo.

O manifesto registra também seed, timestep fixo, duração, equipes, perfil de
instrumentação, `configurationHash`, `instrumentationHash`, `manifestHash` e
`reproductionKey`.

Os hashes são SHA-256 de JSON canônico, com chaves ordenadas. O hash da
configuração esportiva exclui instrumentação e o antigo sinalizador de debug.
Portanto, mudar logs ou replay não cria falsamente uma física diferente. O hash
do manifesto inclui a instrumentação para reproduzir também o artefato entregue.

`MatchEngine.reproduce(config, manifest)` recusa a execução quando configuração,
versões ou instrumentação não correspondem ao manifesto gravado.

Ao concluir, a engine também publica `resultHash`, calculado sobre placar,
duração, journal autoritativo completo e analytics por equipe antes de qualquer
redução do perfil. Assim, EVALUATION e BENCHMARK produzem o mesmo `resultHash`.
`MatchEngine.reproduce(config, manifest, expectedResultHash)` também valida esse
resultado e falha se a nova execução divergir.

## Perfis

| Perfil | Uso | Artefatos |
|---|---|---|
| `DEBUG` | investigação local | replay, timeline, traces, diagnósticos, eventos e analytics detalhados |
| `EVALUATION` | avaliação oficial, padrão | replay, timeline, diagnósticos, eventos e analytics; sem trace extenso |
| `TRAINING` | coleta de experiência | mantém somente dados essenciais e sinaliza gravação de experiência |
| `BENCHMARK` | medição de throughput | mínimo observacional |

Overrides explícitos são permitidos. Física, regras, RNG, eventos necessários
ao reward, estado terminal e invariantes críticos nunca são desligados. Quando
diagnósticos comuns são desativados, violações de teleporte continuam publicadas.

Os perfis podem reduzir o resultado arquivado:

- `eventHistory=false`: não publica o histórico final, embora o journal interno
  continue existindo para produzir estatísticas autoritativas;
- `detailedAnalytics=false`: mantém relatório por equipe e remove jogadores e
  intervalos detalhados;
- `replay=false` e `timeline=false`: não gravam/publicam esses artefatos;
- `debugSnapshots=false`: não retém traces completos de decisão.

## Procedimento de reprodução

1. Persistir configuração de entrada e `ExecutionManifest`.
2. Verificar que a versão de código corresponde ao manifesto.
3. Chamar `MatchEngine.reproduce(config, manifest, resultHash)`.
4. Comparar placar, métricas, IDs causais e hashes do novo resultado.

Mesmo seed e configuração com outro perfil devem produzir o mesmo resultado
esportivo, mas terão `instrumentationHash` e `manifestHash` diferentes.
