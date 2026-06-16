import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicGameState, RoundResult, Seat, Suit, Team } from "@twenty-eight/shared";
import { clearSession, loadSession, saveSession } from "../storage/session";
import { disconnectSocket, emitWithAck, getSocket } from "./socketClient";

type AckResponse = {
  ok: boolean;
  error?: string;
  roomCode?: string;
  playerId?: string;
  sessionToken?: string;
};

export type GameSocketState = {
  connected: boolean;
  loading: boolean;
  roomCode: string | null;
  playerId: string | null;
  sessionToken: string | null;
  displayName: string;
  gameState: PublicGameState | null;
  roundResult: RoundResult | null;
  matchWinner: Team | null;
  error: string | null;
  screen: "home" | "lobby" | "game" | "rules";
};

const initialState: GameSocketState = {
  connected: false,
  loading: false,
  roomCode: null,
  playerId: null,
  sessionToken: null,
  displayName: "",
  gameState: null,
  roundResult: null,
  matchWinner: null,
  error: null,
  screen: "home",
};

export function useGameSocket() {
  const [state, setState] = useState<GameSocketState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const update = useCallback((patch: Partial<GameSocketState>) => {
    setState((current) => ({ ...current, ...patch }));
  }, []);

  const requestStateSync = useCallback(() => {
    void emitWithAck("request_state_sync").catch((error: Error) => {
      update({ error: error.message });
    });
  }, [update]);

  const bindSession = useCallback(
    (session: {
      roomCode: string;
      playerId: string;
      sessionToken: string;
      displayName: string;
    }) => {
      saveSession(session);
      update({
        roomCode: session.roomCode,
        playerId: session.playerId,
        sessionToken: session.sessionToken,
        displayName: session.displayName,
        screen: "lobby",
        error: null,
      });
    },
    [update]
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => update({ connected: true, error: null });
    const onDisconnect = () => update({ connected: false });
    const onError = (payload: { message?: string }) =>
      update({ error: payload.message ?? "Unknown error" });

    const onRoomStateUpdated = (payload: { state: PublicGameState }) => {
      const nextScreen =
        payload.state.phase === "LOBBY" ? "lobby" : ("game" as const);
      update({
        gameState: payload.state,
        screen: nextScreen,
        roundResult: payload.state.roundResult ?? stateRef.current.roundResult,
        error: null,
      });
    };

    const onGameStarted = () => {
      update({ screen: "game" });
      requestStateSync();
    };

    const onRoundCompleted = (payload: { result: RoundResult }) => {
      update({ roundResult: payload.result });
      requestStateSync();
    };

    const onMatchCompleted = (payload: { winner: Team }) => {
      update({ matchWinner: payload.winner });
      requestStateSync();
    };

    const handlers: Array<[string, (...args: never[]) => void]> = [
      ["connect", onConnect],
      ["disconnect", onDisconnect],
      ["error", onError],
      ["room_state_updated", onRoomStateUpdated],
      ["game_started", onGameStarted],
      ["hand_dealt", requestStateSync],
      ["bidding_updated", requestStateSync],
      ["trump_selected_hidden", requestStateSync],
      ["trump_revealed", requestStateSync],
      ["trick_updated", requestStateSync],
      ["trick_completed", requestStateSync],
      ["round_completed", onRoundCompleted],
      ["match_completed", onMatchCompleted],
      ["reconnect_success", requestStateSync],
    ];

    for (const [event, handler] of handlers) {
      socket.on(event, handler as never);
    }

    return () => {
      for (const [event, handler] of handlers) {
        socket.off(event, handler as never);
      }
    };
  }, [requestStateSync, update]);

  const createRoom = useCallback(
    async (displayName: string) => {
      update({ loading: true, error: null, displayName });
      try {
        const response = await emitWithAck<AckResponse>("create_room", { displayName });
        bindSession({
          roomCode: response.roomCode!,
          playerId: response.playerId!,
          sessionToken: response.sessionToken!,
          displayName,
        });
      } catch (error) {
        update({ error: error instanceof Error ? error.message : "Failed to create room" });
      } finally {
        update({ loading: false });
      }
    },
    [bindSession, update]
  );

  const joinRoom = useCallback(
    async (roomCode: string, displayName: string) => {
      update({ loading: true, error: null, displayName });
      try {
        const response = await emitWithAck<AckResponse>("join_room", {
          roomCode: roomCode.toUpperCase(),
          displayName,
        });
        bindSession({
          roomCode: response.roomCode!,
          playerId: response.playerId!,
          sessionToken: response.sessionToken!,
          displayName,
        });
      } catch (error) {
        update({ error: error instanceof Error ? error.message : "Failed to join room" });
      } finally {
        update({ loading: false });
      }
    },
    [bindSession, update]
  );

  const reconnect = useCallback(async () => {
    const stored = loadSession();
    if (!stored) {
      update({ error: "No saved session to reconnect" });
      return;
    }

    update({ loading: true, error: null, displayName: stored.displayName });
    try {
      const response = await emitWithAck<AckResponse>("join_room", {
        roomCode: stored.roomCode,
        playerId: stored.playerId,
        sessionToken: stored.sessionToken,
        displayName: stored.displayName,
      });
      bindSession({
        roomCode: response.roomCode ?? stored.roomCode,
        playerId: response.playerId ?? stored.playerId,
        sessionToken: response.sessionToken ?? stored.sessionToken,
        displayName: stored.displayName,
      });
      requestStateSync();
    } catch (error) {
      update({ error: error instanceof Error ? error.message : "Reconnect failed" });
    } finally {
      update({ loading: false });
    }
  }, [bindSession, requestStateSync, update]);

  const chooseSeat = useCallback(
    async (seat: Seat) => {
      update({ loading: true, error: null });
      try {
        await emitWithAck("choose_seat", { seat });
        requestStateSync();
      } catch (error) {
        update({ error: error instanceof Error ? error.message : "Failed to choose seat" });
      } finally {
        update({ loading: false });
      }
    },
    [requestStateSync, update]
  );

  const startGame = useCallback(async () => {
    update({ loading: true, error: null });
    try {
      await emitWithAck("start_game");
    } catch (error) {
      update({ error: error instanceof Error ? error.message : "Failed to start game" });
    } finally {
      update({ loading: false });
    }
  }, [update]);

  const placeBid = useCallback(
    async (value: number) => {
      update({ loading: true, error: null });
      try {
        await emitWithAck("place_bid", { value });
      } catch (error) {
        update({ error: error instanceof Error ? error.message : "Bid failed" });
      } finally {
        update({ loading: false });
      }
    },
    [update]
  );

  const passBid = useCallback(async () => {
    update({ loading: true, error: null });
    try {
      await emitWithAck("pass_bid");
    } catch (error) {
      update({ error: error instanceof Error ? error.message : "Pass failed" });
    } finally {
      update({ loading: false });
    }
  }, [update]);

  const selectTrump = useCallback(
    async (suit: Suit) => {
      update({ loading: true, error: null });
      try {
        await emitWithAck("select_trump", { suit });
      } catch (error) {
        update({ error: error instanceof Error ? error.message : "Trump selection failed" });
      } finally {
        update({ loading: false });
      }
    },
    [update]
  );

  const playCard = useCallback(
    async (cardId: string) => {
      update({ loading: true, error: null });
      try {
        await emitWithAck("play_card", { cardId });
      } catch (error) {
        update({ error: error instanceof Error ? error.message : "Play failed" });
      } finally {
        update({ loading: false });
      }
    },
    [update]
  );

  const startNextRound = useCallback(async () => {
    update({ loading: true, error: null, roundResult: null });
    try {
      await emitWithAck("start_next_round");
    } catch (error) {
      update({ error: error instanceof Error ? error.message : "Failed to start next round" });
    } finally {
      update({ loading: false });
    }
  }, [update]);

  const rematch = useCallback(async () => {
    update({ loading: true, error: null, matchWinner: null, roundResult: null, gameState: null });
    try {
      await emitWithAck("rematch");
      update({ screen: "lobby" });
      requestStateSync();
    } catch (error) {
      update({ error: error instanceof Error ? error.message : "Rematch failed" });
    } finally {
      update({ loading: false });
    }
  }, [requestStateSync, update]);

  const leaveRoom = useCallback(async () => {
    const current = stateRef.current;
    const inActiveGame =
      current.screen === "game" &&
      current.gameState?.phase !== "MATCH_OVER" &&
      current.gameState?.phase !== "LOBBY";

    update({ loading: true, error: null });
    try {
      await emitWithAck("leave_room");
      disconnectSocket();
      if (inActiveGame) {
        setState({
          ...initialState,
          displayName: current.displayName,
          connected: false,
        });
      } else {
        clearSession();
        setState({
          ...initialState,
          displayName: current.displayName,
          connected: false,
        });
      }
      getSocket().connect();
    } catch (error) {
      update({ error: error instanceof Error ? error.message : "Failed to leave room" });
    } finally {
      update({ loading: false });
    }
  }, [update]);

  const leaveToHome = useCallback(() => {
    clearSession();
    disconnectSocket();
    setState({ ...initialState });
    getSocket().connect();
  }, []);

  const storedSession = useMemo(() => loadSession(), [state.screen]);

  const isHost = useMemo(() => {
    if (!state.playerId || !state.gameState?.lobbyMembers) {
      return state.gameState?.players.some(
        (player) => player.id === state.playerId && player.isHost
      );
    }
    return state.gameState.lobbyMembers.some(
      (member) => member.id === state.playerId && member.isHost
    );
  }, [state.gameState, state.playerId]);

  return {
    ...state,
    storedSession,
    isHost: Boolean(isHost),
    setDisplayName: (displayName: string) => update({ displayName }),
    setScreen: (screen: GameSocketState["screen"]) => update({ screen }),
    createRoom,
    joinRoom,
    reconnect,
    chooseSeat,
    startGame,
    placeBid,
    passBid,
    selectTrump,
    playCard,
    startNextRound,
    rematch,
    leaveRoom,
    leaveToHome,
    clearError: () => update({ error: null }),
  };
}
