import type { GameState, PairStatus, RuleProfileId } from "./types";

export function createDefaultPairStatus(bid = 0): PairStatus {
  return {
    bidderPairDeclared: false,
    defenderPairDeclared: false,
    adjustedBidTarget: bid,
  };
}

export function defaultGameStateFields(
  ruleProfileId: RuleProfileId = "standard_28"
): Pick<
  GameState,
  | "ruleProfileId"
  | "concealedTrumpCardId"
  | "thaniDeclared"
  | "thaniSkipped"
  | "pairStatus"
  | "pointTracker"
  | "stakeMultiplier"
  | "honoursStakeResolved"
  | "redealEligible"
  | "redealCount"
> {
  return {
    ruleProfileId,
    concealedTrumpCardId: null,
    thaniDeclared: false,
    thaniSkipped: false,
    pairStatus: createDefaultPairStatus(),
    pointTracker: null,
    stakeMultiplier: 1,
    honoursStakeResolved: null,
    redealEligible: false,
    redealCount: 0,
  };
}
