import { useGame } from "../context/GameContext";

export function ConnectionStatus() {
  const { connected } = useGame();
  return (
    <span className={`status-pill ${connected ? "online" : "offline"}`}>
      {connected ? "Connected" : "Disconnected"}
    </span>
  );
}
