import { RoleBehaviourRegistry } from "../tactical/roles/RoleBehaviourRegistry";
import { Decision } from "./Decision";
import type { DecisionContext } from "./DecisionContext";

const behaviours = new RoleBehaviourRegistry();

export function applyRoleDecisionModifier(decision: Decision, context: DecisionContext): Decision {
  const modifier = behaviours.forRole(context.player.currentRole).modifyDecisionUtility(decision.type, context);
  if (modifier === 0) return decision;
  return new Decision(
    decision.type,
    decision.utility + modifier,
    decision.targetId,
    [...(decision.reasons ?? []), { code: "ROLE_BEHAVIOUR", value: modifier }],
    { ...(decision.components ?? {}), ROLE_BEHAVIOUR: modifier },
  );
}
