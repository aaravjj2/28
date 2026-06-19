# Online 28

Online multiplayer web version of the Indian trick-taking card game **28**.

This project is a social card game for friends. It is **not** a gambling app and has **no** real-money features, payments, wallets, or ranked wagering.

Repository: https://github.com/aaravjj2/28

## Rules of 28 (summary)

- Four players in fixed partnerships: Seat 0 + Seat 2 (Team A) vs Seat 1 + Seat 3 (Team B).
- 32-card deck (7 through Ace in four suits).
- Each round: initial deal, bidding, hidden trump selection by declarer, remaining deal, eight tricks.
- Card points in a round always total **28**.
- First partnership to reach the match target score wins (default 6 match points).

## Architecture

Monorepo with three packages:

| Package | Role |
|---------|------|
| `packages/shared` | Pure deterministic game engine (deal, bidding, legal moves, tricks, scoring, public state) |
| `apps/server` | Authoritative Socket.IO server; validates intents and emits per-player public state |
| `apps/web` | Dumb React client; renders server state and sends intents only |

The server owns all rules. The client never computes legal moves, trick winners, trump visibility, or scores.

## Tech stack

- TypeScript, pnpm workspaces
- Node.js 20+ server with Socket.IO
- React + Vite frontend
- Vitest (unit/component/integration)
- Playwright (E2E)

## Local setup

```bash
pnpm install
cp .env.example .env
```

Run server and web in separate terminals:

```bash
pnpm dev:server
pnpm dev:web
```

Open http://localhost:5173

## Commands

```bash
pnpm typecheck      # TypeScript project references
pnpm test           # Vitest unit/component/integration tests
pnpm test:e2e       # Playwright browser tests
pnpm test:all       # typecheck + test + e2e
pnpm dev:server     # Socket.IO server on :3001
pnpm dev:web        # Vite dev server on :5173
```

Build for production:

```bash
pnpm --filter @twenty-eight/web build
pnpm --filter @twenty-eight/server start
```

## Environment variables

Copy `.env.example` to `.env`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `development` | `production` enables strict CORS |
| `PORT` | `3001` | Server port |
| `WEB_ORIGIN` | `http://localhost:5173` | Allowed browser origin in production |
| `VITE_SERVER_URL` | empty in dev | Socket URL for web build; empty uses Vite proxy |
| `MATCH_TARGET_SCORE` | `6` | Match points to win (use `1` for fast E2E) |
| `TURN_TIMEOUT_MS` | `30000` | Server turn timer |

## Testing

```bash
pnpm test
```

Coverage includes:

- Shared engine unit tests and 1,000 random simulation rounds
- Server room lifecycle, hidden-state checks, illegal move rejection
- React component tests
- Playwright E2E: lobby → full round → reconnect → match finish

## E2E testing

```bash
pnpm test:e2e
```

Playwright starts the server (`MATCH_TARGET_SCORE=1`) and Vite dev server automatically. E2E clicks only `.hand-card.legal` buttons enabled by server-provided `legalCardIds`.

## Security model

See [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md).

Highlights:

- Server-authoritative play
- Per-player `PublicGameState` serialization
- Hidden trump, other hands, and deck order never sent to clients
- Session token required for reconnection and actions

## Hidden-state model

Each player receives only:

- Their own `myHand`
- Other players' **hand counts**, not cards
- Trump suit only when rules allow (declarer before reveal; everyone after reveal)
- `legalCardIds` only on their turn during play

## Deployment notes

### Server

1. Set `NODE_ENV=production`
2. Set `PORT` (e.g. `3001`)
3. Set `WEB_ORIGIN` to your deployed web URL (exact origin, no wildcard)
4. Start: `pnpm --filter @twenty-eight/server start`
5. Health check: `GET /health` → `{"status":"ok"}`

### Web

1. Build with `VITE_SERVER_URL=https://your-api.example.com`
2. Serve `apps/web/dist` via any static host (Vercel, Netlify, S3+CDN, nginx)
3. Ensure HTTPS and CORS origin match

Example production env:

```env
NODE_ENV=production
PORT=3001
WEB_ORIGIN=https://28.example.com
VITE_SERVER_URL=https://api.28.example.com
```

## Rematch behavior

**Rematch preserves seats.** After match over, the host can rematch; all four connected players return to the lobby with the same seats. Match score resets when a new game starts.

## Rule profiles

The host can choose a rule profile in the lobby before starting:

| Profile | Notes |
|---------|--------|
| `standard_28` | Pagat baseline — opens at 14 |
| `house_28_16_start` | House rules — opens at 16, 4-point stake from bid 20+ |
| `future_29_placeholder` | Experimental 29-point variant |

Set the server default with `RULE_PROFILE=house_28_16_start` in `.env`.

## Known MVP limitations

- In-memory rooms only (lost on server restart)
- No accounts or authentication beyond session tokens
- No matchmaking, voice chat, tournaments, or cosmetics
- Practice bots are available in the lobby (host can add/remove before start); bot play is not tuned for production
- No Redis, persistent audit log, or collusion detection
- Host does not auto-transfer mid-game if host disconnects
- Single Node process (no horizontal scaling)

## Future roadmap

- Persistent rooms (Redis)
- User accounts and friend invites
- Spectator mode
- Mobile layout polish
- Production auth and rate limiting
- Horizontal scaling with sticky sessions

## Health endpoint

```
GET /health
→ 200 {"status":"ok"}
```
