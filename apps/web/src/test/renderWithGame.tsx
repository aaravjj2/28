import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import type { PublicGameState } from "@twenty-eight/shared";
import { GameSocketContext } from "../context/GameContext";
import type { GameSocketState } from "../socket/useGameSocket";

type MockGameOverrides = Partial<{
  connected: boolean;
  loading: boolean;
  roomCode: string | null;
  playerId: string | null;
  sessionToken: string | null;
  displayName: string;
  gameState: PublicGameState | null;
  roundResult: GameSocketState["roundResult"];
  matchWinner: GameSocketState["matchWinner"];
  error: string | null;
  screen: GameSocketState["screen"];
  isHost: boolean;
}>;

function createMockGame(overrides: MockGameOverrides = {}) {
  const baseState: GameSocketState = {
    connected: true,
    loading: false,
    roomCode: "ABCD12",
    playerId: "player-0",
    sessionToken: "token",
    displayName: "Alice",
    gameState: null,
    roundResult: null,
    matchWinner: null,
    error: null,
    screen: "home",
  };

  return {
    ...baseState,
    storedSession: null,
    isHost: false,
    setDisplayName: () => undefined,
    setScreen: () => undefined,
    createRoom: async () => undefined,
    joinRoom: async () => undefined,
    reconnect: async () => undefined,
    chooseSeat: async () => undefined,
    startGame: async () => undefined,
    placeBid: async () => undefined,
    passBid: async () => undefined,
    selectTrump: async () => undefined,
    playCard: async () => undefined,
    startNextRound: async () => undefined,
    rematch: async () => undefined,
    leaveRoom: async () => undefined,
    leaveToHome: () => undefined,
    clearError: () => undefined,
    ...overrides,
  };
}

export function renderWithGame(ui: ReactElement, overrides: MockGameOverrides = {}) {
  const value = createMockGame(overrides);
  return render(<GameSocketContext.Provider value={value}>{ui}</GameSocketContext.Provider>);
}

export function makeLobbyState(seatedCount: number): PublicGameState {
  const lobbyMembers = Array.from({ length: seatedCount }, (_, seat) => ({
    id: `player-${seat}`,
    displayName: `Player ${seat}`,
    seat: seat as 0 | 1 | 2 | 3,
    connected: true,
    isHost: seat === 0,
  }));

  return {
    phase: "LOBBY",
    dealerSeat: 0,
    currentTurnSeat: null,
    players: [],
    myHand: [],
    handCountsByPlayerId: {},
    bids: [],
    currentBid: null,
    highestBidderPlayerId: null,
    passedPlayerIds: [],
    declarerPlayerId: null,
    biddingTeam: null,
    trumpSuit: null,
    trumpRevealed: false,
    currentTrick: [],
    completedTricks: [],
    roundNumber: 0,
    matchScore: { teamA: 0, teamB: 0 },
    targetScore: 6,
    lobbyMembers,
  };
}

export function makePlayingState(legalCardIds?: string[]): PublicGameState {
  return {
    phase: "PLAYING_TRICKS",
    dealerSeat: 0,
    currentTurnSeat: 0,
    players: [
      {
        id: "player-0",
        displayName: "Alice",
        seat: 0,
        connected: true,
        isHost: true,
        team: "A",
      },
    ],
    myHand: [
      { id: "hearts-J", suit: "hearts", rank: "J", points: 3 },
      { id: "spades-7", suit: "spades", rank: "7", points: 0 },
    ],
    handCountsByPlayerId: { "player-0": 2 },
    bids: [],
    currentBid: 14,
    highestBidderPlayerId: "player-0",
    passedPlayerIds: [],
    declarerPlayerId: "player-0",
    biddingTeam: "A",
    trumpSuit: null,
    trumpRevealed: false,
    currentTrick: [],
    completedTricks: [],
    roundNumber: 1,
    matchScore: { teamA: 0, teamB: 0 },
    targetScore: 6,
    legalCardIds,
  };
}

export { createMockGame };
