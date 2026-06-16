import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { LobbyScreen } from "./LobbyScreen";
import { makeLobbyState, renderWithGame } from "../test/renderWithGame";

describe("LobbyScreen", () => {
  it("renders 4 seats", () => {
    renderWithGame(<LobbyScreen />, {
      screen: "lobby",
      roomCode: "ABCD12",
      playerId: "player-0",
      gameState: makeLobbyState(1),
      isHost: true,
    });

    expect(screen.getByText("Seat 0")).toBeInTheDocument();
    expect(screen.getByText("Seat 1")).toBeInTheDocument();
    expect(screen.getByText("Seat 2")).toBeInTheDocument();
    expect(screen.getByText("Seat 3")).toBeInTheDocument();
  });

  it("disables start button with fewer than 4 seated players", () => {
    renderWithGame(<LobbyScreen />, {
      screen: "lobby",
      roomCode: "ABCD12",
      playerId: "player-0",
      gameState: makeLobbyState(2),
      isHost: true,
    });

    expect(screen.getByRole("button", { name: "Start Game" })).toBeDisabled();
  });

  it("does not show active start button for non-host", () => {
    renderWithGame(<LobbyScreen />, {
      screen: "lobby",
      roomCode: "ABCD12",
      playerId: "player-1",
      gameState: makeLobbyState(4),
      isHost: false,
    });

    expect(screen.queryByRole("button", { name: "Start Game" })).not.toBeInTheDocument();
    expect(screen.getByText(/Waiting for host/i)).toBeInTheDocument();
  });
});
