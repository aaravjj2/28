import { describe, expect, it } from "vitest";
import {
  createDeck,
  getDeckPointTotal,
  RANK_STRENGTH,
  RANKS,
  SUITS,
} from "./cards";

describe("cards", () => {
  it("creates a 32-card deck", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(32);
  });

  it("creates unique cards", () => {
    const deck = createDeck();
    const ids = new Set(deck.map((card) => card.id));
    expect(ids.size).toBe(32);
  });

  it("totals 28 points", () => {
    expect(getDeckPointTotal()).toBe(28);
  });

  it("uses all suits and ranks", () => {
    const deck = createDeck();
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        expect(deck.some((card) => card.suit === suit && card.rank === rank)).toBe(true);
      }
    }
  });

  it("orders strength J > 9 > A > 10 > K > Q > 8 > 7", () => {
    expect(RANK_STRENGTH.J).toBeGreaterThan(RANK_STRENGTH["9"]);
    expect(RANK_STRENGTH["9"]).toBeGreaterThan(RANK_STRENGTH.A);
    expect(RANK_STRENGTH.A).toBeGreaterThan(RANK_STRENGTH["10"]);
    expect(RANK_STRENGTH["10"]).toBeGreaterThan(RANK_STRENGTH.K);
    expect(RANK_STRENGTH.K).toBeGreaterThan(RANK_STRENGTH.Q);
    expect(RANK_STRENGTH.Q).toBeGreaterThan(RANK_STRENGTH["8"]);
    expect(RANK_STRENGTH["8"]).toBeGreaterThan(RANK_STRENGTH["7"]);
  });
});
