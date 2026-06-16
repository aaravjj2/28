# Manual Codex Checklist

Use this checklist while working with Codex.

## Before First Code Generation

- Paste `.codex/MASTER_IMPLEMENTATION_PROMPT.md`.
- Tell Codex to only implement Task 01.
- Tell Codex not to build UI yet.

## After Engine Code

Run:

```bash
pnpm install
pnpm test
pnpm typecheck
```

Do not continue if tests fail.

## Before Server

Ask Codex:

"Show me how PublicGameState hides other hands and hidden trump. Then implement Task 02."

## Before Frontend

Ask Codex:

"Do not change rules. Build only minimal UI that consumes PublicGameState."

## Before Launch

- Run 1,000 simulation rounds.
- Manually play 20 matches.
- Inspect network payloads for hidden state leaks.
- Test refresh/reconnect.
- Test phone layout.
