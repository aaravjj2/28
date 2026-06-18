import { describe, expect, it } from "vitest";
import { createDeck } from "./cards";
import { createPlayState, getLegalPlayMoves, validateConcealedTrumpCard } from "./play";
import type { RoundHands, Seat } from "./types";

function handsWithTrumpAt(seat: Seat, trumpSuit: "hearts"): RoundHands {
  const deck = createDeck();
  const bySeat: RoundHands = { 0: [], 1: [], 2: [], 3: [] };
  let idx = 0;
  for (const s of [0, 1, 2, 3] as Seat[]) {
    bySeat[s] = deck.slice(idx, idx + 8);
    idx += 8;
  }
  const trumpCard = bySeat[seat].find((c) => c.suit === trumpSuit);
  if (!trumpCard) {
    bySeat[seat][0] = { ...deck.find((c) => c.suit === trumpSuit)! };
  }
  return bySeat;
}

describe("concealed trump card", () => {
  it("requires concealed card from trump suit in declarer hand", () => {
    const hands = handsWithTrumpAt(1, "hearts");
    const trumpCard = hands[1].find((c) => c.suit === "hearts")!;
    expect(validateConcealedTrumpCard(hands, 1, "hearts", trumpCard.id).ok).toBe(true);
    expect(validateConcealedTrumpCard(hands, 1, "spades", trumpCard.id).ok).toBe(false);
  });

  it("removes concealed card from declarer active hand", () => {
    const hands = handsWithTrumpAt(1, "hearts");
    const trumpCard = hands[1].find((c) => c.suit === "hearts")!;
    const play = createPlayState({
      hands,
      declarerSeat: 1,
      biddingTeam: "B",
      bid: 16,
      trumpSuit: "hearts",
      concealedTrumpCard: trumpCard,
    });

    expect(play.concealedTrumpCard?.id).toBe(trumpCard.id);
    expect(play.hands[1].some((c) => c.id === trumpCard.id)).toBe(false);
    expect(play.hands[1]).toHaveLength(7);
  });

  it("legal moves include concealed trump when it is set aside from hand", () => {
    const deck = createDeck();
    const hands = handsWithTrumpAt(1, "hearts");
    const trumpCard = hands[1].find((c) => c.suit === "hearts")!;
    const spadesAce = deck.find((c) => c.suit === "spades" && c.rank === "A")!;
    const clubsSeven = deck.find((c) => c.suit === "clubs" && c.rank === "7")!;
    hands[1] = [spadesAce, trumpCard];
    const play = createPlayState({
      hands,
      declarerSeat: 1,
      biddingTeam: "B",
      bid: 16,
      trumpSuit: "hearts",
      concealedTrumpCard: trumpCard,
    });
    play.currentTrick = [{ playerId: "p0", seat: 0, card: clubsSeven }];

    const legalIds = getLegalPlayMoves(play, 1);
    expect(legalIds).toContain(trumpCard.id);
    expect(play.hands[1].some((c) => c.id === trumpCard.id)).toBe(false);
  });
});
