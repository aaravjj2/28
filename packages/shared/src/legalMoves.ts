import type { Card, PlayedCard, Seat, Suit } from "./types";
import { cardBelongsToHand, removeCardFromHand } from "./utils";

export function hasLedSuit(hand: Card[], ledSuit: Suit): boolean {
  return hand.some((card) => card.suit === ledSuit);
}

export function getLedSuit(currentTrick: PlayedCard[]): Suit | null {
  const firstPlay = currentTrick[0];
  return firstPlay ? firstPlay.card.suit : null;
}

export function isVoidInLedSuit(hand: Card[], ledSuit: Suit): boolean {
  return !hasLedSuit(hand, ledSuit);
}

export function getLegalMoves(
  hand: Card[],
  currentTrick: PlayedCard[],
  trumpSuit: Suit | null,
  trumpRevealed: boolean
): Card[] {
  if (hand.length === 0) {
    return [];
  }

  const ledSuit = getLedSuit(currentTrick);
  if (ledSuit === null) {
    return [...hand];
  }

  if (hasLedSuit(hand, ledSuit)) {
    return hand.filter((card) => card.suit === ledSuit);
  }

  return [...hand];
}

export function shouldRevealTrump(
  card: Card,
  handBeforePlay: Card[],
  ledSuit: Suit,
  trumpSuit: Suit,
  trumpRevealed: boolean
): boolean {
  if (trumpRevealed) {
    return false;
  }

  if (card.suit !== trumpSuit) {
    return false;
  }

  return isVoidInLedSuit(handBeforePlay, ledSuit);
}

export type PlayValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validatePlay(
  hand: Card[],
  currentTrick: PlayedCard[],
  cardId: string,
  trumpSuit: Suit | null,
  trumpRevealed: boolean
): PlayValidationResult {
  if (!cardBelongsToHand(hand, cardId)) {
    return { ok: false, reason: "Card is not in player's hand" };
  }

  const card = hand.find((candidate) => candidate.id === cardId);
  if (!card) {
    return { ok: false, reason: "Card is not in player's hand" };
  }

  const legalMoves = getLegalMoves(hand, currentTrick, trumpSuit, trumpRevealed);
  if (!legalMoves.some((move) => move.id === cardId)) {
    return { ok: false, reason: "Must follow suit when possible" };
  }

  return { ok: true };
}

export function applyPlay(
  hand: Card[],
  currentTrick: PlayedCard[],
  seat: Seat,
  playerId: string,
  cardId: string,
  trumpSuit: Suit,
  trumpRevealed: boolean
): {
  hand: Card[];
  currentTrick: PlayedCard[];
  trumpRevealed: boolean;
} {
  const validation = validatePlay(hand, currentTrick, cardId, trumpSuit, trumpRevealed);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const card = hand.find((candidate) => candidate.id === cardId);
  if (!card) {
    throw new Error("Card is not in player's hand");
  }

  const ledSuit = getLedSuit(currentTrick) ?? card.suit;
  const nextTrumpRevealed =
    trumpRevealed ||
    shouldRevealTrump(card, hand, ledSuit, trumpSuit, trumpRevealed);

  return {
    hand: removeCardFromHand(hand, cardId),
    currentTrick: [
      ...currentTrick,
      {
        playerId,
        seat,
        card,
      },
    ],
    trumpRevealed: nextTrumpRevealed,
  };
}
