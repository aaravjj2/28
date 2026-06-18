import { describe, expect, it } from "vitest";
import {
  applyBidAction,
  applyStakeMultiplierAction,
  createBiddingState,
  getLegalBidActions,
  isAuctionReadyForTrump,
  validateBidAction,
} from "./bidding";
import { MAX_BID, MIN_BID } from "./types";

function passStakePhases(state: ReturnType<typeof createBiddingState>) {
  let next = state;
  while (!isAuctionReadyForTrump(next)) {
    if (next.stakeMultiplierPhase === "defender" || next.stakeMultiplierPhase === "bidder") {
      next = applyStakeMultiplierAction(next, next.currentTurnSeat, "PASS");
      continue;
    }
    break;
  }
  return next;
}

describe("bidding", () => {
  it("requires first bidder to open at least 14", () => {
    const state = createBiddingState(0);
    expect(validateBidAction(state, 1, "PASS").ok).toBe(false);
    expect(validateBidAction(state, 1, 13).ok).toBe(false);
    expect(validateBidAction(state, 1, MIN_BID).ok).toBe(true);
  });

  it("rejects equal or lower bids", () => {
    let state = createBiddingState(0);
    state = applyBidAction(state, 1, 14);
    state = applyBidAction(state, 2, "PASS");
    state = applyBidAction(state, 3, "PASS");

    expect(validateBidAction(state, 0, 14).ok).toBe(false);
    expect(validateBidAction(state, 0, 15).ok).toBe(true);
  });

  it("rejects bids above 28", () => {
    let state = createBiddingState(0);
    state = applyBidAction(state, 1, 28);
    expect(validateBidAction(state, 2, MAX_BID + 1).ok).toBe(false);
  });

  it("pass removes player from auction", () => {
    let state = createBiddingState(0);
    state = applyBidAction(state, 1, 14);
    state = applyBidAction(state, 2, "PASS");

    expect(state.passedSeats).toContain(2);
    expect(state.activeSeats).not.toContain(2);
  });

  it("completes when only one active bidder remains", () => {
    let state = createBiddingState(0);
    state = applyBidAction(state, 1, 14);
    state = applyBidAction(state, 2, "PASS");
    state = applyBidAction(state, 3, "PASS");
    state = applyBidAction(state, 0, "PASS");
    state = passStakePhases(state);

    expect(state.complete).toBe(true);
    expect(state.declarerSeat).toBe(1);
    expect(state.currentBid).toBe(14);
    expect(state.biddingTeam).toBe("B");
  });

  it("allows raising until one bidder remains", () => {
    let state = createBiddingState(0);
    state = applyBidAction(state, 1, 14);
    state = applyBidAction(state, 2, 16);
    state = applyBidAction(state, 3, "PASS");
    state = applyBidAction(state, 0, "PASS");
    state = applyBidAction(state, 1, 17);
    state = applyBidAction(state, 2, "PASS");
    state = passStakePhases(state);

    expect(state.complete).toBe(true);
    expect(state.declarerSeat).toBe(1);
    expect(state.currentBid).toBe(17);
  });

  it("exposes legal bid actions for current player", () => {
    const state = createBiddingState(0);
    const actions = getLegalBidActions(state, 1);
    expect(actions).not.toContain("PASS");
    expect(actions[0]).toBe(14);
    expect(actions[actions.length - 1]).toBe(28);
  });
});
