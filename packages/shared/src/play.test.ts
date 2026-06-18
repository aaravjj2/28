import { describe, expect, it } from "vitest";
import { createDeck } from "./cards";
import { createPlayState, getLegalPlayMoves } from "./play";

describe("seventh trick auto-reveal", () => {
  it("requires concealed trump lead on trick 8 after auto-reveal", () => {
    const deck = createDeck();
    const trumpCard = deck.find((c) => c.suit === "hearts" && c.rank === "7")!;
    const spadesAce = deck.find((c) => c.suit === "spades" && c.rank === "A")!;
    const hands = {
      0: [spadesAce, trumpCard],
      1: [],
      2: [],
      3: [],
    };
    const play = createPlayState({
      hands,
      declarerSeat: 0,
      biddingTeam: "A",
      bid: 16,
      trumpSuit: "hearts",
      concealedTrumpCard: trumpCard,
    });
    play.trumpRevealed = true;
    play.mustLeadConcealedTrump = true;
    play.trickNumber = 8;
    play.currentTurnSeat = 0;

    const legal = getLegalPlayMoves(play, 0);
    expect(legal).toEqual([trumpCard.id]);
  });
});
