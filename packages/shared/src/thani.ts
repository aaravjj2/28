import type { Seat, Trick } from "./types";

export type ThaniState = {
  active: boolean;
  declarerSeat: Seat;
  /** Partner of declarer sits out — never receives a turn. */
  partnerSeat: Seat;
};

export function createThaniState(declarerSeat: Seat): ThaniState {
  const partner = ((declarerSeat + 2) % 4) as Seat;
  return {
    active: true,
    declarerSeat,
    partnerSeat: partner,
  };
}

export function isSeatActiveInThani(thani: ThaniState | null, seat: Seat): boolean {
  if (!thani?.active) {
    return true;
  }
  return seat !== thani.partnerSeat;
}

export function validateThaniDeclaration(params: {
  thaniEnabled: boolean;
  thaniAlreadyDeclared: boolean;
  declarerSeat: Seat;
  seat: Seat;
  phase: string;
}): { ok: true } | { ok: false; reason: string } {
  if (!params.thaniEnabled) {
    return { ok: false, reason: "Thani is not enabled for this room" };
  }
  if (params.thaniAlreadyDeclared) {
    return { ok: false, reason: "Thani already declared" };
  }
  if (params.seat !== params.declarerSeat) {
    return { ok: false, reason: "Only the declarer can declare Thani" };
  }
  if (params.phase !== "THANI_DECLARATION" && params.phase !== "PLAYING_TRICKS") {
    return { ok: false, reason: "Thani can only be declared before the first trick" };
  }
  return { ok: true };
}

export function scoreThani(params: {
  tricks: Trick[];
  declarerSeat: Seat;
  winPoints: number;
  lossPoints: number;
}): { won: boolean; matchPoints: number; winnerTeam: "A" | "B" } {
  const declarerTeam = params.declarerSeat === 0 || params.declarerSeat === 2 ? "A" : "B";
  const partnerSeat = ((params.declarerSeat + 2) % 4) as Seat;

  const declarerWonAll = params.tricks.every(
    (trick) => trick.winnerPlayerId.includes(String(params.declarerSeat)) ||
      trick.playedCards.every((p) => p.seat !== partnerSeat) &&
      trick.winnerPlayerId === `player-${params.declarerSeat}`
  );

  // Declarer must win all 8 tricks; partner must win none
  let declarerTricks = 0;
  let partnerTricks = 0;
  for (const trick of params.tricks) {
    const winnerSeat = trick.playedCards.find((p) => p.playerId === trick.winnerPlayerId)?.seat;
    if (winnerSeat === params.declarerSeat) {
      declarerTricks += 1;
    }
    if (winnerSeat === partnerSeat) {
      partnerTricks += 1;
    }
  }

  const won = declarerTricks === 8 && partnerTricks === 0;
  const matchPoints = won ? params.winPoints : -params.lossPoints;

  return {
    won,
    matchPoints,
    winnerTeam: won ? declarerTeam : declarerTeam === "A" ? "B" : "A",
  };
}

export function countTricksBySeat(tricks: Trick[]): Record<Seat, number> {
  const counts: Record<Seat, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const trick of tricks) {
    const winner = trick.playedCards.find((p) => p.playerId === trick.winnerPlayerId);
    if (winner) {
      counts[winner.seat] = (counts[winner.seat] ?? 0) + 1;
    }
  }
  return counts;
}

export function evaluateThaniResult(tricks: Trick[], declarerSeat: Seat): boolean {
  const partnerSeat = ((declarerSeat + 2) % 4) as Seat;
  const counts = countTricksBySeat(tricks);
  return counts[declarerSeat] === 8 && counts[partnerSeat] === 0;
}
