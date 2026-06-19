import { useGame } from "../context/GameContext";
import { SUIT_LABELS } from "../constants";
import { TurnTimerDisplay } from "./TurnTimerDisplay";

function formatStakeLevel(level: string | null | undefined): string {
  if (!level) {
    return "—";
  }
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function GameInfoPanel() {
  const { gameState, playerId, declarePair, loading } = useGame();
  if (!gameState) {
    return null;
  }

  const tracker = gameState.pointTracker;
  const pair = gameState.pairStatus;

  let trumpLabel = "Trump hidden";
  if (gameState.trumpRevealed && gameState.trumpSuit) {
    trumpLabel = `Trump: ${SUIT_LABELS[gameState.trumpSuit]}`;
  } else if (gameState.trumpSuit && !gameState.trumpRevealed) {
    trumpLabel = "Trump: hidden (declarer only)";
  }

  return (
    <aside className="game-info-panel" aria-label="Game information">
      <div className="info-row">
        <span className="info-label">Bid</span>
        <span className="info-value">{gameState.currentBid ?? "—"}</span>
      </div>
      <div className="info-row info-row-trump">
        <span className="info-value trump-status">{trumpLabel}</span>
      </div>
      <div className="info-row">
        <span className="info-label">Stake</span>
        <span className="info-value">{formatStakeLevel(gameState.stakeLevel)}</span>
      </div>
      {tracker ? (
        <>
          <div className="info-row">
            <span className="info-label">Target</span>
            <span className="info-value">{tracker.adjustedBidTarget}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Captured</span>
            <span className="info-value">
              {tracker.biddingTeamCaptured} / {tracker.defendingTeamCaptured}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Remaining</span>
            <span className="info-value">{tracker.pointsRemaining}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Stake pts</span>
            <span className="info-value">
              +{tracker.stakeIfWin} / −{tracker.stakeIfLose}
            </span>
          </div>
        </>
      ) : null}
      <div className="info-row">
        <span className="info-label">Pair</span>
        <span className="info-value">
          {pair.bidderPairDeclared ? "Bidder" : "—"}
          {pair.defenderPairDeclared ? " · Defender" : ""}
        </span>
      </div>
      <div className="info-row">
        <span className="info-label">Match</span>
        <span className="info-value">
          A {gameState.matchScore.teamA} — B {gameState.matchScore.teamB}
        </span>
      </div>
      <TurnTimerDisplay compact />

      {gameState.canDeclarePair ? (
        <div className="info-actions">
          <button
            type="button"
            className="btn-primary btn-compact"
            disabled={loading}
            onClick={() => void declarePair()}
          >
            Declare Pair
          </button>
        </div>
      ) : null}
    </aside>
  );
}
