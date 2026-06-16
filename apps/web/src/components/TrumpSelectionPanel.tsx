import type { Suit } from "@twenty-eight/shared";
import { useGame } from "../context/GameContext";
import { SUIT_LABELS } from "../constants";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

export function TrumpSelectionPanel() {
  const { gameState, playerId, selectTrump, loading } = useGame();
  if (!gameState || gameState.phase !== "TRUMP_SELECTION") {
    return null;
  }

  const isDeclarer = gameState.declarerPlayerId === playerId;

  return (
    <div className="card-panel">
      <h2 style={{ marginTop: 0 }}>Trump Selection</h2>
      {isDeclarer ? (
        <>
          <p>Choose your hidden trump suit.</p>
          <div className="suit-grid">
            {SUITS.map((suit) => (
              <button
                key={suit}
                type="button"
                className="btn-primary"
                disabled={loading}
                onClick={() => void selectTrump(suit)}
              >
                {SUIT_LABELS[suit]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p>Declarer is choosing trump…</p>
      )}
    </div>
  );
}
