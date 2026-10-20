import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAgent, type AgentEvent, type ModelClient } from "./agent.ts";

const text = (value: string) => ({ type: "text", text: value }) as Anthropic.TextBlock;
const toolUse = (id: string, name: string, input: Record<string, unknown>) =>
  ({ type: "tool_use", id, name, input }) as Anthropic.ToolUseBlock;

/**
 * A client that plays back one scripted response per model call (repeating the last
 * one) and records every request it receives.
 */
function fakeClient(turns: Anthropic.ContentBlock[][]) {
  const requests: Anthropic.MessageStreamParams[] = [];
  const client: ModelClient = {
    messages: {
      stream(params) {
        requests.push(structuredClone(params));
        const content = turns[Math.min(requests.length, turns.length) - 1];
        let onText = (_delta: string) => {};
        return {
          on(_event, listener) {
            onText = listener;
          },
          async finalMessage() {
            for (const block of content) if (block.type === "text") onText(block.text);
            const stop_reason = content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn";
            return { content, stop_reason } as Anthropic.Message;
          },
        };
      },
    },
  };
  return { client, requests };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("runAgent", () => {
  // All of a turn's results must go back in one message; splitting them discourages the
  // model from making parallel calls.
  it("sends tool results back to the model in call order, then answers", async () => {
    const { client, requests } = fakeClient([
      [toolUse("a", "getFinancials", { company: "Acme Corp" }), toolUse("b", "getCompanyProfile", { company: "Initech" })],
      [text("Acme Corp is growing faster.")],
    ]);
    const pending = runAgent("Compare them", () => {}, client);
    await vi.advanceTimersByTimeAsync(800);

    expect((await pending).answer).toBe("Acme Corp is growing faster.");
    const results = requests[1].messages.at(-1)!;
    expect(results.role).toBe("user");
    expect((results.content as Anthropic.ToolResultBlockParam[]).map((r) => r.tool_use_id)).toEqual(["a", "b"]);
  });

  // Bounds the worst case: a model that keeps calling tools can't run (and bill) forever.
  it("gives up after 12 model calls if the model never stops calling tools", async () => {
    const { client, requests } = fakeClient([[toolUse("a", "searchCompanies", { query: "Acme" })]]);
    const pending = runAgent("Loop forever", () => {}, client);
    await vi.advanceTimersByTimeAsync(12 * 250);

    expect((await pending).answer).toMatch(/ran out of research steps/);
    expect(requests).toHaveLength(12);
  });
});

// Each test locks in one change behind the measured speed-ups in NOTES.md. Real latency
// depends on the API, so actual timings are measured separately; these catch the code
// changes that would undo them.
describe("runAgent performance guarantees", () => {
  // Guards the editor-pass removal (27.0s → 16.1s).
  it("makes one model call per turn, with no extra polish call after the answer", async () => {
    const { client, requests } = fakeClient([[text("Acme Robotics.")]]);
    const result = await runAgent("Who is growing fastest?", () => {}, client);

    expect(result.answer).toBe("Acme Robotics.");
    expect(requests).toHaveLength(1);
  });

  // Guards parallel tools (five lookups: 4.0s → 0.8s).
  it("runs a turn's tool calls concurrently", async () => {
    const { client } = fakeClient([
      [toolUse("a", "getFinancials", { company: "Acme Corp" }), toolUse("b", "getFinancials", { company: "Globex Inc" })],
      [text("Done.")],
    ]);
    let settled = false;
    void runAgent("Compare them", () => {}, client).then(() => (settled = true));

    // Each lookup takes 800ms; one after another they would need 1600ms.
    await vi.advanceTimersByTimeAsync(800);
    expect(settled).toBe(true);
  });

  // Guards the effort change (README questions: 68.7s → 56.7s). Fails if ROGO_EFFORT is set.
  it("asks for medium thinking effort on every call", async () => {
    const { client, requests } = fakeClient([[toolUse("a", "searchCompanies", { query: "Acme" })], [text("Done.")]]);
    const pending = runAgent("Find Acme", () => {}, client);
    await vi.advanceTimersByTimeAsync(250);
    await pending;

    expect(requests.map((r) => r.output_config?.effort)).toEqual(["medium", "medium"]);
  });

  // Guards answer streaming (first words at ~4s instead of ~8s).
  it("streams the answer's text as it arrives", async () => {
    const { client } = fakeClient([[text("Acme Robotics.")]]);
    const events: AgentEvent[] = [];
    await runAgent("Who is growing fastest?", (e) => events.push(e), client);

    expect(events).toEqual([
      { type: "iteration", n: 1 },
      { type: "text", delta: "Acme Robotics." },
    ]);
  });
});
