import { useGame } from "../context/GameContext";
import { getBidButtonValues } from "../constants";

export function BiddingPanel() {
  const {
    gameState,
    playerId,
    placeBid,
    passBid,
    requestRedeal,
    doubleBid,
    redoubleBid,
    passStakeMultiplier,
    loading,
  } = useGame();

  if (!gameState) {
    return null;
  }

  const myPlayer = gameState.players.find((player) => player.id === playerId);
  const isMyTurn =
    myPlayer !== undefined && gameState.currentTurnSeat === myPlayer.seat;

  if (gameState.phase === "STAKE_MULTIPLIER") {
    return (
      <div className="table-overlay bidding-overlay">
        <div className="overlay-panel">
          <h2 className="overlay-title">Double / Redouble</h2>
          {isMyTurn ? (
            <div className="bid-grid">
              {gameState.canDouble ? (
                <button
                  type="button"
                  className="btn-primary btn-compact"
                  disabled={loading}
                  onClick={() => void doubleBid()}
                >
                  Double
                </button>
              ) : null}
              {gameState.canRedouble ? (
                <button
                  type="button"
                  className="btn-primary btn-compact"
                  disabled={loading}
                  onClick={() => void redoubleBid()}
                >
                  Redouble
                </button>
              ) : null}
              <button
                type="button"
                className="btn-secondary btn-compact"
                disabled={loading}
                onClick={() => void passStakeMultiplier()}
              >
                Pass
              </button>
            </div>
          ) : (
            <p className="overlay-copy">Waiting for stake decision…</p>
          )}
        </div>
      </div>
    );
  }

  if (gameState.phase !== "BIDDING") {
    return null;
  }

  const bidValues = getBidButtonValues(gameState.currentBid, {
    ruleProfileId: gameState.ruleProfileId,
  });
  const canPass = gameState.currentBid !== null || gameState.canRequestRedeal;

  return (
    <div className="table-overlay bidding-overlay">
      <div className="overlay-panel">
        <h2 className="overlay-title">Bidding</h2>
        {isMyTurn ? (
          <>
            <p className="overlay-copy">Your turn to bid.</p>
            <div className="bid-grid">
              {bidValues.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="btn-primary btn-compact"
                  disabled={loading}
                  onClick={() => void placeBid(value)}
                >
                  {value}
                </button>
              ))}
              {gameState.canRequestRedeal ? (
                <button
                  type="button"
                  className="btn-secondary btn-compact"
                  disabled={loading}
                  onClick={() => void requestRedeal()}
                >
                  Redeal
                </button>
              ) : null}
              {canPass && !gameState.canRequestRedeal ? (
                <button
                  type="button"
                  className="btn-secondary btn-compact"
                  disabled={loading}
                  onClick={() => void passBid()}
                >
                  Pass
                </button>
              ) : null}
              {gameState.canRequestRedeal ? (
                <button
                  type="button"
                  className="btn-secondary btn-compact"
                  disabled={loading}
                  onClick={() => void passBid()}
                >
                  Pass
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="overlay-copy">Waiting for another player to bid…</p>
        )}
      </div>
    </div>
  );
}
