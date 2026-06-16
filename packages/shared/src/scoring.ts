import type { RoundResult, Seat, Team, Trick } from "./types";
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

export function assertCapturedPointsTotal28(tricks: Trick[]): void {
  const total = tricks.reduce((sum, trick) => sum + trick.points, 0);
  if (total !== 28) {
    throw new Error(`Captured trick points must total 28, got ${total}`);
  }
}

export function scoreRound(
  tricks: Trick[],
  biddingTeam: Team,
  bid: number,
  declarerSeat: Seat
): RoundResult {
  assertCapturedPointsTotal28(tricks);

  const captured = getCapturedPointsByTeam(tricks);
  const biddingTeamPoints = biddingTeam === "A" ? captured.teamA : captured.teamB;
  const biddingTeamWon = biddingTeamPoints >= bid;
  const matchPointWinner: Team = biddingTeamWon
    ? biddingTeam
    : biddingTeam === "A"
      ? "B"
      : "A";

  return {
    biddingTeam,
    bid,
    declarerSeat,
    teamAPoints: captured.teamA,
    teamBPoints: captured.teamB,
    biddingTeamWon,
    matchPointWinner,
  };
}

export function applyMatchScore(
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
