import { DEFAULT_TARGET_SCORE, type RuleProfileId } from "@twenty-eight/shared";
import { DEFAULT_TURN_TIMEOUT_MS } from "./timers";

export type ServerConfig = {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  webOrigin: string;
  matchTargetScore: number;
  turnTimeoutMs: number;
  botInstantActions: boolean;
  ruleProfileId: RuleProfileId;
  thaniEnabled: boolean;
};

export function loadServerConfig(): ServerConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
  const ruleProfileRaw = process.env.RULE_PROFILE ?? "standard_28";

  return {
    nodeEnv,
    isProduction,
    port: Number(process.env.PORT ?? 3001),
    webOrigin,
    matchTargetScore: Number(process.env.MATCH_TARGET_SCORE ?? DEFAULT_TARGET_SCORE),
    turnTimeoutMs: Number(process.env.TURN_TIMEOUT_MS ?? DEFAULT_TURN_TIMEOUT_MS),
    botInstantActions: process.env.BOT_INSTANT_ACTIONS === "true",
    ruleProfileId: ruleProfileRaw as RuleProfileId,
    thaniEnabled: process.env.THANI_ENABLED !== "false",
  };
}
