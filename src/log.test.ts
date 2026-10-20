import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { log, withLogContext } from "./log.ts";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("log", () => {
  it("writes one JSON line carrying the request's context, even across awaits", async () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    await withLogContext({ requestId: "r-1" }, async () => {
      await Promise.resolve();
      log.info("tool_start", { tool: "getFinancials" });
    });

    expect(JSON.parse(out.mock.calls[0][0])).toMatchObject({
      level: "info",
      requestId: "r-1",
      event: "tool_start",
      tool: "getFinancials",
    });
  });

  it("keeps an error's stack and appends only errors to the error file", () => {
    const file = join(mkdtempSync(join(tmpdir(), "rogo-log-")), "errors.jsonl");
    vi.stubEnv("ROGO_ERROR_LOG", file);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    log.info("chat_started");
    log.error("tool_crashed", { error: new TypeError("boom") });

    const lines = readFileSync(file, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: "error", event: "tool_crashed", error: { name: "TypeError", message: "boom" } });
    expect(lines[0].error.stack).toContain("TypeError: boom");
  });
});
