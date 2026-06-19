import { describe, expect, it } from "vitest";
import { createDeck } from "./cards";
import { resolveTrickWinner } from "./trickResolver";
import type { PlayedCard } from "./types";

describe("trickResolver", () => {
  const deck = createDeck();
  const card = (suit: string, rank: string) => {
    const found = deck.find((candidate) => candidate.suit === suit && candidate.rank === rank);
    if (!found) {
      throw new Error(`Missing card ${suit}-${rank}`);
    }
    return found;
  };

  const play = (seat: 0 | 1 | 2 | 3, suit: string, rank: string): PlayedCard => ({
    playerId: `p${seat}`,
    seat,
    card: card(suit, rank),
  });

  it("resolves highest led suit when no trump is in play", () => {
    const winner = resolveTrickWinner(
      [
        play(0, "hearts", "9"),
        play(1, "hearts", "A"),
        play(2, "hearts", "K"),
        play(3, "hearts", "7"),
      ],
      "hearts",
      "spades",
      false
    );

    expect(winner.seat).toBe(0);
  });

  it("resolves highest trump after reveal", () => {
    const winner = resolveTrickWinner(
      [
        play(0, "hearts", "J"),
        play(1, "spades", "9"),
        play(2, "hearts", "A"),
        play(3, "spades", "J"),
      ],
      "hearts",
      "spades",
      true
    );

    expect(winner.seat).toBe(3);
  });

  it("ignores off-suit cards when trump is not revealed", () => {
    const winner = resolveTrickWinner(
      [
        play(0, "hearts", "10"),
        play(1, "spades", "J"),
        play(2, "hearts", "A"),
        play(3, "clubs", "7"),
      ],
      "hearts",
      "spades",
      false
    );

    expect(winner.seat).toBe(2);
  });

  it("ignores trump entirely in no-trump mode", () => {
    const winner = resolveTrickWinner(
      [
        play(0, "hearts", "10"),
        play(1, "spades", "J"),
        play(2, "hearts", "A"),
      ],
      "hearts",
      "spades",
      true,
      true
    );

    expect(winner.seat).toBe(2);
  });
});
