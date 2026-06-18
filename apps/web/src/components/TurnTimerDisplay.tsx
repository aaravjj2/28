import { useEffect, useState } from "react";
import { useGame } from "../context/GameContext";

type TurnTimerDisplayProps = {
  compact?: boolean;
};

export function TurnTimerDisplay({ compact = false }: TurnTimerDisplayProps) {
  const { gameState } = useGame();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!gameState?.turnDeadlineAt) {
      setSecondsLeft(null);
      return;
    }

    const tick = () => {
      const deadline = new Date(gameState.turnDeadlineAt!).getTime();
      setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [gameState?.turnDeadlineAt]);

  if (secondsLeft === null) {
    return null;
  }

  if (compact) {
    return (
      <div className="info-row">
        <span className="info-label">Timer</span>
        <span className="info-value">{secondsLeft}s</span>
      </div>
    );
  }

  return (
    <div className="meta-box">
      <strong>Turn timer</strong>
      <div>Turn timer: {secondsLeft}s</div>
    </div>
  );
}
