import {
  applyBidAction,
  applyMatchScore,
  applyPlayAction,
  createBiddingState,
  createPlayState,
  createShuffledDeck,
  dealInitialRound,
  dealRemainingRound,
  DEFAULT_TARGET_SCORE,
  getLegalBidActions,
  getLegalMoves,
  getLegalPlayMoves,
  getMatchWinner,
  isMatchOver,
  scoreRound,
  seatToTeam,
  serializePublicState,
  validateBidAction,
  validateTrumpSelection,
  validateTrumpSuitSelection,
  type BiddingState,
  type Card,
  type GameState,
  type PlayState,
  type Player,
  type PublicGameState,
  type RoundHands,
  type RoundResult,
  type Seat,
  type Suit,
  type Team,
} from "@twenty-eight/shared";
import { generatePlayerId, generateRoomCode, generateSessionToken, sessionTokensMatch } from "./session";

const MAX_PLAYERS = 4;

export type RoomPlayer = {
  id: string;
  sessionToken: string;
  displayName: string;
  socketId: string | null;
  connected: boolean;
  seat: Seat | null;
  isHost: boolean;
};

export type RoomGame = {
  state: GameState;
  deck: Card[];
  roundHands: RoundHands;
  biddingState: BiddingState | null;
  playState: PlayState | null;
  lastRoundResult: RoundResult | null;
};

export type Room = {
  code: string;
  hostPlayerId: string;
  locked: boolean;
  players: Map<string, RoomPlayer>;
  seats: Record<Seat, string | null>;
  game: RoomGame | null;
  joinOrder: string[];
  lastActivityAt: number;
  turnDeadlineAt: number | null;
  matchTargetScore: number;
};

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type RoomEvent =
  | { type: "room_created"; roomCode: string; playerId: string; sessionToken: string }
  | { type: "room_joined"; roomCode: string; playerId: string; sessionToken: string }
  | { type: "game_started" }
  | { type: "hand_dealt"; dealPhase: "initial" | "remaining" }
  | { type: "bidding_updated" }
  | { type: "trump_selected_hidden" }
  | { type: "trump_revealed" }
  | { type: "trick_updated" }
  | { type: "trick_completed"; trickNumber: number }
  | { type: "round_completed"; result: RoundResult }
  | { type: "match_completed"; winner: Team }
  | { type: "reconnect_success" };

export type RoomActionResult<T = void> = ActionResult<T> & {
  events?: RoomEvent[];
};

type SeatMap = Record<Seat, string | null>;

function emptySeats(): SeatMap {
  return { 0: null, 1: null, 2: null, 3: null };
}

function allSeatsFilled(seats: SeatMap): boolean {
  return ([0, 1, 2, 3] as Seat[]).every((seat) => seats[seat] !== null);
}

function getPlayerBySeat(room: Room, seat: Seat): RoomPlayer | null {
  const playerId = room.seats[seat];
  if (!playerId) {
    return null;
  }
  return room.players.get(playerId) ?? null;
}

function buildPlayersList(room: Room): Player[] {
  const players: Player[] = [];
  for (const seat of [0, 1, 2, 3] as Seat[]) {
    const playerId = room.seats[seat];
    if (!playerId) {
      continue;
    }
    const roomPlayer = room.players.get(playerId);
    if (!roomPlayer) {
      continue;
    }
    players.push({
      id: roomPlayer.id,
      displayName: roomPlayer.displayName,
      seat,
      connected: roomPlayer.connected,
      isHost: roomPlayer.isHost,
      team: seatToTeam(seat),
    });
  }
  return players.sort((a, b) => a.seat - b.seat);
}

function touchRoomActivity(room: Room): void {
  room.lastActivityAt = Date.now();
}

function transferHost(room: Room): void {
  if (room.locked) {
    return;
  }

  for (const player of room.players.values()) {
    player.isHost = false;
  }

  const nextHostId = room.joinOrder.find((playerId) => {
    const player = room.players.get(playerId);
    return player?.connected;
  });

  if (nextHostId) {
    const nextHost = room.players.get(nextHostId);
    if (nextHost) {
      nextHost.isHost = true;
      room.hostPlayerId = nextHostId;
    }
  }
}

function createLobbyState(room: Room): GameState {
  return {
    phase: "LOBBY",
    dealerSeat: 0,
    currentTurnSeat: null,
    players: buildPlayersList(room),
    handsByPlayerId: {},
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
    targetScore: room.matchTargetScore,
  };
}

function syncHandsToState(room: Room, game: RoomGame): void {
  const handsByPlayerId: Record<string, Card[]> = {};
  for (const seat of [0, 1, 2, 3] as Seat[]) {
    const playerId = room.seats[seat];
    if (!playerId) {
      continue;
    }
    if (game.playState) {
      handsByPlayerId[playerId] = [...game.playState.hands[seat]];
    } else {
      handsByPlayerId[playerId] = [...game.roundHands[seat]];
    }
  }
  game.state.handsByPlayerId = handsByPlayerId;
  game.state.players = buildPlayersList(room);
}

function syncBiddingToState(room: Room, game: RoomGame): void {
  const bidding = game.biddingState;
  if (!bidding) {
    return;
  }

  game.state.phase = bidding.complete ? "TRUMP_SELECTION" : "BIDDING";
  game.state.currentTurnSeat = bidding.currentTurnSeat;
  game.state.currentBid = bidding.currentBid;
  game.state.highestBidderPlayerId =
    bidding.highestBidderSeat !== null ? room.seats[bidding.highestBidderSeat] : null;
  game.state.passedPlayerIds = bidding.passedSeats
    .map((seat) => room.seats[seat])
    .filter((playerId): playerId is string => playerId !== null);
  game.state.bids = bidding.bids.map((bid) => ({
    playerId: room.seats[bid.seat]!,
    value: bid.value,
    createdAt: new Date().toISOString(),
  }));

  if (bidding.complete && bidding.declarerSeat !== null) {
    game.state.declarerPlayerId = room.seats[bidding.declarerSeat];
    game.state.biddingTeam = bidding.biddingTeam;
    game.state.phase = "TRUMP_SELECTION";
    game.state.currentTurnSeat = bidding.declarerSeat;
  }

  syncHandsToState(room, game);
}

function syncPlayToState(room: Room, game: RoomGame): void {
  const play = game.playState;
  if (!play) {
    return;
  }

  game.state.phase = play.complete ? "ROUND_SCORING" : "PLAYING_TRICKS";
  game.state.currentTurnSeat = play.currentTurnSeat;
  game.state.trumpSuit = play.trumpSuit;
  game.state.trumpRevealed = play.trumpRevealed;
  game.state.currentTrick = play.currentTrick;
  game.state.completedTricks = play.completedTricks;
  game.state.declarerPlayerId = room.seats[play.declarerSeat];
  game.state.biddingTeam = play.biddingTeam;
  game.state.currentBid = play.bid;

  syncHandsToState(room, game);
}

export function getPublicStateForPlayer(room: Room, playerId: string): PublicGameState | null {
  if (!room.game) {
    const lobby = createLobbyState(room);
    const publicState = serializePublicState(lobby, playerId);
    return {
      ...publicState,
      lobbyMembers: [...room.players.values()].map((player) => ({
        id: player.id,
        displayName: player.displayName,
        seat: player.seat,
        connected: player.connected,
        isHost: player.isHost,
      })),
    };
  }

  const publicState = serializePublicState(room.game.state, playerId);
  const augmented: PublicGameState = { ...publicState };

  if (
    room.game.lastRoundResult &&
    (room.game.state.phase === "ROUND_SCORING" || room.game.state.phase === "MATCH_OVER")
  ) {
    augmented.roundResult = room.game.lastRoundResult;
  }

  if (
    room.game.playState &&
    room.game.state.phase === "PLAYING_TRICKS" &&
    room.game.state.currentTurnSeat !== null
  ) {
    const seat = room.game.state.currentTurnSeat;
    const currentPlayerId = room.seats[seat];
    if (currentPlayerId === playerId) {
      augmented.legalCardIds = getLegalPlayMoves(room.game.playState, seat);
    }
  }

  if (room.turnDeadlineAt !== null) {
    augmented.turnDeadlineAt = new Date(room.turnDeadlineAt).toISOString();
  }

  return augmented;
}

function validateRoomPlayer(
  room: Room | undefined,
  playerId: string,
  sessionToken?: string
): ActionResult<{ room: Room; player: RoomPlayer }> {
  if (!room) {
    return { ok: false, error: "Room not found" };
  }

  const player = room.players.get(playerId);
  if (!player) {
    return { ok: false, error: "Player not found" };
  }

  if (sessionToken !== undefined && !sessionTokensMatch(player.sessionToken, sessionToken)) {
    return { ok: false, error: "Invalid session token" };
  }

  return { ok: true, data: { room, player } };
}

function validateSeated(player: RoomPlayer): ActionResult<Seat> {
  if (player.seat === null) {
    return { ok: false, error: "Player is not seated" };
  }
  return { ok: true, data: player.seat };
}

export type RoomManagerOptions = {
  matchTargetScore?: number;
};

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly socketToPlayer = new Map<string, { roomCode: string; playerId: string }>();
  private readonly random: () => number;
  private readonly matchTargetScore: number;

  constructor(random: () => number = Math.random, options: RoomManagerOptions = {}) {
    this.random = random;
    this.matchTargetScore = options.matchTargetScore ?? DEFAULT_TARGET_SCORE;
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  getRooms(): Map<string, Room> {
    return this.rooms;
  }

  deleteRoom(roomCode: string): boolean {
    return this.rooms.delete(roomCode.toUpperCase());
  }

  getPlayerContext(socketId: string): { roomCode: string; playerId: string } | undefined {
    return this.socketToPlayer.get(socketId);
  }

  createRoom(displayName: string, socketId: string): RoomActionResult<{
    room: Room;
    player: RoomPlayer;
    roomCode: string;
  }> {
    const playerId = generatePlayerId();
    const sessionToken = generateSessionToken();
    let roomCode = generateRoomCode();
    while (this.rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const player: RoomPlayer = {
      id: playerId,
      sessionToken,
      displayName,
      socketId,
      connected: true,
      seat: null,
      isHost: true,
    };

    const room: Room = {
      code: roomCode,
      hostPlayerId: playerId,
      locked: false,
      players: new Map([[playerId, player]]),
      seats: emptySeats(),
      game: null,
      joinOrder: [playerId],
      lastActivityAt: Date.now(),
      turnDeadlineAt: null,
      matchTargetScore: this.matchTargetScore,
    };

    this.rooms.set(roomCode, room);
    this.socketToPlayer.set(socketId, { roomCode, playerId });
    touchRoomActivity(room);

    return {
      ok: true,
      data: { room, player, roomCode },
      events: [
        {
          type: "room_created",
          roomCode,
          playerId,
          sessionToken,
        },
      ],
    };
  }

  joinRoom(
    roomCode: string,
    displayName: string,
    socketId: string,
    reconnect?: { playerId: string; sessionToken: string }
  ): RoomActionResult<{ room: Room; player: RoomPlayer }> {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) {
      return { ok: false, error: "Room not found" };
    }

    if (reconnect) {
      const validation = validateRoomPlayer(room, reconnect.playerId, reconnect.sessionToken);
      if (!validation.ok) {
        return validation;
      }

      const { player } = validation.data;
      player.connected = true;
      player.socketId = socketId;
      this.socketToPlayer.set(socketId, { roomCode: room.code, playerId: player.id });
      touchRoomActivity(room);

      return {
        ok: true,
        data: { room, player },
        events: [{ type: "reconnect_success" }],
      };
    }

    if (room.locked) {
      return { ok: false, error: "Room is locked" };
    }

    if (room.players.size >= MAX_PLAYERS) {
      return { ok: false, error: "Room is full" };
    }

    const playerId = generatePlayerId();
    const sessionToken = generateSessionToken();
    const player: RoomPlayer = {
      id: playerId,
      sessionToken,
      displayName,
      socketId,
      connected: true,
      seat: null,
      isHost: false,
    };

    room.players.set(playerId, player);
    room.joinOrder.push(playerId);
    this.socketToPlayer.set(socketId, { roomCode: room.code, playerId });
    touchRoomActivity(room);

    return {
      ok: true,
      data: { room, player },
      events: [
        {
          type: "room_joined",
          roomCode: room.code,
          playerId,
          sessionToken,
        },
      ],
    };
  }

  chooseSeat(
    roomCode: string,
    playerId: string,
    sessionToken: string,
    seat: Seat
  ): RoomActionResult {
    const room = this.rooms.get(roomCode.toUpperCase());
    const validation = validateRoomPlayer(room, playerId, sessionToken);
    if (!validation.ok) {
      return validation;
    }

    const { room: validRoom, player } = validation.data;
    if (validRoom.locked) {
      return { ok: false, error: "Room is locked" };
    }

    if (validRoom.seats[seat] !== null && validRoom.seats[seat] !== playerId) {
      return { ok: false, error: "Seat is already taken" };
    }

    if (player.seat !== null) {
      validRoom.seats[player.seat] = null;
    }

    player.seat = seat;
    validRoom.seats[seat] = playerId;
    touchRoomActivity(validRoom);

    return { ok: true, data: undefined };
  }

  leaveRoom(roomCode: string, playerId: string, sessionToken: string): RoomActionResult {
    const room = this.rooms.get(roomCode.toUpperCase());
    const validation = validateRoomPlayer(room, playerId, sessionToken);
    if (!validation.ok) {
      return validation;
    }

    const { room: validRoom, player } = validation.data;
    if (validRoom.locked && validRoom.game) {
      const oldSocketId = player.socketId;
      player.connected = false;
      player.socketId = null;
      if (oldSocketId) {
        this.socketToPlayer.delete(oldSocketId);
      }
      touchRoomActivity(validRoom);
      return { ok: true, data: undefined };
    }

    if (player.seat !== null) {
      validRoom.seats[player.seat] = null;
      player.seat = null;
    }

    if (player.socketId) {
      this.socketToPlayer.delete(player.socketId);
    }

    validRoom.players.delete(playerId);
    validRoom.joinOrder = validRoom.joinOrder.filter((id) => id !== playerId);
    player.isHost = false;

    if (validRoom.hostPlayerId === playerId) {
      transferHost(validRoom);
    }

    touchRoomActivity(validRoom);

    if (validRoom.players.size === 0) {
      this.rooms.delete(validRoom.code);
    }

    return { ok: true, data: undefined };
  }

  handleDisconnect(socketId: string): RoomActionResult | null {
    const context = this.socketToPlayer.get(socketId);
    if (!context) {
      return null;
    }

    this.socketToPlayer.delete(socketId);
    const room = this.rooms.get(context.roomCode);
    if (!room) {
      return null;
    }

    const player = room.players.get(context.playerId);
    if (!player) {
      return null;
    }

    player.connected = false;
    player.socketId = null;

    if (!room.locked) {
      if (room.hostPlayerId === player.id) {
        transferHost(room);
      }
    }

    touchRoomActivity(room);

    return { ok: true, data: undefined };
  }

  attachSocket(roomCode: string, playerId: string, sessionToken: string, socketId: string): RoomActionResult {
    const room = this.rooms.get(roomCode.toUpperCase());
    const validation = validateRoomPlayer(room, playerId, sessionToken);
    if (!validation.ok) {
      return validation;
    }

    const { player } = validation.data;
    player.connected = true;
    player.socketId = socketId;
    this.socketToPlayer.set(socketId, { roomCode: room!.code, playerId });

    return {
      ok: true,
      data: undefined,
      events: [{ type: "reconnect_success" }],
    };
  }

  startGame(roomCode: string, playerId: string, sessionToken: string): RoomActionResult {
    const room = this.rooms.get(roomCode.toUpperCase());
    const validation = validateRoomPlayer(room, playerId, sessionToken);
    if (!validation.ok) {
      return validation;
    }

    const { room: validRoom, player } = validation.data;
    if (!player.isHost) {
      return { ok: false, error: "Only the host can start the game" };
    }

    if (validRoom.locked) {
      return { ok: false, error: "Game has already started" };
    }

    if (!allSeatsFilled(validRoom.seats)) {
      return { ok: false, error: "All four seats must be filled before starting" };
    }

    const dealerSeat = 0;
    const deck = createShuffledDeck(this.random);
    const initialDeal = dealInitialRound(deck, dealerSeat);

    const state: GameState = {
      phase: "BIDDING",
      dealerSeat,
      currentTurnSeat: null,
      players: buildPlayersList(validRoom),
      handsByPlayerId: {},
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
      roundNumber: 1,
      matchScore: { teamA: 0, teamB: 0 },
      targetScore: this.matchTargetScore,
    };

    const biddingState = createBiddingState(dealerSeat);
    const game: RoomGame = {
      state,
      deck: initialDeal.deck,
      roundHands: initialDeal.hands,
      biddingState,
      playState: null,
      lastRoundResult: null,
    };

    syncBiddingToState(validRoom, game);
    validRoom.game = game;
    validRoom.locked = true;
    validRoom.turnDeadlineAt = null;
    touchRoomActivity(validRoom);

    return {
      ok: true,
      data: undefined,
      events: [{ type: "game_started" }, { type: "hand_dealt", dealPhase: "initial" }, { type: "bidding_updated" }],
    };
  }

  placeBid(
    roomCode: string,
    playerId: string,
    sessionToken: string,
    value: number
  ): RoomActionResult {
    return this.applyBid(roomCode, playerId, sessionToken, value);
  }

  passBid(roomCode: string, playerId: string, sessionToken: string): RoomActionResult {
    return this.applyBid(roomCode, playerId, sessionToken, "PASS");
  }

  private applyBid(
    roomCode: string,
    playerId: string,
    sessionToken: string,
    action: number | "PASS"
  ): RoomActionResult {
    const room = this.rooms.get(roomCode.toUpperCase());
    const validation = validateRoomPlayer(room, playerId, sessionToken);
    if (!validation.ok) {
      return validation;
    }

    const { room: validRoom, player } = validation.data;
    const seated = validateSeated(player);
    if (!seated.ok) {
      return seated;
    }

    const game = validRoom.game;
    if (!game || !game.biddingState) {
      return { ok: false, error: "Bidding is not active" };
    }

    if (game.state.phase !== "BIDDING") {
      return { ok: false, error: "Invalid game phase for bidding" };
    }

    const seat = seated.data;
    const bidValidation = validateBidAction(game.biddingState, seat, action);
    if (!bidValidation.ok) {
      return { ok: false, error: bidValidation.reason };
    }

    const previousComplete = game.biddingState.complete;
    game.biddingState = applyBidAction(game.biddingState, seat, action);
    syncBiddingToState(validRoom, game);

    const events: RoomEvent[] = [{ type: "bidding_updated" }];
    if (!previousComplete && game.biddingState.complete) {
      events.push({ type: "bidding_updated" });
    }

    return { ok: true, data: undefined, events };
  }

  selectTrump(
    roomCode: string,
    playerId: string,
    sessionToken: string,
    trumpSuit: Suit
  ): RoomActionResult {
    const room = this.rooms.get(roomCode.toUpperCase());
    const validation = validateRoomPlayer(room, playerId, sessionToken);
    if (!validation.ok) {
      return validation;
    }

    const { room: validRoom, player } = validation.data;
    const seated = validateSeated(player);
    if (!seated.ok) {
      return seated;
    }

    const game = validRoom.game;
    if (!game || !game.biddingState?.complete) {
      return { ok: false, error: "Trump selection is not available" };
    }

    if (game.state.phase !== "TRUMP_SELECTION") {
      return { ok: false, error: "Invalid game phase for trump selection" };
    }

    const trumpValidation = validateTrumpSelection(
      game.state.declarerPlayerId ?? "",
      playerId,
      trumpSuit
    );
    if (!trumpValidation.ok) {
      return { ok: false, error: trumpValidation.reason };
    }

    const declarerSeat = seated.data;
    if (game.biddingState.declarerSeat !== declarerSeat) {
      return { ok: false, error: "Only the declarer can select trump" };
    }

    const suitValidation = validateTrumpSuitSelection(game.roundHands, declarerSeat, trumpSuit);
    if (!suitValidation.ok) {
      return { ok: false, error: suitValidation.reason };
    }

    const remainingDeal = dealRemainingRound(game.deck, game.roundHands, game.state.dealerSeat);
    game.deck = remainingDeal.deck;
    game.roundHands = remainingDeal.hands;

    game.playState = createPlayState({
      hands: game.roundHands,
      declarerSeat,
      biddingTeam: game.biddingState.biddingTeam!,
      bid: game.biddingState.currentBid!,
      trumpSuit,
    });

    game.biddingState = null;
    syncPlayToState(validRoom, game);

    return {
      ok: true,
      data: undefined,
      events: [
        { type: "trump_selected_hidden" },
        { type: "hand_dealt", dealPhase: "remaining" },
        { type: "trick_updated" },
      ],
    };
  }

  playCard(
    roomCode: string,
    playerId: string,
    sessionToken: string,
    cardId: string
  ): RoomActionResult {
    const room = this.rooms.get(roomCode.toUpperCase());
    const validation = validateRoomPlayer(room, playerId, sessionToken);
    if (!validation.ok) {
      return validation;
    }

    const { room: validRoom, player } = validation.data;
    const seated = validateSeated(player);
    if (!seated.ok) {
      return seated;
    }

    const game = validRoom.game;
    if (!game || !game.playState) {
      return { ok: false, error: "Play phase is not active" };
    }

    if (game.state.phase !== "PLAYING_TRICKS") {
      return { ok: false, error: "Invalid game phase for play" };
    }

    const seat = seated.data;
    const play = game.playState;
    const trumpRevealedBefore = play.trumpRevealed;
    const completedTricksBefore = play.completedTricks.length;

    try {
      game.playState = applyPlayAction(play, seat, playerId, cardId);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Illegal play" };
    }

    syncPlayToState(validRoom, game);

    const events: RoomEvent[] = [{ type: "trick_updated" }];
    if (!trumpRevealedBefore && game.playState.trumpRevealed) {
      events.push({ type: "trump_revealed" });
    }

    if (game.playState.completedTricks.length > completedTricksBefore) {
      const completed = game.playState.completedTricks[game.playState.completedTricks.length - 1];
      if (completed) {
        events.push({ type: "trick_completed", trickNumber: completed.trickNumber });
      }
    }

    if (game.playState.complete) {
      const roundEvents = this.finalizeRound(validRoom, game);
      events.push(...roundEvents);
    }

    return { ok: true, data: undefined, events };
  }

  autoPassBid(roomCode: string): RoomActionResult | null {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room?.game?.biddingState || room.game.state.phase !== "BIDDING") {
      return null;
    }

    const seat = room.game.biddingState.currentTurnSeat;
    const player = getPlayerBySeat(room, seat);
    if (!player) {
      return null;
    }

    const actions = getLegalBidActions(room.game.biddingState, seat);
    if (!actions.includes("PASS")) {
      const fallback = actions[0];
      if (typeof fallback === "number") {
        return this.placeBid(room.code, player.id, player.sessionToken, fallback);
      }
      return null;
    }

    return this.passBid(room.code, player.id, player.sessionToken);
  }

  autoPlayCard(roomCode: string): RoomActionResult | null {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room?.game?.playState || room.game.state.phase !== "PLAYING_TRICKS") {
      return null;
    }

    const seat = room.game.playState.currentTurnSeat;
    const player = getPlayerBySeat(room, seat);
    if (!player) {
      return null;
    }

    const legalIds = getLegalPlayMoves(room.game.playState, seat);
    if (legalIds.length === 0) {
      return null;
    }

    const hand = room.game.playState.hands[seat];
    const legalCards = getLegalMoves(
      hand,
      room.game.playState.currentTrick,
      room.game.playState.trumpSuit,
      room.game.playState.trumpRevealed
    );
    const lowest = legalCards.reduce((min, card) => (card.strength < min.strength ? card : min));
    return this.playCard(room.code, player.id, player.sessionToken, lowest.id);
  }

  startNextRound(roomCode: string, playerId: string, sessionToken: string): RoomActionResult {
    const room = this.rooms.get(roomCode.toUpperCase());
    const validation = validateRoomPlayer(room, playerId, sessionToken);
    if (!validation.ok) {
      return validation;
    }

    const { room: validRoom, player } = validation.data;
    if (!player.isHost) {
      return { ok: false, error: "Only the host can start the next round" };
    }

    const game = validRoom.game;
    if (!game || game.state.phase !== "ROUND_SCORING") {
      return { ok: false, error: "Round scoring is not active" };
    }

    return this.beginRound(validRoom, game);
  }

  rematch(roomCode: string, playerId: string, sessionToken: string): RoomActionResult {
    const room = this.rooms.get(roomCode.toUpperCase());
    const validation = validateRoomPlayer(room, playerId, sessionToken);
    if (!validation.ok) {
      return validation;
    }

    const { room: validRoom, player } = validation.data;
    if (!player.isHost) {
      return { ok: false, error: "Only the host can start a rematch" };
    }

    validRoom.game = null;
    validRoom.locked = false;
    validRoom.turnDeadlineAt = null;
    touchRoomActivity(validRoom);

    return { ok: true, data: undefined };
  }

  private beginRound(room: Room, game: RoomGame): RoomActionResult {
    const nextDealer = ((game.state.dealerSeat + 1) % 4) as Seat;
    const deck = createShuffledDeck(this.random);
    const initialDeal = dealInitialRound(deck, nextDealer);

    game.state.dealerSeat = nextDealer;
    game.state.roundNumber += 1;
    game.state.bids = [];
    game.state.currentBid = null;
    game.state.highestBidderPlayerId = null;
    game.state.passedPlayerIds = [];
    game.state.declarerPlayerId = null;
    game.state.biddingTeam = null;
    game.state.trumpSuit = null;
    game.state.trumpRevealed = false;
    game.state.currentTrick = [];
    game.state.completedTricks = [];
    game.state.phase = "BIDDING";
    game.deck = initialDeal.deck;
    game.roundHands = initialDeal.hands;
    game.biddingState = createBiddingState(nextDealer);
    game.playState = null;
    game.lastRoundResult = null;

    syncBiddingToState(room, game);

    return {
      ok: true,
      data: undefined,
      events: [{ type: "hand_dealt", dealPhase: "initial" }, { type: "bidding_updated" }],
    };
  }

  private finalizeRound(room: Room, game: RoomGame): RoomEvent[] {
    const play = game.playState!;
    const result = scoreRound(
      play.completedTricks,
      play.biddingTeam,
      play.bid,
      play.declarerSeat
    );

    game.lastRoundResult = result;
    game.state.matchScore = applyMatchScore(game.state.matchScore, result.matchPointWinner!);
    game.state.phase = "ROUND_SCORING";
    game.playState = null;

    const events: RoomEvent[] = [{ type: "round_completed", result }];

    if (isMatchOver(game.state.matchScore, game.state.targetScore)) {
      game.state.phase = "MATCH_OVER";
      const winner = getMatchWinner(game.state.matchScore, game.state.targetScore);
      if (winner) {
        events.push({ type: "match_completed", winner });
      }
    }

    return events;
  }

  requestStateSync(roomCode: string, playerId: string, sessionToken: string): RoomActionResult {
    const room = this.rooms.get(roomCode.toUpperCase());
    const validation = validateRoomPlayer(room, playerId, sessionToken);
    if (!validation.ok) {
      return validation;
    }
    return { ok: true, data: undefined };
  }
}
