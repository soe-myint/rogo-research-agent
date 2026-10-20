import { useEffect, useRef, useState } from "react";
import { applyEvent, initialProgress, readEvents, type Progress } from "./progress.ts";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const EXAMPLES = [
  "Compare Acme and Globex and tell me which one appears to be growing faster.",
  "What are the biggest risks Umbrella Health flags in its filings?",
  "How is Initech's subscription transition going?",
  "Which company in the universe is growing fastest?",
];

export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress>(initialProgress);

  async function send(question: string) {
    if (!question.trim() || busy) return;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setProgress(initialProgress);
    setBusy(true);

    let reply = "Something went wrong: the server stopped responding before it finished.";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      if (!res.ok || !res.body) throw new Error(`server returned ${res.status}`);

      for await (const event of readEvents(res.body)) {
        if (event.type === "answer") reply = event.answer;
        else if (event.type === "error") reply = `Something went wrong: ${event.message}`;
        else setProgress((prev) => applyEvent(prev, event));
      }
    } catch (err) {
      reply = `Something went wrong: ${String(err)}`;
    }

    setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    setBusy(false);
  }

  return (
    <div className="app">
      <header>
        <h1>Rogo Research</h1>
        <p>Ask a question about a company in our coverage universe.</p>
      </header>

      <div className="transcript">
        {messages.length === 0 && (
          <div className="examples">
            {EXAMPLES.map((example) => (
              <button key={example} onClick={() => send(example)}>
                {example}
              </button>
            ))}
          </div>
        )}

        {messages.map((message, i) => (
          <div key={i} className={`bubble ${message.role}`}>
            {message.text}
          </div>
        ))}

        {busy && <PendingBubble progress={progress} />}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a research question…"
          disabled={busy}
        />
        <button type="submit" disabled={busy}>
          Send
        </button>
      </form>
    </div>
  );
}

/** Seconds since the calling component mounted, ticking once a second. */
function useElapsedSeconds(): number {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return Math.floor((now - startedAt) / 1000);
}

function PendingBubble({ progress }: { progress: Progress }) {
  const elapsed = useElapsedSeconds();
  const ref = useRef<HTMLDivElement>(null);

  // Keep the newest step in view as the list grows.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [progress.steps.length, progress.phase]);

  return (
    <div ref={ref} className="bubble assistant pending" role="status">
      <div className="phase">
        <span className="spinner" aria-hidden="true" />
        <span>{progress.phase}…</span>
        <span className="elapsed" aria-hidden="true">
          {elapsed}s
        </span>
      </div>

      {progress.steps.length > 0 && (
        <ol className="steps">
          {progress.steps.map((step) => (
            <li key={step.id} className={step.status} title={step.error}>
              {step.status === "running" ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <span className="icon" aria-hidden="true">
                  {step.status === "done" ? "✓" : "✕"}
                </span>
              )}
              <span className="label">{step.label}</span>
              {step.ms !== undefined && (
                <span className="ms">{(step.ms / 1000).toFixed(1)}s</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
