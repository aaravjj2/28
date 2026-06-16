import { applyPlay, getLegalMoves } from "./legalMoves";
import { getTrickPoints, resolveTrickWinner } from "./trickResolver";
import type { PlayState, PlayedCard, RoundHands, Seat, Suit, Trick } from "./types";
import { TRICK_COUNT } from "./types";
import { nextSeatCounterClockwise, seatToTeam } from "./utils";

export function createPlayState(params: {
  hands: RoundHands;
  declarerSeat: Seat;
  biddingTeam: "A" | "B";
  bid: number;
  trumpSuit: Suit;
}): PlayState {
  return {
    hands: {
      0: [...params.hands[0]],
      1: [...params.hands[1]],
      2: [...params.hands[2]],
      3: [...params.hands[3]],
    },
    declarerSeat: params.declarerSeat,
    biddingTeam: params.biddingTeam,
    bid: params.bid,
    trumpSuit: params.trumpSuit,
    trumpRevealed: false,
    currentTurnSeat: params.declarerSeat,
    currentTrick: [],
    completedTricks: [],
    trickNumber: 1,
    complete: false,
  };
}

export function validateTrumpSuitSelection(
  hands: RoundHands,
  declarerSeat: Seat,
  trumpSuit: Suit
): { ok: true } | { ok: false; reason: string } {
  const declarerHand = hands[declarerSeat];
  const hasSuit = declarerHand.some((card) => card.suit === trumpSuit);
  if (!hasSuit) {
    return { ok: false, reason: "Declarer must choose a trump suit present in hand" };
  }
  return { ok: true };
}

function completeCurrentTrick(state: PlayState): PlayState {
  const ledSuit = state.currentTrick[0]?.card.suit;
  if (!ledSuit) {
    throw new Error("Cannot complete trick without a lead card");
  }

  const winner = resolveTrickWinner(
    state.currentTrick,
    ledSuit,
    state.trumpSuit,
    state.trumpRevealed
  );

  const trick: Trick = {
    trickNumber: state.trickNumber,
    ledSuit,
    playedCards: state.currentTrick,
    winnerPlayerId: winner.playerId,
    winnerTeam: seatToTeam(winner.seat),
    points: getTrickPoints(state.currentTrick),
  };

  const completedTricks = [...state.completedTricks, trick];
  const complete = completedTricks.length === TRICK_COUNT;

  return {
    ...state,
    currentTrick: [],
    completedTricks,
    trickNumber: state.trickNumber + 1,
    currentTurnSeat: winner.seat,
    complete,
  };
}

export function applyPlayAction(
  state: PlayState,
  seat: Seat,
  playerId: string,
  cardId: string
): PlayState {
  if (state.complete) {
    throw new Error("Play phase is already complete");
  }

  if (state.currentTurnSeat !== seat) {
    throw new Error("Not this player's turn");
  }

  const hand = state.hands[seat];
  const playResult = applyPlay(
    hand,
    state.currentTrick,
    seat,
    playerId,
    cardId,
    state.trumpSuit,
    state.trumpRevealed
  );

  const nextState: PlayState = {
    ...state,
    hands: {
      ...state.hands,
      [seat]: playResult.hand,
    },
    currentTrick: playResult.currentTrick,
    trumpRevealed: playResult.trumpRevealed,
  };

  if (nextState.currentTrick.length === 4) {
    return completeCurrentTrick(nextState);
  }

  return {
    ...nextState,
    currentTurnSeat: nextSeatCounterClockwise(seat),
  };
}

export function getLegalPlayMoves(state: PlayState, seat: Seat): string[] {
  const hand = state.hands[seat];
  return getLegalMoves(hand, state.currentTrick, state.trumpSuit, state.trumpRevealed).map(
    (card) => card.id
  );
}

export function getPlayedCards(state: PlayState): PlayedCard[] {
  const completed = state.completedTricks.flatMap((trick) => trick.playedCards);
  return [...completed, ...state.currentTrick];
}
