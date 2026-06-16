import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlayerHand } from "./PlayerHand";

describe("PlayerHand", () => {
  const hand = [
    { id: "hearts-J", suit: "hearts" as const, rank: "J" as const, points: 3 },
    { id: "spades-7", suit: "spades" as const, rank: "7" as const, points: 0 },
  ];

  it("renders only cards from public state", () => {
    render(
      <PlayerHand hand={hand} legalCardIds={["hearts-J"]} onPlayCard={() => undefined} />
    );
    expect(screen.getByLabelText(/J of hearts/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/7 of spades/i)).toBeInTheDocument();
  });

  it("disables illegal cards when legalCardIds is provided", () => {
    render(
      <PlayerHand hand={hand} legalCardIds={["hearts-J"]} onPlayCard={() => undefined} />
    );
    expect(screen.getByLabelText(/J of hearts/i)).toBeEnabled();
    expect(screen.getByLabelText(/7 of spades/i)).toBeDisabled();
  });

  it("allows clicking legal cards", () => {
    const onPlayCard = vi.fn();
    render(
      <PlayerHand hand={hand} legalCardIds={["hearts-J"]} onPlayCard={onPlayCard} />
    );
    fireEvent.click(screen.getByLabelText(/J of hearts/i));
    expect(onPlayCard).toHaveBeenCalledWith("hearts-J");
  });
});
