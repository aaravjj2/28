import { describe, expect, it } from "vitest";
import { firstBidderHasNoPointCards, shouldOfferFirstBidderRedeal } from "./redeal";
import { createDeck } from "./cards";
import type { RoundHands } from "./types";

describe("redeal", () => {
  it("detects first bidder with no point cards", () => {
    const deck = createDeck();
    const hands: RoundHands = { 0: [], 1: [], 2: [], 3: [] };
    hands[1] = deck.filter((c) => c.points === 0).slice(0, 4);
    expect(firstBidderHasNoPointCards(hands, 0)).toBe(true);
    expect(shouldOfferFirstBidderRedeal(hands, 0, 0)).toBe(true);
    expect(shouldOfferFirstBidderRedeal(hands, 0, 3)).toBe(false);
  });
});
