import type { RuleProfileId, StakeLevel } from "./ruleProfiles";

export type { RuleProfileId, StakeLevel };

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
  isBot?: boolean;
  botDifficulty?: "random" | "heuristic";
};

export type GamePhase =
  | "LOBBY"
  | "DEAL_INITIAL"
  | "BIDDING"
  | "STAKE_MULTIPLIER"
  | "TRUMP_SELECTION"
  | "DEAL_REMAINING"
  | "THANI_DECLARATION"
  | "PLAYING_TRICKS"
  | "ROUND_SCORING"
  | "MATCH_OVER";

export type Bid = {
  playerId: string;
  value: number | "PASS" | "REDEAL";
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

export type PointTrackerState = {
  teamACaptured: number;
  teamBCaptured: number;
  biddingTeamCaptured: number;
  defendingTeamCaptured: number;
  pointsRemaining: number;
  bidTarget: number;
  adjustedBidTarget: number;
  stakeLevel: StakeLevel;
  stakePoints: number;
  stakeIfWin: number;
  stakeIfLose: number;
};

export type PairStatus = {
  bidderPairDeclared: boolean;
  defenderPairDeclared: boolean;
  adjustedBidTarget: number;
};

export type GameState = {
  phase: GamePhase;
  ruleProfileId: RuleProfileId;
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
  /** Face-down trump card id — server only, never in public state for non-declarer. */
  concealedTrumpCardId: string | null;
  thaniDeclared: boolean;
  pairStatus: PairStatus;
  pointTracker: PointTrackerState | null;
  stakeMultiplier: number;
  honoursStakeResolved: number | null;
  redealEligible: boolean;
  redealCount: number;
  currentTrick: PlayedCard[];
  completedTricks: Trick[];
  roundNumber: number;
  matchScore: { teamA: number; teamB: number };
  targetScore: number;
};

export type PublicCard = Pick<Card, "id" | "suit" | "rank" | "points">;

export type PublicPlayer = Pick<
  Player,
  "id" | "displayName" | "seat" | "connected" | "isHost" | "team" | "isBot" | "botDifficulty"
>;

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
  ruleProfileId: RuleProfileId;
  dealerSeat: Seat;
  currentTurnSeat: Seat | null;
  players: PublicPlayer[];
  myHand: PublicCard[];
  /** Declarer-only: the face-down concealed trump card. */
  myConcealedTrumpCard?: PublicCard | null;
  handCountsByPlayerId: Record<string, number>;
  bids: Bid[];
  currentBid: number | null;
  highestBidderPlayerId: string | null;
  passedPlayerIds: string[];
  declarerPlayerId: string | null;
  biddingTeam: Team | null;
  trumpSuit: Suit | null;
  trumpRevealed: boolean;
  thaniDeclared: boolean;
  pairStatus: PairStatus;
  pointTracker: PointTrackerState | null;
  stakeLevel: StakeLevel | null;
  stakeMultiplier: number;
  honoursStakeResolved: number | null;
  redealEligible: boolean;
  canRequestRedeal: boolean;
  canDouble: boolean;
  canRedouble: boolean;
  currentTrick: Array<{
    playerId: string;
    seat: Seat;
    card: PublicCard;
    concealed?: boolean;
  }>;
  completedTricks: PublicTrick[];
  roundNumber: number;
  matchScore: { teamA: number; teamB: number };
  targetScore: number;
  legalCardIds?: string[];
  canDeclarePair?: boolean;
  canDeclareThani?: boolean;
  lobbyMembers?: Array<{
    id: string;
    displayName: string;
    seat: Seat | null;
    connected: boolean;
    isHost: boolean;
    isBot?: boolean;
    botDifficulty?: "random" | "heuristic";
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
  bids: Array<{ seat: Seat; value: number | "PASS" | "REDEAL" }>;
  complete: boolean;
  declarerSeat: Seat | null;
  biddingTeam: Team | null;
  ruleProfileId?: RuleProfileId;
  redealEligible: boolean;
  redealCount: number;
  /** Set when all pass — room manager should redeal. */
  pendingAllPassRedeal: boolean;
  honoursStakeResolved: number | null;
  doubleMultiplier: number;
  /** Defender team may double, then bidder may redouble. */
  stakeMultiplierPhase: "none" | "defender" | "bidder" | "done";
};

export type PlayState = {
  hands: RoundHands;
  declarerSeat: Seat;
  biddingTeam: Team;
  bid: number;
  trumpSuit: Suit;
  trumpRevealed: boolean;
  /** Card set face-down; removed from declarer hand until reveal. */
  concealedTrumpCard: Card | null;
  thaniActive: boolean;
  thaniPartnerSeat: Seat | null;
  pairDeclarations: Array<{ team: Team; seat: Seat }>;
  currentTurnSeat: Seat;
  currentTrick: PlayedCard[];
  completedTricks: Trick[];
  trickNumber: number;
  complete: boolean;
  /** After trick 7, declarer must lead concealed trump on trick 8. */
  mustLeadConcealedTrump: boolean;
};

export type RoundResult = {
  biddingTeam: Team;
  bid: number;
  adjustedBidTarget: number;
  declarerSeat: Seat;
  teamAPoints: number;
  teamBPoints: number;
  biddingTeamWon: boolean;
  matchPointWinner: Team | null;
  stakeLevel: StakeLevel;
  stakePoints: number;
  matchPointsAwarded: number;
  stakeMultiplier: number;
  honoursStakeResolved: number | null;
  bidderPairDeclared: boolean;
  defenderPairDeclared: boolean;
  thaniDeclared: boolean;
  thaniWon?: boolean;
};
