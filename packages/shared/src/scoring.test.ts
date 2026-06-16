import { describe, expect, it } from "vitest";
import { createDeck } from "./cards";
import {
  applyMatchScore,
  getCapturedPointsByTeam,
  isMatchOver,
  scoreRound,
} from "./scoring";
import type { Trick } from "./types";

describe("scoring", () => {
  const deck = createDeck();
  const card = (suit: string, rank: string) => {
    const found = deck.find((candidate) => candidate.suit === suit && candidate.rank === rank);
    if (!found) {
      throw new Error(`Missing card ${suit}-${rank}`);
    }
    return found;
  };

  const trick = (
    trickNumber: number,
    winnerTeam: "A" | "B",
    cards: Array<{ seat: 0 | 1 | 2 | 3; suit: string; rank: string }>
  ): Trick => ({
    trickNumber,
    ledSuit: cards[0]?.suit as Trick["ledSuit"],
    playedCards: cards.map((entry) => ({
      playerId: `p${entry.seat}`,
      seat: entry.seat,
      card: card(entry.suit, entry.rank),
    })),
    winnerPlayerId: `p${cards[0]?.seat ?? 0}`,
    winnerTeam,
    points: cards.reduce((sum, entry) => sum + card(entry.suit, entry.rank).points, 0),
  });

  it("totals captured points to 28 across tricks", () => {
    const tricks: Trick[] = [
      trick(1, "A", [
        { seat: 0, suit: "hearts", rank: "J" },
        { seat: 1, suit: "hearts", rank: "9" },
        { seat: 2, suit: "hearts", rank: "A" },
        { seat: 3, suit: "hearts", rank: "10" },
      ]),
      trick(2, "B", [
        { seat: 1, suit: "spades", rank: "J" },
        { seat: 2, suit: "spades", rank: "9" },
        { seat: 3, suit: "spades", rank: "A" },
        { seat: 0, suit: "spades", rank: "10" },
      ]),
      trick(3, "A", [
        { seat: 0, suit: "diamonds", rank: "J" },
        { seat: 1, suit: "diamonds", rank: "9" },
        { seat: 2, suit: "diamonds", rank: "A" },
        { seat: 3, suit: "diamonds", rank: "10" },
      ]),
      trick(4, "B", [
        { seat: 1, suit: "clubs", rank: "J" },
        { seat: 2, suit: "clubs", rank: "9" },
        { seat: 3, suit: "clubs", rank: "A" },
        { seat: 0, suit: "clubs", rank: "10" },
      ]),
      trick(5, "A", [
        { seat: 0, suit: "hearts", rank: "K" },
        { seat: 1, suit: "hearts", rank: "Q" },
        { seat: 2, suit: "hearts", rank: "8" },
        { seat: 3, suit: "hearts", rank: "7" },
      ]),
      trick(6, "B", [
        { seat: 1, suit: "spades", rank: "K" },
        { seat: 2, suit: "spades", rank: "Q" },
        { seat: 3, suit: "spades", rank: "8" },
        { seat: 0, suit: "spades", rank: "7" },
      ]),
      trick(7, "A", [
        { seat: 0, suit: "diamonds", rank: "K" },
        { seat: 1, suit: "diamonds", rank: "Q" },
        { seat: 2, suit: "diamonds", rank: "8" },
        { seat: 3, suit: "diamonds", rank: "7" },
      ]),
      trick(8, "B", [
        { seat: 1, suit: "clubs", rank: "K" },
        { seat: 2, suit: "clubs", rank: "Q" },
        { seat: 3, suit: "clubs", rank: "8" },
        { seat: 0, suit: "clubs", rank: "7" },
      ]),
    ];

    const captured = getCapturedPointsByTeam(tricks);
    expect(captured.teamA + captured.teamB).toBe(28);
  });

  it("awards match point to bidding team on success", () => {
    const tricks: Trick[] = [
      trick(1, "A", [
        { seat: 0, suit: "hearts", rank: "J" },
        { seat: 1, suit: "hearts", rank: "9" },
        { seat: 2, suit: "hearts", rank: "A" },
        { seat: 3, suit: "hearts", rank: "10" },
      ]),
      trick(2, "A", [
        { seat: 0, suit: "spades", rank: "J" },
        { seat: 1, suit: "spades", rank: "9" },
        { seat: 2, suit: "spades", rank: "A" },
        { seat: 3, suit: "spades", rank: "10" },
      ]),
      trick(3, "B", [
        { seat: 1, suit: "diamonds", rank: "J" },
        { seat: 2, suit: "diamonds", rank: "9" },
        { seat: 3, suit: "diamonds", rank: "A" },
        { seat: 0, suit: "diamonds", rank: "10" },
      ]),
      trick(4, "B", [
        { seat: 1, suit: "clubs", rank: "J" },
        { seat: 2, suit: "clubs", rank: "9" },
        { seat: 3, suit: "clubs", rank: "A" },
        { seat: 0, suit: "clubs", rank: "10" },
      ]),
      trick(5, "A", [
        { seat: 0, suit: "hearts", rank: "K" },
        { seat: 1, suit: "hearts", rank: "Q" },
        { seat: 2, suit: "hearts", rank: "8" },
        { seat: 3, suit: "hearts", rank: "7" },
      ]),
      trick(6, "B", [
        { seat: 1, suit: "spades", rank: "K" },
        { seat: 2, suit: "spades", rank: "Q" },
        { seat: 3, suit: "spades", rank: "8" },
        { seat: 0, suit: "spades", rank: "7" },
      ]),
      trick(7, "A", [
        { seat: 0, suit: "diamonds", rank: "K" },
        { seat: 1, suit: "diamonds", rank: "Q" },
        { seat: 2, suit: "diamonds", rank: "8" },
        { seat: 3, suit: "diamonds", rank: "7" },
      ]),
      trick(8, "B", [
        { seat: 1, suit: "clubs", rank: "K" },
        { seat: 2, suit: "clubs", rank: "Q" },
        { seat: 3, suit: "clubs", rank: "8" },
        { seat: 0, suit: "clubs", rank: "7" },
      ]),
    ];

    const result = scoreRound(tricks, "A", 14, 0);
    expect(result.biddingTeamWon).toBe(true);
    expect(result.matchPointWinner).toBe("A");

    const nextScore = applyMatchScore({ teamA: 0, teamB: 0 }, result.matchPointWinner!);
    expect(nextScore.teamA).toBe(1);
    expect(isMatchOver(nextScore, 6)).toBe(false);
  });
});
