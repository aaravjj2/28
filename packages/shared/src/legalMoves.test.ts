import { describe, expect, it } from "vitest";
import { createDeck } from "./cards";
import {
  applyPlay,
  getLegalMoves,
  shouldRevealTrump,
  validatePlay,
} from "./legalMoves";
import type { PlayedCard } from "./types";

describe("legalMoves", () => {
  const deck = createDeck();
  const heartsJack = deck.find((card) => card.suit === "hearts" && card.rank === "J");
  const heartsNine = deck.find((card) => card.suit === "hearts" && card.rank === "9");
  const spadesAce = deck.find((card) => card.suit === "spades" && card.rank === "A");
  const clubsSeven = deck.find((card) => card.suit === "clubs" && card.rank === "7");

  if (!heartsJack || !heartsNine || !spadesAce || !clubsSeven) {
    throw new Error("Test deck cards missing");
  }

  it("requires follow suit when possible", () => {
    const hand = [heartsJack, spadesAce, clubsSeven];
    const currentTrick: PlayedCard[] = [
      {
        playerId: "p0",
        seat: 0,
        card: heartsNine,
      },
    ];

    const legal = getLegalMoves(hand, currentTrick, "diamonds", false);
    expect(legal).toHaveLength(1);
    expect(legal[0]?.id).toBe(heartsJack.id);

    expect(validatePlay(hand, currentTrick, spadesAce.id, "diamonds", false).ok).toBe(false);
    expect(validatePlay(hand, currentTrick, heartsJack.id, "diamonds", false).ok).toBe(true);
  });

  it("allows any card when void in led suit", () => {
    const hand = [spadesAce, clubsSeven];
    const currentTrick: PlayedCard[] = [
      {
        playerId: "p0",
        seat: 0,
        card: heartsNine,
      },
    ];

    const legal = getLegalMoves(hand, currentTrick, "diamonds", false);
    expect(legal).toHaveLength(2);
  });

  it("reveals trump when void player plays trump suit", () => {
    const hand = [spadesAce, clubsSeven];
    const currentTrick: PlayedCard[] = [
      {
        playerId: "p0",
        seat: 0,
        card: heartsNine,
      },
    ];

    expect(
      shouldRevealTrump(spadesAce, hand, "hearts", "spades", false)
    ).toBe(true);

    const result = applyPlay(
      hand,
      currentTrick,
      1,
      "p1",
      spadesAce.id,
      "spades",
      false
    );

    expect(result.trumpRevealed).toBe(true);
  });
});
