import { describe, expect, it } from "vitest";
import { createDeck } from "./cards";
import {
  assertHandsValid,
  createShuffledDeck,
  dealInitialRound,
  dealRemainingRound,
  getAllDealtCards,
} from "./deal";

describe("deal", () => {
  it("deals 4 cards initially to each player", () => {
    const deck = createShuffledDeck();
    const { hands } = dealInitialRound(deck, 0);

    expect(hands[0]).toHaveLength(4);
    expect(hands[1]).toHaveLength(4);
    expect(hands[2]).toHaveLength(4);
    expect(hands[3]).toHaveLength(4);
  });

  it("deals 8 cards total after remaining deal", () => {
    const deck = createShuffledDeck();
    const initial = dealInitialRound(deck, 1);
    const remaining = dealRemainingRound(initial.deck, initial.hands, 1);

    for (const seat of [0, 1, 2, 3] as const) {
      expect(remaining.hands[seat]).toHaveLength(8);
    }
  });

  it("does not duplicate cards across hands", () => {
    const deck = createShuffledDeck();
    const initial = dealInitialRound(deck, 2);
    const remaining = dealRemainingRound(initial.deck, initial.hands, 2);

    assertHandsValid(remaining.hands);
    const dealt = getAllDealtCards(remaining.hands);
    expect(dealt).toHaveLength(32);

    const deckIds = new Set(createDeck().map((card) => card.id));
    for (const card of dealt) {
      expect(deckIds.has(card.id)).toBe(true);
    }
  });
});
