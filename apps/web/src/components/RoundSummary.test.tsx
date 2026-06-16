import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { RoundSummary } from "./RoundSummary";
import { renderWithGame } from "../test/renderWithGame";

describe("RoundSummary", () => {
  it("displays scoring fields from server round result", () => {
    renderWithGame(<RoundSummary />, {
      screen: "game",
      playerId: "player-0",
      isHost: true,
      gameState: {
        phase: "ROUND_SCORING",
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
        roundResult: {
          biddingTeam: "A",
          bid: 16,
          declarerSeat: 0,
          teamAPoints: 18,
          teamBPoints: 10,
          biddingTeamWon: true,
          matchPointWinner: "A",
        },
      },
      roundResult: {
        biddingTeam: "A",
        bid: 16,
        declarerSeat: 0,
        teamAPoints: 18,
        teamBPoints: 10,
        biddingTeamWon: true,
        matchPointWinner: "A",
      },
    });

    expect(screen.getByText("16")).toBeInTheDocument();
    expect(screen.getByText("Bidding team").closest(".meta-box")).toHaveTextContent("Team A");
    expect(screen.getByText("Team A points").closest(".meta-box")).toHaveTextContent("18");
    expect(screen.getByText("Team B points").closest(".meta-box")).toHaveTextContent("10");
    expect(screen.getByRole("button", { name: "Start Next Round" })).toBeInTheDocument();
  });
});
