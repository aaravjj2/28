import { useGame } from "../context/GameContext";

export function ErrorBanner() {
  const { error, clearError } = useGame();
  if (!error) {
    return null;
  }

  return (
    <div className="error-banner" role="alert">
      <div>{error}</div>
      <button type="button" className="btn-secondary" onClick={clearError} style={{ marginTop: "0.5rem" }}>
        Dismiss
      </button>
    </div>
  );
}
