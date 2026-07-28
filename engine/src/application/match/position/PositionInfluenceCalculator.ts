import { PlayerRole } from "../../../domain";

/**
 * Calculates how well a player's current role suits a specific action.
 *
 * Derived from the FM26 position-influence guide (posicao-influencia.txt):
 * — ST has Finishing, Composure, Off-the-Ball as KEY → maximum shooting quality
 * — DC has Marking/Tackling/Strength as KEY; Finishing not mentioned → heavy penalty
 * — GK in outfield actions → near-zero quality
 *
 * Returns a multiplier in [0, 1]. 1.0 = perfectly suited, 0.0 = completely unsuited.
 */
export class PositionInfluenceCalculator {

  /**
   * Quality multiplier for SHOOTING from a given role.
   * High for attackers; severely penalised for defenders and GKs.
   */
  public static shootingQuality(role: PlayerRole): number {
    switch (role) {
      // Finishing is KEY (FM26 ST guide)
      case "STRIKER":
        return 1.0;

      // Wide attacking roles — Finishing in PREFERRED list (FM26 AML/AMR guide)
      case "WIDE_MIDFIELDER":
      case "ATTACKING_MIDFIELDER":
      case "WINGER":
        return 0.82;

      // Central midfielders — Finishing not listed in MC guide
      case "CENTRAL_MIDFIELDER":
      case "DEFENSIVE_MIDFIELDER":
        return 0.52;

      // Fullbacks & wing-backs — no shooting attribute mentioned
      case "FULL_BACK":
      case "WING_BACK":
        return 0.38;

      // Centre-backs — Finishing marked UNNECESSARY in DC defensive role
      case "CENTRE_BACK":
        return 0.28;

      // GK — completely unsuited for outfield shooting
      case "GOALKEEPER":
        return 0.08;
    }
  }

  /**
   * Quality multiplier for PASSING from a given role.
   */
  public static passingQuality(role: PlayerRole): number {
    switch (role) {
      case "CENTRAL_MIDFIELDER":
      case "ATTACKING_MIDFIELDER":
        return 1.0;

      case "DEFENSIVE_MIDFIELDER":
        return 0.90;

      case "STRIKER":
        return 0.75;

      case "WIDE_MIDFIELDER":
      case "WINGER":
      case "WING_BACK":
        return 0.80;

      case "FULL_BACK":
      case "CENTRE_BACK":
        return 0.75;

      case "GOALKEEPER":
        return 0.60;
    }
  }

  /**
   * Quality multiplier for DEFENDING (tackling/pressing) from a given role.
   */
  public static defendingQuality(role: PlayerRole): number {
    switch (role) {
      case "CENTRE_BACK":
      case "FULL_BACK":
        return 1.0;

      case "WING_BACK":
      case "DEFENSIVE_MIDFIELDER":
        return 0.88;

      case "CENTRAL_MIDFIELDER":
        return 0.70;

      case "WIDE_MIDFIELDER":
      case "WINGER":
        return 0.55;

      case "ATTACKING_MIDFIELDER":
        return 0.45;

      case "STRIKER":
        return 0.35;

      case "GOALKEEPER":
        return 0.20;
    }
  }

  /**
   * Whether this role actively seeks goal-scoring opportunities.
   */
  public static isAttackingRole(role: PlayerRole): boolean {
    return (
      role === "STRIKER" ||
      role === "ATTACKING_MIDFIELDER" ||
      role === "WIDE_MIDFIELDER" ||
      role === "WINGER"
    );
  }

  /**
   * Whether this role should prefer conservative, ball-retention decisions.
   */
  public static isConservativeRole(role: PlayerRole): boolean {
    return (
      role === "GOALKEEPER" ||
      role === "CENTRE_BACK" ||
      role === "FULL_BACK"
    );
  }
}
