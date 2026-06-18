import { describe, expect, it } from "vitest";
import {
  HOUSE_28_16_START,
  RULE_PROFILES,
  STANDARD_28,
  getStakeLevel,
  getStakePoints,
  getAdjustedBidTarget,
} from "./ruleProfiles";
import { createBiddingState, validateBidAction, getLegalBidActions } from "./bidding";

describe("ruleProfiles", () => {
  it("defines three profiles", () => {
    expect(Object.keys(RULE_PROFILES)).toEqual([
      "standard_28",
      "house_28_16_start",
      "future_29_placeholder",
    ]);
  });

  it("house profile starts bidding at 16", () => {
    expect(HOUSE_28_16_START.minBid).toBe(16);
    expect(HOUSE_28_16_START.maxBid).toBe(28);
    const state = createBiddingState(0, "house_28_16_start");
    expect(validateBidAction(state, 1, 15).ok).toBe(false);
    expect(validateBidAction(state, 1, 16).ok).toBe(true);
  });

  it("standard profile opens at 14", () => {
    const state = createBiddingState(0, "standard_28");
    expect(getLegalBidActions(state, 1)[0]).toBe(14);
  });

  it("assigns stake tiers", () => {
    expect(getStakeLevel(17, STANDARD_28)).toBe("normal");
    expect(getStakeLevel(22, STANDARD_28)).toBe("honours");
    expect(getStakeLevel(27, STANDARD_28)).toBe("high");
    expect(getStakePoints(22, STANDARD_28)).toBe(3);
    expect(getStakePoints(22, STANDARD_28, { doubleMultiplier: 2 })).toBe(6);
  });

  it("future 29 profile uses 29 total points", () => {
    expect(RULE_PROFILES.future_29_placeholder.totalPoints).toBe(29);
    expect(RULE_PROFILES.future_29_placeholder.maxBid).toBe(29);
  });

  it("adjusts bid target with pair declarations", () => {
    expect(getAdjustedBidTarget(20, STANDARD_28, true, false)).toBe(16);
    expect(getAdjustedBidTarget(20, STANDARD_28, false, true)).toBe(24);
    expect(getAdjustedBidTarget(19, STANDARD_28, true, false)).toBe(16);
  });

  it("first bidder cannot pass on opening for house profile", () => {
    const state = createBiddingState(0, "house_28_16_start");
    expect(validateBidAction(state, 1, "PASS").ok).toBe(false);
  });
});
