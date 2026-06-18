import { applyBidAction, createBiddingState, getLegalBidActions, isAuctionReadyForTrump, applyStakeMultiplierAction } from "./bidding";
import { SUITS } from "./cards";
import {
  assertHandsValid,
  createShuffledDeck,
  dealInitialRound,
  dealRemainingRound,
  getAllDealtCards,
} from "./deal";
import { scoreRound } from "./scoring";
import type { BiddingState, Card, RoundHands, RoundResult, Seat, Suit } from "./types";
import {
  CARDS_PER_PLAYER,
  PLAYER_COUNT,
  TRICK_COUNT,
} from "./types";
import { applyPlayAction, createPlayState, getLegalPlayMoves, validateTrumpSuitSelection } from "./play";
import { firstBidderSeat } from "./utils";

export type RandomSource = () => number;

function pickRandom<T>(items: T[], random: RandomSource): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from empty list");
  }
  const index = Math.floor(random() * items.length);
  const item = items[index];
  if (item === undefined) {
    throw new Error("Random index out of bounds");
  }
  return item;
}

function playerIdForSeat(seat: Seat): string {
  return `player-${seat}`;
}

function runBidding(
  dealerSeat: Seat,
  random: RandomSource
): BiddingState {
  let bidding = createBiddingState(dealerSeat);
  let safety = 0;

  while (!isAuctionReadyForTrump(bidding)) {
    const seat = bidding.currentTurnSeat;

    if (bidding.stakeMultiplierPhase === "defender" || bidding.stakeMultiplierPhase === "bidder") {
      bidding = applyStakeMultiplierAction(bidding, seat, "PASS");
      safety += 1;
      continue;
    }

    const actions = getLegalBidActions(bidding, seat).filter((action) => action !== "REDEAL");
    if (actions.length === 0) {
      throw new Error(`No legal bid actions for seat ${seat}`);
    }
    const action = pickRandom(actions, random);
    bidding = applyBidAction(bidding, seat, action);
    safety += 1;
    if (safety > 100) {
      throw new Error("Bidding simulation exceeded safety limit");
    }
  }

  return bidding;
}

function chooseTrumpSuit(hands: RoundHands, declarerSeat: Seat, random: RandomSource): Suit {
  const declarerHand = hands[declarerSeat];
  const suitsInHand = SUITS.filter((suit) =>
    declarerHand.some((card) => card.suit === suit)
  );
  const suit = pickRandom(suitsInHand, random);
  const validation = validateTrumpSuitSelection(hands, declarerSeat, suit);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }
  return suit;
}

function runPlayPhase(
  hands: RoundHands,
  bidding: BiddingState,
  trumpSuit: Suit,
  random: RandomSource
) {
  if (bidding.declarerSeat === null || bidding.biddingTeam === null || bidding.currentBid === null) {
    throw new Error("Bidding must be complete before play");
  }

  let play = createPlayState({
    hands,
    declarerSeat: bidding.declarerSeat,
    biddingTeam: bidding.biddingTeam,
    bid: bidding.currentBid,
    trumpSuit,
  });

  let safety = 0;
  while (!play.complete) {
    const seat = play.currentTurnSeat;
    const legalMoves = getLegalPlayMoves(play, seat);
    if (legalMoves.length === 0) {
      throw new Error(`No legal play moves for seat ${seat}`);
    }
    const cardId = pickRandom(legalMoves, random);
    play = applyPlayAction(play, seat, playerIdForSeat(seat), cardId);
    safety += 1;
    if (safety > 64) {
      throw new Error("Play simulation exceeded safety limit");
    }
  }

  return play;
}

export type SimulationRoundReport = {
  hands: RoundHands;
  bidding: BiddingState;
  trumpSuit: Suit;
  playedCardIds: string[];
  tricksPlayed: number;
  cardsPlayedPerSeat: Record<Seat, number>;
  result: RoundResult;
};

export function simulateRound(
  dealerSeat: Seat,
  random: RandomSource = Math.random
): SimulationRoundReport {
  let deck = createShuffledDeck(random);
  const initialDeal = dealInitialRound(deck, dealerSeat);
  deck = initialDeal.deck;

  const bidding = runBidding(dealerSeat, random);
  if (bidding.declarerSeat === null || bidding.currentBid === null || bidding.biddingTeam === null) {
    throw new Error("Bidding did not produce a declarer");
  }

  const trumpSuit = chooseTrumpSuit(initialDeal.hands, bidding.declarerSeat, random);
  const remainingDeal = dealRemainingRound(deck, initialDeal.hands, dealerSeat);
  const hands = remainingDeal.hands;

  assertHandsValid(hands);
  for (const seat of [0, 1, 2, 3] as Seat[]) {
    if (hands[seat].length !== CARDS_PER_PLAYER) {
      throw new Error(`Seat ${seat} expected ${CARDS_PER_PLAYER} cards, got ${hands[seat].length}`);
    }
  }

  const play = runPlayPhase(hands, bidding, trumpSuit, random);
  const playedCards = play.completedTricks.flatMap((trick) => trick.playedCards);

  const playedCardIds = playedCards.map((playCard) => playCard.card.id);
  const uniquePlayed = new Set(playedCardIds);
  if (uniquePlayed.size !== playedCardIds.length) {
    throw new Error("Duplicate played cards detected");
  }

  const dealtCards = getAllDealtCards(hands);
  const dealtIds = new Set(dealtCards.map((card) => card.id));
  if (dealtIds.size !== 32) {
    throw new Error("Dealt cards must be 32 unique cards");
  }

  for (const playedId of playedCardIds) {
    if (!dealtIds.has(playedId)) {
      throw new Error(`Played card ${playedId} was not dealt`);
    }
  }

  if (play.completedTricks.length !== TRICK_COUNT) {
    throw new Error(`Expected ${TRICK_COUNT} tricks, got ${play.completedTricks.length}`);
  }

  const cardsPlayedPerSeat: Record<Seat, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const played of playedCards) {
    cardsPlayedPerSeat[played.seat] = (cardsPlayedPerSeat[played.seat] ?? 0) + 1;
  }

  for (const seat of [0, 1, 2, 3] as Seat[]) {
    if (cardsPlayedPerSeat[seat] !== CARDS_PER_PLAYER) {
      throw new Error(`Seat ${seat} played ${cardsPlayedPerSeat[seat]} cards instead of 8`);
    }
  }

  for (const trick of play.completedTricks) {
    if (trick.playedCards.length !== PLAYER_COUNT) {
      throw new Error(`Trick ${trick.trickNumber} must have 4 cards`);
    }
  }

  const result = scoreRound(
    play.completedTricks,
    bidding.biddingTeam,
    bidding.currentBid,
    bidding.declarerSeat
  );

  return {
    hands,
    bidding,
    trumpSuit,
    playedCardIds,
    tricksPlayed: play.completedTricks.length,
    cardsPlayedPerSeat,
    result,
  };
}

export function runSimulation(roundCount: number, random: RandomSource = Math.random): void {
  for (let round = 0; round < roundCount; round += 1) {
    const dealerSeat = Math.floor(random() * PLAYER_COUNT) as Seat;
    simulateRound(dealerSeat, random);
  }
}

export function assertNoDuplicateCards(cards: Card[]): void {
  const ids = new Set(cards.map((card) => card.id));
  if (ids.size !== cards.length) {
    throw new Error("Duplicate cards detected");
  }
}

export function getFirstBidderForDealer(dealerSeat: Seat): Seat {
  return firstBidderSeat(dealerSeat);
}
