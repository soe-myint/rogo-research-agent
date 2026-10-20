import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentEvent } from "./agent.ts";
import { executeToolCalls } from "./tools.ts";

const call = (id: string, name: string, input: Record<string, unknown>) =>
  ({ type: "tool_use", id, name, input }) as Anthropic.ToolUseBlock;

describe("executeToolCalls", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs a turn's calls concurrently and keeps their order", async () => {
    let settled = false;
    const pending = executeToolCalls(
      [
        call("a", "getFinancials", { company: "Acme Corp" }),
        call("b", "getFinancials", { company: "Globex Inc" }),
        call("c", "getCompanyProfile", { company: "Initech" }),
      ],
      () => {},
    );
    pending.then(() => (settled = true));

    // The slowest tool takes 800ms; run one after another, these would need 2050ms.
    await vi.advanceTimersByTimeAsync(800);
    expect(settled).toBe(true);
    expect((await pending).map((r) => r.tool_use_id)).toEqual(["a", "b", "c"]);
  });

  it("flags a failed call with is_error", async () => {
    const events: AgentEvent["type"][] = [];
    const pending = executeToolCalls([call("a", "getFinancials", { company: "Nope" })], (e) =>
      events.push(e.type),
    );
    await vi.advanceTimersByTimeAsync(800);

    expect(await pending).toEqual([
      {
        type: "tool_result",
        tool_use_id: "a",
        content: 'no financials found for "Nope"',
        is_error: true,
      },
    ]);
    expect(events).toEqual(["tool_start", "tool_failed", "tool_end"]);
  });
});
