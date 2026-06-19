import { useGame } from "../context/GameContext";

export function ThaniDeclarationPanel() {
  const { gameState, playerId, declareThani, skipThani, loading } = useGame();

  if (!gameState || gameState.phase !== "THANI_DECLARATION") {
    return null;
  }

  const isDeclarer = gameState.declarerPlayerId === playerId;

  return (
    <div className="table-overlay thani-overlay">
      <div className="overlay-panel">
        <h2 className="overlay-title">Single Hand (Thani)</h2>
        {isDeclarer ? (
          <>
            <p className="overlay-copy">
              Win all eight tricks yourself with no trump. Your partner sits out. +4 / −5 match
              points.
            </p>
            <div className="bid-grid">
              <button
                type="button"
                className="btn-primary btn-compact"
                disabled={loading || !gameState.canDeclareThani}
                onClick={() => void declareThani()}
              >
                Declare Thani
              </button>
              <button
                type="button"
                className="btn-secondary btn-compact"
                disabled={loading}
                onClick={() => void skipThani()}
              >
                Play normally
              </button>
            </div>
          </>
        ) : (
          <p className="overlay-copy">Declarer is deciding whether to play Thani…</p>
        )}
      </div>
    </div>
  );
}
