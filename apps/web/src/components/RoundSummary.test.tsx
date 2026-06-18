import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { RoundSummary } from "./RoundSummary";
import { renderWithGame } from "../test/renderWithGame";
import { sampleRoundResult } from "../test/sampleRoundResult";

describe("RoundSummary", () => {
  it("displays scoring fields from server round result", () => {
    renderWithGame(<RoundSummary />, {
      screen: "game",
      playerId: "player-0",
      isHost: true,
      gameState: {
        phase: "ROUND_SCORING",
        ruleProfileId: "standard_28",
        thaniDeclared: false,
        pairStatus: { bidderPairDeclared: false, defenderPairDeclared: false, adjustedBidTarget: 16 },
        pointTracker: null,
        stakeLevel: "normal",
        stakeMultiplier: 1,
        honoursStakeResolved: null,
        redealEligible: false,
        canRequestRedeal: false,
        canDouble: false,
        canRedouble: false,
        dealerSeat: 0,
        currentTurnSeat: null,
        players: [],
        myHand: [],
        handCountsByPlayerId: {},
        bids: [],
        currentBid: 16,
        highestBidderPlayerId: "player-0",
        passedPlayerIds: [],
        declarerPlayerId: "player-0",
        biddingTeam: "A",
        trumpSuit: "hearts",
        trumpRevealed: true,
        currentTrick: [],
        completedTricks: [],
        roundNumber: 1,
        matchScore: { teamA: 1, teamB: 0 },
        targetScore: 6,
        roundResult: sampleRoundResult,
      },
      roundResult: sampleRoundResult,
    });

    expect(screen.getByText("16")).toBeInTheDocument();
    expect(screen.getByText("Bidding team").closest(".meta-box")).toHaveTextContent("Team A");
    expect(screen.getByText("Team A points").closest(".meta-box")).toHaveTextContent("18");
    expect(screen.getByText("Team B points").closest(".meta-box")).toHaveTextContent("10");
    expect(screen.getByRole("button", { name: "Start Next Round" })).toBeInTheDocument();
  });
});
