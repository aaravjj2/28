import { describe, expect, it } from "vitest";
import { createDeck } from "./cards";
import { evaluateHand, shouldBidAtLeast16 } from "./handEvaluation";

describe("handEvaluation", () => {
  const deck = createDeck();

  it("rejects aggressive bid for scattered jacks and nines", () => {
    const scattered = [
      deck.find((c) => c.suit === "hearts" && c.rank === "J")!,
      deck.find((c) => c.suit === "spades" && c.rank === "9")!,
      deck.find((c) => c.suit === "diamonds" && c.rank === "J")!,
      deck.find((c) => c.suit === "clubs" && c.rank === "7")!,
    ];
    const evalResult = evaluateHand(scattered);
    expect(evalResult.qualifiesForOpeningBid).toBe(false);
    expect(shouldBidAtLeast16(scattered)).toBe(false);
  });

  it("approves concentrated trump suit with 3+ cards and strength >= 4.5", () => {
    const strong = [
      deck.find((c) => c.suit === "hearts" && c.rank === "J")!,
      deck.find((c) => c.suit === "hearts" && c.rank === "9")!,
      deck.find((c) => c.suit === "hearts" && c.rank === "A")!,
      deck.find((c) => c.suit === "clubs" && c.rank === "7")!,
    ];
    const evalResult = evaluateHand(strong);
    expect(evalResult.bestSuit).toBe("hearts");
    expect(evalResult.bestSuitEvaluation?.cardCount).toBe(3);
    expect(evalResult.bestSuitEvaluation?.trumpStrength).toBeGreaterThanOrEqual(4.5);
    expect(evalResult.qualifiesForOpeningBid).toBe(true);
    expect(shouldBidAtLeast16(strong)).toBe(true);
  });

  it("treats side J/N as bonuses only", () => {
    const sideBonus = [
      deck.find((c) => c.suit === "hearts" && c.rank === "J")!,
      deck.find((c) => c.suit === "hearts" && c.rank === "8")!,
      deck.find((c) => c.suit === "spades" && c.rank === "9")!,
      deck.find((c) => c.suit === "diamonds" && c.rank === "J")!,
    ];
    const evalResult = evaluateHand(sideBonus);
    expect(evalResult.scatteredBonus).toBeGreaterThan(0);
    expect(evalResult.qualifiesForOpeningBid).toBe(false);
  });
});
