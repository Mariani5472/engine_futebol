# Match event ontology

The authoritative event stream separates actions, contests, ball outcomes and
possession consequences. Analytics must count the semantic event itself and
must not infer it from `POSSESSION_CHANGED`.

## Defensive event definitions

### `TACKLE`

A player physically attempts to dispossess an opponent. It records the
initiator, opponent and whether the tackle succeeded. A physical tackle also
produces one `DUEL` with `duelKind: "GROUND_TACKLE"`.

### `INTERCEPTION`

An opponent controls a ball while it is travelling from a passer. It is not a
tackle, loose-ball recovery or duel. `passerId` preserves the causal source.

### `BALL_RECOVERY`

A player establishes uncontested control of an ownerless ball whose previous
touch belonged to the opponent. Retrieving a teammate's loose pass is not a
recovery. A contested loose ball is a `DUEL`, not also a recovery.

### `DUEL`

One physical contest between two opponents. The event is stored once with
`playerId`, `opponentId`, `winnerId`, `loserId` and `duelKind`. Team and player
reports attribute one participation to each player and one win to the winner.

Supported kinds currently are:

- `GROUND_TACKLE`
- `LOOSE_BALL`
- `AERIAL` (contract reserved; physical resolver pending)
- `SHOULDER` (contract reserved; physical resolver pending)

### `POSSESSION_CHANGED`

The consequence that authoritative ball ownership changed. It remains useful
for replay, transition diagnostics and possession intervals, but is never the
source for tackle, interception, recovery or duel totals.

## Counting invariants

- One causal contest produces at most one `DUEL`.
- Every `DUEL` contributes two participations and exactly one win.
- An `INTERCEPTION` never increments recoveries.
- A successful `TACKLE` never increments recoveries automatically.
- A contested loose-ball claim never increments recoveries.
- Analytics totals are reconstructible solely from the normalized event stream.

