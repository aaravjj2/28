import { createServer } from "node:http";
import { Server } from "socket.io";
import { loadServerConfig } from "./config";
import { cleanupStaleRooms } from "./roomCleanup";
import { BotScheduler } from "./bots/botScheduler";
import { registerSocketHandlers } from "./socketHandlers";
import { RoomManager } from "./roomManager";
import { TurnTimerManager } from "./timers";

const CLEANUP_INTERVAL_MS = 60_000;

export function createApp() {
  const config = loadServerConfig();
  const httpServer = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });

  const corsOrigin = config.isProduction ? config.webOrigin : true;
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
    },
  });

  const roomManager = new RoomManager(Math.random, {
    matchTargetScore: config.matchTargetScore,
    ruleProfileId: config.ruleProfileId,
    thaniEnabled: config.thaniEnabled,
  });
  const timerManager = new TurnTimerManager(config.turnTimeoutMs);
  const botScheduler = new BotScheduler(roomManager, {
    instantActions: config.botInstantActions,
  });
  registerSocketHandlers(io, roomManager, timerManager, botScheduler);

  const cleanupTimer = setInterval(() => {
    cleanupStaleRooms(roomManager.getRooms());
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();

  return { httpServer, io, roomManager, timerManager, botScheduler, config, cleanupTimer };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { httpServer, config } = createApp();
  httpServer.listen(config.port, () => {
    console.log(`28 game server listening on port ${config.port}`);
  });
}
