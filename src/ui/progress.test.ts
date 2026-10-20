import { describe, expect, it } from "vitest";
import type { ChatEvent } from "../protocol.ts";
import { applyEvent, initialProgress, readEvents } from "./progress.ts";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of readEvents(body)) events.push(event);
  return events;
}

describe("readEvents", () => {
  it("reassembles events split across chunks", async () => {
    const events = await collect(
      streamOf(['{"type":"itera', 'tion","n":1}\n{"type":"answer",', '"answer":"hi"}\n']),
    );
    expect(events).toEqual([
      { type: "iteration", n: 1 },
      { type: "answer", answer: "hi" },
    ]);
  });

  it("handles a final line with no trailing newline", async () => {
    const events = await collect(streamOf(['{"type":"editing"}\n{"type":"answer","answer":"x"}']));
    expect(events.map((e) => e.type)).toEqual(["editing", "answer"]);
  });
});

describe("applyEvent", () => {
  const run = (events: ChatEvent[]) => events.reduce(applyEvent, initialProgress);

  it("tracks each tool call from start to finish", () => {
    const progress = run([
      { type: "iteration", n: 1 },
      { type: "tool_start", id: "a", name: "getFinancials", input: { company: "Acme Corp" } },
      { type: "tool_start", id: "b", name: "searchDocuments", input: { query: "risk" } },
      { type: "tool_end", id: "a", name: "getFinancials", ms: 800 },
    ]);
    expect(progress.phase).toBe("Researching");
    expect(progress.steps).toEqual([
      { id: "a", label: "Pulling Acme Corp financials", status: "done", ms: 800 },
      { id: "b", label: 'Searching all documents for "risk"', status: "running" },
    ]);
  });

  it("keeps a failed tool marked failed after it ends", () => {
    const progress = run([
      { type: "tool_start", id: "a", name: "getFinancials", input: { company: "Acme" } },
      { type: "tool_failed", id: "a", name: "getFinancials", message: "no financials found" },
      { type: "tool_end", id: "a", name: "getFinancials", ms: 800 },
    ]);
    expect(progress.steps[0]).toMatchObject({ status: "failed", error: "no financials found" });
  });

  it("moves through the phases of a run", () => {
    expect(run([{ type: "iteration", n: 1 }]).phase).toBe("Planning the research");
    expect(run([{ type: "iteration", n: 2 }]).phase).toBe("Reviewing what it found");
    expect(run([{ type: "editing" }]).phase).toBe("Writing up the answer");
  });
});
