export type RuleProfileId = "standard_28" | "house_28_16_start" | "future_29_placeholder";

export type StakeLevel = "normal" | "honours" | "high";

export type PairAdjustmentRule =
  | { mode: "fixed"; amount: number }
  | { mode: "tiered"; bid19: number; bid20Plus: number };

export type RuleProfile = {
  id: RuleProfileId;
  label: string;
  minBid: number;
  maxBid: number;
  /** Total points available in a round (28 standard; 29 includes last-trick bonus). */
  totalPoints: number;
  /** First bidder must open unless redeal applies (standard Pagat). */
  firstBidderMustOpen: boolean;
  /** Pass removes player from auction. */
  passMeansOut: boolean;
  /** Bidding uses only the initial four-card deal. */
  bidOnInitialFourOnly: boolean;
  /** Declarer places one trump-suit card face down from the first four. */
  concealedTrumpCard: boolean;
  /** First bidder may redeal when first four cards have no point cards. */
  redealIfFirstBidderNoPoints: boolean;
  /** Redeal when all four players pass with no bid. */
  redealOnAllPass: boolean;
  pairMinBidToDeclare: number;
  pairAdjustment: PairAdjustmentRule;
  thaniEnabled: boolean;
  thaniWinPoints: number;
  thaniLossPoints: number;
  thaniNoTrump: boolean;
  honoursStakeMinDelta: number;
  honoursStakeMaxDelta: number;
  allowDoubleRedouble: boolean;
  twentyPlusFourPointStake: boolean;
};

export const STANDARD_28: RuleProfile = {
  id: "standard_28",
  label: "Standard 28 (Pagat baseline)",
  minBid: 14,
  maxBid: 28,
  totalPoints: 28,
  firstBidderMustOpen: true,
  passMeansOut: true,
  bidOnInitialFourOnly: true,
  concealedTrumpCard: true,
  redealIfFirstBidderNoPoints: true,
  redealOnAllPass: true,
  pairMinBidToDeclare: 19,
  pairAdjustment: { mode: "tiered", bid19: 3, bid20Plus: 4 },
  thaniEnabled: true,
  thaniWinPoints: 4,
  thaniLossPoints: 5,
  thaniNoTrump: true,
  honoursStakeMinDelta: 2,
  honoursStakeMaxDelta: 3,
  allowDoubleRedouble: true,
  twentyPlusFourPointStake: false,
};

export const HOUSE_28_16_START: RuleProfile = {
  id: "house_28_16_start",
  label: "House 28 (16 start)",
  minBid: 16,
  maxBid: 28,
  totalPoints: 28,
  firstBidderMustOpen: true,
  passMeansOut: true,
  bidOnInitialFourOnly: true,
  concealedTrumpCard: true,
  redealIfFirstBidderNoPoints: true,
  redealOnAllPass: true,
  pairMinBidToDeclare: 19,
  pairAdjustment: { mode: "tiered", bid19: 3, bid20Plus: 4 },
  thaniEnabled: true,
  thaniWinPoints: 4,
  thaniLossPoints: 5,
  thaniNoTrump: true,
  honoursStakeMinDelta: 2,
  honoursStakeMaxDelta: 3,
  allowDoubleRedouble: true,
  twentyPlusFourPointStake: true,
};

/** Placeholder profile for future 29-point variant — not fully playable yet. */
export const FUTURE_29_PLACEHOLDER: RuleProfile = {
  id: "future_29_placeholder",
  label: "29 (last trick bonus)",
  minBid: 17,
  maxBid: 29,
  totalPoints: 29,
  firstBidderMustOpen: true,
  passMeansOut: true,
  bidOnInitialFourOnly: true,
  concealedTrumpCard: true,
  redealIfFirstBidderNoPoints: true,
  redealOnAllPass: true,
  pairMinBidToDeclare: 20,
  pairAdjustment: { mode: "fixed", amount: 4 },
  thaniEnabled: false,
  thaniWinPoints: 4,
  thaniLossPoints: 5,
  thaniNoTrump: true,
  honoursStakeMinDelta: 2,
  honoursStakeMaxDelta: 3,
  allowDoubleRedouble: true,
  twentyPlusFourPointStake: false,
};

export const RULE_PROFILES: Record<RuleProfileId, RuleProfile> = {
  standard_28: STANDARD_28,
  house_28_16_start: HOUSE_28_16_START,
  future_29_placeholder: FUTURE_29_PLACEHOLDER,
};

export function getRuleProfile(id: RuleProfileId): RuleProfile {
  return RULE_PROFILES[id];
}

export function getStakeLevel(bid: number, profile: RuleProfile): StakeLevel {
  if (bid >= 25 && bid <= profile.maxBid) {
    return "high";
  }
  if (bid >= 20 && bid <= 24) {
    return "honours";
  }
  return "normal";
}

export function getStakePoints(
  bid: number,
  profile: RuleProfile,
  options?: { honoursStakeResolved?: number; doubleMultiplier?: number }
): number {
  const level = getStakeLevel(bid, profile);
  let base: number;
  if (level === "high") {
    base = profile.twentyPlusFourPointStake && bid >= 20 ? 4 : 3;
  } else if (level === "honours") {
    base = options?.honoursStakeResolved ?? profile.honoursStakeMaxDelta;
  } else {
    base = 1;
  }
  const multiplier = options?.doubleMultiplier ?? 1;
  return base * multiplier;
}

export function rollHonoursStake(profile: RuleProfile, random: () => number): number {
  const min = profile.honoursStakeMinDelta;
  const max = profile.honoursStakeMaxDelta;
  if (min >= max) {
    return min;
  }
  return min + Math.floor(random() * (max - min + 1));
}

export function getPairAdjustment(bid: number, profile: RuleProfile): number {
  if (profile.pairAdjustment.mode === "fixed") {
    return profile.pairAdjustment.amount;
  }
  return bid === 19 ? profile.pairAdjustment.bid19 : profile.pairAdjustment.bid20Plus;
}

export function getAdjustedBidTarget(
  bid: number,
  profile: RuleProfile,
  bidderPairDeclared: boolean,
  defenderPairDeclared: boolean
): number {
  let target = bid;
  if (bidderPairDeclared) {
    target -= getPairAdjustment(bid, profile);
  }
  if (defenderPairDeclared) {
    target += getPairAdjustment(bid, profile);
  }
  return target;
}
