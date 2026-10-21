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

const REQUEST_TIMEOUT_MS = Number(process.env.ROGO_TIMEOUT_MS ?? 120_000);

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

    // Stop the agent (and its model calls) if the user goes away or the request runs too long.
    const disconnected = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) disconnected.abort();
    });
    const signal = AbortSignal.any([disconnected.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);

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
      }, { signal });

      send({ type: "answer", answer: result.answer });
      log.info("chat_finished", { ms: Date.now() - startedAt, modelCalls: result.iterations, ...result.usage });
    } catch (err) {
      const ms = Date.now() - startedAt;
      if (disconnected.signal.aborted) {
        log.info("chat_cancelled", { ms });
      } else if (signal.aborted) {
        log.warn("chat_timed_out", { ms });
        send({
          type: "error",
          message: `This took longer than ${REQUEST_TIMEOUT_MS / 1000}s, so I stopped. Try a narrower question. (reference ${requestId})`,
        });
      } else {
        log.error("chat_failed", { ms, error: err });
        send({ type: "error", message: `${String(err)} (reference ${requestId})` });
      }
    }
    res.end();
  });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  log.info("server_listening", { url: `http://localhost:${port}` });
});
