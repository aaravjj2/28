import { useGame } from "../context/GameContext";
import { SUIT_LABELS } from "../constants";

export function RoundSummary() {
  const { gameState, roundResult, isHost, startNextRound, loading } = useGame();
  if (!gameState || gameState.phase !== "ROUND_SCORING") {
    return null;
  }

  const result = roundResult ?? gameState.roundResult;
  if (!result) {
    return (
      <div className="card-panel">
        <h2 style={{ marginTop: 0 }}>Round Summary</h2>
        <p>Waiting for round results from server…</p>
      </div>
    );
  }

  return (
    <div className="card-panel">
      <h2 style={{ marginTop: 0 }}>Round Summary</h2>
      <div className="table-meta">
        <div className="meta-box">
          <strong>Bid</strong>
          <div>{result.bid}</div>
        </div>
        <div className="meta-box">
          <strong>Bidding team</strong>
          <div>Team {result.biddingTeam}</div>
        </div>
        <div className="meta-box">
          <strong>Team A points</strong>
          <div>{result.teamAPoints}</div>
        </div>
        <div className="meta-box">
          <strong>Team B points</strong>
          <div>{result.teamBPoints}</div>
        </div>
        <div className="meta-box">
          <strong>Round winner</strong>
          <div>Team {result.matchPointWinner}</div>
        </div>
        <div className="meta-box">
          <strong>Match score</strong>
          <div>
            A {gameState.matchScore.teamA} — B {gameState.matchScore.teamB}
          </div>
        </div>
      </div>

      {isHost ? (
        <button
          type="button"
          className="btn-primary"
          style={{ marginTop: "1rem" }}
          disabled={loading}
          onClick={() => void startNextRound()}
        >
          Start Next Round
        </button>
      ) : (
        <p style={{ marginTop: "1rem" }}>Waiting for host to start the next round…</p>
      )}
    </div>
  );
}

export function MatchOverScreen() {
  const { gameState, matchWinner, isHost, rematch, loading } = useGame();
  if (!gameState || gameState.phase !== "MATCH_OVER") {
    return null;
  }

  const winner = matchWinner ?? (gameState.matchScore.teamA >= gameState.targetScore ? "A" : "B");

  return (
    <div className="card-panel">
      <h2 style={{ marginTop: 0 }}>Match Over</h2>
      <p style={{ fontSize: "1.25rem", fontWeight: 700 }}>Team {winner} wins!</p>
      <p>
        Final score: Team A {gameState.matchScore.teamA} — Team B {gameState.matchScore.teamB}
      </p>
      {isHost ? (
        <button type="button" className="btn-primary" disabled={loading} onClick={() => void rematch()}>
          Rematch
        </button>
      ) : (
        <p>Waiting for host to start a rematch…</p>
      )}
    </div>
  );
}

export function TrumpStatus() {
  const { gameState } = useGame();
  if (!gameState) {
    return null;
  }

  if (gameState.trumpRevealed && gameState.trumpSuit) {
    return <span>Trump: {SUIT_LABELS[gameState.trumpSuit]}</span>;
  }

  if (gameState.trumpSuit && !gameState.trumpRevealed) {
    return <span>Trump: hidden (declarer only)</span>;
  }

  return <span>Trump hidden</span>;
}
