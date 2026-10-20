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
- Real bugs in tools reach the model looking like an expected "not found".
- The API client is created at import, so the agent loop can't be unit-tested.
- No stop-reason checks, raw API errors shown to users, no input validation.
- Bulky tool results; no cancellation or timeout.
- Company names must match exactly ("Acme", "GLBX" fail).

## Process

- Used Claude Code. The progress change was made during my initial review, before I started timing.
