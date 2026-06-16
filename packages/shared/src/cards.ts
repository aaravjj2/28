import type { Card, Rank, Suit } from "./types";

export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
export const RANKS: Rank[] = ["7", "8", "Q", "K", "10", "A", "9", "J"];

export const RANK_POINTS: Record<Rank, number> = {
  J: 3,
  "9": 2,
  A: 1,
  "10": 1,
  K: 0,
  Q: 0,
  "8": 0,
  "7": 0,
};

export const RANK_STRENGTH: Record<Rank, number> = {
  J: 8,
  "9": 7,
  A: 6,
  "10": 5,
  K: 4,
  Q: 3,
  "8": 2,
  "7": 1,
};

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      id: `${suit}-${rank}`,
      suit,
      rank,
      points: RANK_POINTS[rank],
      strength: RANK_STRENGTH[rank],
    }))
  );
}

export function getDeckPointTotal(deck: Card[] = createDeck()): number {
  return deck.reduce((sum, card) => sum + card.points, 0);
}
