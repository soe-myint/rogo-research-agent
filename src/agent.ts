/**
 * The research agent: a tool-use loop over the mocked research tools.
 */

import Anthropic from "@anthropic-ai/sdk";
import { companies } from "./data.ts";
import { executeToolCalls, toolSchemas } from "./tools.ts";

const MODEL = process.env.ROGO_MODEL ?? "claude-sonnet-5";
const EFFORT = (process.env.ROGO_EFFORT ?? "medium") as Anthropic.OutputConfig["effort"];
const MAX_ITERATIONS = 12;

/** The part of the SDK client the agent uses, so tests can pass a fake. */
export interface ModelClient {
  messages: {
    stream(params: Anthropic.MessageStreamParams): {
      on(event: "text", listener: (delta: string) => void): unknown;
      finalMessage(): Promise<Anthropic.Message>;
    };
  };
}

const defaultClient: ModelClient = new Anthropic();

const SYSTEM_PROMPT = `You are Rogo Research, an assistant that answers questions about companies for financial analysts.

Use the tools to look up companies, profiles, financials and source documents. Answer the analyst's question: lead with the direct answer, then the figures that support it. Keep it brief and easy to follow.

Our coverage universe:
${companies
  .map(
    (c) =>
      `- ${c.name} (${c.ticker}) — ${c.sector}, HQ ${c.hq}, ${c.employees} employees. ${c.description}`,
  )
  .join("\n")}
`;

export type AgentEvent =
  | { type: "iteration"; n: number }
  | { type: "text"; delta: string }
  | { type: "tool_start"; id: string; name: string; input: unknown }
  | { type: "tool_end"; id: string; name: string; ms: number }
  | { type: "tool_failed"; id: string; name: string; message: string };

export interface AgentResult {
  answer: string;
  iterations: number;
  usage: { inputTokens: number; outputTokens: number };
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

export async function runAgent(
  question: string,
  onEvent: (event: AgentEvent) => void,
  client: ModelClient = defaultClient,
): Promise<AgentResult> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];

  let answer = "";
  let iterations = 0;
  const usage = { inputTokens: 0, outputTokens: 0 };

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    onEvent({ type: "iteration", n: iterations });

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: EFFORT },
      system: SYSTEM_PROMPT,
      tools: toolSchemas,
      messages,
    });
    // Forward text as it's generated, so the UI can show the answer while it's written.
    stream.on("text", (delta) => onEvent({ type: "text", delta }));
    const response = await stream.finalMessage();
    usage.inputTokens += response.usage.input_tokens;
    usage.outputTokens += response.usage.output_tokens;

    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUses.length === 0) {
      answer = textOf(response);
      break;
    }

    const toolResults = await executeToolCalls(toolUses, onEvent);
    messages.push({ role: "user", content: toolResults });
  }

  if (!answer) {
    answer =
      "I looked at a number of sources but ran out of research steps before I could pull the answer together. Try asking a narrower question.";
  }

  return { answer, iterations, usage };
}
