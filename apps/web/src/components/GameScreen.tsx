import type { PublicGameState, PublicPlayer, Seat } from "@twenty-eight/shared";
import { useGame } from "../context/GameContext";
import { seatToTablePosition, teamForSeat, type TablePosition } from "../constants";
import { BiddingPanel } from "./BiddingPanel";
import { CardBack, CardView } from "./CardView";
import { ConnectionStatus } from "./ConnectionStatus";
import { ErrorBanner } from "./ErrorBanner";
import { GameInfoPanel } from "./GameInfoPanel";
import { MatchOverScreen, RoundSummary } from "./RoundSummary";
import { PlayerHand } from "./PlayerHand";
import { TrumpSelectionPanel } from "./TrumpSelectionPanel";
import { ThaniDeclarationPanel } from "./ThaniDeclarationPanel";

const SEATS: Seat[] = [0, 1, 2, 3];

type SeatSlotProps = {
  position: TablePosition;
  player: PublicPlayer | undefined;
  gameState: PublicGameState;
  isCurrent: boolean;
  isMe: boolean;
};

function SeatSlot({ position, player, gameState, isCurrent, isMe }: SeatSlotProps) {
  const handCount = player ? (gameState.handCountsByPlayerId[player.id] ?? 0) : 0;
  const showCardBacks = handCount > 0 && !isMe && gameState.phase === "PLAYING_TRICKS";

  return (
    <div className={`table-seat seat-${position} ${isCurrent ? "current-turn" : ""} ${isMe ? "is-me" : ""}`}>
      <div className="seat-nameplate">
        <span className={`team-dot team-${player ? teamForSeat(player.seat).toLowerCase() : "empty"}`} />
        <span className="seat-name">{player?.displayName ?? "Empty"}</span>
        {player?.isBot ? <span className="seat-badge">BOT</span> : null}
        {!player?.connected && player ? <span className="seat-badge offline">OFF</span> : null}
      </div>
      {showCardBacks ? (
        <div className="opponent-hand" aria-label={`${player?.displayName ?? "Player"} hand`}>
          {Array.from({ length: Math.min(handCount, 8) }, (_, index) => (
            <CardBack key={index} size="sm" className="opponent-card" />
          ))}
        </div>
      ) : handCount > 0 && !isMe ? (
        <div className="seat-card-count">{handCount} cards</div>
      ) : null}
    </div>
  );
}

export function GameScreen() {
  const { gameState, playerId, playCard, loading, leaveRoom } = useGame();
  if (!gameState) {
    return (
      <div className="page">
        <p>Loading game…</p>
      </div>
    );
  }

  const myPlayer = gameState.players.find((player) => player.id === playerId);
  const mySeat = myPlayer?.seat ?? 0;
  const isMyTurn =
    myPlayer !== undefined && gameState.currentTurnSeat === myPlayer.seat;

  const seatLayout = SEATS.map((seat) => ({
    seat,
    position: seatToTablePosition(mySeat, seat),
    player: gameState.players.find((entry) => entry.seat === seat),
    isCurrent: gameState.currentTurnSeat === seat,
    isMe: seat === mySeat,
  }));

  return (
    <div className="game-page" data-testid="game-phase" data-phase={gameState.phase}>
      <header className="game-header">
        <h1 className="game-title">Table</h1>
        <div className="game-header-actions">
          <ConnectionStatus />
          <button
            type="button"
            className="btn-secondary btn-compact"
            disabled={loading}
            onClick={() => void leaveRoom()}
          >
            Leave
          </button>
        </div>
      </header>

      <ErrorBanner />
      {loading ? <p className="waiting-banner">Waiting for server…</p> : null}

      <div className="felt-table-wrapper">
        <GameInfoPanel />

        <div className="felt-table" role="region" aria-label="Game table">
          <div className="felt-rail" />

          {seatLayout.map(({ seat, position, player, isCurrent, isMe }) => (
            <SeatSlot
              key={seat}
              position={position}
              player={player}
              gameState={gameState}
              isCurrent={isCurrent}
              isMe={isMe}
            />
          ))}

          <div className="trick-center" aria-label="Current trick">
            {gameState.currentTrick.length === 0 ? (
              <span className="trick-empty">Trick</span>
            ) : (
              gameState.currentTrick.map((play) => {
                const position = seatToTablePosition(mySeat, play.seat);
                const playerName =
                  gameState.players.find((entry) => entry.id === play.playerId)?.displayName ??
                  `Seat ${play.seat}`;
                return (
                  <div
                    key={`${play.playerId}-${play.card.id}`}
                    className={`trick-card trick-from-${position}`}
                  >
                    {play.concealed ? (
                      <CardBack size="md" />
                    ) : (
                      <CardView card={play.card} size="md" />
                    )}
                    <span className="trick-player-label">{playerName}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <BiddingPanel />
        <TrumpSelectionPanel />
        <ThaniDeclarationPanel />
        <RoundSummary />
        <MatchOverScreen />

        {gameState.phase === "PLAYING_TRICKS" ? (
          <div className="player-hand-zone">
            {!isMyTurn ? <p className="hand-waiting">Waiting for your turn…</p> : null}
            <PlayerHand
              hand={gameState.myHand}
              concealedTrumpCard={gameState.myConcealedTrumpCard}
              legalCardIds={gameState.legalCardIds}
              disabled={!isMyTurn || loading}
              onPlayCard={(cardId) => void playCard(cardId)}
            />
          </div>
        ) : gameState.phase === "BIDDING" || gameState.phase === "TRUMP_SELECTION" ? (
          <div className="player-hand-zone preview">
            <PlayerHand
              hand={gameState.myHand}
              disabled
              onPlayCard={() => undefined}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
