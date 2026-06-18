import type { Card, Seat, Suit, Team, Trick } from "./types";
import { getAdjustedBidTarget, getStakeLevel, getStakePoints, type RuleProfile } from "./ruleProfiles";

export type PointTracker = {
  teamACaptured: number;
  teamBCaptured: number;
  biddingTeamCaptured: number;
  defendingTeamCaptured: number;
  pointsRemaining: number;
  bidTarget: number;
  adjustedBidTarget: number;
  stakeLevel: ReturnType<typeof getStakeLevel>;
  stakePoints: number;
  stakeIfWin: number;
  stakeIfLose: number;
};

export function computePointTracker(params: {
  tricks: Trick[];
  biddingTeam: Team;
  bid: number;
  profile: RuleProfile;
  bidderPairDeclared: boolean;
  defenderPairDeclared: boolean;
  honoursStakeResolved?: number | null;
  doubleMultiplier?: number;
}): PointTracker {
  const teamACaptured = params.tricks
    .filter((t) => t.winnerTeam === "A")
    .reduce((s, t) => s + t.points, 0);
  const teamBCaptured = params.tricks
    .filter((t) => t.winnerTeam === "B")
    .reduce((s, t) => s + t.points, 0);

  const biddingTeamCaptured =
    params.biddingTeam === "A" ? teamACaptured : teamBCaptured;
  const defendingTeamCaptured =
    params.biddingTeam === "A" ? teamBCaptured : teamACaptured;

  const adjustedBidTarget = getAdjustedBidTarget(
    params.bid,
    params.profile,
    params.bidderPairDeclared,
    params.defenderPairDeclared
  );

  const stakePoints = getStakePoints(params.bid, params.profile, {
    honoursStakeResolved: params.honoursStakeResolved ?? undefined,
    doubleMultiplier: params.doubleMultiplier ?? 1,
  });

  return {
    teamACaptured,
    teamBCaptured,
    biddingTeamCaptured,
    defendingTeamCaptured,
    pointsRemaining: params.profile.totalPoints - teamACaptured - teamBCaptured,
    bidTarget: params.bid,
    adjustedBidTarget,
    stakeLevel: getStakeLevel(params.bid, params.profile),
    stakePoints,
    stakeIfWin: stakePoints,
    stakeIfLose: stakePoints,
  };
}

export function computeLivePointTracker(params: {
  completedTricks: Trick[];
  biddingTeam: Team;
  bid: number;
  profile: RuleProfile;
  bidderPairDeclared: boolean;
  defenderPairDeclared: boolean;
  honoursStakeResolved?: number | null;
  doubleMultiplier?: number;
}): PointTracker {
  return computePointTracker({
    tricks: params.completedTricks,
    biddingTeam: params.biddingTeam,
    bid: params.bid,
    profile: params.profile,
    bidderPairDeclared: params.bidderPairDeclared,
    defenderPairDeclared: params.defenderPairDeclared,
    honoursStakeResolved: params.honoursStakeResolved,
    doubleMultiplier: params.doubleMultiplier,
  });
}
