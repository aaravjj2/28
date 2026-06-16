import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { makePlayingState, renderWithGame } from "../test/renderWithGame";

describe("GameScreen trump status", () => {
  it("shows trump hidden when trump is not exposed", () => {
    renderWithGame(<GameScreen />, {
      screen: "game",
      playerId: "player-0",
      gameState: makePlayingState(),
    });
    expect(screen.getByText("Trump hidden")).toBeInTheDocument();
  });

  it("shows revealed trump only when public state includes trump suit", () => {
    renderWithGame(<GameScreen />, {
      screen: "game",
      playerId: "player-0",
      gameState: {
        ...makePlayingState(),
        trumpSuit: "hearts",
        trumpRevealed: true,
      },
    });
    expect(screen.getByText(/Trump: Hearts/)).toBeInTheDocument();
  });
});
