import type { BiddingState, Seat, Team } from "./types";
import { MAX_BID, MIN_BID } from "./types";
import { allSeats, firstBidderSeat, nextSeatCounterClockwise, seatToTeam } from "./utils";

export function createBiddingState(dealerSeat: Seat): BiddingState {
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
  };
}

export type BidAction = number | "PASS";

export type BidValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateBidAction(
  state: BiddingState,
  seat: Seat,
  action: BidAction
): BidValidationResult {
  if (state.complete) {
    return { ok: false, reason: "Bidding is already complete" };
  }

  if (state.currentTurnSeat !== seat) {
    return { ok: false, reason: "Not this player's turn to bid" };
  }

  if (!state.activeSeats.includes(seat)) {
    return { ok: false, reason: "Player is out of bidding" };
  }

  const isOpeningBid = state.currentBid === null;
  const isFirstBidder = seat === firstBidderSeat(state.dealerSeat);

  if (action === "PASS") {
    if (isOpeningBid && isFirstBidder) {
      return { ok: false, reason: "First bidder must bid at least the minimum" };
    }
    return { ok: true };
  }

  if (!Number.isInteger(action)) {
    return { ok: false, reason: "Bid must be an integer" };
  }

  if (action < MIN_BID || action > MAX_BID) {
    return { ok: false, reason: `Bid must be between ${MIN_BID} and ${MAX_BID}` };
  }

  if (isOpeningBid && action < MIN_BID) {
    return { ok: false, reason: `Opening bid must be at least ${MIN_BID}` };
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

function finalizeBidding(state: BiddingState): BiddingState {
  if (state.highestBidderSeat === null || state.currentBid === null) {
    throw new Error("Cannot finalize bidding without a winning bid");
  }

  const declarerSeat = state.highestBidderSeat;
  const biddingTeam = seatToTeam(declarerSeat);

  return {
    ...state,
    complete: true,
    declarerSeat,
    biddingTeam,
    currentTurnSeat: declarerSeat,
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

  if (action === "PASS") {
    const activeSeats = state.activeSeats.filter((activeSeat) => activeSeat !== seat);
    const passedSeats = [...state.passedSeats, seat];

    const nextState: BiddingState = {
      ...state,
      bids,
      activeSeats,
      passedSeats,
    };

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

export function getLegalBidActions(state: BiddingState, seat: Seat): BidAction[] {
  const validationTurn = validateBidAction(state, seat, MIN_BID);
  if (!validationTurn.ok && validationTurn.reason === "Not this player's turn to bid") {
    return [];
  }
  if (!validationTurn.ok && validationTurn.reason === "Player is out of bidding") {
    return [];
  }
  if (!validationTurn.ok && validationTurn.reason === "Bidding is already complete") {
    return [];
  }

  const actions: BidAction[] = [];
  const isOpeningBid = state.currentBid === null;
  const isFirstBidder = seat === firstBidderSeat(state.dealerSeat);

  if (!(isOpeningBid && isFirstBidder)) {
    actions.push("PASS");
  }

  const minimum = state.currentBid === null ? MIN_BID : state.currentBid + 1;
  for (let bid = minimum; bid <= MAX_BID; bid += 1) {
    actions.push(bid);
  }

  return actions;
}

export function isBiddingComplete(state: BiddingState): boolean {
  return state.complete;
}

export function getBiddingTeam(state: BiddingState): Team | null {
  return state.biddingTeam;
}
