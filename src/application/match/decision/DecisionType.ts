export enum DecisionType {
  // --- Neutro / Nenhum ---
  NONE,

  // --- Com a bola ---
  PASS,
  CROSS,
  SHOT,
  DRIBBLE,
  HOLD_BALL,
  CLEAR,
  RECEIVE,
  HEADER,
  CONTROL, // first touch / trap
  SKILL_MOVE, // feint, step-over, etc.

  // --- Sem a bola ---
  MOVE,
  MARK,
  COVER,
  PRESS,
  INTERCEPT,
  TACKLE,
  BLOCK,
  POSITION,

  // --- Especiais ---
  SET_PIECE,
  GK_CLAIM,
  GK_DISTRIBUTE,
  FAKE,
  TACTICAL_FOUL
}
