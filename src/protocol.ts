/**
 * What POST /api/chat streams back: newline-delimited JSON, one event per line.
 * Progress events arrive as the agent works, then exactly one `answer` or `error`.
 */

import type { AgentEvent } from "./agent.ts";

export type ChatEvent =
  | AgentEvent
  | { type: "answer"; answer: string }
  | { type: "error"; message: string };
