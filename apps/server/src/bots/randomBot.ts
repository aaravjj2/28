import type { BotAction, BotObservation, BotStrategy } from "./botTypes";

function pickRandom<T>(items: T[], random: () => number): T {
  const index = Math.floor(random() * items.length);
  const item = items[index];
  if (item === undefined) {
    throw new Error("Cannot pick from empty list");
  }
  return item;
}

export function createRandomBot(random: () => number = Math.random): BotStrategy {
  return {
    decide(observation: BotObservation): BotAction {
      const { publicState } = observation;

      if (publicState.phase === "BIDDING" && observation.legalBidActions?.length) {
        const numeric = observation.legalBidActions.filter(
          (action): action is number => typeof action === "number"
        );
        if (numeric.length === 0) {
          return { type: "pass" };
        }
        return { type: "bid", value: pickRandom(numeric, random) };
      }

      if (publicState.phase === "TRUMP_SELECTION" && observation.legalTrumpSuits?.length) {
        const suit = pickRandom(observation.legalTrumpSuits, random);
        const card = publicState.myHand.find((candidate) => candidate.suit === suit);
        return {
          type: "select_trump",
          suit,
          concealedCardId: card?.id,
        };
      }

      if (publicState.phase === "PLAYING_TRICKS" && publicState.legalCardIds?.length) {
        return {
          type: "play_card",
          cardId: pickRandom(publicState.legalCardIds, random),
        };
      }

      throw new Error(`Random bot has no legal action in phase ${publicState.phase}`);
    },
  };
}

export const randomBot = createRandomBot();
