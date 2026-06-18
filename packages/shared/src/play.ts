import { applyPlay, getLegalMoves, type PlayContext } from "./legalMoves";
import { getTrickPoints, resolveTrickWinner } from "./trickResolver";
import type { Card, PlayState, PlayedCard, RoundHands, Seat, Suit, Trick } from "./types";
import { TRICK_COUNT } from "./types";
import { isSeatActiveInThani, type ThaniState } from "./thani";
import { nextSeatCounterClockwise, partnerSeat, removeCardFromHand, seatToTeam } from "./utils";

export function createPlayState(params: {
  hands: RoundHands;
  declarerSeat: Seat;
  biddingTeam: "A" | "B";
  bid: number;
  trumpSuit: Suit;
  concealedTrumpCard?: Card | null;
  thaniActive?: boolean;
}): PlayState {
  const thaniPartner = params.thaniActive ? partnerSeat(params.declarerSeat) : null;
  let hands: RoundHands = {
    0: [...params.hands[0]],
    1: [...params.hands[1]],
    2: [...params.hands[2]],
    3: [...params.hands[3]],
  };

  let concealedTrumpCard = params.concealedTrumpCard ?? null;
  if (concealedTrumpCard) {
    hands = {
      ...hands,
      [params.declarerSeat]: removeCardFromHand(
        hands[params.declarerSeat],
        concealedTrumpCard.id
      ),
    };
  }

  return {
    hands,
    declarerSeat: params.declarerSeat,
    biddingTeam: params.biddingTeam,
    bid: params.bid,
    trumpSuit: params.trumpSuit,
    trumpRevealed: params.thaniActive ? true : false,
    concealedTrumpCard,
    thaniActive: params.thaniActive ?? false,
    thaniPartnerSeat: thaniPartner,
    pairDeclarations: [],
    currentTurnSeat: params.declarerSeat,
    currentTrick: [],
    completedTricks: [],
    trickNumber: 1,
    complete: false,
    mustLeadConcealedTrump: false,
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

export function validateConcealedTrumpCard(
  hands: RoundHands,
  declarerSeat: Seat,
  trumpSuit: Suit,
  cardId: string
): { ok: true } | { ok: false; reason: string } {
  const suitValidation = validateTrumpSuitSelection(hands, declarerSeat, trumpSuit);
  if (!suitValidation.ok) {
    return suitValidation;
  }

  const declarerHand = hands[declarerSeat];
  const card = declarerHand.find((c) => c.id === cardId);
  if (!card) {
    return { ok: false, reason: "Concealed trump card must be in declarer's hand" };
  }
  if (card.suit !== trumpSuit) {
    return { ok: false, reason: "Concealed trump card must be of the chosen trump suit" };
  }
  return { ok: true };
}

function buildPlayContext(state: PlayState, seat: Seat): PlayContext {
  const ledSuit = state.currentTrick[0]?.card.suit ?? null;
  return {
    seat,
    declarerSeat: state.declarerSeat,
    trumpSuit: state.trumpSuit,
    trumpRevealed: state.trumpRevealed,
    concealedTrumpCard: state.concealedTrumpCard,
    ledSuitIsConcealedTrump: ledSuit === state.trumpSuit && !state.trumpRevealed,
    mustLeadConcealedTrump:
      state.mustLeadConcealedTrump &&
      seat === state.declarerSeat &&
      state.currentTrick.length === 0 &&
      state.trickNumber === 8,
  };
}

function getNextTurnSeat(state: PlayState, fromSeat: Seat): Seat {
  const thani: ThaniState | null = state.thaniActive && state.thaniPartnerSeat !== null
    ? { active: true, declarerSeat: state.declarerSeat, partnerSeat: state.thaniPartnerSeat }
    : null;

  let seat = nextSeatCounterClockwise(fromSeat);
  for (let i = 0; i < 4; i += 1) {
    if (isSeatActiveInThani(thani, seat)) {
      return seat;
    }
    seat = nextSeatCounterClockwise(seat);
  }
  return seat;
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

  // Seventh trick complete: auto-reveal concealed trump; trick 8 lead must be concealed card
  let nextState: PlayState = {
    ...state,
    currentTrick: [],
    completedTricks,
    trickNumber: state.trickNumber + 1,
    currentTurnSeat: winner.seat,
    complete,
  };

  if (
    !nextState.trumpRevealed &&
    nextState.concealedTrumpCard &&
    completedTricks.length === 7
  ) {
    nextState = {
      ...nextState,
      trumpRevealed: true,
      mustLeadConcealedTrump: winner.seat === nextState.declarerSeat,
    };
  }

  return nextState;
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
  const ctx = buildPlayContext(state, seat);
  const playResult = applyPlay(hand, state.currentTrick, seat, playerId, cardId, ctx);

  const nextState: PlayState = {
    ...state,
    hands: {
      ...state.hands,
      [seat]: playResult.hand,
    },
    concealedTrumpCard: playResult.concealedTrumpCard,
    currentTrick: playResult.currentTrick,
    trumpRevealed: playResult.trumpRevealed,
  };

  if (nextState.currentTrick.length === 4) {
    return completeCurrentTrick(nextState);
  }

  return {
    ...nextState,
    currentTurnSeat: getNextTurnSeat(nextState, seat),
  };
}

export function getLegalPlayMoves(state: PlayState, seat: Seat): string[] {
  const hand = state.hands[seat];
  const ctx = buildPlayContext(state, seat);
  return getLegalMoves(hand, state.currentTrick, ctx).map((card) => card.id);
}

export function getPlayedCards(state: PlayState): PlayedCard[] {
  const completed = state.completedTricks.flatMap((trick) => trick.playedCards);
  return [...completed, ...state.currentTrick];
}

export function declarePair(state: PlayState, seat: Seat, team: "A" | "B"): PlayState {
  if (state.pairDeclarations.some((d) => d.team === team)) {
    throw new Error("Pair already declared for this team");
  }
  return {
    ...state,
    pairDeclarations: [...state.pairDeclarations, { team, seat }],
  };
}

export function activateThani(state: PlayState): PlayState {
  return {
    ...state,
    thaniActive: true,
    thaniPartnerSeat: partnerSeat(state.declarerSeat),
    trumpRevealed: true,
    concealedTrumpCard: null,
    trumpSuit: state.trumpSuit,
    mustLeadConcealedTrump: false,
  };
}
