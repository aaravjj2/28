import { useGame } from "../context/GameContext";
import { getBidButtonValues } from "../constants";

export function BiddingPanel() {
  const { gameState, playerId, placeBid, passBid, loading } = useGame();
  if (!gameState || gameState.phase !== "BIDDING") {
    return null;
  }

  const myPlayer = gameState.players.find((player) => player.id === playerId);
  const isMyTurn =
    myPlayer !== undefined && gameState.currentTurnSeat === myPlayer.seat;
  const bidValues = getBidButtonValues(gameState.currentBid);
  const canPass = gameState.currentBid !== null;

  return (
    <div className="card-panel">
      <h2 style={{ marginTop: 0 }}>Bidding</h2>
      {isMyTurn ? (
        <>
          <p>Your turn to bid.</p>
          <div className="bid-grid">
            {bidValues.map((value) => (
              <button
                key={value}
                type="button"
                className="btn-primary"
                disabled={loading}
                onClick={() => void placeBid(value)}
              >
                Bid {value}
              </button>
            ))}
            {canPass ? (
              <button
                type="button"
                className="btn-secondary"
                disabled={loading}
                onClick={() => void passBid()}
              >
                Pass
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <p>Waiting for another player to bid…</p>
      )}
    </div>
  );
}
