import { GameSocketProvider, useGame } from "./context/GameContext";
import { HomeScreen } from "./components/HomeScreen";
import { LobbyScreen } from "./components/LobbyScreen";
import { GameScreen } from "./components/GameScreen";
import { RulesScreen } from "./components/RulesScreen";
import "./app.css";

function AppRoutes() {
  const { screen } = useGame();

  switch (screen) {
    case "lobby":
      return <LobbyScreen />;
    case "game":
      return <GameScreen />;
    case "rules":
      return <RulesScreen />;
    default:
      return <HomeScreen />;
  }
}

export default function App() {
  return (
    <div className="app-shell">
      <GameSocketProvider>
        <AppRoutes />
      </GameSocketProvider>
    </div>
  );
}
