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
- **Thinking effort `medium`.** At the default `high`, most of the answer call was hidden thinking. Across the five
  README questions, `medium` cut total time 68.7s → 56.7s with no factual errors found (vs 4 at `high`). Results
  and all answers: `docs/effort-comparison.md`. Override with `ROGO_EFFORT`.
- **Streamed answers.** Each model turn now streams, and the UI shows the answer while it's being written. Text from
  a turn that ends in tool calls is a preamble ("I'll pull…"), so it's cleared when the next turn starts. Across the
  five README questions, first words appear at 3.4–6.3s instead of when the answer finishes (8.9–12.5s).
- **Performance overall:** "Which company is growing fastest?" went from 27.0s to 8.2s (editor removal, parallel
  tools, `medium` effort), and its first words now appear at ~4s.
- **Agent loop tests.** `runAgent` takes its client as a parameter, so the loop is tested against a scripted fake:
  tool results go back in order, and it stops after 12 calls. Four tests lock in the speed-ups (one call per turn,
  concurrent tools, `medium` effort, streamed text); I checked each one fails when its change is undone.
- **Tool bugs vs expected failures.** Only `ToolError` messages (e.g. an unknown company) reach the model. Any other
  exception is a bug: it's logged with its stack trace and the model gets a generic error.
- **Structured logs for tracking errors.** Each log line is one JSON object tagged with a request ID, so one
  question's lines can be pulled together, and each request ends with a summary line (time, model calls, tokens).
  Errors keep their stack trace and are also appended to `logs/errors.jsonl` for review; error messages shown to
  users include the request ID. In production, the JSON output would go to Datadog and errors to Sentry instead;
  `src/log.ts` is the one place to wire them in.
- **Cancellation and a time limit.** If the user disconnects, the in-flight model call is aborted and no further
  calls start. Each request also stops after 2 minutes (`ROGO_TIMEOUT_MS`) with a clear message, instead of a
  spinner that never ends.

## Decisions

- Kept `ROGO_MODEL` at the default so before/after numbers are comparable.

## Noticed, not fixed

- **Prompt caching (prototyped, not merged).** The tools and system prompt (~1.3K tokens) are identical on every
  call, so they could be cached and read back at 10% of the input price. A quick test showed ~20–50% lower input
  cost per question once warm (~8% on a cold cache), but I would need to research more to understand the saving
  before merging the change. The change:

  ```diff
  -      system: SYSTEM_PROMPT,
  +      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
  ```
- No tests for the HTTP endpoint or UI rendering, and real latency is only measured by hand. Each needs a medium
  amount of change (splitting the server's app setup from `listen()`, a browser-like test environment, a benchmark
  script against the live API), and I didn't have time for them. With more time, they're important to add.
- No stop-reason checks, raw API errors shown to users, no input validation.
- Bulky tool results.
- Company names must match exactly ("Acme", "GLBX" fail).

## Process

- Used Claude Code. The progress change was made during my initial review, before I started timing.
