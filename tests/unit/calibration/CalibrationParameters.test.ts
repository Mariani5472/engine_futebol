import {
  DEFAULT_CALIBRATION_PARAMETERS,
  ENGINE_CALIBRATION_PARAMETERS,
} from "../../../src/application/match/calibration/CalibrationParameters";

describe("CalibrationParameters", () => {
  it("defines 0.05s as the official timestep", () => {
    expect(ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds).toBe(0.05);
  });

  it("keeps legacy flat parameters synchronized with the live baseline", () => {
    expect(DEFAULT_CALIBRATION_PARAMETERS.shotUtilityScale)
      .toBe(ENGINE_CALIBRATION_PARAMETERS.shot.utilityScale);
    expect(DEFAULT_CALIBRATION_PARAMETERS.shotOnTargetCap)
      .toBe(ENGINE_CALIBRATION_PARAMETERS.shot.onTargetProbabilityCap);
    expect(DEFAULT_CALIBRATION_PARAMETERS.gkSaveCap)
      .toBe(ENGINE_CALIBRATION_PARAMETERS.shot.goalkeeperSaveCap);
    expect(DEFAULT_CALIBRATION_PARAMETERS.gkSaveFloor)
      .toBe(ENGINE_CALIBRATION_PARAMETERS.shot.goalkeeperSaveFloor);
  });
});
