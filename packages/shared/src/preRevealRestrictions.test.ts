import { describe, expect, it } from "vitest";
import { createDeck } from "./cards";
import { getLegalMovesLegacy } from "./legalMoves";
import type { PlayedCard } from "./types";

describe("pre-reveal trump restrictions", () => {
  const deck = createDeck();
  const heartsJack = deck.find((c) => c.suit === "hearts" && c.rank === "J")!;
  const heartsNine = deck.find((c) => c.suit === "hearts" && c.rank === "9")!;
  const spadesAce = deck.find((c) => c.suit === "spades" && c.rank === "A")!;
  const clubsSeven = deck.find((c) => c.suit === "clubs" && c.rank === "7")!;

  it("declarer cannot lead concealed trump when alternatives exist", () => {
    const hand = [heartsJack, spadesAce];
    const legal = getLegalMovesLegacy(hand, [], "hearts", false, 1, 1);
    expect(legal.map((c) => c.id)).toEqual([spadesAce.id]);
  });

  it("declarer must lead trump when only trump cards remain", () => {
    const hand = [heartsJack, heartsNine];
    const legal = getLegalMovesLegacy(hand, [], "hearts", false, 1, 1);
    expect(legal).toHaveLength(2);
  });

  it("declarer cannot reveal when another player leads concealed trump suit", () => {
    const hand = [spadesAce, clubsSeven];
    const trick: PlayedCard[] = [{ playerId: "p0", seat: 0, card: heartsNine }];
    const legal = getLegalMovesLegacy(hand, trick, "hearts", false, 1, 1);
    expect(legal.every((c) => c.suit !== "hearts")).toBe(true);
  });

  it("declarer void in led suit may include concealed trump card option", () => {
    const concealed = heartsJack;
    const hand = [spadesAce];
    const trick: PlayedCard[] = [{ playerId: "p0", seat: 0, card: clubsSeven }];
    const legal = getLegalMovesLegacy(hand, trick, "hearts", false, 1, 1, concealed);
    expect(legal.some((c) => c.id === concealed.id)).toBe(true);
  });
});
