import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import { runAgent } from "./agent.ts";
import { log, withLogContext } from "./log.ts";
import type { ChatEvent } from "./protocol.ts";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "\nANTHROPIC_API_KEY is not set.\nCopy .env.example to .env and add your key, then run `npm run dev` again.\n",
  );
  process.exit(1);
}

const app = express();
app.use(express.json());

app.post("/api/chat", (req, res) => {
  // Every log line for this request carries its id, so one question's logs can be pulled together.
  const requestId = randomUUID().slice(0, 8);
  return withLogContext({ requestId }, async () => {
    const message = String(req.body.message ?? "");
    const startedAt = Date.now();
    log.info("chat_started", { message });

    // Stream progress so the UI can show what the agent is doing while it works.
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.flushHeaders();
    const send = (event: ChatEvent) => res.write(`${JSON.stringify(event)}\n`);

    try {
      const result = await runAgent(message, (event) => {
        switch (event.type) {
          case "iteration":
            log.info("iteration", { n: event.n });
            break;
          case "tool_start":
            log.info("tool_start", { tool: event.name, input: event.input });
            break;
          case "tool_end":
            log.info("tool_end", { tool: event.name, ms: event.ms });
            break;
          case "tool_failed":
            log.warn("tool_failed", { tool: event.name, message: event.message });
            break;
        }
        send(event);
      });

      send({ type: "answer", answer: result.answer });
      log.info("chat_finished", { ms: Date.now() - startedAt, modelCalls: result.iterations, ...result.usage });
    } catch (err) {
      log.error("chat_failed", { ms: Date.now() - startedAt, error: err });
      send({ type: "error", message: `${String(err)} (reference ${requestId})` });
    }
    res.end();
  });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  log.info("server_listening", { url: `http://localhost:${port}` });
});
