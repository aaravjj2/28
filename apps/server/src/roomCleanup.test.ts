import { describe, expect, it } from "vitest";
import type { Room } from "./roomManager";
import { cleanupStaleRooms, EMPTY_LOBBY_TTL_MS, INACTIVE_ROOM_TTL_MS, shouldDeleteRoom } from "./roomCleanup";

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    code: "TEST01",
    hostPlayerId: "p1",
    locked: false,
    players: new Map(),
    seats: { 0: null, 1: null, 2: null, 3: null },
    game: null,
    joinOrder: [],
    lastActivityAt: Date.now(),
    turnDeadlineAt: null,
    matchTargetScore: 6,
    ...overrides,
  };
}

describe("roomCleanup", () => {
  it("deletes empty lobby rooms after 15 minutes", () => {
    const now = Date.now();
    const room = makeRoom({ lastActivityAt: now - EMPTY_LOBBY_TTL_MS - 1 });
    expect(shouldDeleteRoom(room, now)).toBe(true);
  });

  it("keeps active bidding rooms", () => {
    const room = makeRoom({
      locked: true,
      game: {
        state: {
          phase: "BIDDING",
          dealerSeat: 0,
          currentTurnSeat: 0,
          players: [],
          handsByPlayerId: {},
          bids: [],
          currentBid: null,
          highestBidderPlayerId: null,
          passedPlayerIds: [],
          declarerPlayerId: null,
          biddingTeam: null,
          trumpSuit: null,
          trumpRevealed: false,
          currentTrick: [],
          completedTricks: [],
          roundNumber: 1,
          matchScore: { teamA: 0, teamB: 0 },
          targetScore: 6,
        },
        deck: [],
        roundHands: { 0: [], 1: [], 2: [], 3: [] },
        biddingState: null,
        playState: null,
        lastRoundResult: null,
      },
    });
    expect(shouldDeleteRoom(room)).toBe(false);
  });

  it("deletes completed match rooms after 2 hours", () => {
    const now = Date.now();
    const room = makeRoom({
      locked: true,
      lastActivityAt: now - INACTIVE_ROOM_TTL_MS - 1,
      game: {
        state: {
          phase: "MATCH_OVER",
          dealerSeat: 0,
          currentTurnSeat: null,
          players: [],
          handsByPlayerId: {},
          bids: [],
          currentBid: null,
          highestBidderPlayerId: null,
          passedPlayerIds: [],
          declarerPlayerId: null,
          biddingTeam: null,
          trumpSuit: null,
          trumpRevealed: false,
          currentTrick: [],
          completedTricks: [],
          roundNumber: 1,
          matchScore: { teamA: 1, teamB: 0 },
          targetScore: 1,
        },
        deck: [],
        roundHands: { 0: [], 1: [], 2: [], 3: [] },
        biddingState: null,
        playState: null,
        lastRoundResult: null,
      },
    });
    expect(shouldDeleteRoom(room, now)).toBe(true);
  });

  it("removes stale rooms from the map", () => {
    const rooms = new Map<string, Room>();
    const now = Date.now();
    rooms.set("OLD", makeRoom({ lastActivityAt: now - EMPTY_LOBBY_TTL_MS - 1 }));
    rooms.set("NEW", makeRoom({ lastActivityAt: now }));
    const deleted = cleanupStaleRooms(rooms, now);
    expect(deleted).toEqual(["OLD"]);
    expect(rooms.has("OLD")).toBe(false);
    expect(rooms.has("NEW")).toBe(true);
  });
});
