import { describe, expect, it } from "vitest";
import { createDeck } from "./cards";
import {
  assertPublicStateHasNoHiddenLeaks,
  serializePublicState,
  validateTrumpSelection,
} from "./publicState";
import { defaultGameStateFields } from "./gameStateDefaults";
import type { GameState, Player } from "./types";

function makePlayer(seat: 0 | 1 | 2 | 3): Player {
  return {
    id: `player-${seat}`,
    displayName: `Player ${seat}`,
    seat,
    connected: true,
    isHost: seat === 0,
    team: seat === 0 || seat === 2 ? "A" : "B",
  };
}

describe("publicState", () => {
  const deck = createDeck();

  it("hides other players hands and hidden trump", () => {
    const state: GameState = {
      phase: "PLAYING_TRICKS",
      dealerSeat: 0,
      currentTurnSeat: 1,
      players: [0, 1, 2, 3].map((seat) => makePlayer(seat as 0 | 1 | 2 | 3)),
      handsByPlayerId: {
        "player-0": deck.slice(0, 8),
        "player-1": deck.slice(8, 16),
        "player-2": deck.slice(16, 24),
        "player-3": deck.slice(24, 32),
      },
      bids: [],
      currentBid: 16,
      highestBidderPlayerId: "player-1",
      passedPlayerIds: [],
      declarerPlayerId: "player-1",
      biddingTeam: "B",
      trumpSuit: "hearts",
      trumpRevealed: false,
      currentTrick: [],
      completedTricks: [],
      roundNumber: 1,
      matchScore: { teamA: 0, teamB: 0 },
      targetScore: 6,
      ...defaultGameStateFields(),
    };

    const publicState = serializePublicState(state, "player-0");
    expect(publicState.myHand).toHaveLength(8);
    expect(publicState.trumpSuit).toBeNull();
    expect(publicState.handCountsByPlayerId["player-1"]).toBe(8);
    assertPublicStateHasNoHiddenLeaks(publicState, "player-0", state);
  });

  it("shows trump to declarer before reveal", () => {
    const state: GameState = {
      phase: "PLAYING_TRICKS",
      dealerSeat: 0,
      currentTurnSeat: 1,
      players: [0, 1, 2, 3].map((seat) => makePlayer(seat as 0 | 1 | 2 | 3)),
      handsByPlayerId: {
        "player-0": deck.slice(0, 8),
        "player-1": deck.slice(8, 16),
        "player-2": deck.slice(16, 24),
        "player-3": deck.slice(24, 32),
      },
      bids: [],
      currentBid: 16,
      highestBidderPlayerId: "player-1",
      passedPlayerIds: [],
      declarerPlayerId: "player-1",
      biddingTeam: "B",
      trumpSuit: "hearts",
      trumpRevealed: false,
      currentTrick: [],
      completedTricks: [],
      roundNumber: 1,
      matchScore: { teamA: 0, teamB: 0 },
      targetScore: 6,
      ...defaultGameStateFields(),
    };

    const publicState = serializePublicState(state, "player-1");
    expect(publicState.trumpSuit).toBe("hearts");
  });

  it("only allows declarer to select trump", () => {
    expect(validateTrumpSelection("player-1", "player-1", "hearts").ok).toBe(true);
    expect(validateTrumpSelection("player-1", "player-0", "hearts").ok).toBe(false);
  });
});
