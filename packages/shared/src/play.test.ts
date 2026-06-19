import { describe, expect, it } from "vitest";
import { createDeck } from "./cards";
import {
  activateThani,
  applyPlayAction,
  createPlayState,
  getLegalPlayMoves,
  getTrickPlayerCount,
} from "./play";

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

describe("thani play", () => {
  it("plays no-trump tricks with three active players", () => {
    const deck = createDeck();
    const h7 = deck.find((c) => c.suit === "hearts" && c.rank === "7")!;
    const h9 = deck.find((c) => c.suit === "hearts" && c.rank === "9")!;
    const hA = deck.find((c) => c.suit === "hearts" && c.rank === "A")!;
    const sJ = deck.find((c) => c.suit === "spades" && c.rank === "J")!;

    let play = createPlayState({
      hands: { 0: [h7], 1: [h9, sJ], 2: [hA], 3: [] },
      declarerSeat: 1,
      biddingTeam: "B",
      bid: 20,
      trumpSuit: "spades",
      concealedTrumpCard: sJ,
    });
    play = activateThani(play);

    expect(play.trumpRevealed).toBe(false);
    expect(play.concealedTrumpCard).toBeNull();
    expect(getTrickPlayerCount(play)).toBe(3);

    play = applyPlayAction(play, 1, "p1", h9.id);
    expect(play.currentTrick.length).toBe(1);

    play = applyPlayAction(play, 2, "p2", hA.id);
    expect(play.currentTrick.length).toBe(2);

    play = applyPlayAction(play, 0, "p0", h7.id);
    expect(play.completedTricks.length).toBe(1);
    expect(play.currentTrick.length).toBe(0);
    expect(play.completedTricks[0]!.playedCards.length).toBe(3);
    expect(play.completedTricks[0]!.winnerPlayerId).toBe("p1");
  });
});
