import type { BiddingState, RoundHands, Seat, Team } from "./types";
import { MAX_BID, MIN_BID } from "./types";
import {
  getRuleProfile,
  rollHonoursStake,
  type RuleProfile,
  type RuleProfileId,
} from "./ruleProfiles";
import { allSeats, firstBidderSeat, nextSeatCounterClockwise, seatToTeam } from "./utils";
import { shouldOfferFirstBidderRedeal } from "./redeal";

export function createBiddingState(
  dealerSeat: Seat,
  profileId: RuleProfileId = "standard_28",
  options?: { redealEligible?: boolean; redealCount?: number }
): BiddingState {
  const firstBidder = firstBidderSeat(dealerSeat);
  return {
    dealerSeat,
    activeSeats: allSeats(),
    currentTurnSeat: firstBidder,
    currentBid: null,
    highestBidderSeat: null,
    passedSeats: [],
    bids: [],
    complete: false,
    declarerSeat: null,
    biddingTeam: null,
    ruleProfileId: profileId,
    redealEligible: options?.redealEligible ?? false,
    redealCount: options?.redealCount ?? 0,
    pendingAllPassRedeal: false,
    honoursStakeResolved: null,
    doubleMultiplier: 1,
    stakeMultiplierPhase: "none",
  };
}

export function computeRedealEligible(
  hands: RoundHands,
  dealerSeat: Seat,
  profileId: RuleProfileId,
  redealCount: number
): boolean {
  const profile = getRuleProfile(profileId);
  if (!profile.redealIfFirstBidderNoPoints) {
    return false;
  }
  return shouldOfferFirstBidderRedeal(hands, dealerSeat, redealCount);
}

export type BidAction = number | "PASS" | "REDEAL";
export type StakeMultiplierAction = "DOUBLE" | "REDOUBLE" | "PASS";

export type BidValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

function getProfile(state: BiddingState): RuleProfile {
  return getRuleProfile(state.ruleProfileId ?? "standard_28");
}

export function validateBidAction(
  state: BiddingState,
  seat: Seat,
  action: BidAction
): BidValidationResult {
  const profile = getProfile(state);

  if (state.complete) {
    return { ok: false, reason: "Bidding is already complete" };
  }

  if (state.stakeMultiplierPhase !== "none") {
    return { ok: false, reason: "Auction is in stake multiplier phase" };
  }

  if (state.currentTurnSeat !== seat) {
    return { ok: false, reason: "Not this player's turn to bid" };
  }

  if (!state.activeSeats.includes(seat)) {
    return { ok: false, reason: "Player is out of bidding" };
  }

  const isOpeningBid = state.currentBid === null;
  const isFirstBidder = seat === firstBidderSeat(state.dealerSeat);

  if (action === "REDEAL") {
    if (!state.redealEligible || !isFirstBidder) {
      return { ok: false, reason: "Redeal is not available" };
    }
    return { ok: true };
  }

  if (action === "PASS") {
    if (profile.firstBidderMustOpen && isOpeningBid && isFirstBidder && !state.redealEligible) {
      return { ok: false, reason: "First bidder must bid at least the minimum" };
    }
    if (!profile.passMeansOut && isOpeningBid) {
      return { ok: false, reason: "Pass is not allowed on opening bid for this profile" };
    }
    return { ok: true };
  }

  if (!Number.isInteger(action)) {
    return { ok: false, reason: "Bid must be an integer" };
  }

  if (action < profile.minBid || action > profile.maxBid) {
    return { ok: false, reason: `Bid must be between ${profile.minBid} and ${profile.maxBid}` };
  }

  if (isOpeningBid && action < profile.minBid) {
    return { ok: false, reason: `Opening bid must be at least ${profile.minBid}` };
  }

  if (state.currentBid !== null && action <= state.currentBid) {
    return { ok: false, reason: "Bid must exceed the current highest bid" };
  }

  return { ok: true };
}

function getNextActiveSeat(state: BiddingState, fromSeat: Seat): Seat | null {
  let seat = nextSeatCounterClockwise(fromSeat);
  for (let i = 0; i < 4; i += 1) {
    if (state.activeSeats.includes(seat)) {
      return seat;
    }
    seat = nextSeatCounterClockwise(seat);
  }
  return null;
}

function beginStakeMultiplierPhase(state: BiddingState): BiddingState {
  const profile = getProfile(state);
  if (!profile.allowDoubleRedouble) {
    return { ...state, stakeMultiplierPhase: "done", complete: true };
  }
  const defendingTeam = state.biddingTeam === "A" ? "B" : "A";
  let defenderSeat: Seat | null = null;
  let seat = nextSeatCounterClockwise(state.declarerSeat!);
  for (let i = 0; i < 4; i += 1) {
    if (seatToTeam(seat) === defendingTeam) {
      defenderSeat = seat;
      break;
    }
    seat = nextSeatCounterClockwise(seat);
  }
  if (defenderSeat === null) {
    throw new Error("No defender seat found for stake multiplier phase");
  }
  return {
    ...state,
    complete: false,
    stakeMultiplierPhase: "defender",
    currentTurnSeat: defenderSeat,
  };
}

function finalizeBidding(state: BiddingState): BiddingState {
  if (state.highestBidderSeat === null || state.currentBid === null) {
    throw new Error("Cannot finalize bidding without a winning bid");
  }

  const declarerSeat = state.highestBidderSeat;
  const biddingTeam = seatToTeam(declarerSeat);

  const withTeams: BiddingState = {
    ...state,
    declarerSeat,
    biddingTeam,
    currentTurnSeat: declarerSeat,
  };

  if (withTeams.stakeMultiplierPhase === "none") {
    return beginStakeMultiplierPhase(withTeams);
  }

  return {
    ...withTeams,
    complete: true,
    stakeMultiplierPhase: "done",
  };
}

export function applyBidAction(
  state: BiddingState,
  seat: Seat,
  action: BidAction
): BiddingState {
  const validation = validateBidAction(state, seat, action);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const bids = [...state.bids, { seat, value: action }];

  if (action === "REDEAL") {
    return {
      ...state,
      bids,
      redealCount: state.redealCount + 1,
      redealEligible: false,
      pendingAllPassRedeal: true,
    };
  }

  if (action === "PASS") {
    const activeSeats = state.activeSeats.filter((activeSeat) => activeSeat !== seat);
    const passedSeats = [...state.passedSeats, seat];

    const nextState: BiddingState = {
      ...state,
      bids,
      activeSeats,
      passedSeats,
    };

    if (activeSeats.length === 0 && nextState.currentBid === null) {
      const profile = getProfile(state);
      return {
        ...nextState,
        pendingAllPassRedeal: profile.redealOnAllPass,
      };
    }

    if (activeSeats.length === 1) {
      const remainingSeat = activeSeats[0];
      if (remainingSeat === undefined) {
        throw new Error("No active bidder remaining");
      }
      if (nextState.highestBidderSeat === null || nextState.currentBid === null) {
        throw new Error("Remaining bidder must have an active winning bid");
      }
      if (nextState.highestBidderSeat !== remainingSeat) {
        throw new Error("Remaining active player is not the highest bidder");
      }
      return finalizeBidding({
        ...nextState,
        currentTurnSeat: remainingSeat,
      });
    }

    const nextSeat = getNextActiveSeat(nextState, seat);
    if (nextSeat === null) {
      throw new Error("No next active bidder found");
    }

    return {
      ...nextState,
      currentTurnSeat: nextSeat,
    };
  }

  const nextState: BiddingState = {
    ...state,
    bids,
    currentBid: action,
    highestBidderSeat: seat,
    redealEligible: false,
  };

  if (nextState.activeSeats.length === 1) {
    return finalizeBidding(nextState);
  }

  const nextSeat = getNextActiveSeat(nextState, seat);
  if (nextSeat === null) {
    throw new Error("No next active bidder found");
  }

  return {
    ...nextState,
    currentTurnSeat: nextSeat,
  };
}

export function validateStakeMultiplierAction(
  state: BiddingState,
  seat: Seat,
  action: StakeMultiplierAction
): BidValidationResult {
  if (state.stakeMultiplierPhase === "none" || state.stakeMultiplierPhase === "done") {
    return { ok: false, reason: "Stake multiplier phase is not active" };
  }

  const team = seatToTeam(seat);
  if (state.stakeMultiplierPhase === "defender") {
    if (team === state.biddingTeam) {
      return { ok: false, reason: "Only defenders may double" };
    }
    if (action === "REDOUBLE") {
      return { ok: false, reason: "Defenders may only double or pass" };
    }
    return { ok: true };
  }

  if (state.stakeMultiplierPhase === "bidder") {
    if (team !== state.biddingTeam) {
      return { ok: false, reason: "Only bidding team may redouble or pass" };
    }
    if (action === "DOUBLE") {
      return { ok: false, reason: "Bidding team may only redouble or pass" };
    }
    if (state.doubleMultiplier < 2) {
      return { ok: false, reason: "Cannot redouble without a double" };
    }
    return { ok: true };
  }

  return { ok: false, reason: "Invalid stake multiplier phase" };
}

export function applyStakeMultiplierAction(
  state: BiddingState,
  seat: Seat,
  action: StakeMultiplierAction
): BiddingState {
  const validation = validateStakeMultiplierAction(state, seat, action);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  if (state.stakeMultiplierPhase === "defender") {
    if (action === "PASS") {
      return {
        ...state,
        stakeMultiplierPhase: "done",
        complete: true,
      };
    }
    return {
      ...state,
      doubleMultiplier: 2,
      stakeMultiplierPhase: "bidder",
      currentTurnSeat: state.declarerSeat!,
    };
  }

  if (action === "PASS") {
    return {
      ...state,
      stakeMultiplierPhase: "done",
      complete: true,
    };
  }

  return {
    ...state,
    doubleMultiplier: 4,
    stakeMultiplierPhase: "done",
    complete: true,
  };
}

export function resolveHonoursStake(state: BiddingState, random: () => number): BiddingState {
  const profile = getProfile(state);
  if (state.currentBid === null || state.honoursStakeResolved !== null) {
    return state;
  }
  const level =
    state.currentBid >= 20 && state.currentBid <= 24 ? "honours" : null;
  if (!level) {
    return state;
  }
  return {
    ...state,
    honoursStakeResolved: rollHonoursStake(profile, random),
  };
}

export function getLegalBidActions(state: BiddingState, seat: Seat): BidAction[] {
  const profile = getProfile(state);
  const validationTurn = validateBidAction(state, seat, profile.minBid);
  if (!validationTurn.ok && validationTurn.reason === "Not this player's turn to bid") {
    return [];
  }
  if (!validationTurn.ok && validationTurn.reason === "Player is out of bidding") {
    return [];
  }
  if (!validationTurn.ok && validationTurn.reason === "Bidding is already complete") {
    return [];
  }
  if (!validationTurn.ok && validationTurn.reason === "Auction is in stake multiplier phase") {
    return [];
  }

  const actions: BidAction[] = [];
  const isOpeningBid = state.currentBid === null;
  const isFirstBidder = seat === firstBidderSeat(state.dealerSeat);

  if (state.redealEligible && isFirstBidder && isOpeningBid) {
    actions.push("REDEAL");
  }

  const mustOpen =
    profile.firstBidderMustOpen && isOpeningBid && isFirstBidder && !state.redealEligible;
  if (!mustOpen) {
    actions.push("PASS");
  }

  const minimum = state.currentBid === null ? profile.minBid : state.currentBid + 1;
  for (let bid = minimum; bid <= profile.maxBid; bid += 1) {
    actions.push(bid);
  }

  return actions;
}

export function getLegalStakeMultiplierActions(
  state: BiddingState,
  seat: Seat
): StakeMultiplierAction[] {
  if (state.stakeMultiplierPhase === "defender") {
    if (seatToTeam(seat) === state.biddingTeam) {
      return [];
    }
    return ["DOUBLE", "PASS"];
  }

  if (state.stakeMultiplierPhase === "bidder") {
    if (seatToTeam(seat) !== state.biddingTeam) {
      return [];
    }
    return state.doubleMultiplier >= 2 ? ["REDOUBLE", "PASS"] : ["PASS"];
  }

  return [];
}

export function isBiddingComplete(state: BiddingState): boolean {
  return state.complete && state.stakeMultiplierPhase === "done";
}

export function isAuctionReadyForTrump(state: BiddingState): boolean {
  return state.complete && state.stakeMultiplierPhase === "done" && state.currentBid !== null;
}

export function getBiddingTeam(state: BiddingState): Team | null {
  return state.biddingTeam;
}

/** Backward-compatible exports using standard profile bounds. */
export { MIN_BID, MAX_BID };
