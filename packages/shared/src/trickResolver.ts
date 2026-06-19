import type { Card, PlayedCard, Suit } from "./types";

function isTrumpCard(card: Card, trumpSuit: Suit, trumpRevealed: boolean): boolean {
  return trumpRevealed && card.suit === trumpSuit;
}

function compareCardStrength(a: Card, b: Card): number {
  return a.strength - b.strength;
}

export function resolveTrickWinner(
  playedCards: PlayedCard[],
  ledSuit: Suit,
  trumpSuit: Suit,
  trumpRevealed: boolean,
  noTrump = false
): PlayedCard {
  if (playedCards.length === 0) {
    throw new Error("Cannot resolve an empty trick");
  }

  const trumpCards = noTrump
    ? []
    : playedCards.filter((play) => isTrumpCard(play.card, trumpSuit, trumpRevealed));

  if (trumpCards.length > 0) {
    return trumpCards.reduce((best, current) =>
      compareCardStrength(current.card, best.card) > 0 ? current : best
    );
  }

  const ledSuitCards = playedCards.filter((play) => play.card.suit === ledSuit);
  if (ledSuitCards.length === 0) {
    throw new Error("No cards of led suit in trick");
  }

  return ledSuitCards.reduce((best, current) =>
    compareCardStrength(current.card, best.card) > 0 ? current : best
  );
}

export function getTrickPoints(playedCards: PlayedCard[]): number {
  return playedCards.reduce((sum, play) => sum + play.card.points, 0);
}
