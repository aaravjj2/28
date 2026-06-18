import type { RoundResult, Seat, Team, Trick } from "./types";
import { evaluateThaniResult } from "./thani";
import {
  getAdjustedBidTarget,
  getRuleProfile,
  getStakeLevel,
  getStakePoints,
  type RuleProfile,
  type RuleProfileId,
} from "./ruleProfiles";
import { seatToTeam } from "./utils";

export function sumTeamTrickPoints(tricks: Trick[], team: Team): number {
  return tricks
    .filter((trick) => trick.winnerTeam === team)
    .reduce((sum, trick) => sum + trick.points, 0);
}

export function getCapturedPointsByTeam(tricks: Trick[]): { teamA: number; teamB: number } {
  return {
    teamA: sumTeamTrickPoints(tricks, "A"),
    teamB: sumTeamTrickPoints(tricks, "B"),
  };
}

export function getEffectiveTeamPoints(
  tricks: Trick[],
  team: Team,
  profile: RuleProfile
): number {
  let points = sumTeamTrickPoints(tricks, team);
  if (profile.totalPoints === 29 && tricks.length > 0) {
    const lastTrick = tricks[tricks.length - 1];
    if (lastTrick?.winnerTeam === team) {
      points += 1;
    }
  }
  return points;
}

export function assertCapturedCardPointsTotal28(tricks: Trick[]): void {
  const total = tricks.reduce((sum, trick) => sum + trick.points, 0);
  if (total !== 28) {
    throw new Error(`Captured trick points must total 28, got ${total}`);
  }
}

/** @deprecated use assertCapturedCardPointsTotal28 */
export function assertCapturedPointsTotal28(tricks: Trick[]): void {
  assertCapturedCardPointsTotal28(tricks);
}

export function scoreRound(
  tricks: Trick[],
  biddingTeam: Team,
  bid: number,
  declarerSeat: Seat,
  options: {
    profileId?: RuleProfileId;
    bidderPairDeclared?: boolean;
    defenderPairDeclared?: boolean;
    thaniDeclared?: boolean;
    thaniWinPoints?: number;
    thaniLossPoints?: number;
    honoursStakeResolved?: number | null;
    doubleMultiplier?: number;
  } = {}
): RoundResult {
  assertCapturedCardPointsTotal28(tricks);

  const profile = getRuleProfile(options.profileId ?? "standard_28");
  const bidderPairDeclared = options.bidderPairDeclared ?? false;
  const defenderPairDeclared = options.defenderPairDeclared ?? false;
  const thaniDeclared = options.thaniDeclared ?? false;
  const doubleMultiplier = options.doubleMultiplier ?? 1;

  const captured = getCapturedPointsByTeam(tricks);
  const biddingTeamPoints = getEffectiveTeamPoints(tricks, biddingTeam, profile);

  const adjustedBidTarget = getAdjustedBidTarget(
    bid,
    profile,
    bidderPairDeclared,
    defenderPairDeclared
  );

  const stakePoints = getStakePoints(bid, profile, {
    honoursStakeResolved: options.honoursStakeResolved ?? undefined,
    doubleMultiplier,
  });

  let biddingTeamWon: boolean;
  let matchPointsAwarded: number;
  let thaniWon: boolean | undefined;

  if (thaniDeclared) {
    thaniWon = evaluateThaniResult(tricks, declarerSeat);
    biddingTeamWon = thaniWon;
    matchPointsAwarded = thaniWon
      ? (options.thaniWinPoints ?? profile.thaniWinPoints)
      : -(options.thaniLossPoints ?? profile.thaniLossPoints);
  } else {
    biddingTeamWon = biddingTeamPoints >= adjustedBidTarget;
    matchPointsAwarded = biddingTeamWon ? stakePoints : -stakePoints;
  }

  const matchPointWinner: Team | null = biddingTeamWon
    ? biddingTeam
    : biddingTeam === "A"
      ? "B"
      : "A";

  return {
    biddingTeam,
    bid,
    adjustedBidTarget,
    declarerSeat,
    teamAPoints: captured.teamA,
    teamBPoints: captured.teamB,
    biddingTeamWon,
    matchPointWinner,
    stakeLevel: getStakeLevel(bid, profile),
    stakePoints,
    matchPointsAwarded,
    stakeMultiplier: doubleMultiplier,
    honoursStakeResolved: options.honoursStakeResolved ?? null,
    bidderPairDeclared,
    defenderPairDeclared,
    thaniDeclared,
    thaniWon,
  };
}

export function applyMatchScore(
  matchScore: { teamA: number; teamB: number },
  roundResult: RoundResult
): { teamA: number; teamB: number } {
  const points = roundResult.matchPointsAwarded;
  if (roundResult.matchPointWinner === "A") {
    return {
      teamA: matchScore.teamA + Math.max(points, 0),
      teamB: matchScore.teamB + (points < 0 ? Math.abs(points) : 0),
    };
  }
  if (roundResult.matchPointWinner === "B") {
    return {
      teamA: matchScore.teamA + (points < 0 ? Math.abs(points) : 0),
      teamB: matchScore.teamB + Math.max(points, 0),
    };
  }
  return matchScore;
}

/** Legacy single-point apply for backward compat in simple tests. */
export function applyMatchScoreSimple(
  matchScore: { teamA: number; teamB: number },
  roundWinner: Team
): { teamA: number; teamB: number } {
  if (roundWinner === "A") {
    return { teamA: matchScore.teamA + 1, teamB: matchScore.teamB };
  }
  return { teamA: matchScore.teamA, teamB: matchScore.teamB + 1 };
}

export function isMatchOver(
  matchScore: { teamA: number; teamB: number },
  targetScore: number
): boolean {
  return matchScore.teamA >= targetScore || matchScore.teamB >= targetScore;
}

export function getMatchWinner(
  matchScore: { teamA: number; teamB: number },
  targetScore: number
): Team | null {
  if (matchScore.teamA >= targetScore) {
    return "A";
  }
  if (matchScore.teamB >= targetScore) {
    return "B";
  }
  return null;
}

export function getStakeForBid(
  bid: number,
  profile: RuleProfile = getRuleProfile("standard_28"),
  options?: { honoursStakeResolved?: number; doubleMultiplier?: number }
) {
  return {
    level: getStakeLevel(bid, profile),
    points: getStakePoints(bid, profile, options),
  };
}
