import { useState } from "react";
import type { Suit } from "@twenty-eight/shared";
import { useGame } from "../context/GameContext";
import { SUIT_LABELS } from "../constants";
import { PlayerHand } from "./PlayerHand";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

export function TrumpSelectionPanel() {
  const { gameState, playerId, selectTrump, loading } = useGame();
  const [selectedSuit, setSelectedSuit] = useState<Suit | null>(null);

  if (!gameState || gameState.phase !== "TRUMP_SELECTION") {
    return null;
  }

  const isDeclarer = gameState.declarerPlayerId === playerId;

  const handleConfirm = (cardId: string) => {
    if (!selectedSuit) {
      return;
    }
    void selectTrump(selectedSuit, cardId);
  };

  return (
    <div className="table-overlay trump-overlay">
      <div className="overlay-panel">
        <h2 className="overlay-title">Trump Selection</h2>
        {isDeclarer ? (
          selectedSuit === null ? (
            <>
              <p className="overlay-copy">Choose your trump suit.</p>
              <div className="suit-grid">
                {SUITS.map((suit) => (
                  <button
                    key={suit}
                    type="button"
                    className="btn-primary"
                    disabled={loading}
                    onClick={() => setSelectedSuit(suit)}
                  >
                    {SUIT_LABELS[suit]}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="overlay-copy">
                Pick a {SUIT_LABELS[selectedSuit]} card to conceal as trump.
              </p>
              <button
                type="button"
                className="btn-secondary btn-compact"
                disabled={loading}
                onClick={() => setSelectedSuit(null)}
              >
                Change suit
              </button>
              <PlayerHand
                hand={gameState.myHand}
                suitFilter={selectedSuit}
                disabled={loading}
                onPlayCard={() => undefined}
                onSelectCard={handleConfirm}
              />
            </>
          )
        ) : (
          <p className="overlay-copy">Declarer is choosing trump…</p>
        )}
      </div>
    </div>
  );
}
