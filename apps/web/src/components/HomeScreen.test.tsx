import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { HomeScreen } from "../components/HomeScreen";
import { renderWithGame } from "../test/renderWithGame";

describe("HomeScreen", () => {
  it("renders create and join controls", () => {
    renderWithGame(<HomeScreen />, { displayName: "Alice" });
    expect(screen.getByRole("button", { name: "Create Room" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join Room" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Rules" })).toBeInTheDocument();
  });
});
