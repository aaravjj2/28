import type { Seat } from "@twenty-eight/shared";
import { useGame } from "../context/GameContext";
import { seatLabel, teamForSeat } from "../constants";
import { ConnectionStatus } from "./ConnectionStatus";
import { ErrorBanner } from "./ErrorBanner";

const SEATS: Seat[] = [0, 1, 2, 3];

export function LobbyScreen() {
  const {
    roomCode,
    playerId,
    gameState,
    chooseSeat,
    startGame,
    isHost,
    loading,
    leaveToHome,
  } = useGame();

  const members = gameState?.lobbyMembers ?? [];
  const seatedCount = members.filter((member) => member.seat !== null).length;
  const canStart = seatedCount === 4;

  async function copyRoomCode() {
    if (!roomCode) {
      return;
    }
    await navigator.clipboard.writeText(roomCode);
  }

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
        <h1 className="title">Lobby</h1>
        <ConnectionStatus />
      </div>

      <ErrorBanner />

      <div className="card-panel">
        <div className="meta-box" style={{ marginBottom: "1rem" }}>
          <strong>Room code</strong>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "1.5rem", fontWeight: 800 }}>{roomCode}</span>
            <button type="button" className="btn-secondary" onClick={() => void copyRoomCode()}>
              Copy invite code
            </button>
          </div>
        </div>

        <p className="subtitle" style={{ marginBottom: "1rem" }}>
          Team A: Seat 0 + Seat 2 · Team B: Seat 1 + Seat 3
        </p>

        <div className="seat-grid">
          {SEATS.map((seat) => {
            const occupant = members.find((member) => member.seat === seat);
            const isMine = occupant?.id === playerId;

            return (
              <div
                key={seat}
                className={`seat-card ${occupant ? "occupied" : ""} ${isMine ? "mine" : ""}`}
              >
                <span className={`team-tag team-${teamForSeat(seat).toLowerCase()}`}>
                  Team {teamForSeat(seat)}
                </span>
                <div style={{ fontWeight: 700 }}>{seatLabel(seat)}</div>
                <div style={{ marginTop: "0.35rem" }}>
                  {occupant ? (
                    <>
                      <div>{occupant.displayName}</div>
                      <div className={`status-pill ${occupant.connected ? "online" : "offline"}`}>
                        {occupant.connected ? "Connected" : "Disconnected"}
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={loading}
                      onClick={() => void chooseSeat(seat)}
                    >
                      Take seat
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: "1.25rem" }}>
          {isHost ? (
            <button
              type="button"
              className="btn-primary"
              disabled={!canStart || loading}
              onClick={() => void startGame()}
            >
              Start Game
            </button>
          ) : (
            <p>Waiting for host to start the game…</p>
          )}
          {!canStart ? <p style={{ color: "#d5e8df" }}>All 4 seats must be filled.</p> : null}
        </div>

        <div className="button-row" style={{ marginTop: "1rem" }}>
          <button type="button" className="btn-secondary" onClick={leaveToHome}>
            Leave room
          </button>
        </div>
      </div>
    </div>
  );
}
