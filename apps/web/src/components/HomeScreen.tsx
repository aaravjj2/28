import { useState } from "react";
import { useGame } from "../context/GameContext";
import { ConnectionStatus } from "./ConnectionStatus";
import { ErrorBanner } from "./ErrorBanner";

export function HomeScreen() {
  const {
    displayName,
    setDisplayName,
    createRoom,
    joinRoom,
    reconnect,
    storedSession,
    loading,
    setScreen,
  } = useGame();
  const [roomCode, setRoomCode] = useState("");

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
        <h1 className="title">28</h1>
        <ConnectionStatus />
      </div>
      <p className="subtitle">Online multiplayer Indian card game</p>

      <ErrorBanner />

      <div className="card-panel">
        <div className="field">
          <label htmlFor="displayName">Your name</label>
          <input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Enter your name"
          />
        </div>

        <div className="button-row">
          <button
            type="button"
            className="btn-primary"
            disabled={!displayName.trim() || loading}
            onClick={() => void createRoom(displayName.trim())}
          >
            Create Room
          </button>
        </div>

        <div className="field" style={{ marginTop: "1.25rem" }}>
          <label htmlFor="roomCode">Room code</label>
          <input
            id="roomCode"
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            placeholder="ABCD12"
          />
        </div>

        <div className="button-row">
          <button
            type="button"
            className="btn-secondary"
            disabled={!displayName.trim() || !roomCode.trim() || loading}
            onClick={() => void joinRoom(roomCode.trim(), displayName.trim())}
          >
            Join Room
          </button>
        </div>

        {storedSession ? (
          <div className="button-row" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={loading}
              onClick={() => void reconnect()}
            >
              Reconnect to {storedSession.roomCode}
            </button>
          </div>
        ) : null}

        <div className="button-row" style={{ marginTop: "1.25rem" }}>
          <button type="button" className="btn-secondary" onClick={() => setScreen("rules")}>
            View Rules
          </button>
        </div>
      </div>
    </div>
  );
}
