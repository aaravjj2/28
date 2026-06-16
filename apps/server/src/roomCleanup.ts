import type { Room } from "./roomManager";

export const EMPTY_LOBBY_TTL_MS = 15 * 60 * 1000;
export const INACTIVE_ROOM_TTL_MS = 2 * 60 * 60 * 1000;

export function shouldDeleteRoom(room: Room, now = Date.now()): boolean {
  if (room.game?.state.phase === "PLAYING_TRICKS" || room.game?.state.phase === "BIDDING") {
    return false;
  }

  if (room.game?.state.phase === "TRUMP_SELECTION") {
    return false;
  }

  const inactiveMs = now - room.lastActivityAt;

  if (!room.locked && room.players.size === 0) {
    return inactiveMs >= EMPTY_LOBBY_TTL_MS;
  }

  if (!room.locked && room.players.size > 0) {
    const allDisconnected = [...room.players.values()].every((player) => !player.connected);
    if (allDisconnected && inactiveMs >= EMPTY_LOBBY_TTL_MS) {
      return true;
    }
    return false;
  }

  if (room.game?.state.phase === "MATCH_OVER" || room.game?.state.phase === "ROUND_SCORING") {
    return inactiveMs >= INACTIVE_ROOM_TTL_MS;
  }

  return false;
}

export function cleanupStaleRooms(rooms: Map<string, Room>, now = Date.now()): string[] {
  const deleted: string[] = [];
  for (const [code, room] of rooms.entries()) {
    if (shouldDeleteRoom(room, now)) {
      rooms.delete(code);
      deleted.push(code);
    }
  }
  return deleted;
}
