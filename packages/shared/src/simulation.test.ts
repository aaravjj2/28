import { describe, expect, it } from "vitest";
import { runSimulation, simulateRound } from "./simulation";
import { CARDS_PER_PLAYER, TRICK_COUNT } from "./types";

describe("simulation", () => {
  it("plays one deterministic round", () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const report = simulateRound(0, random);
    expect(report.tricksPlayed).toBe(TRICK_COUNT);
    expect(report.playedCardIds).toHaveLength(32);
    expect(new Set(report.playedCardIds).size).toBe(32);
    expect(report.result.teamAPoints + report.result.teamBPoints).toBe(28);
    expect(report.result.matchPointWinner).not.toBeNull();

    for (const seat of [0, 1, 2, 3] as const) {
      expect(report.cardsPlayedPerSeat[seat]).toBe(CARDS_PER_PLAYER);
      expect(report.hands[seat]).toHaveLength(CARDS_PER_PLAYER);
    }
  });

  it("passes 1,000 random legal rounds", () => {
    expect(() => runSimulation(1000)).not.toThrow();
  });
});
