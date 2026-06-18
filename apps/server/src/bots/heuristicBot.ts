import { evaluateHand, type Suit } from "@twenty-eight/shared";
import { getRuleProfile } from "@twenty-eight/shared";
import type { BotAction, BotObservation, BotStrategy } from "./botTypes";

function suitWithMostCards(hand: BotObservation["publicState"]["myHand"]): Suit {
  const counts: Record<Suit, number> = { hearts: 0, diamonds: 0, clubs: 0, spades: 0 };
  for (const card of hand) {
    counts[card.suit] += 1;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "spades") as Suit;
}

export const heuristicBot: BotStrategy = {
  decide(observation: BotObservation): BotAction {
    const { publicState, legalBidActions } = observation;
    const profile = getRuleProfile(publicState.ruleProfileId ?? "standard_28");

    if (publicState.phase === "BIDDING" && legalBidActions?.length) {
      const evaluation = evaluateHand(publicState.myHand);
      const numericBids = legalBidActions.filter((action): action is number => typeof action === "number");

      if (legalBidActions.includes("PASS") && publicState.currentBid !== null) {
        if (!evaluation.qualifiesForOpeningBid) {
          return { type: "pass" };
        }
        const minAggressive = Math.max(16, profile.minBid);
        if (publicState.currentBid >= minAggressive) {
          return { type: "pass" };
        }
      }

      if (numericBids.length === 0) {
        return { type: "pass" };
      }

      if (!evaluation.qualifiesForOpeningBid && publicState.currentBid === null) {
        const minBid = numericBids.find((v) => v === profile.minBid);
        if (minBid !== undefined) {
          return { type: "bid", value: minBid };
        }
        return { type: "pass" };
      }

      const preferred =
        publicState.currentBid === null
          ? Math.max(profile.minBid, evaluation.recommendedMaxBid >= 16 ? 16 : profile.minBid)
          : Math.min(publicState.currentBid + 1, evaluation.recommendedMaxBid);

      const bid = numericBids.find((value) => value >= preferred) ?? numericBids[0]!;
      return { type: "bid", value: bid };
    }

    if (publicState.phase === "TRUMP_SELECTION" && observation.legalTrumpSuits?.length) {
      const evaluation = evaluateHand(publicState.myHand);
      const preferred = evaluation.bestSuit ?? suitWithMostCards(publicState.myHand);
      const suit =
        observation.legalTrumpSuits.find((candidate) => candidate === preferred) ??
        observation.legalTrumpSuits[0]!;
      const card = publicState.myHand.find((c) => c.suit === suit);
      return { type: "select_trump", suit, concealedCardId: card?.id };
    }

    if (publicState.phase === "PLAYING_TRICKS" && publicState.legalCardIds?.length) {
      const legalCards = publicState.myHand.filter((card) =>
        publicState.legalCardIds!.includes(card.id)
      );
      const concealed = publicState.myConcealedTrumpCard;
      if (concealed && publicState.legalCardIds.includes(concealed.id)) {
        legalCards.push(concealed);
      }
      if (legalCards.length === 0) {
        return { type: "play_card", cardId: publicState.legalCardIds[0]! };
      }

      const isLeading = publicState.currentTrick.length === 0;
      const myTeam = publicState.players.find((p) => p.id === observation.playerId)?.team;
      const biddingTeam = publicState.biddingTeam;
      const needPoints =
        myTeam === biddingTeam &&
        publicState.pointTracker !== null &&
        publicState.pointTracker.biddingTeamCaptured < publicState.pointTracker.adjustedBidTarget;

      if (isLeading) {
        const evaluation = evaluateHand(publicState.myHand);
        const trumpSuit = publicState.trumpSuit;
        const leadSuit = evaluation.bestSuit ?? legalCards[0]!.suit;
        const suitCards = legalCards.filter((c) => c.suit === leadSuit);
        const pool = suitCards.length > 0 ? suitCards : legalCards;
        const pick = needPoints
          ? pool.reduce((best, card) => (card.points > best.points ? card : best))
          : pool.reduce((best, card) => (card.points < best.points ? card : best));
        if (trumpSuit && pick.suit === trumpSuit && !publicState.trumpRevealed) {
          const nonTrump = legalCards.filter((c) => c.suit !== trumpSuit);
          if (nonTrump.length > 0) {
            return { type: "play_card", cardId: nonTrump[0]!.id };
          }
        }
        return { type: "play_card", cardId: pick.id };
      }

      const lowest = legalCards.reduce((min, card) =>
        card.points < min.points || (card.points === min.points && card.rank < min.rank) ? card : min
      );
      return { type: "play_card", cardId: lowest.id };
    }

    if (publicState.phase === "STAKE_MULTIPLIER") {
      if (publicState.canRedouble) {
        return { type: "pass" };
      }
      if (publicState.canDouble) {
        return { type: "pass" };
      }
      return { type: "pass" };
    }

    throw new Error(`Heuristic bot has no legal action in phase ${publicState.phase}`);
  },
};
