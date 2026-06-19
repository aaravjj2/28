import { describe, expect, it } from "vitest";
import {
  createThaniState,
  evaluateThaniResult,
  getThaniTrickPlayerCount,
  validateThaniDeclaration,
} from "./thani";
import type { Trick } from "./types";

describe("thani", () => {
  it("allows declarer to declare before first trick", () => {
    expect(
      validateThaniDeclaration({
        thaniEnabled: true,
        thaniAlreadyDeclared: false,
        declarerSeat: 1,
        seat: 1,
        phase: "THANI_DECLARATION",
      }).ok
    ).toBe(true);
  });

  it("rejects thani when disabled", () => {
    expect(
      validateThaniDeclaration({
        thaniEnabled: false,
        thaniAlreadyDeclared: false,
        declarerSeat: 1,
        seat: 1,
        phase: "THANI_DECLARATION",
      }).ok
    ).toBe(false);
  });

  it("uses three-card tricks when partner sits out", () => {
    const thani = createThaniState(1);
    expect(getThaniTrickPlayerCount(thani)).toBe(3);
    expect(getThaniTrickPlayerCount(null)).toBe(4);
  });

  it("detects declarer winning all eight tricks alone", () => {
    const tricks: Trick[] = Array.from({ length: 8 }, (_, i) => ({
      trickNumber: i + 1,
      ledSuit: "hearts",
      playedCards: [
        { playerId: "p1", seat: 1, card: { id: `c${i}`, suit: "hearts", rank: "7", points: 0, strength: 1 } },
        { playerId: "p2", seat: 2, card: { id: `d${i}`, suit: "hearts", rank: "8", points: 0, strength: 2 } },
        { playerId: "p3", seat: 3, card: { id: `e${i}`, suit: "hearts", rank: "Q", points: 0, strength: 3 } },
        { playerId: "p0", seat: 0, card: { id: `f${i}`, suit: "hearts", rank: "K", points: 0, strength: 4 } },
      ],
      winnerPlayerId: "p1",
      winnerTeam: "B",
      points: 0,
    }));

    expect(evaluateThaniResult(tricks, 1)).toBe(true);
  });
});
