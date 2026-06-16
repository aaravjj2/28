import { createDeck } from "./cards";
import type { Card, RoundHands, Seat } from "./types";
import { INITIAL_DEAL_SIZE, PLAYER_COUNT } from "./types";
import { nextSeatCounterClockwise } from "./utils";

export function shuffleDeck(deck: Card[], random: () => number = Math.random): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = shuffled[i];
    const swap = shuffled[j];
    if (!temp || !swap) {
      throw new Error("Shuffle index out of bounds");
    }
    shuffled[i] = swap;
    shuffled[j] = temp;
  }
  return shuffled;
}

export function createShuffledDeck(random: () => number = Math.random): Card[] {
  return shuffleDeck(createDeck(), random);
}

export function createEmptyHands(): RoundHands {
  return {
    0: [],
    1: [],
    2: [],
    3: [],
  };
}

export function dealCards(
  deck: Card[],
  hands: RoundHands,
  dealerSeat: Seat,
  cardsPerPlayer: number
): { deck: Card[]; hands: RoundHands } {
  if (deck.length < cardsPerPlayer * PLAYER_COUNT) {
    throw new Error("Not enough cards in deck to deal");
  }

  const nextHands: RoundHands = {
    0: [...hands[0]],
    1: [...hands[1]],
    2: [...hands[2]],
    3: [...hands[3]],
  };

  let deckIndex = 0;
  let seat = nextSeatCounterClockwise(dealerSeat);

  for (let cardIndex = 0; cardIndex < cardsPerPlayer; cardIndex += 1) {
    for (let playerIndex = 0; playerIndex < PLAYER_COUNT; playerIndex += 1) {
      const card = deck[deckIndex];
      if (!card) {
        throw new Error("Deck exhausted during deal");
      }
      nextHands[seat].push(card);
      deckIndex += 1;
      seat = nextSeatCounterClockwise(seat);
    }
  }

  return {
    deck: deck.slice(deckIndex),
    hands: nextHands,
  };
}

export function dealInitialRound(
  deck: Card[],
  dealerSeat: Seat
): { deck: Card[]; hands: RoundHands } {
  return dealCards(deck, createEmptyHands(), dealerSeat, INITIAL_DEAL_SIZE);
}

export function dealRemainingRound(
  deck: Card[],
  hands: RoundHands,
  dealerSeat: Seat
): { deck: Card[]; hands: RoundHands } {
  return dealCards(deck, hands, dealerSeat, INITIAL_DEAL_SIZE);
}

export function assertHandsValid(hands: RoundHands): void {
  const allCards: Card[] = [0, 1, 2, 3].flatMap((seat) => hands[seat as Seat]);
  const ids = new Set(allCards.map((card) => card.id));
  if (ids.size !== allCards.length) {
    throw new Error("Duplicate cards found in hands");
  }
}

export function getAllDealtCards(hands: RoundHands): Card[] {
  return [0, 1, 2, 3].flatMap((seat) => hands[seat as Seat]);
}
