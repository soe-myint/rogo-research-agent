/**
 * Turns the events streamed from /api/chat into the progress shown while the
 * agent works.
 */

import type { ChatEvent } from "../protocol.ts";

export interface Step {
  id: string;
  label: string;
  status: "running" | "done" | "failed";
  ms?: number;
  error?: string;
}

export interface Progress {
  phase: string;
  steps: Step[];
}

export const initialProgress: Progress = { phase: "Reading your question", steps: [] };

/** A plain-English line for a tool call, e.g. `Pulling Acme Corp financials`. */
export function describeTool(name: string, input: unknown): string {
  const args = (input ?? {}) as Record<string, unknown>;
  switch (name) {
    case "searchCompanies":
      return `Searching companies for "${args.query}"`;
    case "getCompanyProfile":
      return `Reading ${args.company}'s profile`;
    case "getFinancials":
      return `Pulling ${args.company} financials`;
    case "searchDocuments":
      return args.company
        ? `Searching ${args.company} documents for "${args.query}"`
        : `Searching all documents for "${args.query}"`;
    default:
      return `Running ${name}`;
  }
}

function updateStep(progress: Progress, id: string, change: Partial<Step>): Progress {
  return {
    ...progress,
    steps: progress.steps.map((step) => (step.id === id ? { ...step, ...change } : step)),
  };
}

export function applyEvent(progress: Progress, event: ChatEvent): Progress {
  switch (event.type) {
    case "iteration":
      return {
        ...progress,
        phase: event.n === 1 ? "Planning the research" : "Reviewing what it found",
      };
    case "tool_start":
      return {
        phase: "Researching",
        steps: [
          ...progress.steps,
          { id: event.id, label: describeTool(event.name, event.input), status: "running" },
        ],
      };
    case "tool_failed":
      return updateStep(progress, event.id, { status: "failed", error: event.message });
    case "tool_end": {
      const step = progress.steps.find((s) => s.id === event.id);
      return updateStep(progress, event.id, {
        status: step?.status === "failed" ? "failed" : "done",
        ms: event.ms,
      });
    }
    case "editing":
      return { ...progress, phase: "Writing up the answer" };
    default:
      return progress;
  }
}

/** Yields each event of a newline-delimited JSON stream as soon as its line is complete. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      if (line.trim()) yield JSON.parse(line);
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer);
}
