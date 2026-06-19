import {
  activateThani,
  applyBidAction,
  applyMatchScore,
  applyPlayAction,
  applyStakeMultiplierAction,
  buildPairStatus,
  canViewerDeclarePair,
  computeLivePointTracker,
  computeRedealEligible,
  createBiddingState,
  createPlayState,
  createShuffledDeck,
  dealInitialRound,
  dealRemainingRound,
  declarePair as declarePairOnState,
  defaultGameStateFields,
  createDefaultPairStatus,
  getLegalBidActions,
  getLegalPlayMoves,
  getLegalStakeMultiplierActions,
  getMatchWinner,
  getRuleProfile,
  isAuctionReadyForTrump,
  isMatchOver,
  resolveHonoursStake,
  scoreRound,
  seatToTeam,
  serializePublicState,
  validateBidAction,
  validateConcealedTrumpCard,
  validatePairDeclaration,
  validateThaniDeclaration,
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
  type RuleProfileId,
  type Seat,
  type StakeMultiplierAction,
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
  isBot?: boolean;
  botDifficulty?: "random" | "heuristic";
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
  ruleProfileId: RuleProfileId;
  thaniEnabled: boolean;
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
      connected: roomPlayer.isBot ? true : roomPlayer.connected,
      isHost: roomPlayer.isHost,
      team: seatToTeam(seat),
      isBot: roomPlayer.isBot,
      botDifficulty: roomPlayer.botDifficulty,
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
    ...defaultGameStateFields(room.ruleProfileId),
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

  const profile = getRuleProfile(room.ruleProfileId);

  if (bidding.stakeMultiplierPhase === "defender" || bidding.stakeMultiplierPhase === "bidder") {
    game.state.phase = "STAKE_MULTIPLIER";
    game.state.currentTurnSeat = bidding.currentTurnSeat;
    game.state.stakeMultiplier = bidding.doubleMultiplier;
    game.state.honoursStakeResolved = bidding.honoursStakeResolved;
    syncHandsToState(room, game);
    return;
  }

  game.state.phase = isAuctionReadyForTrump(bidding) ? "TRUMP_SELECTION" : "BIDDING";
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
  game.state.redealEligible = bidding.redealEligible;
  game.state.redealCount = bidding.redealCount;
  game.state.stakeMultiplier = bidding.doubleMultiplier;
  game.state.honoursStakeResolved = bidding.honoursStakeResolved;

  if (isAuctionReadyForTrump(bidding) && bidding.declarerSeat !== null) {
    game.state.declarerPlayerId = room.seats[bidding.declarerSeat];
    game.state.biddingTeam = bidding.biddingTeam;
    game.state.phase = "TRUMP_SELECTION";
    game.state.currentTurnSeat = bidding.declarerSeat;
    game.state.pairStatus = buildPairStatus({
      bid: bidding.currentBid!,
      profileId: room.ruleProfileId,
      biddingTeam: bidding.biddingTeam!,
      pairDeclarations: [],
    });
  }

  syncHandsToState(room, game);
}

function resolvePlayPhase(room: Room, game: RoomGame): GameState["phase"] {
  const play = game.playState;
  if (!play || play.complete) {
    return "ROUND_SCORING";
  }
  if (
    room.thaniEnabled &&
    !play.thaniActive &&
    !game.state.thaniSkipped &&
    play.completedTricks.length === 0
  ) {
    return "THANI_DECLARATION";
  }
  return "PLAYING_TRICKS";
}

function syncPlayToState(room: Room, game: RoomGame): void {
  const play = game.playState;
  if (!play) {
    return;
  }

  const profile = getRuleProfile(room.ruleProfileId);
  const pairStatus = buildPairStatus({
    bid: play.bid,
    profileId: room.ruleProfileId,
    biddingTeam: play.biddingTeam,
    pairDeclarations: play.pairDeclarations,
  });

  game.state.phase = resolvePlayPhase(room, game);
  game.state.currentTurnSeat = play.currentTurnSeat;
  game.state.trumpSuit = play.trumpSuit;
  game.state.trumpRevealed = play.trumpRevealed;
  game.state.concealedTrumpCardId = play.concealedTrumpCard?.id ?? null;
  game.state.currentTrick = play.currentTrick;
  game.state.completedTricks = play.completedTricks;
  game.state.declarerPlayerId = room.seats[play.declarerSeat];
  game.state.biddingTeam = play.biddingTeam;
  game.state.currentBid = play.bid;
  game.state.thaniDeclared = play.thaniActive;
  game.state.pairStatus = pairStatus;
  game.state.pointTracker = computeLivePointTracker({
    completedTricks: play.completedTricks,
    biddingTeam: play.biddingTeam,
    bid: play.bid,
    profile,
    bidderPairDeclared: pairStatus.bidderPairDeclared,
    defenderPairDeclared: pairStatus.defenderPairDeclared,
    honoursStakeResolved: game.state.honoursStakeResolved,
    doubleMultiplier: game.state.stakeMultiplier,
  });

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
        connected: player.isBot ? true : player.connected,
        isHost: player.isHost,
        isBot: player.isBot,
        botDifficulty: player.botDifficulty,
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
    (room.game.state.phase === "PLAYING_TRICKS" || room.game.state.phase === "THANI_DECLARATION") &&
    room.game.state.currentTurnSeat !== null
  ) {
    const seat = room.game.state.currentTurnSeat;
    const currentPlayerId = room.seats[seat];
    if (currentPlayerId === playerId) {
      if (room.game.state.phase === "PLAYING_TRICKS") {
        augmented.legalCardIds = getLegalPlayMoves(room.game.playState, seat);
      }
    }
  }

  if (room.game.biddingState && room.game.state.phase === "STAKE_MULTIPLIER") {
    const seat = room.players.get(playerId)?.seat;
    if (seat !== null && seat !== undefined) {
      const actions = getLegalStakeMultiplierActions(room.game.biddingState, seat);
      augmented.canDouble = actions.includes("DOUBLE");
      augmented.canRedouble = actions.includes("REDOUBLE");
    }
  }

  if (
    room.game.playState?.concealedTrumpCard &&
    room.game.state.declarerPlayerId === playerId &&
    !room.game.state.trumpRevealed
  ) {
    const card = room.game.playState.concealedTrumpCard;
    augmented.myConcealedTrumpCard = {
      id: card.id,
      suit: card.suit,
      rank: card.rank,
      points: card.points,
    };
  }

  if (room.game.state.phase === "PLAYING_TRICKS") {
    augmented.canDeclarePair = canViewerDeclarePair(room.game.state, playerId);
  }

  if (room.game.state.phase === "THANI_DECLARATION" && room.thaniEnabled) {
    augmented.canDeclareThani = room.game.state.declarerPlayerId === playerId;
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
  ruleProfileId?: RuleProfileId;
  thaniEnabled?: boolean;
};

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly socketToPlayer = new Map<string, { roomCode: string; playerId: string }>();
  private readonly random: () => number;
  private readonly matchTargetScore: number;
  private readonly defaultRuleProfileId: RuleProfileId;
  private readonly defaultThaniEnabled: boolean;

  constructor(random: () => number = Math.random, options: RoomManagerOptions = {}) {
    this.random = random;
    this.matchTargetScore = options.matchTargetScore ?? 6;
    this.defaultRuleProfileId = options.ruleProfileId ?? "standard_28";
    this.defaultThaniEnabled = options.thaniEnabled ?? true;
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
      ruleProfileId: this.defaultRuleProfileId,
      thaniEnabled: this.defaultThaniEnabled,
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
    const redealEligible = computeRedealEligible(
      initialDeal.hands,
      dealerSeat,
      validRoom.ruleProfileId,
      0
    );

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
      targetScore: validRoom.matchTargetScore,
      ...defaultGameStateFields(validRoom.ruleProfileId),
      redealEligible,
    };

    const biddingState = createBiddingState(dealerSeat, validRoom.ruleProfileId, {
      redealEligible,
      redealCount: 0,
    });
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

  requestRedeal(roomCode: string, playerId: string, sessionToken: string): RoomActionResult {
    return this.applyBid(roomCode, playerId, sessionToken, "REDEAL");
  }

  doubleBid(roomCode: string, playerId: string, sessionToken: string): RoomActionResult {
    return this.applyStakeMultiplier(roomCode, playerId, sessionToken, "DOUBLE");
  }

  redoubleBid(roomCode: string, playerId: string, sessionToken: string): RoomActionResult {
    return this.applyStakeMultiplier(roomCode, playerId, sessionToken, "REDOUBLE");
  }

  passStakeMultiplier(roomCode: string, playerId: string, sessionToken: string): RoomActionResult {
    return this.applyStakeMultiplier(roomCode, playerId, sessionToken, "PASS");
  }

  setRuleProfile(
    roomCode: string,
    playerId: string,
    sessionToken: string,
    profileId: RuleProfileId
  ): RoomActionResult {
    const room = this.rooms.get(roomCode.toUpperCase());
    const validation = validateRoomPlayer(room, playerId, sessionToken);
    if (!validation.ok) {
      return validation;
    }

    const { room: validRoom, player } = validation.data;
    if (!player.isHost) {
      return { ok: false, error: "Only the host can change rule profile" };
    }
    if (validRoom.locked) {
      return { ok: false, error: "Cannot change profile after game start" };
    }

    validRoom.ruleProfileId = profileId;
    touchRoomActivity(validRoom);
    return { ok: true, data: undefined };
  }

  private applyStakeMultiplier(
    roomCode: string,
    playerId: string,
    sessionToken: string,
    action: StakeMultiplierAction
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
    if (!game?.biddingState || game.state.phase !== "STAKE_MULTIPLIER") {
      return { ok: false, error: "Stake multiplier phase is not active" };
    }

    try {
      game.biddingState = applyStakeMultiplierAction(game.biddingState, seated.data, action);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Invalid action" };
    }

    game.state.stakeMultiplier = game.biddingState.doubleMultiplier;
    syncBiddingToState(validRoom, game);
    return { ok: true, data: undefined, events: [{ type: "bidding_updated" }] };
  }

  private maybeRedeal(room: Room, game: RoomGame): RoomActionResult | null {
    const bidding = game.biddingState;
    if (!bidding?.pendingAllPassRedeal && !bidding?.bids.some((b) => b.value === "REDEAL")) {
      return null;
    }

    const dealerSeat = game.state.dealerSeat;
    const redealCount = bidding!.redealCount;
    const deck = createShuffledDeck(this.random);
    const initialDeal = dealInitialRound(deck, dealerSeat);
    const redealEligible = computeRedealEligible(
      initialDeal.hands,
      dealerSeat,
      room.ruleProfileId,
      redealCount
    );

    game.deck = initialDeal.deck;
    game.roundHands = initialDeal.hands;
    game.biddingState = createBiddingState(dealerSeat, room.ruleProfileId, {
      redealEligible,
      redealCount,
    });
    game.state.redealEligible = redealEligible;
    game.state.redealCount = redealCount;
    syncBiddingToState(room, game);
    touchRoomActivity(room);

    return {
      ok: true,
      data: undefined,
      events: [{ type: "hand_dealt", dealPhase: "initial" }, { type: "bidding_updated" }],
    };
  }

  private applyBid(
    roomCode: string,
    playerId: string,
    sessionToken: string,
    action: number | "PASS" | "REDEAL"
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

    game.biddingState = applyBidAction(game.biddingState, seat, action);

    const redealResult = this.maybeRedeal(validRoom, game);
    if (redealResult) {
      return redealResult;
    }

    if (game.biddingState.pendingAllPassRedeal) {
      game.biddingState = { ...game.biddingState, pendingAllPassRedeal: false, redealCount: game.biddingState.redealCount + 1 };
      return this.maybeRedeal(validRoom, game)!;
    }

    if (isAuctionReadyForTrump(game.biddingState)) {
      game.biddingState = resolveHonoursStake(game.biddingState, this.random);
      game.state.stakeMultiplier = game.biddingState.doubleMultiplier;
      game.state.honoursStakeResolved = game.biddingState.honoursStakeResolved;
    }

    syncBiddingToState(validRoom, game);

    return { ok: true, data: undefined, events: [{ type: "bidding_updated" }] };
  }

  selectTrump(
    roomCode: string,
    playerId: string,
    sessionToken: string,
    trumpSuit: Suit,
    concealedCardId?: string
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
    if (!game?.biddingState || !isAuctionReadyForTrump(game.biddingState)) {
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

    const profile = getRuleProfile(validRoom.ruleProfileId);
    let concealedCard: Card | null = null;
    if (profile.concealedTrumpCard) {
      if (!concealedCardId) {
        return { ok: false, error: "Concealed trump card is required" };
      }
      const concealedValidation = validateConcealedTrumpCard(
        game.roundHands,
        declarerSeat,
        trumpSuit,
        concealedCardId
      );
      if (!concealedValidation.ok) {
        return { ok: false, error: concealedValidation.reason };
      }
      concealedCard =
        game.roundHands[declarerSeat].find((c) => c.id === concealedCardId) ?? null;
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
      concealedTrumpCard: concealedCard,
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

  declarePair(roomCode: string, playerId: string, sessionToken: string): RoomActionResult {
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
    if (!game?.playState || game.state.phase !== "PLAYING_TRICKS") {
      return { ok: false, error: "Pair can only be declared during play" };
    }

    const profile = getRuleProfile(validRoom.ruleProfileId);
    const hand = game.playState.hands[seated.data];
    const pairValidation = validatePairDeclaration({
      hand,
      trumpSuit: game.playState.trumpSuit,
      trumpRevealed: game.playState.trumpRevealed,
      bid: game.playState.bid,
      pairMinBidToDeclare: profile.pairMinBidToDeclare,
      seat: seated.data,
      biddingTeam: game.playState.biddingTeam,
      existingDeclarations: game.playState.pairDeclarations.map((d) => ({
        team: d.team,
        declaredBySeat: d.seat,
      })),
    });
    if (!pairValidation.ok) {
      return { ok: false, error: pairValidation.reason };
    }

    game.playState = declarePairOnState(game.playState, seated.data, seatToTeam(seated.data));
    syncPlayToState(validRoom, game);
    return { ok: true, data: undefined, events: [{ type: "trick_updated" }] };
  }

  declareThani(roomCode: string, playerId: string, sessionToken: string): RoomActionResult {
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
    if (!game?.playState) {
      return { ok: false, error: "Play phase is not active" };
    }

    const thaniValidation = validateThaniDeclaration({
      thaniEnabled: validRoom.thaniEnabled,
      thaniAlreadyDeclared: game.state.thaniDeclared,
      declarerSeat: game.playState.declarerSeat,
      seat: seated.data,
      phase: game.state.phase,
    });
    if (!thaniValidation.ok) {
      return { ok: false, error: thaniValidation.reason };
    }

    game.playState = activateThani(game.playState);
    game.state.phase = "PLAYING_TRICKS";
    game.state.thaniDeclared = true;
    syncPlayToState(validRoom, game);
    return { ok: true, data: undefined, events: [{ type: "trick_updated" }] };
  }

  skipThaniAndPlay(roomCode: string, playerId: string, sessionToken: string): RoomActionResult {
    const room = this.rooms.get(roomCode.toUpperCase());
    const validation = validateRoomPlayer(room, playerId, sessionToken);
    if (!validation.ok) {
      return validation;
    }

    const { room: validRoom, player } = validation.data;
    if (validRoom.game?.state.phase !== "THANI_DECLARATION") {
      return { ok: false, error: "Thani declaration phase is not active" };
    }
    if (validRoom.game.state.declarerPlayerId !== playerId) {
      return { ok: false, error: "Only the declarer can skip Thani" };
    }

    validRoom.game.state.thaniSkipped = true;
    validRoom.game.state.phase = "PLAYING_TRICKS";
    syncPlayToState(validRoom, validRoom.game);
    return { ok: true, data: undefined, events: [{ type: "trick_updated" }] };
  }

  addBot(
    roomCode: string,
    hostId: string,
    sessionToken: string,
    seat: Seat,
    difficulty: "random" | "heuristic" = "random"
  ): RoomActionResult<{ playerId: string }> {
    const room = this.rooms.get(roomCode.toUpperCase());
    const validation = validateRoomPlayer(room, hostId, sessionToken);
    if (!validation.ok) {
      return validation;
    }

    const { room: validRoom, player: host } = validation.data;
    if (!host.isHost) {
      return { ok: false, error: "Only the host can add bots" };
    }
    if (validRoom.locked) {
      return { ok: false, error: "Room is locked" };
    }
    if (validRoom.seats[seat] !== null) {
      return { ok: false, error: "Seat is already taken" };
    }

    const botId = generatePlayerId();
    const botToken = generateSessionToken();
    const bot: RoomPlayer = {
      id: botId,
      sessionToken: botToken,
      displayName: `Bot ${seat}`,
      socketId: null,
      connected: true,
      seat,
      isHost: false,
      isBot: true,
      botDifficulty: difficulty,
    };

    validRoom.players.set(botId, bot);
    validRoom.seats[seat] = botId;
    validRoom.joinOrder.push(botId);
    touchRoomActivity(validRoom);

    return { ok: true, data: { playerId: botId } };
  }

  removeBot(
    roomCode: string,
    hostId: string,
    sessionToken: string,
    botPlayerId: string
  ): RoomActionResult {
    const room = this.rooms.get(roomCode.toUpperCase());
    const validation = validateRoomPlayer(room, hostId, sessionToken);
    if (!validation.ok) {
      return validation;
    }

    const { room: validRoom, player: host } = validation.data;
    if (!host.isHost) {
      return { ok: false, error: "Only the host can remove bots" };
    }
    if (validRoom.locked) {
      return { ok: false, error: "Room is locked" };
    }

    const bot = validRoom.players.get(botPlayerId);
    if (!bot?.isBot) {
      return { ok: false, error: "Player is not a bot" };
    }

    if (bot.seat !== null) {
      validRoom.seats[bot.seat] = null;
    }
    validRoom.players.delete(botPlayerId);
    validRoom.joinOrder = validRoom.joinOrder.filter((id) => id !== botPlayerId);
    touchRoomActivity(validRoom);

    return { ok: true, data: undefined };
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
    if (!room?.game?.biddingState) {
      return null;
    }

    if (room.game.state.phase === "STAKE_MULTIPLIER") {
      const seat = room.game.biddingState.currentTurnSeat;
      const player = getPlayerBySeat(room, seat);
      if (!player) {
        return null;
      }
      return this.passStakeMultiplier(room.code, player.id, player.sessionToken);
    }

    if (room.game.state.phase !== "BIDDING") {
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

    const playState = room.game.playState;
    const hand = playState.hands[seat];
    const candidates: Card[] = hand.filter((c) => legalIds.includes(c.id));
    const concealed = playState.concealedTrumpCard;
    if (concealed && legalIds.includes(concealed.id)) {
      candidates.push(concealed);
    }
    if (candidates.length === 0) {
      return null;
    }

    const lowest = candidates.reduce((min, card) =>
      card.strength < min.strength ? card : min
    );
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
    game.state.concealedTrumpCardId = null;
    game.state.thaniDeclared = false;
    game.state.thaniSkipped = false;
    game.state.stakeMultiplier = 1;
    game.state.honoursStakeResolved = null;
    game.state.redealEligible = false;
    game.state.redealCount = 0;
    game.state.pairStatus = createDefaultPairStatus();
    game.state.pointTracker = null;
    game.state.currentTrick = [];
    game.state.completedTricks = [];
    game.state.phase = "BIDDING";
    game.deck = initialDeal.deck;
    game.roundHands = initialDeal.hands;

    const redealEligible = computeRedealEligible(
      initialDeal.hands,
      nextDealer,
      room.ruleProfileId,
      0
    );
    game.state.redealEligible = redealEligible;
    game.biddingState = createBiddingState(nextDealer, room.ruleProfileId, {
      redealEligible,
      redealCount: 0,
    });
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
    const bidderPairDeclared = play.pairDeclarations.some((d) => d.team === play.biddingTeam);
    const defenderPairDeclared = play.pairDeclarations.some((d) => d.team !== play.biddingTeam);

    const result = scoreRound(
      play.completedTricks,
      play.biddingTeam,
      play.bid,
      play.declarerSeat,
      {
        profileId: room.ruleProfileId,
        bidderPairDeclared,
        defenderPairDeclared,
        thaniDeclared: play.thaniActive,
        honoursStakeResolved: game.state.honoursStakeResolved,
        doubleMultiplier: game.state.stakeMultiplier,
      }
    );

    game.lastRoundResult = result;
    game.state.matchScore = applyMatchScore(game.state.matchScore, result);
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
