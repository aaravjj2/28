import type { BidAction } from "@twenty-eight/shared";
import type { PublicGameState, Seat, Suit } from "@twenty-eight/shared";

export type BotDifficulty = "random" | "heuristic";

export type BotBidAction = {
  type: "bid";
  value: number;
};

export type BotPassAction = {
  type: "pass";
};

export type BotTrumpAction = {
  type: "select_trump";
  suit: Suit;
  concealedCardId?: string;
};

export type BotPlayAction = {
  type: "play_card";
  cardId: string;
};

export type BotAction = BotBidAction | BotPassAction | BotTrumpAction | BotPlayAction;

export type BotObservation = {
  playerId: string;
  seat: Seat;
  difficulty: BotDifficulty;
  publicState: PublicGameState;
  legalBidActions?: BidAction[];
  legalTrumpSuits?: Suit[];
};

export type BotStrategy = {
  decide: (observation: BotObservation) => BotAction;
};
