import { describe, expect, it } from "vitest";
import { createDeck } from "./cards";
import { canDeclarePair, hasTrumpPair, validatePairDeclaration } from "./pair";

describe("pair declaration", () => {
  const deck = createDeck();

  it("detects king and queen of trump", () => {
    const heartsKing = deck.find((c) => c.suit === "hearts" && c.rank === "K")!;
    const heartsQueen = deck.find((c) => c.suit === "hearts" && c.rank === "Q")!;
    expect(hasTrumpPair([heartsKing, heartsQueen], "hearts")).toBe(true);
    expect(hasTrumpPair([heartsKing], "hearts")).toBe(false);
  });

  it("requires trump reveal before pair", () => {
    const heartsKing = deck.find((c) => c.suit === "hearts" && c.rank === "K")!;
    const heartsQueen = deck.find((c) => c.suit === "hearts" && c.rank === "Q")!;
    expect(
      canDeclarePair({
        hand: [heartsKing, heartsQueen],
        trumpSuit: "hearts",
        trumpRevealed: false,
        bid: 20,
        pairMinBidToDeclare: 19,
        team: "A",
        biddingTeam: "A",
      })
    ).toBe(false);
  });

  it("bidder needs bid 19+ to declare pair", () => {
    const heartsKing = deck.find((c) => c.suit === "hearts" && c.rank === "K")!;
    const heartsQueen = deck.find((c) => c.suit === "hearts" && c.rank === "Q")!;
    expect(
      canDeclarePair({
        hand: [heartsKing, heartsQueen],
        trumpSuit: "hearts",
        trumpRevealed: true,
        bid: 18,
        pairMinBidToDeclare: 19,
        team: "A",
        biddingTeam: "A",
      })
    ).toBe(false);
    expect(
      canDeclarePair({
        hand: [heartsKing, heartsQueen],
        trumpSuit: "hearts",
        trumpRevealed: true,
        bid: 20,
        pairMinBidToDeclare: 19,
        team: "A",
        biddingTeam: "A",
      })
    ).toBe(true);
  });

  it("validates pair declaration once per team", () => {
    const heartsKing = deck.find((c) => c.suit === "hearts" && c.rank === "K")!;
    const heartsQueen = deck.find((c) => c.suit === "hearts" && c.rank === "Q")!;
    const hand = [heartsKing, heartsQueen];
    const first = validatePairDeclaration({
      hand,
      trumpSuit: "hearts",
      trumpRevealed: true,
      bid: 20,
      pairMinBidToDeclare: 19,
      seat: 0,
      biddingTeam: "A",
      existingDeclarations: [],
    });
    expect(first.ok).toBe(true);
    const second = validatePairDeclaration({
      hand,
      trumpSuit: "hearts",
      trumpRevealed: true,
      bid: 20,
      pairMinBidToDeclare: 19,
      seat: 2,
      biddingTeam: "A",
      existingDeclarations: [{ team: "A", declaredBySeat: 0 }],
    });
    expect(second.ok).toBe(false);
  });
});
