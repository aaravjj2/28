import type { Seat } from "@twenty-eight/shared";
import { useGame } from "../context/GameContext";
import { seatLabel, teamForSeat } from "../constants";
import { BiddingPanel } from "./BiddingPanel";
import { CardView } from "./CardView";
import { ConnectionStatus } from "./ConnectionStatus";
import { ErrorBanner } from "./ErrorBanner";
import { MatchOverScreen, RoundSummary, TrumpStatus } from "./RoundSummary";
import { PlayerHand } from "./PlayerHand";
import { TrumpSelectionPanel } from "./TrumpSelectionPanel";

const SEATS: Seat[] = [0, 1, 2, 3];

export function GameScreen() {
  const { gameState, playerId, playCard, loading } = useGame();
  if (!gameState) {
    return (
      <div className="page">
        <p>Loading game…</p>
      </div>
    );
  }

  const myPlayer = gameState.players.find((player) => player.id === playerId);
  const isMyTurn =
    myPlayer !== undefined && gameState.currentTurnSeat === myPlayer.seat;

  return (
    <div className="page table-layout">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
        <h1 className="title" style={{ marginBottom: 0 }}>
          Table
        </h1>
        <ConnectionStatus />
      </div>

      <ErrorBanner />

      <div className="table-meta">
        <div className="meta-box">
          <strong>Phase</strong>
          <div>{gameState.phase}</div>
        </div>
        <div className="meta-box">
          <strong>Current turn</strong>
          <div>{gameState.currentTurnSeat === null ? "—" : seatLabel(gameState.currentTurnSeat)}</div>
        </div>
        <div className="meta-box">
          <strong>Current bid</strong>
          <div>{gameState.currentBid ?? "—"}</div>
        </div>
        <div className="meta-box">
          <strong>Trump</strong>
          <div>
            <TrumpStatus />
          </div>
        </div>
        <div className="meta-box">
          <strong>Match score</strong>
          <div>
            A {gameState.matchScore.teamA} — B {gameState.matchScore.teamB}
          </div>
        </div>
        <div className="meta-box">
          <strong>Tricks played</strong>
          <div>{gameState.completedTricks.length}</div>
        </div>
        {gameState.declarerPlayerId ? (
          <div className="meta-box">
            <strong>Declarer</strong>
            <div>
              {gameState.players.find((player) => player.id === gameState.declarerPlayerId)?.displayName ??
                "—"}
            </div>
          </div>
        ) : null}
      </div>

      <div className="seat-grid">
        {SEATS.map((seat) => {
          const player = gameState.players.find((entry) => entry.seat === seat);
          const isCurrent = gameState.currentTurnSeat === seat;
          const isMe = player?.id === playerId;
          return (
            <div
              key={seat}
              className={`seat-card ${isCurrent ? "current" : ""} ${isMe ? "mine" : ""}`}
            >
              <span className={`team-tag team-${teamForSeat(seat).toLowerCase()}`}>
                Team {teamForSeat(seat)}
              </span>
              <div style={{ fontWeight: 700 }}>{seatLabel(seat)}</div>
              <div>{player?.displayName ?? "Empty"}</div>
              {player ? (
                <div className={`status-pill ${player.connected ? "online" : "offline"}`}>
                  {player.connected ? "Connected" : "Disconnected"}
                </div>
              ) : null}
              <div style={{ marginTop: "0.35rem" }}>
                Cards: {player ? (gameState.handCountsByPlayerId[player.id] ?? 0) : 0}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card-panel">
        <h2 style={{ marginTop: 0 }}>Current trick</h2>
        <div className="trick-area">
          {gameState.currentTrick.length === 0 ? (
            <span>No cards played yet.</span>
          ) : (
            gameState.currentTrick.map((play) => (
              <div key={`${play.playerId}-${play.card.id}`} style={{ textAlign: "center" }}>
                <CardView card={play.card} />
                <div style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                  {gameState.players.find((player) => player.id === play.playerId)?.displayName ??
                    seatLabel(play.seat)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <BiddingPanel />
      <TrumpSelectionPanel />
      <RoundSummary />
      <MatchOverScreen />

      {gameState.phase === "PLAYING_TRICKS" ? (
        <div className="card-panel">
          <h2 style={{ marginTop: 0 }}>Your hand</h2>
          {!isMyTurn ? <p>Waiting for your turn…</p> : null}
          <PlayerHand
            hand={gameState.myHand}
            legalCardIds={gameState.legalCardIds}
            disabled={!isMyTurn || loading}
            onPlayCard={(cardId) => void playCard(cardId)}
          />
        </div>
      ) : null}
    </div>
  );
}
