export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "7" | "8" | "Q" | "K" | "10" | "A" | "9" | "J";
export type Team = "A" | "B";
export type Seat = 0 | 1 | 2 | 3;

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
  points: number;
  strength: number;
};

export type Player = {
  id: string;
  displayName: string;
  seat: Seat;
  connected: boolean;
  isHost: boolean;
  team: Team;
};

export type GamePhase =
  | "LOBBY"
  | "DEAL_INITIAL"
  | "BIDDING"
  | "TRUMP_SELECTION"
  | "DEAL_REMAINING"
  | "PLAYING_TRICKS"
  | "ROUND_SCORING"
  | "MATCH_OVER";

export type Bid = {
  playerId: string;
  value: number | "PASS";
  createdAt: string;
};

export type PlayedCard = {
  playerId: string;
  seat: Seat;
  card: Card;
};

export type Trick = {
  trickNumber: number;
  ledSuit: Suit;
  playedCards: PlayedCard[];
  winnerPlayerId: string;
  winnerTeam: Team;
  points: number;
};

export type GameState = {
  phase: GamePhase;
  dealerSeat: Seat;
  currentTurnSeat: Seat | null;
  players: Player[];
  handsByPlayerId: Record<string, Card[]>;
  bids: Bid[];
  currentBid: number | null;
  highestBidderPlayerId: string | null;
  passedPlayerIds: string[];
  declarerPlayerId: string | null;
  biddingTeam: Team | null;
  trumpSuit: Suit | null;
  trumpRevealed: boolean;
  currentTrick: PlayedCard[];
  completedTricks: Trick[];
  roundNumber: number;
  matchScore: { teamA: number; teamB: number };
  targetScore: number;
};

export type PublicCard = Pick<Card, "id" | "suit" | "rank" | "points">;

export type PublicPlayer = Pick<Player, "id" | "displayName" | "seat" | "connected" | "isHost" | "team">;

export type PublicTrick = {
  trickNumber: number;
  ledSuit: Suit;
  playedCards: Array<{
    playerId: string;
    seat: Seat;
    card: PublicCard;
  }>;
  winnerPlayerId: string;
  winnerTeam: Team;
  points: number;
};

export type PublicGameState = {
  phase: GamePhase;
  dealerSeat: Seat;
  currentTurnSeat: Seat | null;
  players: PublicPlayer[];
  myHand: PublicCard[];
  handCountsByPlayerId: Record<string, number>;
  bids: Bid[];
  currentBid: number | null;
  highestBidderPlayerId: string | null;
  passedPlayerIds: string[];
  declarerPlayerId: string | null;
  biddingTeam: Team | null;
  trumpSuit: Suit | null;
  trumpRevealed: boolean;
  currentTrick: Array<{
    playerId: string;
    seat: Seat;
    card: PublicCard;
  }>;
  completedTricks: PublicTrick[];
  roundNumber: number;
  matchScore: { teamA: number; teamB: number };
  targetScore: number;
  legalCardIds?: string[];
  lobbyMembers?: Array<{
    id: string;
    displayName: string;
    seat: Seat | null;
    connected: boolean;
    isHost: boolean;
  }>;
  roundResult?: RoundResult;
  turnDeadlineAt?: string | null;
};

export const MIN_BID = 14;
export const MAX_BID = 28;
export const DEFAULT_TARGET_SCORE = 6;
export const CARDS_PER_PLAYER = 8;
export const INITIAL_DEAL_SIZE = 4;
export const TRICK_COUNT = 8;
export const PLAYER_COUNT = 4;

export type RoundHands = Record<Seat, Card[]>;

export type BiddingState = {
  dealerSeat: Seat;
  activeSeats: Seat[];
  currentTurnSeat: Seat;
  currentBid: number | null;
  highestBidderSeat: Seat | null;
  passedSeats: Seat[];
  bids: Array<{ seat: Seat; value: number | "PASS" }>;
  complete: boolean;
  declarerSeat: Seat | null;
  biddingTeam: Team | null;
};

export type PlayState = {
  hands: RoundHands;
  declarerSeat: Seat;
  biddingTeam: Team;
  bid: number;
  trumpSuit: Suit;
  trumpRevealed: boolean;
  currentTurnSeat: Seat;
  currentTrick: PlayedCard[];
  completedTricks: Trick[];
  trickNumber: number;
  complete: boolean;
};

export type RoundResult = {
  biddingTeam: Team;
  bid: number;
  declarerSeat: Seat;
  teamAPoints: number;
  teamBPoints: number;
  biddingTeamWon: boolean;
  matchPointWinner: Team | null;
};
