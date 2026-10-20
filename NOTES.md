# Notes

## Changes

- **Live progress while the agent works.** The agent already emitted progress events, but they only went to the
  server log while the UI waited ~25s on one blocking response. `/api/chat` now streams those events, and the UI
  shows the current phase, elapsed time and each research step. Trade-off: errors now arrive in a 200 response, so
  logging must capture them.
- **Removed the editor pass.** A second model call re-sent the whole transcript to rewrite an already-good answer,
  risking changed figures. Its style guidance moved into the system prompt. On "Which company is growing fastest?":
  27.0s → 16.1s, 23.7K → 10.3K input tokens.
- **Tools run in parallel.** The model already asks for several lookups per turn, but the loop ran them one by one.
  They now run concurrently (results keep their order) and failures are flagged with `is_error`. Five lookups:
  4.0s → 0.8s; same question 16.1s → 12.1s.

## Decisions

- Kept `ROGO_MODEL` at the default so before/after numbers are comparable.

## Noticed, not fixed

- Real bugs in tools reach the model looking like an expected "not found".
- The API client is created at import, so the agent loop can't be unit-tested.
- No stop-reason checks, raw API errors shown to users, no input validation.
- Final answer not streamed; no prompt caching; bulky tool results; no cancellation or timeout.
- Company names must match exactly ("Acme", "GLBX" fail).

## Process

- Used Claude Code. The progress change was made during my initial review, before I started timing.
