import "dotenv/config";
import express from "express";
import { runAgent } from "./agent.ts";
import type { ChatEvent } from "./protocol.ts";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "\nANTHROPIC_API_KEY is not set.\nCopy .env.example to .env and add your key, then run `npm run dev` again.\n",
  );
  process.exit(1);
}

const app = express();
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  const message = String(req.body.message ?? "");
  console.log(`\n[chat] ${message}`);

  // Stream progress so the UI can show what the agent is doing while it works.
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();
  const send = (event: ChatEvent) => res.write(`${JSON.stringify(event)}\n`);

  try {
    const result = await runAgent(message, (event) => {
      switch (event.type) {
        case "iteration":
          console.log(`[agent] iteration ${event.n}`);
          break;
        case "tool_start":
          console.log(`[tool]  → ${event.name} ${JSON.stringify(event.input)}`);
          break;
        case "tool_end":
          console.log(`[tool]  ← ${event.name} (${event.ms}ms)`);
          break;
        case "tool_failed":
          console.log(`[tool]  ! ${event.name}: ${event.message}`);
          break;
        case "editing":
          console.log(`[agent] editing draft`);
          break;
      }
      send(event);
    });

    send({ type: "answer", answer: result.answer });
  } catch (err) {
    console.error(err);
    send({ type: "error", message: String(err) });
  }
  res.end();
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Agent server listening on http://localhost:${port}`);
});
