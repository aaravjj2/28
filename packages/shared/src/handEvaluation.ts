import type { Card, PublicCard, Suit } from "./types";

export type SuitEvaluation = {
  suit: Suit;
  cardCount: number;
  trumpStrength: number;
  hasJack: boolean;
  hasNine: boolean;
};

export type HandEvaluation = {
  bestSuit: Suit | null;
  bestSuitEvaluation: SuitEvaluation | null;
  /** Side J/N bonuses not tied to best suit concentration. */
  scatteredBonus: number;
  /** Minimum bid threshold met for aggressive 16+ bids. */
  qualifiesForOpeningBid: boolean;
  recommendedMaxBid: number;
};

const TRUMP_POINT_VALUES: Record<string, number> = {
  J: 3,
  "9": 2,
  A: 1,
  "10": 1,
  K: 0,
  Q: 0,
  "8": 0,
  "7": 0,
};

type EvaluableCard = Pick<Card, "suit" | "rank">;

function trumpStrengthForCard(card: EvaluableCard): number {
  return TRUMP_POINT_VALUES[card.rank] ?? 0;
}

export function evaluateSuit(cards: EvaluableCard[], suit: Suit): SuitEvaluation {
  const suitCards = cards.filter((c) => c.suit === suit);
  const trumpStrength = suitCards.reduce((sum, c) => sum + trumpStrengthForCard(c), 0);
  return {
    suit,
    cardCount: suitCards.length,
    trumpStrength,
    hasJack: suitCards.some((c) => c.rank === "J"),
    hasNine: suitCards.some((c) => c.rank === "9"),
  };
}

export function evaluateHand(cards: EvaluableCard[]): HandEvaluation {
  const suits = ["hearts", "diamonds", "clubs", "spades"] as Suit[];
  const evaluations = suits.map((suit) => evaluateSuit(cards, suit));
  const ranked = [...evaluations].sort((a, b) => {
    if (b.cardCount !== a.cardCount) {
      return b.cardCount - a.cardCount;
    }
    return b.trumpStrength - a.trumpStrength;
  });

  const best = ranked[0] ?? null;
  const bestSuit = best && best.cardCount > 0 ? best.suit : null;
  const bestSuitEvaluation = best && best.cardCount > 0 ? best : null;

  const sideBonuses = evaluations
    .filter((ev) => ev.suit !== bestSuit)
    .reduce((sum, ev) => {
      let bonus = 0;
      if (ev.hasJack) bonus += 0.5;
      if (ev.hasNine) bonus += 0.25;
      return sum + bonus;
    }, 0);

  const qualifiesForOpeningBid =
    bestSuitEvaluation !== null &&
    bestSuitEvaluation.cardCount >= 3 &&
    bestSuitEvaluation.trumpStrength >= 4.5;

  let recommendedMaxBid = 14;
  if (qualifiesForOpeningBid && bestSuitEvaluation) {
    recommendedMaxBid = Math.min(
      28,
      Math.floor(14 + bestSuitEvaluation.trumpStrength + sideBonuses * 0.5)
    );
  }

  return {
    bestSuit,
    bestSuitEvaluation,
    scatteredBonus: sideBonuses,
    qualifiesForOpeningBid,
    recommendedMaxBid,
  };
}

export function shouldBidAtLeast16(cards: EvaluableCard[]): boolean {
  return evaluateHand(cards).qualifiesForOpeningBid;
}
