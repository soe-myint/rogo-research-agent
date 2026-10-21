/**
 * Structured logs: one JSON object per line, so they can be searched and shipped as-is.
 * Errors are also appended to logs/errors.jsonl for later review. In production, the
 * JSON output would go to Datadog and errors to Sentry; this module is where to wire them in.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

type Fields = Record<string, unknown>;
type Level = "info" | "warn" | "error";

const context = new AsyncLocalStorage<Fields>();

/** Runs `fn` with `fields` (e.g. a request id) added to every entry logged inside it. */
export function withLogContext<T>(fields: Fields, fn: () => T): T {
  return context.run(fields, fn);
}

function write(level: Level, event: string, fields: Fields = {}): void {
  const entry = { time: new Date().toISOString(), level, ...context.getStore(), event, ...fields };
  // JSON.stringify drops an Error's fields; keep what's needed to debug it.
  const line = JSON.stringify(entry, (_key, value) =>
    value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value,
  );
  if (level === "error") {
    console.error(line);
    appendToErrorFile(line);
  } else {
    console.log(line);
  }
}

function appendToErrorFile(line: string): void {
  const file = process.env.ROGO_ERROR_LOG ?? "logs/errors.jsonl"; // empty turns it off
  if (!file) return;
  try {
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${line}\n`);
  } catch (err) {
    console.error("could not write to the error log", err); // logging must never fail a request
  }
}

export const log = {
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
