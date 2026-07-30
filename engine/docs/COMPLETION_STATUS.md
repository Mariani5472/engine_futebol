# Completion status of the shooting, decision and analytics restructuring

The intermediate implementation labels have been closed at the engine's declared 2D fidelity level.

- Goalkeeper states now change movement, reaction, vertical/horizontal reach, smothering and timed recovery. A deflected shot remains an authoritative threat and can be saved, miss, hit the frame or score.
- Carries have destination, desired speed, close/normal/sprint control, tactical purpose and a causal terminal event.
- Collective combinations include one-two, two-stage third man, overlap, underlap, far-side balance, near/far-post runs and box-edge cover.
- Expected value includes success, goal probability, future possession, defensive exposure, score and match time. Debug snapshots contain selected and rejected candidates with reasons.
- Event analytics cover team/player/period/zone reports and the official calibration consumes event-derived xG, shot distance, attacks and high recoveries.
- Timeline supports every normalized important event. Goal replay records authoritative state, uses its own camera, and provides play/pause/restart/return-live controls at 1x.
- The API exposes the complete deterministic final archive through `GET /matches/:id/report`.

The remaining distinction is a product boundary, not an unfinished implementation: this is a 2D simulation, so goalkeeper bodies use deterministic reach volumes rather than a skeletal 3D collision model.
